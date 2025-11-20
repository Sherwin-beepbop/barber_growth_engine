/*
  # Barber Growth Engine - Core Schema

  ## Overview
  This migration creates the complete database schema for the Barber Growth Engine SaaS platform,
  including business management, booking system, CRM, retention engine, and analytics.

  ## New Tables

  ### 1. businesses
  Core table for barbershops/salons
  - `id` (uuid, primary key)
  - `owner_id` (uuid, references auth.users)
  - `name` (text) - Shop name
  - `email` (text) - Contact email
  - `phone` (text) - Contact phone
  - `booking_mode` (text) - 'online' or 'internal_only'
  - `google_review_url` (text) - Link for review flow
  - `default_reminder_interval_weeks` (integer) - Default for freshness reminders
  - `opening_hours` (jsonb) - Store opening hours per day
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. services
  Services offered by each business
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `name` (text) - Service name
  - `duration_minutes` (integer)
  - `price` (decimal)
  - `active` (boolean)
  - `created_at` (timestamptz)

  ### 3. customers
  Customer profiles for CRM
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `name` (text)
  - `phone` (text)
  - `email` (text, optional)
  - `label` (text) - Tags like 'VIP', 'new', etc.
  - `average_interval_weeks` (integer) - Calculated from visit history
  - `last_visit_date` (date)
  - `total_visits` (integer)
  - `total_spent` (decimal)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. appointments
  Booking/appointment records
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `customer_id` (uuid, references customers)
  - `service_id` (uuid, references services)
  - `appointment_date` (date)
  - `appointment_time` (time)
  - `duration_minutes` (integer)
  - `amount` (decimal)
  - `status` (text) - 'scheduled', 'completed', 'cancelled', 'no_show'
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. retention_flows
  Configuration for automated retention campaigns
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `flow_type` (text) - 'winback', 'freshness', 'thank_you', 'gap_fill'
  - `enabled` (boolean)
  - `channel` (text) - 'whatsapp', 'sms', 'email'
  - `trigger_condition` (jsonb) - Conditions for triggering
  - `message_template` (text)
  - `follow_up_enabled` (boolean)
  - `follow_up_days` (integer)
  - `follow_up_template` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. messages
  Log of all sent messages for tracking
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `customer_id` (uuid, references customers)
  - `flow_id` (uuid, references retention_flows, optional)
  - `channel` (text)
  - `message_text` (text)
  - `status` (text) - 'pending', 'sent', 'failed'
  - `sent_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Policies ensure users can only access their own business data
  - Public booking widget has limited read access to services and appointment creation
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  booking_mode text DEFAULT 'internal_only' CHECK (booking_mode IN ('online', 'internal_only')),
  google_review_url text,
  default_reminder_interval_weeks integer DEFAULT 3,
  opening_hours jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business"
  ON businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can update own business"
  ON businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can insert own business"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  price decimal(10,2) NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage services"
  ON services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = services.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active services for online booking"
  ON services FOR SELECT
  TO anon
  USING (
    active = true AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = services.business_id
      AND businesses.booking_mode = 'online'
    )
  );

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  label text,
  average_interval_weeks integer,
  last_visit_date date,
  total_visits integer DEFAULT 0,
  total_spent decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, phone)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = customers.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  customer_id uuid REFERENCES customers NOT NULL,
  service_id uuid REFERENCES services NOT NULL,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  amount decimal(10,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Public can create appointments for online booking"
  ON appointments FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.booking_mode = 'online'
    )
  );

-- Create retention_flows table
CREATE TABLE IF NOT EXISTS retention_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  flow_type text NOT NULL CHECK (flow_type IN ('winback', 'freshness', 'thank_you', 'gap_fill')),
  enabled boolean DEFAULT false,
  channel text DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  trigger_condition jsonb DEFAULT '{}',
  message_template text,
  follow_up_enabled boolean DEFAULT false,
  follow_up_days integer,
  follow_up_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, flow_type)
);

ALTER TABLE retention_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage retention flows"
  ON retention_flows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = retention_flows.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  customer_id uuid REFERENCES customers NOT NULL,
  flow_id uuid REFERENCES retention_flows,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_text text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = messages.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(business_id, last_visit_date);
CREATE INDEX IF NOT EXISTS idx_appointments_business_date ON appointments(business_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_services_business_active ON services(business_id, active);
CREATE INDEX IF NOT EXISTS idx_messages_business_status ON messages(business_id, status);

-- Create function to update customer stats after appointment
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
    
    UPDATE customers
    SET 
      last_visit_date = NEW.appointment_date,
      total_visits = total_visits + 1,
      total_spent = total_spent + NEW.amount,
      updated_at = now()
    WHERE id = NEW.customer_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic customer stats update
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON appointments;
CREATE TRIGGER trigger_update_customer_stats
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();
