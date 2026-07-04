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

async function run() {
  const email = 'test-1783188464087@gmail.com';
  const password = 'Password123!';
  
  console.log(`Signing in user: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (authError) {
    console.error("SignIn error:", authError.message);
    return;
  }
  
  console.log("SignIn success, user ID:", authData.user.id);
  
  console.log("Querying feature_flags table...");
  const { data: flags, error: flagsError } = await supabase
    .from('feature_flags')
    .select('*');
    
  if (flagsError) {
    console.error("Query feature_flags error:", flagsError.message);
  } else {
    console.log("Query feature_flags success. Total flags:", flags.length);
    console.log(flags);
  }
}

run().catch(console.error);
