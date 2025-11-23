import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cprlbyekvoymaahxfroh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwcmxieWVrdm95bWFhaHhmcm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MzMxMTUsImV4cCI6MjA3OTIwOTExNX0.pUOUgJP2jADJuOhix3c_xD22oOpWLpppX8CPKc13TVE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dropAllTables() {
  console.log('⚠️  DROPPING ALL TABLES - THIS CANNOT BE UNDONE ⚠️');

  const sql = `
    -- Drop all RPC functions first
    DROP FUNCTION IF EXISTS generate_free_time_slots(uuid, uuid, date, integer) CASCADE;
    DROP FUNCTION IF EXISTS sync_barber_schedules_to_availability(uuid, date, date) CASCADE;
    DROP FUNCTION IF EXISTS execute_retention_flows() CASCADE;

    -- Drop all tables in correct order
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS appointments CASCADE;
    DROP TABLE IF EXISTS availability_blocks CASCADE;
    DROP TABLE IF EXISTS staff_weekly_schedules CASCADE;
    DROP TABLE IF EXISTS staff_members CASCADE;
    DROP TABLE IF EXISTS services CASCADE;
    DROP TABLE IF EXISTS retention_flows CASCADE;
    DROP TABLE IF EXISTS customers CASCADE;
    DROP TABLE IF EXISTS businesses CASCADE;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error dropping tables:', error);
      console.log('Trying alternative method...');

      // Alternative: Drop tables one by one
      const tables = [
        'messages',
        'appointments',
        'availability_blocks',
        'staff_weekly_schedules',
        'staff_members',
        'services',
        'retention_flows',
        'customers',
        'businesses'
      ];

      for (const table of tables) {
        console.log(`Deleting all rows from ${table}...`);
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError.message);
        } else {
          console.log(`✓ Cleared ${table}`);
        }
      }

      console.log('✓ All data deleted from all tables');
    } else {
      console.log('✓ All tables dropped successfully');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

dropAllTables();
