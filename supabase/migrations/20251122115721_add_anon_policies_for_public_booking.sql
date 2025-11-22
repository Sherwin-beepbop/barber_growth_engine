/*
  # Add Anonymous RLS Policies for Public Booking

  ## Overview
  This migration adds RLS policies to allow anonymous (unauthenticated) users to access
  the public booking funnel for businesses that have `booking_mode = 'online'`.

  ## Changes

  ### 1. businesses table
  - Add SELECT policy for anon role
  - Allows viewing ONLY businesses with `booking_mode = 'online'`

  ### 2. barbers table
  - Add SELECT policy for anon role
  - Allows viewing barbers for businesses with `booking_mode = 'online'`

  ### 3. availability_blocks table
  - Add SELECT policy for anon role
  - Allows viewing availability for businesses with `booking_mode = 'online'`

  ### 4. customers table
  - Add SELECT policy for anon role (lookup existing customers)
  - Add INSERT policy for anon role (create new customers during booking)
  - Both restricted to businesses with `booking_mode = 'online'`

  ## Security Notes
  - All policies are restrictive: anon users can ONLY access data for businesses
    that explicitly enable online booking
  - Existing authenticated policies remain unchanged
  - No data leakage for internal_only businesses
*/

-- 1. businesses table: Allow anon to view online booking businesses
CREATE POLICY "Public can view online booking businesses"
  ON businesses FOR SELECT
  TO anon
  USING (booking_mode = 'online');

-- 2. barbers table: Allow anon to view barbers for online booking businesses
CREATE POLICY "Public can view barbers for online booking"
  ON barbers FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = barbers.business_id
      AND businesses.booking_mode = 'online'
    )
  );

-- 3. availability_blocks table: Allow anon to view availability for online booking businesses
CREATE POLICY "Public can view availability for online booking"
  ON availability_blocks FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = availability_blocks.business_id
      AND businesses.booking_mode = 'online'
    )
  );

-- 4. customers table: Allow anon to lookup and create customers for online booking businesses
CREATE POLICY "Public can view customers for online booking"
  ON customers FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = customers.business_id
      AND businesses.booking_mode = 'online'
    )
  );

CREATE POLICY "Public can create customers for online booking"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = customers.business_id
      AND businesses.booking_mode = 'online'
    )
  );
