const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kmgjqvsyxrkwzacutivs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttZ2pxdnN5eHJrd3phY3V0aXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTQ3NjgsImV4cCI6MjA5MDYzMDc2OH0.ot7MadRoDCHuiipb7IBQUj19Dj-o9-8K77tD3a8adTU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvents() {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Events in DB:', data.length);
    data.forEach(e => console.log(e.id, e.name, e.user_id));
  }
}

checkEvents();
