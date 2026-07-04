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

async function run() {
  console.log(`Connecting to: ${url}/rest/v1/study_sessions`);
  const res = await fetch(`${url}/rest/v1/study_sessions?limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  const body = await res.text();
  console.log("Body:", body);
}

run().catch(console.error);
