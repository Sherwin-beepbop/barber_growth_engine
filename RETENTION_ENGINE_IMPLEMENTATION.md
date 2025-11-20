# Retention Engine Implementation

## Overview

The Retention Engine has been upgraded to not only store flow configurations but also actively generate messages in the `messages` table based on customer behavior and business rules.

## What Was Implemented

### 1. Database Functions (Supabase RPC)

Four new PostgreSQL functions have been created to execute retention flows:

#### `run_winback_flow(p_business_id uuid, p_flow_id uuid)`
- **Purpose**: Identify and message inactive customers
- **Logic**:
  - Selects customers where `last_visit_date` is older than the configured `inactive_weeks` (default: 8 weeks)
  - Excludes customers with upcoming scheduled appointments
  - Prevents duplicate messages within 7 days
  - Creates messages with status = 'pending'
- **Returns**: JSON with success status and count of messages created

#### `run_freshness_flow(p_business_id uuid, p_flow_id uuid)`
- **Purpose**: Remind customers when they're due for their next visit
- **Logic**:
  - Uses `interval_weeks` from trigger_condition or business.default_reminder_interval_weeks
  - Selects customers where `last_visit_date` + interval ≈ today (±3 days)
  - Excludes customers with future appointments
  - Prevents duplicate messages within 7 days
  - Creates reminder messages with status = 'pending'
- **Returns**: JSON with success status and count of messages created

#### `run_quiet_day_flow(p_business_id uuid, p_flow_id uuid)`
- **Purpose**: Fill low-occupancy days with promotional offers
- **Logic**:
  - Checks next 7 days for appointment density
  - Calculates occupancy rate (appointments / max_capacity)
  - If occupancy < min_occupancy threshold (default: 40%)
  - Selects loyal customers (total_visits >= 3)
  - Creates promotional messages (limited to 5 customers per day)
  - Prevents duplicate messages within 3 days
- **Returns**: JSON with success status and count of messages created

#### `create_thank_you_message()` (Trigger Function)
- **Purpose**: Automatically send thank you messages when appointments complete
- **Logic**:
  - Fires automatically when appointment status changes to 'completed'
  - Checks if thank_you flow is enabled for the business
  - Creates thank you message with review link
  - Prevents duplicate messages for same appointment (within 1 hour)
- **Trigger**: Runs on INSERT/UPDATE of appointments table

### 2. Template Placeholder Replacement

Helper function `replace_message_template()` replaces placeholders in message templates:
- `{customer_name}` → Customer's actual name
- `{business_name}` → Business name
- `{booking_link}` → Public booking URL (format: `https://yourdomain.com/book/{business_id}`)
- `{review_link}` → Google Review URL from business settings

### 3. UI Updates (RetentionPage.tsx)

Added interactive flow execution capabilities:

#### New State Management
- `runningFlows`: Tracks which flows are currently executing
- `flowResults`: Stores execution results (success, messages created, errors)

#### "Run Flow Now" Button
- Appears only when flow is enabled and has been saved (has flow.id)
- Disabled state when flow is running
- Shows loading state with animated icon during execution
- Special handling for thank_you flow (shows info that it runs automatically)

#### Real-time Feedback
- Success messages show count of messages created
  - Example: "Success! 5 messages created"
- Error messages display relevant error details
- Results auto-dismiss after 10 seconds
- Visual indicators with icons (CheckCircle/AlertCircle)
- Color-coded backgrounds (green for success, red for error)

## Flow Execution Details

### Winback Flow
**Trigger Conditions:**
```json
{
  "inactive_weeks": 8
}
```
**Customer Selection:**
- last_visit_date < (today - inactive_weeks * 7 days)
- No future appointments scheduled
- No recent winback messages (within 7 days)

### Freshness Flow
**Trigger Conditions:**
```json
{
  "interval_weeks": 3
}
```
**Customer Selection:**
- last_visit_date between (today - interval ± 3 days)
- No future appointments scheduled
- No recent freshness messages (within 7 days)

### Thank You Flow
**Automatic Trigger:**
- Fires when appointment.status changes to 'completed'
- No manual "Run Flow Now" needed
- Includes review link if configured in business settings

### Quiet Day Gap-Fill Flow
**Trigger Conditions:**
```json
{
  "min_occupancy": 0.4
}
```
**Logic:**
- Scans next 7 days for low occupancy
- Occupancy = (appointment count) / (max capacity of 10)
- Targets loyal customers (3+ total visits)
- Limits to 5 messages per day to prevent spam

## Security & Multi-Tenancy

All database functions are:
- **SECURITY DEFINER**: Bypass RLS to access customer data
- **Business-scoped**: All queries filter by business_id
- **Safe**: No SQL injection risks, uses parameterized queries
- **Validated**: Check flow ownership and enabled status before execution

## Messages Table

Generated messages have the following structure:
- `business_id`: Owner business
- `customer_id`: Target customer
- `flow_id`: Source retention flow (for tracking)
- `channel`: whatsapp, sms, or email
- `message_text`: Personalized message with placeholders replaced
- `status`: 'pending' (ready for sending)
- `created_at`: Timestamp

## Testing the Implementation

### Manual Testing Steps:

1. **Navigate to Retention Engine page**
2. **Enable a flow** (e.g., Winback Flow)
3. **Configure the flow** with template and channel
4. **Click "Run Flow Now"**
5. **Observe the results** - message count displayed
6. **Check messages table** in Supabase to verify records

### For Thank You Flow:
1. Navigate to Bookings page
2. Mark an appointment as 'completed'
3. Check messages table - should automatically create thank you message

### Verification Queries:

```sql
-- Check pending messages
SELECT
  m.*,
  c.name as customer_name,
  rf.flow_type
FROM messages m
JOIN customers c ON m.customer_id = c.id
JOIN retention_flows rf ON m.flow_id = rf.id
WHERE m.status = 'pending'
ORDER BY m.created_at DESC;

-- Check flow execution history
SELECT
  flow_type,
  COUNT(*) as total_messages,
  MAX(created_at) as last_run
FROM messages m
JOIN retention_flows rf ON m.flow_id = rf.id
GROUP BY flow_type;
```

## Future Enhancements

The current implementation creates messages with `status = 'pending'`. Future work could include:

1. **Actual Sending Integration**:
   - WhatsApp Business API integration
   - Twilio for SMS
   - SendGrid/Mailgun for email
   - Background job to process pending messages

2. **Message Scheduling**:
   - Add `scheduled_for` field to messages
   - Optimal send time based on customer preferences

3. **Response Tracking**:
   - Track delivery status
   - Monitor click-through rates
   - Customer response handling

4. **Advanced Targeting**:
   - Customer segments
   - A/B testing for message templates
   - Personalization based on service history

5. **Analytics Dashboard**:
   - Campaign performance metrics
   - Conversion tracking
   - ROI calculation

## Technical Notes

- All RPC functions return JSON format: `{success: boolean, messages_created: number, error?: string}`
- Functions use COALESCE for default values from trigger_condition
- Duplicate prevention windows: 7 days (winback/freshness), 3 days (gap_fill), 1 hour (thank_you)
- Template replacement is safe against null values
- Error handling at both database and UI levels
