import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
function loadModules(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file); if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} }; cache.set(file, loadedModule);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    function dependency(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('@/') || specifier.startsWith('.')) { let resolved = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier); if (!path.extname(resolved)) resolved += '.ts'; return load(resolved); }
      if (specifier === 'node:crypto') return crypto;
      if (specifier === 'next/server') return { NextRequest, NextResponse };
      throw new Error(`Unexpected test dependency: ${specifier}`);
    }
    new Function('require', 'module', 'exports', js)(dependency, loadedModule, loadedModule.exports); return loadedModule.exports;
  }
  return load;
}
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const password = '  SyntheticA1!  ';
function fixture() {
  const state = { intents: new Map(), proofs: new Map(), emails: [], updates: [], signOutFails: false, providerFails: false, sendFails: false, refreshCookie: false, currentUser: userId, currentSession: sessionId, email: 'fixture@example.invalid' };
  const client = { auth: {
    getSession: async () => ({ data: { session: { access_token: 'synthetic-session-only' } }, error: null }),
    getUser: async () => ({ data: { user: { id: state.currentUser, email: state.email } }, error: null }),
    getClaims: async () => ({ data: { claims: { sub: state.currentUser, session_id: state.currentSession } }, error: null }),
    resetPasswordForEmail: async (email, options) => { state.emails.push({ email, redirectTo: options.redirectTo }); return { error: state.sendFails ? new Error('synthetic provider failure') : null }; },
    updateUser: async ({ password }) => { state.updates.push(password); return { error: state.providerFails ? new Error('synthetic provider failure') : null }; },
    signOut: async () => ({ error: state.signOutFails ? new Error('synthetic sign-out failure') : null }),
  } };
  const repository = {
    createRecoveryIntent: async (args) => { state.intents.set(args.p_nonce_hash, { ...args, used: false }); return true; },
    authorizeRecoveryIntent: async (args) => {
      const intent = state.intents.get(args.p_nonce_hash);
      if (!intent || intent.used || intent.expired || intent.p_browser_hash !== args.p_browser_hash || intent.p_email_hash !== args.p_email_hash) return false;
      intent.used = true; state.proofs.set(args.p_proof_hash, { user: args.p_user_id, session: args.p_session_id, used: false }); return true;
    },
    validateRecoveryProof: async (args) => { const proof = state.proofs.get(args.p_proof_hash); return Boolean(proof && !proof.used && !proof.expired && proof.user === args.p_user_id && proof.session === args.p_session_id); },
    consumeRecoveryProof: async (args) => { const proof = state.proofs.get(args.p_proof_hash); if (!proof || proof.used || proof.expired || proof.user !== args.p_user_id || proof.session !== args.p_session_id) return false; proof.used = true; return true; },
  };
  const load = loadModules({ '@/lib/supabase/server': { createSupabaseServerClient: async (adapter) => {
    if (state.refreshCookie) adapter.setAll([{ name: 'fixture-auth-session', value: 'synthetic-refreshed-session', options: { path: '/', httpOnly: true } }]);
    return client;
  } }, '@/lib/repositories/recovery': repository });
  const helper = load('src/lib/auth/recovery-server.ts');
  function request(endpoint, body, cookie = '', origin = 'http://localhost') { return new NextRequest(`http://localhost${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body) }); }
  async function intent() {
    const result = await helper.initiateRecovery(request('/api/auth/recovery', { email: state.email }));
    assert.equal(result.status, 200);
    const browser = result.cookies.get(helper.RECOVERY_BROWSER_COOKIE).value;
    const nonce = new URL(state.emails.at(-1).redirectTo).searchParams.get('recovery_nonce');
    return { browser, nonce, result };
  }
  async function grant() {
    const initial = await intent(); const output = NextResponse.redirect('http://localhost/auth/reset-password');
    const callback = new NextRequest(`http://localhost/auth/callback?recovery_nonce=${initial.nonce}`, { headers: { cookie: `${helper.RECOVERY_BROWSER_COOKIE}=${initial.browser}` } });
    await helper.grantRecoveryProof(callback, output, client, 'synthetic-code-exchange-session');
    const proof = output.cookies.get(helper.RECOVERY_PROOF_COOKIE).value;
    return { ...initial, proof, output };
  }
  return { helper, state, client, request, intent, grant, load };
}
test('normal signed-in session cannot complete recovery without a separate one-use proof', async () => {
  const f = fixture(); const result = await f.helper.finishRecovery(f.request('/api/auth/recovery/complete', { password }));
  assert.equal(result.status, 401); assert.equal(f.state.updates.length, 0);
});
test('failed recovery never forwards a newly refreshed Auth cookie', async () => {
  for (const fault of ['invalid-proof','provider-failure']) {
    const f = fixture(); const { proof } = await f.grant(); f.state.refreshCookie = true;
    if (fault === 'provider-failure') f.state.providerFails = true;
    const result = await f.helper.finishRecovery(f.request('/api/auth/recovery/complete', { password }, `${f.helper.RECOVERY_PROOF_COOKIE}=${fault === 'invalid-proof' ? 'x'.repeat(43) : proof}`));
    assert.ok(result.status >= 400);
    assert.equal(result.cookies.get('fixture-auth-session'), undefined);
    assert.ok(!(result.headers.get('set-cookie') ?? '').includes('synthetic-refreshed-session'));
  }
});
test('initiation delivers nonce only by email redirect and uses private browser binding cookie', async () => {
  const f = fixture(); const { result, nonce, browser } = await f.intent();
  const body = await result.text(); assert.ok(!body.includes(nonce)); assert.ok(!body.includes(browser));
  assert.equal(result.cookies.get(f.helper.RECOVERY_BROWSER_COOKIE).httpOnly, true);
  assert.equal(result.cookies.get(f.helper.RECOVERY_BROWSER_COOKIE).sameSite, 'lax');
  const intent = [...f.state.intents.values()][0]; assert.ok(!JSON.stringify(intent).includes(f.state.email));
  const repeated = await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: f.state.email }, `${f.helper.RECOVERY_BROWSER_COOKIE}=${browser}`));
  assert.equal(repeated.cookies.get(f.helper.RECOVERY_BROWSER_COOKIE).value, browser);
});
test('unknown-account/provider failure responses cannot expose membership', async () => {
  const f = fixture(); const ordinary = await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: f.state.email }));
  f.state.sendFails = true; const failed = await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: 'missing@example.invalid' }));
  assert.equal(ordinary.status, failed.status); assert.deepEqual(await ordinary.json(), await failed.json());
});
test('recovery intent rejects wrong browser, wrong verified email, expired and reused nonce', async () => {
  for (const fault of ['browser', 'email', 'expired', 'reused']) {
    const f = fixture(); const { browser, nonce } = await f.intent();
    if (fault === 'email') f.state.email = 'other@example.invalid';
    if (fault === 'expired') [...f.state.intents.values()][0].expired = true;
    if (fault === 'reused') [...f.state.intents.values()][0].used = true;
    const callback = new NextRequest(`http://localhost/auth/callback?recovery_nonce=${nonce}`, { headers: { cookie: `${f.helper.RECOVERY_BROWSER_COOKIE}=${fault === 'browser' ? 'x'.repeat(43) : browser}` } });
    await assert.rejects(() => f.helper.grantRecoveryProof(callback, NextResponse.redirect('http://localhost/auth/reset-password'), f.client, 'synthetic-session'));
    assert.equal(f.state.proofs.size, 0);
  }
});
test('next route and client-stored recovery marker cannot substitute for intent nonce', async () => {
  const f = fixture();
  const request = new NextRequest('http://localhost/auth/callback?next=/auth/reset-password&redirectType=recovery');
  await assert.rejects(() => f.helper.grantRecoveryProof(request, NextResponse.redirect('http://localhost/auth/reset-password'), f.client, 'synthetic-session'));
  assert.equal(f.state.proofs.size, 0);
});
test('dedicated page proof validation is bound to verified current user and session', async () => {
  const f = fixture(); const { proof } = await f.grant();
  await f.helper.assertRecoveryProof(f.client, proof);
  f.state.currentSession = '33333333-3333-4333-8333-333333333333';
  await assert.rejects(() => f.helper.assertRecoveryProof(f.client, proof));
  f.state.currentSession = sessionId; [...f.state.proofs.values()][0].expired = true;
  await assert.rejects(() => f.helper.assertRecoveryProof(f.client, proof));
});
test('complete journey changes password once, preserves whitespace and prevents concurrent replay', async () => {
  const f = fixture(); const { proof } = await f.grant();
  const make = () => f.request('/api/auth/recovery/complete', { password }, `${f.helper.RECOVERY_PROOF_COOKIE}=${proof}`);
  const results = await Promise.all([f.helper.finishRecovery(make()), f.helper.finishRecovery(make())]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  assert.equal(f.state.updates.length, 1); assert.equal(f.state.updates[0], password);
  const success = results.find((result) => result.status === 200); assert.equal((await success.json()).signedOut, true);
  assert.equal(success.cookies.get(f.helper.RECOVERY_PROOF_COOKIE).maxAge, 0);
});
test('provider update uncertainty consumes proof and requires fresh email rather than a second update', async () => {
  const f = fixture(); const { proof } = await f.grant(); f.state.providerFails = true;
  const make = () => f.request('/api/auth/recovery/complete', { password }, `${f.helper.RECOVERY_PROOF_COOKIE}=${proof}`);
  const failed = await f.helper.finishRecovery(make()); assert.equal(failed.status, 400);
  assert.equal(failed.cookies.get(f.helper.RECOVERY_PROOF_COOKIE).maxAge, 0);
  assert.equal((await f.helper.finishRecovery(make())).status, 401); assert.equal(f.state.updates.length, 1);
});
test('sign-out failure after durable password update is a distinct successful-save outcome', async () => {
  const f = fixture(); const { proof } = await f.grant(); f.state.signOutFails = true;
  const result = await f.helper.finishRecovery(f.request('/api/auth/recovery/complete', { password }, `${f.helper.RECOVERY_PROOF_COOKIE}=${proof}`));
  assert.equal(result.status, 200); assert.equal((await result.json()).signedOut, false); assert.equal(f.state.updates.length, 1);
});
test('cross-origin, oversized and unknown-field requests fail before email or password effects', async () => {
  const f = fixture();
  assert.equal((await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: f.state.email }, '', 'https://foreign.invalid'))).status, 403);
  assert.equal((await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: f.state.email, user_id: userId }))).status, 400);
  assert.equal((await f.helper.initiateRecovery(f.request('/api/auth/recovery', { email: 'x'.repeat(5000) }))).status, 413);
  assert.equal(f.state.emails.length, 0); assert.equal(f.state.updates.length, 0);
});
test('unconfigured preview hosts never silently redirect authentication to production', () => {
  const config = loadModules()('src/lib/supabase/config.ts');
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try { process.env.NEXT_PUBLIC_APP_URL = 'https://www.uselerna.app'; assert.throws(() => config.getAuthRequestOrigin('https://unknown-preview.example.invalid/auth/callback')); }
  finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous; }
});

test('recovery body reads have a total deadline and accept a fast small JSON body', async () => {
  const f = fixture(); let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const stalled = { headers: new Headers(), body: stream, signal: new AbortController().signal };
  await assert.rejects(() => f.helper.readRecoveryBody(stalled, 20), error => error.status === 408);
  assert.equal(cancelled, true);
  assert.deepEqual(await f.helper.readRecoveryBody(f.request('/fixture', { email: 'fixture@example.invalid' }), 100), { email: 'fixture@example.invalid' });
});
