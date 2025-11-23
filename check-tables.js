import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cprlbyekvoymaahxfroh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwcmxieWVrdm95bWFhaHhmcm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MzMxMTUsImV4cCI6MjA3OTIwOTExNX0.pUOUgJP2jADJuOhix3c_xD22oOpWLpppX8CPKc13TVE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const tables = [
    'businesses',
    'customers',
    'staff_members',
    'services',
    'appointments',
    'availability_blocks',
    'retention_flows',
    'messages',
    'staff_weekly_schedules'
  ];

  console.log('📊 Checking table row counts:\n');

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: Error - ${error.message}`);
    } else {
      console.log(`✓ ${table}: ${count} rows`);
    }
  }
}

checkTables();
