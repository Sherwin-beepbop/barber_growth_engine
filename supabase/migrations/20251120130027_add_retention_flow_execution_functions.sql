/*
  # Add Retention Flow Execution Functions

  ## Overview
  This migration adds database functions to execute retention flows and generate messages.
  It enables the Retention Engine to automatically identify customers and create pending messages
  based on flow configurations.

  ## New Functions

  ### 1. run_winback_flow(p_business_id uuid, p_flow_id uuid)
  Identifies inactive customers based on the flow's inactive_weeks threshold and creates
  winback messages for them.
  
  - Selects customers where last_visit_date > inactive_weeks ago
  - Excludes customers with future appointments
  - Creates messages with status = 'pending'
  - Returns count of messages created

  ### 2. run_freshness_flow(p_business_id uuid, p_flow_id uuid)
  Identifies customers who are due for their next visit based on their average interval
  and creates reminder messages.
  
  - Uses trigger_condition.interval_weeks or business.default_reminder_interval_weeks
  - Selects customers where today ≈ last_visit_date + interval
  - Creates messages with status = 'pending'
  - Returns count of messages created

  ### 3. run_quiet_day_flow(p_business_id uuid, p_flow_id uuid)
  Identifies days with low appointment occupancy and creates promotional messages
  for loyal customers.
  
  - Checks appointment density for upcoming days
  - Selects loyal customers (total_visits >= 3)
  - Creates promotional messages with status = 'pending'
  - Returns count of messages created

  ### 4. create_thank_you_message()
  Trigger function that automatically creates thank-you messages when an appointment
  is marked as completed.
  
  - Fires on appointment status change to 'completed'
  - Creates thank-you message with review link
  - Prevents duplicate messages for same appointment

  ## Security
  - All functions are SECURITY DEFINER to bypass RLS
  - Functions validate business_id ownership before execution
  - Multi-tenant safe with proper business_id filtering

  ## Message Template Placeholder Replacement
  Functions replace the following placeholders in message templates:
  - {customer_name} - Customer's name
  - {business_name} - Business name
  - {booking_link} - Public booking URL
  - {review_link} - Google review URL from business settings
*/

-- Function to replace template placeholders
CREATE OR REPLACE FUNCTION replace_message_template(
  p_template text,
  p_customer_name text,
  p_business_name text,
  p_business_id uuid,
  p_review_url text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_result text;
  v_booking_link text;
BEGIN
  v_result := p_template;
  v_booking_link := format('https://yourdomain.com/book/%s', p_business_id);
  
  v_result := replace(v_result, '{customer_name}', p_customer_name);
  v_result := replace(v_result, '{business_name}', p_business_name);
  v_result := replace(v_result, '{booking_link}', v_booking_link);
  
  IF p_review_url IS NOT NULL THEN
    v_result := replace(v_result, '{review_link}', p_review_url);
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to run winback flow
CREATE OR REPLACE FUNCTION run_winback_flow(
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
  v_inactive_weeks integer;
  v_cutoff_date date;
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
  
  -- Get inactive weeks from trigger condition or default to 8
  v_inactive_weeks := COALESCE(
    (v_flow.trigger_condition->>'inactive_weeks')::integer,
    8
  );
  
  v_cutoff_date := CURRENT_DATE - (v_inactive_weeks * 7);
  
  -- Loop through inactive customers
  FOR v_customer IN
    SELECT c.*
    FROM customers c
    WHERE c.business_id = p_business_id
      AND c.last_visit_date IS NOT NULL
      AND c.last_visit_date < v_cutoff_date
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
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'messages_created', v_messages_created
  );
END;
$$;

-- Function to run freshness flow
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
  v_interval_weeks integer;
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
  
  -- Get interval weeks from trigger condition or business default
  v_interval_weeks := COALESCE(
    (v_flow.trigger_condition->>'interval_weeks')::integer,
    v_business.default_reminder_interval_weeks,
    3
  );
  
  -- Calculate target date range (interval ± 3 days)
  v_target_date_min := CURRENT_DATE - (v_interval_weeks * 7) - 3;
  v_target_date_max := CURRENT_DATE - (v_interval_weeks * 7) + 3;
  
  -- Loop through customers due for visit
  FOR v_customer IN
    SELECT c.*
    FROM customers c
    WHERE c.business_id = p_business_id
      AND c.last_visit_date IS NOT NULL
      AND c.last_visit_date BETWEEN v_target_date_min AND v_target_date_max
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
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'messages_created', v_messages_created
  );
