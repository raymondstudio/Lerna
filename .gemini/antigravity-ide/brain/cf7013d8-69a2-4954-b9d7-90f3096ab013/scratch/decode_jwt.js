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

function decodeJWT(token) {
  try {
    // If token starts with sb_publishable_ or sb_service_role_, it might have a JWT payload inside or be a standard JWT.
    // Let's check if there are dots in the token
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
    
    // Check if the token itself is a simple string. Some custom tokens are not JWTs.
    return { type: "non-jwt", value: token };
  } catch (e) {
    return { error: e.message };
  }
}

console.log("Publishable key decoded:", decodeJWT(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
console.log("Service role key decoded:", decodeJWT(env.SUPABASE_SERVICE_ROLE_KEY));
