/*
  # Refactor Barbers to Staff Members

  ## Overview
  Refactors the database from barber-specific naming to a generic staff model,
  making the application suitable for any appointment-based business (barbershops,
  salons, nail studios, beauty clinics, etc.).

  ## Changes

  ### 1. Rename Tables
  - `barbers` → `staff_members`
  - `barber_weekly_schedules` → `staff_weekly_schedules`

  ### 2. Rename Columns
  - `appointments.barber_id` → `appointments.staff_id`
  - `availability_blocks.barber_id` → `availability_blocks.staff_id`
  - `staff_weekly_schedules.barber_id` → `staff_weekly_schedules.staff_id`

  ### 3. Update Foreign Keys
  - All foreign key constraints referencing barbers now reference staff_members
  - All column references updated to use staff_id

  ### 4. Update RLS Policies
  - All RLS policies updated to reference new table and column names
  - Security rules remain unchanged, only names updated

  ### 5. Update Indexes
  - All indexes updated to reference new table and column names

  ## Data Safety
  - Uses ALTER TABLE RENAME to preserve all existing data
  - No data is dropped or recreated
  - All constraints and relationships maintained
  - Backwards compatible with existing data

  ## Notes
  - RPC functions will be updated in a separate migration
  - All existing data and relationships are preserved
  - This is a pure rename operation with no behavioral changes
*/

-- ============================================================================
-- STEP 1: Rename the main tables
-- ============================================================================

-- Rename barbers table to staff_members
ALTER TABLE barbers RENAME TO staff_members;

-- Rename barber_weekly_schedules to staff_weekly_schedules
ALTER TABLE barber_weekly_schedules RENAME TO staff_weekly_schedules;

-- ============================================================================
-- STEP 2: Rename columns in related tables
-- ============================================================================

-- Rename barber_id to staff_id in appointments table
ALTER TABLE appointments RENAME COLUMN barber_id TO staff_id;

-- Rename barber_id to staff_id in availability_blocks table
ALTER TABLE availability_blocks RENAME COLUMN barber_id TO staff_id;

-- Rename barber_id to staff_id in staff_weekly_schedules table
ALTER TABLE staff_weekly_schedules RENAME COLUMN barber_id TO staff_id;

-- ============================================================================
-- STEP 3: Rename foreign key constraints
-- ============================================================================

-- Update appointments foreign key
ALTER TABLE appointments 
  DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;

ALTER TABLE appointments 
  ADD CONSTRAINT appointments_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff_members(id) ON DELETE SET NULL;

-- Update availability_blocks foreign key
ALTER TABLE availability_blocks 
  DROP CONSTRAINT IF EXISTS availability_blocks_barber_id_fkey;

ALTER TABLE availability_blocks 
  ADD CONSTRAINT availability_blocks_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff_members(id) ON DELETE CASCADE;

-- Update staff_weekly_schedules foreign key
ALTER TABLE staff_weekly_schedules 
  DROP CONSTRAINT IF EXISTS barber_weekly_schedules_barber_id_fkey;

ALTER TABLE staff_weekly_schedules 
  ADD CONSTRAINT staff_weekly_schedules_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff_members(id) ON DELETE CASCADE;

-- Update business foreign key reference
ALTER TABLE staff_members 
  DROP CONSTRAINT IF EXISTS barbers_business_id_fkey;

ALTER TABLE staff_members 
  ADD CONSTRAINT staff_members_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- Update staff_weekly_schedules business foreign key
ALTER TABLE staff_weekly_schedules 
  DROP CONSTRAINT IF EXISTS barber_weekly_schedules_business_id_fkey;

ALTER TABLE staff_weekly_schedules 
  ADD CONSTRAINT staff_weekly_schedules_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: Update RLS Policies
-- ============================================================================

-- Drop old policies on staff_members (formerly barbers)
DROP POLICY IF EXISTS "Users can view barbers in their businesses" ON staff_members;
DROP POLICY IF EXISTS "Users can insert barbers in their businesses" ON staff_members;
DROP POLICY IF EXISTS "Users can update barbers in their businesses" ON staff_members;
DROP POLICY IF EXISTS "Users can delete barbers in their businesses" ON staff_members;
DROP POLICY IF EXISTS "Anonymous users can view active barbers for public booking" ON staff_members;

-- Create new policies on staff_members
CREATE POLICY "Users can view staff in their businesses"
  ON staff_members FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert staff in their businesses"
  ON staff_members FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update staff in their businesses"
  ON staff_members FOR UPDATE
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

CREATE POLICY "Users can delete staff in their businesses"
  ON staff_members FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous users can view active staff for public booking"
  ON staff_members FOR SELECT
  TO anon
  USING (active = true);

-- Drop old policies on staff_weekly_schedules (formerly barber_weekly_schedules)
DROP POLICY IF EXISTS "Users can view barber schedules in their businesses" ON staff_weekly_schedules;
DROP POLICY IF EXISTS "Users can insert barber schedules in their businesses" ON staff_weekly_schedules;
DROP POLICY IF EXISTS "Users can update barber schedules in their businesses" ON staff_weekly_schedules;
DROP POLICY IF EXISTS "Users can delete barber schedules in their businesses" ON staff_weekly_schedules;

-- Create new policies on staff_weekly_schedules
CREATE POLICY "Users can view staff schedules in their businesses"
  ON staff_weekly_schedules FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert staff schedules in their businesses"
  ON staff_weekly_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update staff schedules in their businesses"
  ON staff_weekly_schedules FOR UPDATE
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

CREATE POLICY "Users can delete staff schedules in their businesses"
  ON staff_weekly_schedules FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: Update Indexes (if any exist)
-- ============================================================================

-- Note: PostgreSQL automatically updates index names when tables are renamed,
-- but we'll ensure any custom indexes are properly named

-- Check and rename any custom indexes if they exist
DO $$
BEGIN
  -- Rename barbers indexes to staff_members
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_barbers_business_id') THEN
    ALTER INDEX idx_barbers_business_id RENAME TO idx_staff_members_business_id;
  END IF;

  -- Rename barber_weekly_schedules indexes to staff_weekly_schedules
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_barber_weekly_schedules_barber_id') THEN
    ALTER INDEX idx_barber_weekly_schedules_barber_id RENAME TO idx_staff_weekly_schedules_staff_id;
  END IF;
END $$;