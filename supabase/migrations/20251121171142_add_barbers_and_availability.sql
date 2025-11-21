/*
  # Add Barbers and Availability Management

  ## Overview
  This migration adds support for managing multiple barbers and their availability schedules,
  enabling appointment booking per barber and time slot management.

  ## New Tables

  ### `barbers`
  Stores information about barbers working at each business.
  - `id` (uuid, primary key) - Unique identifier for the barber
  - `business_id` (uuid, foreign key) - References the business this barber belongs to
  - `name` (text) - Full name of the barber
  - `active` (boolean) - Whether the barber is currently active/available for bookings

  ### `availability_blocks`
  Defines time slots when barbers are available for appointments.
  - `id` (uuid, primary key) - Unique identifier for the availability block
  - `business_id` (uuid, foreign key) - References the business
  - `barber_id` (uuid, foreign key, nullable) - References the barber (null = any barber)
  - `date` (date) - The date for this availability block
  - `start_time` (time) - Start time of the availability window
  - `end_time` (time) - End time of the availability window
  - `max_clients` (int) - Maximum number of concurrent clients during this block

  ## Table Modifications

  ### `appointments`
  - Add `barber_id` (uuid, nullable) - References the barber assigned to this appointment
  - Add `source` (text) - Tracks where the appointment came from (default: 'internal')

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users to access their business data only
  - Policies check business ownership through business.owner_id

  ## Indexes
  - Index on `availability_blocks(business_id, date)` for efficient date-based lookups
*/

-- Create barbers table
CREATE TABLE IF NOT EXISTS barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on barbers
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for barbers
CREATE POLICY "Users can view barbers from their business"
  ON barbers FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert barbers for their business"
  ON barbers FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update barbers from their business"
  ON barbers FOR UPDATE
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

CREATE POLICY "Users can delete barbers from their business"
  ON barbers FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Create availability_blocks table
CREATE TABLE IF NOT EXISTS availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_clients int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_availability_blocks_business_date
  ON availability_blocks(business_id, date);

-- Enable RLS on availability_blocks
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_blocks
CREATE POLICY "Users can view availability blocks from their business"
  ON availability_blocks FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert availability blocks for their business"
  ON availability_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update availability blocks from their business"
  ON availability_blocks FOR UPDATE
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

CREATE POLICY "Users can delete availability blocks from their business"
  ON availability_blocks FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Alter appointments table to add barber_id and source columns
DO $$
BEGIN
  -- Add barber_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'barber_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL;
  END IF;

  -- Add source column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'source'
  ) THEN
    ALTER TABLE appointments ADD COLUMN source text DEFAULT 'internal';
  END IF;
END $$;