import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { localTargets } from '../tests/support/local-targets.mjs';

const targets = localTargets();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('BLOCKED: use the local CLI service key, never a hosted key.');
const health = await fetch(`${targets.backend}/auth/v1/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!health?.ok) throw new Error('BLOCKED: start the local Supabase containers before provisioning.');
const admin = createClient(targets.backend, key, { auth: { persistSession: false, autoRefreshToken: false } });
const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listed.error) throw new Error('Local fixture identity inventory unavailable.');
const identities = {};
for (const name of ['a','b','admin','owner','recovery','onboarding']) {
  const email = `lerna-stabilization-${name}@fixture.invalid`;
  const password = randomBytes(24).toString('base64url');
  const existing = listed.data.users.find(user => user.email === email);
  const result = existing ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true }) : await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw new Error(`Local ${name} identity provisioning failed.`);
  const id = result.data.user.id;
  const profile = await admin.from('profiles').update({ onboarding_completed: name !== 'onboarding', is_suspended: false, is_deleted: false }).eq('id', id);
  const role = await admin.from('user_roles').upsert({ user_id: id, role: name === 'owner' ? 'owner' : name === 'admin' ? 'admin' : 'student' }, { onConflict: 'user_id' });
  if (profile.error || role.error) throw new Error(`Local ${name} fixture backfill could not be verified.`);
  identities[name] = { id, email, password };
}
await mkdir('.stabilization-local/auth', { recursive: true });
await writeFile('.stabilization-local/fixtures.json', JSON.stringify({ createdAt: new Date().toISOString(), backend: targets.backend, identities }, null, 2), { mode: 0o600 });
console.info('Provisioned six disposable local identities. Credentials and browser state remain in ignored .stabilization-local/.');