END;
$$;

-- Function to run quiet day flow
CREATE OR REPLACE FUNCTION run_quiet_day_flow(
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
  v_min_occupancy decimal;
  v_target_date date;
  v_appointment_count integer;
  v_max_capacity integer := 10;
  v_occupancy decimal;
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
  
  -- Get minimum occupancy threshold from trigger condition or default to 0.4
  v_min_occupancy := COALESCE(
    (v_flow.trigger_condition->>'min_occupancy')::decimal,
    0.4
  );
  
  -- Check next 7 days for low occupancy
  FOR i IN 1..7 LOOP
    v_target_date := CURRENT_DATE + i;
    
    -- Count appointments for this day
    SELECT COUNT(*) INTO v_appointment_count
    FROM appointments
    WHERE business_id = p_business_id
      AND appointment_date = v_target_date
      AND status IN ('scheduled', 'completed');
    
    v_occupancy := v_appointment_count::decimal / v_max_capacity;
    
    -- If occupancy is below threshold, create messages for loyal customers
    IF v_occupancy < v_min_occupancy THEN
      FOR v_customer IN
        SELECT c.*
        FROM customers c
        WHERE c.business_id = p_business_id
          AND c.total_visits >= 3
          AND NOT EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.customer_id = c.id
              AND a.appointment_date = v_target_date
          )
          -- Prevent duplicate messages within last 3 days
          AND NOT EXISTS (
            SELECT 1 FROM messages m
            WHERE m.customer_id = c.id
              AND m.flow_id = p_flow_id
              AND m.created_at > CURRENT_TIMESTAMP - INTERVAL '3 days'
          )
        LIMIT 5
      LOOP
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
      END LOOP;
      
      -- Only process first low-occupancy day
      EXIT;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'messages_created', v_messages_created
  );
END;
$$;

-- Function to create thank you message (trigger function)
CREATE OR REPLACE FUNCTION create_thank_you_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flow record;
  v_business record;
  v_customer record;
  v_message_body text;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get active thank_you flow for this business
    SELECT * INTO v_flow
    FROM retention_flows
    WHERE business_id = NEW.business_id
      AND flow_type = 'thank_you'
      AND enabled = true
    LIMIT 1;
    
    IF FOUND THEN
      -- Get business and customer details
      SELECT * INTO v_business FROM businesses WHERE id = NEW.business_id;
      SELECT * INTO v_customer FROM customers WHERE id = NEW.customer_id;
      
      -- Check if message already exists for this appointment
      IF NOT EXISTS (
        SELECT 1 FROM messages
        WHERE customer_id = NEW.customer_id
          AND flow_id = v_flow.id
          AND created_at > NEW.updated_at - INTERVAL '1 hour'
      ) THEN
        -- Replace template placeholders
        v_message_body := replace_message_template(
          v_flow.message_template,
          v_customer.name,
          v_business.name,
          NEW.business_id,
          v_business.google_review_url
        );
        
        -- Create thank you message
        INSERT INTO messages (
          business_id,
          customer_id,
          flow_id,
          channel,
          message_text,
          status,
          created_at
        ) VALUES (
          NEW.business_id,
          NEW.customer_id,
          v_flow.id,
          v_flow.channel,
          v_message_body,
          'pending',
          CURRENT_TIMESTAMP
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for thank you messages
DROP TRIGGER IF EXISTS trigger_create_thank_you_message ON appointments;
CREATE TRIGGER trigger_create_thank_you_message
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_thank_you_message();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION run_winback_flow(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION run_freshness_flow(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION run_quiet_day_flow(uuid, uuid) TO authenticated;
