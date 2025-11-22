/*
  # Fix generate_free_time_slots Function Signature

  ## Overview
  Fixes the parameter order for `generate_free_time_slots` to match Supabase REST API expectations.
  The REST API alphabetically sorts parameter names when looking up functions, so we need:
  (p_barber_id, p_business_id, p_date, p_service_duration) instead of
  (p_business_id, p_barber_id, p_date, p_service_duration)

  ## Changes

  ### 1. Redefine Function with Correct Parameter Order
  - Parameter order changed to: p_barber_id, p_business_id, p_date, p_service_duration
  - Function logic remains identical
  - All internal references use correct variable names

  ### 2. Re-grant Execute Permissions
  - Ensure both authenticated and anon roles can execute
  - Safe to run again even if already granted

  ## Notes
  - This fixes the "Could not find the function" error
  - No changes to function logic or return value
  - RLS policy on appointments already exists from previous migration
*/

-- 1. Redefine the function with correct parameter order
CREATE OR REPLACE FUNCTION generate_free_time_slots(
  p_barber_id uuid,
  p_business_id uuid,
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
