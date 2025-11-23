/*
  # Add max_clients Support to generate_free_time_slots

  ## Overview
  Updates the `generate_free_time_slots` function to respect the `max_clients` capacity
  from availability_blocks. This allows multiple clients to book the same time slot
  up to the defined capacity, instead of treating every slot as capacity = 1.

  ## Changes

  ### 1. Updated Function Logic
  - Reads `max_clients` from each availability_block
  - For each candidate time slot:
    - Counts how many overlapping scheduled appointments exist
    - Only rejects the slot if overlap_count >= effective_capacity
    - Effective capacity = COALESCE(max_clients, 1)
  - Behavior unchanged when max_clients = 1 (backwards compatible)

  ### 2. Capacity Check Algorithm
  - For each time slot (start to start + service_duration):
    - Query all scheduled appointments on the same date/barber
    - Count appointments that overlap using:
      - slot_start < appointment_end AND slot_end > appointment_start
    - If overlap_count < max_clients → slot is available
    - If overlap_count >= max_clients → slot is fully booked

  ### 3. Function Signature
  - **NO CHANGE** to function signature or return type
  - Parameters: (p_barber_id uuid, p_business_id uuid, p_date date, p_service_duration integer)
  - Returns: jsonb with { free_slots: [...] }

  ## Security
  - Maintains existing RLS policies
  - Maintains existing GRANT permissions for authenticated and anon roles

  ## Notes
  - When max_clients = 1: behaves exactly as before (one appointment blocks the slot)
  - When max_clients > 1: allows multiple concurrent bookings up to capacity
  - Only 'scheduled' appointments count toward capacity
  - Cancelled/completed appointments don't block slots
*/

-- Redefine the function with max_clients support
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
  v_free_slots        text[] := '{}';
  v_slot_end_time     time;
  v_block             record;
  v_current_time      time;
  v_effective_capacity integer;
  v_overlap_count     integer;
BEGIN
  v_free_slots := '{}';

  -- Loop through all availability blocks for this business/date/barber
  -- Includes blocks for specific barber AND blocks for all barbers (barber_id IS NULL)
  FOR v_block IN
    SELECT start_time, end_time, COALESCE(max_clients, 1) as block_capacity
    FROM availability_blocks
    WHERE business_id = p_business_id
      AND (barber_id = p_barber_id OR barber_id IS NULL)
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
          AND barber_id = p_barber_id
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

-- Maintain existing permissions
GRANT EXECUTE ON FUNCTION generate_free_time_slots(uuid, uuid, date, integer)
  TO authenticated, anon;