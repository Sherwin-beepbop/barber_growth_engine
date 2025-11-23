/*
  # Update generate_free_time_slots for Staff Model

  ## Overview
  Updates the `generate_free_time_slots` RPC function to use staff-based naming
  instead of barber-based naming. This aligns with the refactoring from barbers
  to staff_members.

  ## Changes

  ### 1. Function Signature
  - Parameter renamed: `p_barber_id` → `p_staff_id`
  - All other parameters unchanged
  - Return type unchanged: jsonb with { free_slots: [...] }

  ### 2. Function Body
  - All references to `barber_id` updated to `staff_id`
  - Table references updated to use `staff_members` (via FK relationships)
  - Logic and behavior unchanged

  ### 3. Backwards Compatibility
  - The old function signature is replaced
  - Frontend code must update to use `p_staff_id` parameter

  ## Security
  - Maintains existing GRANT permissions for authenticated and anon roles
*/

-- Drop the old function signature
DROP FUNCTION IF EXISTS generate_free_time_slots(uuid, uuid, date, integer);

-- Create the function with new staff-based naming
CREATE OR REPLACE FUNCTION generate_free_time_slots(
  p_staff_id uuid,
  p_business_id uuid,
  p_date date,
  p_service_duration integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_free_slots        text[] := '{}';
  v_slot_end_time     time;
  v_block             record;
  v_current_time      time;
  v_effective_capacity integer;
  v_overlap_count     integer;
BEGIN
  v_free_slots := '{}';

  -- Loop through all availability blocks for this business/date/staff member
  -- Includes blocks for specific staff AND blocks for all staff (staff_id IS NULL)
  FOR v_block IN
    SELECT start_time, end_time, COALESCE(max_clients, 1) as block_capacity
    FROM availability_blocks
    WHERE business_id = p_business_id
      AND (staff_id = p_staff_id OR staff_id IS NULL)
      AND date = p_date
    ORDER BY start_time
  LOOP
    v_current_time := v_block.start_time;
    v_effective_capacity := v_block.block_capacity;

    -- Generate 15-minute time slots within this availability block
    WHILE v_current_time < v_block.end_time LOOP
      -- Calculate end time for this candidate slot
      v_slot_end_time := v_current_time + (p_service_duration || ' minutes')::interval;

      -- Slot must fully fit inside the availability block
      IF v_slot_end_time <= v_block.end_time THEN

        -- Count how many scheduled appointments overlap with this slot
        SELECT COUNT(*) INTO v_overlap_count
        FROM appointments
        WHERE business_id = p_business_id
          AND staff_id = p_staff_id
          AND appointment_date = p_date
          AND status = 'scheduled'
          -- Overlap condition: slot_start < appt_end AND slot_end > appt_start
          AND v_current_time < (appointment_time + (duration_minutes || ' minutes')::interval)
          AND v_slot_end_time > appointment_time;

        -- Only add slot if capacity is not exceeded
        IF v_overlap_count < v_effective_capacity THEN
          v_free_slots := array_append(v_free_slots, to_char(v_current_time, 'HH24:MI'));
        END IF;
      END IF;

      -- Move to next 15-minute interval
      v_current_time := v_current_time + interval '15 minutes';
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('free_slots', to_jsonb(v_free_slots));
END;
$$;

-- Grant execute permissions for both authenticated and anon roles
GRANT EXECUTE ON FUNCTION generate_free_time_slots(uuid, uuid, date, integer)
  TO authenticated, anon;