import test from 'node:test';
import assert from 'node:assert/strict';
import { localTarget, localTargets } from './support/local-targets.mjs';
test('fixture guard accepts loopback and rejects hosted, credentialed and path targets before use', () => {
  assert.equal(localTarget('http://127.0.0.1:54321','fixture'),'http://127.0.0.1:54321');
  for (const value of ['https://project.supabase.co','http://127.0.0.1.attacker.invalid','http://user:password@localhost:54321','http://localhost:54321/redirect','http://localhost:54321/?url=remote']) assert.throws(()=>localTarget(value,'fixture'));
  assert.throws(()=>localTargets({ LERNA_TEST_MODE: 'local', NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }));
  assert.throws(()=>localTargets({ LERNA_TEST_MODE: 'live' }));
});
