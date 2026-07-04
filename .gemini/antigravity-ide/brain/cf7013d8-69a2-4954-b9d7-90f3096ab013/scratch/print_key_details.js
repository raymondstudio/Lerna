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

const pub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Publishable Key:");
console.log("  - Length:", pub ? pub.length : 0);
console.log("  - Value:", pub);
console.log("Service Role Key:");
console.log("  - Length:", svc ? svc.length : 0);
console.log("  - Value:", svc);
console.log("Are suffixes identical?", pub.slice(15) === svc.slice(17));
