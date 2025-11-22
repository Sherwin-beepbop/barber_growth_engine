# Availability Engine Fix

## Problem
Time slots were not showing in either public or internal booking despite availability blocks being configured.

## Root Causes Identified

1. **Missing EXECUTE Permissions**: The `generate_free_time_slots` function existed but wasn't granted EXECUTE permission to `anon` and `authenticated` roles
2. **Missing RLS Policy**: Anon users couldn't read appointments table, preventing the function from checking existing bookings
3. **Function Logic**: The original function didn't handle NULL barber_id correctly for availability blocks that apply to all barbers

## Solution Applied

Created migration: `supabase/migrations/20251122123000_fix_availability_engine.sql`

### Changes Made

1. **Replaced `generate_free_time_slots` Function**
   - Fixed to handle availability blocks with NULL barber_id (blocks for all barbers)
   - Improved overlap detection logic with existing appointments
   - Generates 15-minute intervals correctly

2. **Granted Execute Permissions**
   ```sql
   GRANT EXECUTE ON FUNCTION generate_free_time_slots(uuid, uuid, date, integer)
     TO authenticated, anon;
   ```

3. **Added RLS Policy for Appointments**
   ```sql
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
   ```

## How to Apply

The migration file has been created. Apply it via:

**Option 1: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy contents of `supabase/migrations/20251122123000_fix_availability_engine.sql`
5. Paste and execute

**Option 2: Supabase CLI** (if available)
```bash
supabase db push
```

## Testing

After applying the migration:

1. **Public Booking** (anon user):
   - Visit public booking page for a business with `booking_mode = 'online'`
   - Select barber "Ace" and date "Sunday 23 Nov 2025"
   - Should see time slots: 10:00, 10:15, 10:30, 10:45, 11:00, etc.

2. **Internal Booking** (authenticated):
   - Go to Bookings page
   - Click "New Appointment"
   - Select barber and service
   - Time dropdown should populate with available slots

## Function Behavior

- Returns JSONB: `{"free_slots": ["10:00", "10:15", "10:30", ...]}`
- Times in HH24:MI format (24-hour, local time)
- 15-minute intervals
- Respects availability blocks (including NULL barber_id for all-barber blocks)
- Filters out overlapping scheduled appointments
- Service duration-aware (ensures full duration fits)

## No Frontend Changes Required

The existing frontend code already handles the correct return format from the function.
