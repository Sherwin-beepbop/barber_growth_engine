import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          booking_mode: 'online' | 'internal_only';
          google_review_url: string | null;
          default_reminder_interval_weeks: number;
          opening_hours: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['businesses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['businesses']['Insert']>;
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          duration_minutes: number;
          price: number;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string;
          email: string | null;
          label: string | null;
          average_interval_weeks: number | null;
          last_visit_date: string | null;
          total_visits: number;
          total_spent: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          service_id: string;
          appointment_date: string;
          appointment_time: string;
          duration_minutes: number;
          amount: number;
          status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
      };
      retention_flows: {
        Row: {
          id: string;
          business_id: string;
          flow_type: 'winback' | 'freshness' | 'thank_you' | 'gap_fill';
          enabled: boolean;
          channel: 'whatsapp' | 'sms' | 'email';
          trigger_condition: Record<string, any>;
          message_template: string | null;
          follow_up_enabled: boolean;
          follow_up_days: number | null;
          follow_up_template: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['retention_flows']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['retention_flows']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          flow_id: string | null;
          channel: 'whatsapp' | 'sms' | 'email';
          message_text: string;
          status: 'pending' | 'sent' | 'failed';
          sent_at: string | null;
          created_at: string;
        };
      };
    };
  };
};
