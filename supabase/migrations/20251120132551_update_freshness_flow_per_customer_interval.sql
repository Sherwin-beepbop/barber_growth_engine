/*
  # Update Freshness Flow for Per-Customer Intervals

  ## Overview
  This migration updates the run_freshness_flow function to respect individual customer
  interval preferences. Instead of applying the same interval to all customers, the function
  now checks each customer's average_interval_weeks field first.

  ## Changes

  ### Updated: run_freshness_flow(p_business_id uuid, p_flow_id uuid)
  
  **Previous Logic:**
  - Used a single interval_weeks value from trigger_condition or business default
  - Applied the same interval calculation to all customers
  
  **New Logic:**
  - For each customer, check if they have a custom average_interval_weeks value
  - If set, use the customer's specific interval
  - If not set (NULL), fall back to business.default_reminder_interval_weeks
  - If that's also not set, use default of 3 weeks
  - Calculate target date range based on individual customer's interval
  
  **Benefits:**
  - Personalized reminders based on each customer's actual visit patterns
  - More accurate timing for freshness reminders
  - Flexible per-customer customization by barbers

  ## Example Scenarios

  ### Customer A (average_interval_weeks = 2)
  - Last visit: 14 days ago
  - Will receive reminder (matches their 2-week interval)

  ### Customer B (average_interval_weeks = 4)
  - Last visit: 14 days ago  
  - Will NOT receive reminder (too early, their interval is 4 weeks)

  ### Customer C (average_interval_weeks = NULL)
  - Last visit: 21 days ago
  - Uses business default (e.g., 3 weeks)
  - Will receive reminder if within range

  ## Security
  - Function maintains SECURITY DEFINER for RLS bypass
  - All queries still filtered by business_id
  - Multi-tenant safe
*/

-- Drop and recreate the function with updated logic
CREATE OR REPLACE FUNCTION run_freshness_flow(
  p_business_id uuid,
  p_flow_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flow record;
  v_business record;
  v_customer record;
  v_default_interval_weeks integer;
  v_customer_interval_weeks integer;
  v_target_date_min date;
  v_target_date_max date;
  v_message_body text;
  v_messages_created integer := 0;
BEGIN
  -- Get flow details
  SELECT * INTO v_flow
  FROM retention_flows
  WHERE id = p_flow_id AND business_id = p_business_id AND enabled = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Flow not found or not enabled');
  END IF;
  
  -- Get business details
  SELECT * INTO v_business FROM businesses WHERE id = p_business_id;
  
  -- Get default interval weeks from trigger condition or business default
  v_default_interval_weeks := COALESCE(
    (v_flow.trigger_condition->>'interval_weeks')::integer,
    v_business.default_reminder_interval_weeks,
    3
  );
  
  -- Loop through customers and check each with their individual interval
  FOR v_customer IN
    SELECT c.*
    FROM customers c
    WHERE c.business_id = p_business_id
      AND c.last_visit_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.customer_id = c.id
          AND a.appointment_date >= CURRENT_DATE
          AND a.status = 'scheduled'
      )
      -- Prevent duplicate messages within last 7 days
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.customer_id = c.id
          AND m.flow_id = p_flow_id
          AND m.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      )
  LOOP
    -- Use customer's specific interval if set, otherwise use default
    v_customer_interval_weeks := COALESCE(
      v_customer.average_interval_weeks,
      v_default_interval_weeks
    );
    
    -- Calculate target date range for this specific customer (interval ± 3 days)
    v_target_date_min := CURRENT_DATE - (v_customer_interval_weeks * 7) - 3;
    v_target_date_max := CURRENT_DATE - (v_customer_interval_weeks * 7) + 3;
    
    -- Check if this customer's last visit falls within their specific interval range
    IF v_customer.last_visit_date BETWEEN v_target_date_min AND v_target_date_max THEN
      -- Replace template placeholders
      v_message_body := replace_message_template(
        v_flow.message_template,
        v_customer.name,
        v_business.name,
        p_business_id,
        v_business.google_review_url
      );
      
      -- Create message
      INSERT INTO messages (
        business_id,
        customer_id,
        flow_id,
        channel,
        message_text,
        status,
        created_at
      ) VALUES (
        p_business_id,
        v_customer.id,
        p_flow_id,
        v_flow.channel,
        v_message_body,
        'pending',
        CURRENT_TIMESTAMP
      );
      
      v_messages_created := v_messages_created + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'messages_created', v_messages_created
  );
END;
$$;
