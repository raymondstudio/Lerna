import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const loadPackage = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Transpile production modules in memory; no rewritten source, generated snapshots,
// hosted credentials, database connections, or paid provider calls are used.
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const packet = { exports: {} }; cache.set(file, packet);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    function dependency(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        let resolved = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
        if (!path.extname(resolved)) resolved += '.ts';
        return load(resolved);
      }
      return loadPackage(specifier);
    }
    new Function('require', 'module', 'exports', source)(dependency, packet, packet.exports);
    return packet.exports;
  }
  return load;
}
const load = loader();
const contract = load('src/lib/activity/contracts.ts');
const query = load('src/lib/activity/query.ts');
const cursor = load('src/lib/activity/cursor.ts');
const csv = load('src/lib/activity/csv.ts');
const environment = load('src/lib/activity/environment.ts');
const now = new Date('2026-10-17T11:00:00.000Z');
const fixtureId = '11111111-1111-4111-8111-111111111111';

test('reported browser envelope cannot forge actor, environment, role or authoritative success', () => {
  const event = { event_id: fixtureId, activity_id: fixtureId, event_type: 'page.viewed', route: '/notes' };
  assert.equal(contract.browserBatchSchema.safeParse({ events: [event] }).success, true);
  for (const extra of [{ user_id: fixtureId }, { environment: 'production' }, { actor_role: 'admin' }, { outcome: 'succeeded' }, { properties: { content: 'private fixture' } }]) assert.equal(contract.browserBatchSchema.safeParse({ events: [{ ...event, ...extra }] }).success, false);
  assert.equal(contract.browserBatchSchema.safeParse({ events: [{ ...event, event_type: 'note.saved' }] }).success, false);
  assert.equal(contract.browserBatchSchema.safeParse({ events: Array(21).fill(event) }).success, false);
});
test('metadata allowlists reject content, control characters and unknown event types', () => {
  assert.deepEqual(contract.validateMetadata('note.saved', { revision: 2 }), { revision: 2 });
  for (const value of [{ revision: -1 }, { content: 'private fixture' }, { revision: 2, title: 'private fixture' }]) assert.throws(() => contract.validateMetadata('note.saved', value));
  assert.throws(() => contract.validateMetadata('ai.request.failed', { request_type: 'chat', provider_mode: 'live', error_code: 'FAILED\nforged' }));
  assert.throws(() => contract.validateMetadata('untrusted.type', {}));
});
test('route normalization strips secrets and dynamic IDs without recording arbitrary route text', () => {
  assert.equal(contract.normalizeRoute('/auth/callback?code=private#token'), '/auth/callback');
  assert.equal(contract.normalizeRoute(`/notes/${fixtureId}?search=private`), '/notes/[id]');
  assert.equal(contract.normalizeRoute('/some-unrecognized-route'), '/other');
  assert.throws(() => contract.normalizeRoute('/notes/../private'));
  assert.throws(() => contract.normalizeRoute('/notes\nforged'));
});
test('requested presets use UTC intervals and Lagos is the default presentation timezone', () => {
  for (const [range, hours] of [['3h', 3], ['24h', 24], ['3d', 72], ['7d', 168], ['30d', 720]]) {
    const filters = query.parseActivityFilters(new URLSearchParams({ range }), 'local', now);
    assert.equal(Date.parse(filters.endAt) - Date.parse(filters.startAt), hours * 3600000);
    assert.equal(filters.timezone, 'Africa/Lagos'); assert.equal(filters.limit, 50);
  }
});
test('custom offsets, bounds, enum and correlation validation fail safely', () => {
  const valid = new URLSearchParams({ range: 'custom', start_at: '2026-10-17T08:00:00+01:00', end_at: '2026-10-17T09:00:00+01:00', user_id: fixtureId });
  assert.equal(query.parseActivityFilters(valid, 'local', now).startAt, '2026-10-17T07:00:00.000Z');
  for (const params of [{ limit: '-1' }, { limit: '101' }, { limit: '1.5' }, { range: '__proto__' }, { range: 'constructor' }, { timezone: 'Bad/Zone' }, { outcome: 'invented' }, { user_id: 'x),user_id.neq.null' }, { range: 'custom', start_at: '2026-10-17T08:00', end_at: '2026-10-17T09:00' }]) assert.throws(() => query.parseActivityFilters(new URLSearchParams(params), 'local', now));
});
test('keyset cursors bind filtering and preserve microsecond timestamps for stable tie-breaking', () => {
  const filters = query.parseActivityFilters(new URLSearchParams({ range: '3h' }), 'local', now);
  const value = { at: '2026-10-17T10:59:00.123456+00:00', id: fixtureId, asOf: now.toISOString(), filter: cursor.filterHash(filters) };
  const encoded = cursor.encodeActivityCursor(value);
  assert.deepEqual(cursor.decodeActivityCursor(encoded, filters), value);
  assert.throws(() => cursor.decodeActivityCursor(encoded, { ...filters, environment: 'production' }));
  assert.throws(() => cursor.decodeActivityCursor(encoded, { ...filters, category: 'auth' }));
  assert.throws(() => cursor.decodeActivityCursor(cursor.encodeActivityCursor({ ...value, id: 'x),or(id.neq.null' }), filters));
});
test('export filter serialization retains source, ownership, category and correlations', () => {
  const filters = query.parseActivityFilters(new URLSearchParams({ range: '3d', environment: 'staging', user_id: fixtureId, category: 'study', outcome: 'succeeded', severity: 'info', request_id: fixtureId, activity_id: fixtureId, route: '/notes' }), 'local', now);
  const restored = query.parseActivityFilters(query.activitySearchParams(filters), 'local', now);
  assert.deepEqual(restored, filters);
});
test('CSV neutralizes formula prefixes including whitespace, tabs and carriage returns', () => {
  for (const dangerous of ['=1+1', '+cmd', '-2+3', '@SUM(1)', '  =1', '\t=1', '\r@SUM(1)', '\n+cmd']) assert.ok(csv.activityCsvCell(dangerous).startsWith('"\''));
  assert.equal(csv.activityCsvCell('safe,"quoted"'), '"safe,""quoted"""');
  assert.equal(csv.activityCsvCell(null), '""');
});
test('local deployment cannot activate production source even if remote secrets were configured', () => {
  const previous = { ACTIVITY_ENVIRONMENT: process.env.ACTIVITY_ENVIRONMENT, ACTIVITY_SOURCE_PRODUCTION_URL: process.env.ACTIVITY_SOURCE_PRODUCTION_URL, ACTIVITY_SOURCE_PRODUCTION_TOKEN: process.env.ACTIVITY_SOURCE_PRODUCTION_TOKEN };
  try {
    process.env.ACTIVITY_ENVIRONMENT = 'local'; process.env.ACTIVITY_SOURCE_PRODUCTION_URL = 'https://example.invalid'; process.env.ACTIVITY_SOURCE_PRODUCTION_TOKEN = 'synthetic-not-a-real-token';
    assert.equal(environment.configuredSources().find((source) => source.environment === 'production').available, false);
    process.env.ACTIVITY_ENVIRONMENT = 'spoofed'; assert.throws(() => environment.activityEnvironment());
  } finally { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
test('repository uses scoped keyset query with deterministic timestamp and ID ordering', async () => {
  const calls = []; const rows = [1, 2, 3].map((value) => ({ id: `11111111-1111-4111-8111-11111111111${value}`, user_id: fixtureId, event_type: 'note.saved', properties: { revision: value }, received_at: '2026-10-17T10:00:00.123456+00:00' }));
  const builder = { then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); } };
  for (const method of ['select', 'eq', 'gte', 'lt', 'lte', 'or', 'order', 'limit']) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
  const repo = loader({ '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from: (table) => { calls.push(['from', table]); return builder; } }) } })('src/lib/repositories/activity.ts');
  const filters = { ...query.parseActivityFilters(new URLSearchParams({ range: '3h', user_id: fixtureId }), 'local', now), limit: 2 };
  const page = await repo.selectActivity(filters);
  assert.equal(page.events.length, 2); assert.ok(page.nextCursor);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === fixtureId));
  assert.deepEqual(calls.filter((call) => call[0] === 'order').map((call) => call[1]), ['received_at', 'id']);
  calls.length = 0; await repo.selectActivity({ ...filters, cursor: page.nextCursor });
  assert.ok(calls.some((call) => call[0] === 'or' && call[1].includes('123456') && call[1].includes('id.lt.')));
});
test('browser reports stay bounded, retry only three times and clear on identity changes', async () => {
  const previous = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, fetch: global.fetch };
  const tasks = []; const delays = [];
  try {
    global.setTimeout = (task, delay) => { tasks.push(task); delays.push(delay); return task; };
    global.clearTimeout = (task) => { const index = tasks.indexOf(task); if (index >= 0) tasks.splice(index, 1); };
    global.fetch = async () => { throw new Error('synthetic network failure'); };
    const buffer = loader()('src/lib/activity/browser-buffer.ts');
    buffer.resetActivityBuffer(fixtureId);
    buffer.reportRouteView('/notes');
    for (let attempt = 0; attempt < 4; attempt += 1) { assert.ok(tasks.length); tasks.shift()(); await new Promise(setImmediate); }
    assert.equal(buffer.activityBufferDiagnostics().queued, 0);
    assert.equal(buffer.activityBufferDiagnostics().failures, 4);
    assert.equal(buffer.activityBufferDiagnostics().dropped, 1);
    assert.ok(delays.every((delay) => delay <= 30000));
    for (let index = 0; index < 101; index += 1) buffer.reportRouteView('/notes');
    assert.equal(buffer.activityBufferDiagnostics().queued, 100);
    buffer.resetActivityBuffer(null);
    assert.equal(buffer.activityBufferDiagnostics().queued, 0);
    assert.equal(tasks.length, 0);
  } finally { Object.assign(global, previous); }
});
test('ingestion verifies origin and active actor, then persists only reported allowlisted events', async () => {
  const written = [];
  const ingest = loader({
    '@/lib/auth/require-active-user-api': { requireActiveUserApi: async () => ({ user: { id: fixtureId } }) },
    '@/lib/repositories/activity': { enforceActivityRateLimit: async () => true, appendActivityEvent: async (event) => { written.push(event); return fixtureId; } },
  })('src/lib/activity/ingest.ts').ingestActivity;
  const event = { event_id: fixtureId, activity_id: fixtureId, event_type: 'page.viewed', route: '/notes?private=never-log' };
  const request = (body, origin = 'http://localhost') => new Request('http://localhost/api/analytics/activity', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await ingest(request({ events: [event] }))).status, 200);
  assert.equal(written[0].user_id, fixtureId); assert.equal(written[0].outcome, 'reported'); assert.equal(written[0].source, 'browser_reported'); assert.equal(written[0].route, '/notes');
  assert.equal((await ingest(request({ events: [{ ...event, environment: 'production' }] }))).status, 400);
  assert.equal((await ingest(request({ events: [event] }, 'https://foreign.invalid'))).status, 403);
  assert.equal(written.length, 1);
});
