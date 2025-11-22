/*
  # Create RPC Function: generate_free_time_slots

  ## Overview
  This migration creates a server-side function to generate available appointment time slots
  based on barber availability blocks and existing appointments.

  ## Function: generate_free_time_slots

  ### Inputs
  - `p_business_id` (uuid) - The business ID
  - `p_barber_id` (uuid) - The barber ID
  - `p_date` (date) - The appointment date
  - `p_service_duration` (integer) - Service duration in minutes

  ### Logic
  1. Query all availability_blocks for the given business, barber, and date
  2. Generate 15-minute intervals from each availability block
  3. Create time slot windows based on service duration
  4. Query existing scheduled appointments for that barber on that date
  5. Remove slots that overlap with existing appointments
  6. Return array of available time slots in HH:MI format

  ### Output
  Returns JSON object:
  ```json
  {
    "free_slots": ["10:00", "10:15", "10:30", ...]
  }
  ```

  ## Notes
  - All times are handled in local time (no UTC conversion)
  - Slots are generated at 15-minute intervals
  - A slot is available if the entire service duration fits without overlapping appointments
*/

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
  v_free_slots text[] := '{}';
  v_slot_time time;
  v_slot_end_time time;
  v_block record;
  v_is_available boolean;
  v_appointment record;
  v_current_time time;
BEGIN
  -- Loop through all availability blocks for this barber on this date
  FOR v_block IN
    SELECT start_time, end_time
    FROM availability_blocks
    WHERE business_id = p_business_id
      AND barber_id = p_barber_id
      AND date = p_date
    ORDER BY start_time
  LOOP
    -- Generate 15-minute interval slots within this block
    v_current_time := v_block.start_time;

    WHILE v_current_time < v_block.end_time LOOP
      -- Calculate when this slot would end (current time + service duration)
      v_slot_end_time := v_current_time + (p_service_duration || ' minutes')::interval;

      -- Check if the slot + service duration fits within the availability block
      IF v_slot_end_time <= v_block.end_time THEN
        -- Check if this slot overlaps with any existing appointments
        v_is_available := true;

        FOR v_appointment IN
          SELECT appointment_time, duration_minutes
          FROM appointments
          WHERE business_id = p_business_id
            AND barber_id = p_barber_id
            AND appointment_date = p_date
            AND status = 'scheduled'
        LOOP
          -- Check for overlap:
          -- Slot overlaps if it starts before appointment ends AND ends after appointment starts
          DECLARE
            v_appt_end_time time;
          BEGIN
            v_appt_end_time := v_appointment.appointment_time + (v_appointment.duration_minutes || ' minutes')::interval;

            IF (v_current_time < v_appt_end_time) AND (v_slot_end_time > v_appointment.appointment_time) THEN
              v_is_available := false;
              EXIT; -- No need to check more appointments
            END IF;
          END;
        END LOOP;

        -- If slot is available, add it to the result
        IF v_is_available THEN
          v_free_slots := array_append(v_free_slots, to_char(v_current_time, 'HH24:MI'));
        END IF;
      END IF;

      -- Move to next 15-minute interval
      v_current_time := v_current_time + interval '15 minutes';
    END LOOP;
  END LOOP;

  -- Return as JSON
  RETURN jsonb_build_object('free_slots', to_jsonb(v_free_slots));
END;
$$;
