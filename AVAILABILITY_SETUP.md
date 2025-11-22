# Availability Engine Setup

## Overview
The complete server-side availability system has been implemented for both public booking and internal appointment management.

## Implementation Status

### ✅ Completed

1. **RPC Function Created**: `generate_free_time_slots`
   - Location: `supabase/migrations/20251122120000_create_generate_free_time_slots_function.sql`
   - Generates 15-minute interval time slots
   - Filters out booked appointments
   - Handles service duration properly

2. **PublicBookingPage Updated**
   - Now calls `generate_free_time_slots` RPC function
   - Shows "No available times for this day" when slots are empty
   - Properly handles barber selection requirement

3. **BookingsPage (Internal) Updated**
   - NewAppointmentModal now uses time slot dropdown
   - Dynamically fetches available slots based on barber + service + date
   - Shows loading state while fetching slots
   - Shows helpful messages when no slots available

4. **Double-Booking Protection**
   - Existing server-side guard in PublicBookingPage remains active
   - RPC function filters out overlapping appointments
   - Both layers work together for maximum safety

### ⚠️ Action Required

**The RPC function must be applied to the database:**

The migration file has been created but needs to be applied. You have two options:

#### Option 1: Supabase Dashboard (Recommended)
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to SQL Editor
4. Copy the contents of `supabase/migrations/20251122120000_create_generate_free_time_slots_function.sql`
5. Paste and run the SQL

#### Option 2: Supabase CLI (if available)
```bash
supabase db push
```

## How It Works

### Public Booking Flow
1. User selects barber and service
2. User selects date
3. System calls `generate_free_time_slots` with:
   - business_id
   - barber_id
   - date
   - service_duration
4. Function returns available time slots (15-min intervals)
5. User selects from available slots only
6. On confirm, double-booking check runs before insert

### Internal Booking Flow  
1. Staff selects customer, service, and barber
2. System automatically fetches available slots using `generate_free_time_slots`
3. Time dropdown shows only available slots
4. On create, appointment is inserted

## Features

- ✅ 15-minute time slot granularity
- ✅ Service duration-aware (30/45/60 min services)
- ✅ Filters out overlapping appointments
- ✅ Respects availability_blocks
- ✅ Local timezone handling (no UTC issues)
- ✅ Loading states and empty state messages
- ✅ Double-booking protection at multiple layers

## Testing

Once the RPC function is applied, test:

1. **Public Booking**:
   - Visit public booking page
   - Select barber with availability blocks
   - Verify only available times show
   - Book an appointment
   - Verify that time slot disappears for subsequent bookings

2. **Internal Booking**:
   - Go to Bookings page
   - Click "New Appointment"
   - Select barber and service
   - Verify time dropdown shows only available slots
   - Create appointment successfully

## Troubleshooting

If you see "Could not find function generate_free_time_slots":
- The migration hasn't been applied yet
- Follow "Action Required" steps above

If time slots aren't showing:
- Check that availability_blocks exist for the barber and date
- Verify barber_id is correctly set in availability_blocks
- Check browser console for any RPC errors
