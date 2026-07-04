const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/USER/Desktop/CODE PROJECTS/SMART TUTOR AI/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const index = trimmed.indexOf('=');
  if (index !== -1) {
    const key = trimmed.slice(0, index).trim();
    const val = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key);

async function test() {
  console.log("Calling get_admin_stats RPC...");
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) {
    console.log("Error details:", error.message, "Code:", error.code);
  } else {
    console.log("Success:", data);
  }
}

test();
