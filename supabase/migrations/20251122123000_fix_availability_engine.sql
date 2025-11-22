/*
  # Fix Availability Engine

  ## Overview
  This migration fixes the availability engine to correctly generate free time slots
  for both public booking (anon) and internal booking (authenticated).

  ## Changes

  ### 1. Replace generate_free_time_slots Function
  - Fix logic to handle NULL barber_id (availability blocks for all barbers)
  - Ensure proper overlap detection with existing appointments
  - Generate correct 15-minute intervals

  ### 2. Grant Execute Permissions
  - Grant EXECUTE to both authenticated and anon roles
  - Allows public booking to call the RPC function

  ### 3. Add RLS Policy for Appointments
  - Allow anon to read appointments for online booking businesses
  - Required for the function to check existing appointments
  - Restricted to businesses with booking_mode = 'online'

  ## Notes
  - Function returns JSONB: {"free_slots": ["10:00", "10:15", ...]}
  - All times in HH24:MI format (local time, no UTC conversion)
  - 15-minute interval granularity
*/

-- 1. Replace the function with fixed implementation
CREATE OR REPLACE FUNCTION generate_free_time_slots(
  p_business_id uuid,
  p_barber_id uuid,
  p_date date,
  p_service_duration integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_free_slots     text[] := '{}';
  v_slot_end_time  time;
  v_block          record;
  v_is_available   boolean;
  v_appointment    record;
  v_current_time   time;
  v_appt_end_time  time;
BEGIN
  v_free_slots := '{}';

  -- All availability blocks for this business and date,
  -- including blocks that apply to all barbers (barber_id IS NULL).
  FOR v_block IN
    SELECT start_time, end_time
    FROM availability_blocks
    WHERE business_id = p_business_id
      AND (barber_id = p_barber_id OR barber_id IS NULL)
      AND date = p_date
    ORDER BY start_time
  LOOP
    v_current_time := v_block.start_time;

    WHILE v_current_time < v_block.end_time LOOP
      -- End of this candidate slot = start + service duration
      v_slot_end_time := v_current_time + (p_service_duration || ' minutes')::interval;

      -- Slot must fully fit inside the availability block
      IF v_slot_end_time <= v_block.end_time THEN
        v_is_available := true;

        -- Check overlap with existing scheduled appointments
        FOR v_appointment IN
          SELECT appointment_time, duration_minutes
          FROM appointments
          WHERE business_id = p_business_id
            AND barber_id = p_barber_id
            AND appointment_date = p_date
            AND status = 'scheduled'
        LOOP
          v_appt_end_time := v_appointment.appointment_time
                             + (v_appointment.duration_minutes || ' minutes')::interval;

          -- Overlap if slot starts before appointment ends AND
          -- slot ends after appointment starts
          IF (v_current_time < v_appt_end_time)
             AND (v_slot_end_time > v_appointment.appointment_time) THEN
            v_is_available := false;
            EXIT;
          END IF;
        END LOOP;

        -- Only add slot if it is still available
        IF v_is_available THEN
          v_free_slots := array_append(v_free_slots, to_char(v_current_time, 'HH24:MI'));
        END IF;
      END IF;

      -- Move to next 15-minute step
      v_current_time := v_current_time + interval '15 minutes';
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('free_slots', to_jsonb(v_free_slots));
END;
$$;

-- 2. Grant execute permissions for both authenticated and anon roles
GRANT EXECUTE ON FUNCTION generate_free_time_slots(uuid, uuid, date, integer)
  TO authenticated, anon;

-- 3. Add RLS policy so anon can read appointments for online booking businesses
CREATE POLICY "Public can view appointments for online booking"
  ON appointments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM businesses
      WHERE businesses.id = appointments.business_id
        AND businesses.booking_mode = 'online'
    )
  );
