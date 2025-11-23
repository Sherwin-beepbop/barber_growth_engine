/*
  # Add Barber Weekly Schedules (Roster System)

  1. New Tables
    - `barber_weekly_schedules`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `barber_id` (uuid, references barbers)
      - `weekday` (integer 0-6, where 0=Sunday, 6=Saturday)
      - `work_start_time` (time)
      - `work_end_time` (time)
      - `break_start_time` (time, nullable)
      - `break_end_time` (time, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `sync_barber_schedules_to_availability` - Generates availability_blocks from weekly schedules

  3. Security
    - Enable RLS on `barber_weekly_schedules` table
    - Add policies for authenticated users to manage their business schedules

  4. Notes
    - Weekday uses integer 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday) to match PostgreSQL's extract(dow)
    - Break times are optional; if null, no break is applied
    - This supplements existing availability_blocks, doesn't replace it
*/

-- Create the barber_weekly_schedules table
CREATE TABLE IF NOT EXISTS barber_weekly_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  work_start_time time NOT NULL,
  work_end_time time NOT NULL,
  break_start_time time,
  break_end_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_work_hours CHECK (work_end_time > work_start_time),
  CONSTRAINT valid_break_hours CHECK (
    (break_start_time IS NULL AND break_end_time IS NULL) OR
    (break_start_time IS NOT NULL AND break_end_time IS NOT NULL AND 
     break_end_time > break_start_time AND
     break_start_time >= work_start_time AND
     break_end_time <= work_end_time)
  )
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_barber_weekly_schedules_business 
  ON barber_weekly_schedules(business_id);
CREATE INDEX IF NOT EXISTS idx_barber_weekly_schedules_barber 
  ON barber_weekly_schedules(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_weekly_schedules_weekday 
  ON barber_weekly_schedules(weekday) WHERE is_active = true;

-- Enable RLS
ALTER TABLE barber_weekly_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view schedules for their business"
  ON barber_weekly_schedules
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert schedules for their business"
  ON barber_weekly_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update schedules for their business"
  ON barber_weekly_schedules
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schedules for their business"
  ON barber_weekly_schedules
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Function to sync weekly schedules to availability_blocks
CREATE OR REPLACE FUNCTION sync_barber_schedules_to_availability(
  p_business_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule record;
  v_current_date date;
  v_day_of_week integer;
  v_blocks_created integer := 0;
  v_blocks_skipped integer := 0;
BEGIN
  -- Validate date range
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date';
  END IF;

  -- Verify the user owns this business
  IF NOT EXISTS (
    SELECT 1 FROM businesses 
    WHERE id = p_business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this business';
  END IF;

  -- Loop through each active weekly schedule
  FOR v_schedule IN
    SELECT 
      barber_id,
      weekday,
      work_start_time,
      work_end_time,
      break_start_time,
      break_end_time
    FROM barber_weekly_schedules
    WHERE business_id = p_business_id
      AND is_active = true
  LOOP
    -- Loop through each date in the range
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
      -- Get day of week (0=Sunday, 6=Saturday)
      v_day_of_week := EXTRACT(DOW FROM v_current_date)::integer;

      -- If this date matches the schedule's weekday
      IF v_day_of_week = v_schedule.weekday THEN
        -- Check if break exists
        IF v_schedule.break_start_time IS NOT NULL AND v_schedule.break_end_time IS NOT NULL THEN
          -- Create two blocks: before break and after break
          
          -- Block 1: work_start to break_start
          IF NOT EXISTS (
            SELECT 1 FROM availability_blocks
            WHERE business_id = p_business_id
              AND barber_id = v_schedule.barber_id
              AND date = v_current_date
              AND start_time = v_schedule.work_start_time
              AND end_time = v_schedule.break_start_time
          ) THEN
            INSERT INTO availability_blocks (
              business_id,
              barber_id,
              date,
              start_time,
              end_time
            ) VALUES (
              p_business_id,
              v_schedule.barber_id,
              v_current_date,
              v_schedule.work_start_time,
              v_schedule.break_start_time
            );
            v_blocks_created := v_blocks_created + 1;
          ELSE
            v_blocks_skipped := v_blocks_skipped + 1;
          END IF;

          -- Block 2: break_end to work_end
          IF NOT EXISTS (
            SELECT 1 FROM availability_blocks
            WHERE business_id = p_business_id
              AND barber_id = v_schedule.barber_id
              AND date = v_current_date
              AND start_time = v_schedule.break_end_time
              AND end_time = v_schedule.work_end_time
          ) THEN
            INSERT INTO availability_blocks (
              business_id,
              barber_id,
              date,
              start_time,
              end_time
            ) VALUES (
              p_business_id,
              v_schedule.barber_id,
              v_current_date,
              v_schedule.break_end_time,
              v_schedule.work_end_time
            );
            v_blocks_created := v_blocks_created + 1;
          ELSE
            v_blocks_skipped := v_blocks_skipped + 1;
          END IF;
        ELSE
          -- No break: create one block for entire work period
          IF NOT EXISTS (
            SELECT 1 FROM availability_blocks
            WHERE business_id = p_business_id
              AND barber_id = v_schedule.barber_id
              AND date = v_current_date
              AND start_time = v_schedule.work_start_time
              AND end_time = v_schedule.work_end_time
          ) THEN
            INSERT INTO availability_blocks (
              business_id,
              barber_id,
              date,
              start_time,
              end_time
            ) VALUES (
              p_business_id,
              v_schedule.barber_id,
              v_current_date,
              v_schedule.work_start_time,
              v_schedule.work_end_time
            );
            v_blocks_created := v_blocks_created + 1;
          ELSE
            v_blocks_skipped := v_blocks_skipped + 1;
          END IF;
        END IF;
      END IF;

      v_current_date := v_current_date + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'blocks_created', v_blocks_created,
    'blocks_skipped', v_blocks_skipped,
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    )
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_barber_schedules_to_availability(uuid, date, date) 
  TO authenticated;