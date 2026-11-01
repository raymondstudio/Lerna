import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const ADMIN = '44444444-4444-4444-8444-444444444444';
const SA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
async function sql(text, values = []) { return db.query(text, values); }
async function role(role, user = null, aal = 'aal1') {
  await db.exec('reset role');
  await sql("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, ...(user ? { sub: user } : {}), aal })]);
  if (role !== 'postgres') await db.exec(`set role ${role}`);
}
async function adminSql(text, values = []) { await role('postgres'); return sql(text, values); }
async function rejectsSql(text, values = [], pattern = /permission|denied|insufficient_privilege|Unauthorized|ACTIVE_ACCOUNT|OWNER|MFA|quota|Invalid|conflict|CONFLICT|OPERATION|Foreign/i) {
  await assert.rejects(() => sql(text, values), (error) => pattern.test(error.message));
}
before(async () => {
  await db.waitReady;
  await db.exec(await readFile(path.join(root, 'tests/fixtures/stabilization-schema.sql'), 'utf8'));
  await db.exec('create extension pgcrypto with schema extensions');
  const migrations = (await readdir(path.join(root, 'supabase/migrations'))).filter((file) => file.endsWith('.sql')).sort();
  for (const file of migrations) {
    // Seed synthetic accounts after the complete historical schema, before the
    // new owner-preflight migration. No hosted identities or credentials exist.
    if (file === '20261017120000_stabilization_activity.sql') {
      for (const [id, label] of [[A, 'a'], [B, 'b'], [OWNER, 'owner'], [ADMIN, 'admin']]) await sql('insert into auth.users(id,email) values($1,$2)', [id, `${label}@fixture.invalid`]);
      await sql("update public.user_roles set role='owner' where user_id=$1", [OWNER]);
      await sql("update public.user_roles set role='admin' where user_id=$1", [ADMIN]);
    }
    try { await db.exec(await readFile(path.join(root, 'supabase/migrations', file), 'utf8')); }
    catch (error) { throw new Error(`Actual migration failed: ${file}: ${error.message} (SQLSTATE ${error.code}; position ${error.position ?? 'unknown'})`); }
    if (file === '20261017120000_stabilization_activity.sql') await sql("insert into private.activity_runtime(singleton,environment,release_id) values(true,'local','synthetic-database-tests')");
  }
  await sql('insert into public.study_sessions(id,user_id,title) values($1,$2,$3),($4,$5,$6)', [SA, A, 'Synthetic session A', SB, B, 'Synthetic session B']);
  await sql('insert into public.courses(id,user_id,title,code) values($1,$2,$3,$4)', [C, B, 'Synthetic course B', 'FIXTURE']);
});
after(async () => { await db.close(); });

test('hard deletion removes account identifiers from activity deduplication and legacy metadata', async () => {
  const actor = randomUUID(), legacy = randomUUID();
  await adminSql('insert into auth.users(id,email) values($1,$2)', [actor,'deleted@fixture.invalid']);
  const verified = (await adminSql("select private.append_event($1) id", [{ user_id: actor, event_type: 'note.saved', category: 'study', outcome: 'succeeded', source: 'database', resource_type: 'profile', resource_id: actor, dedup_key: `note:${actor}:${randomUUID()}`, properties: { revision: 1 } }])).rows[0].id;
  const administrative = (await adminSql("select private.append_event($1) id", [{ user_id: ADMIN, event_type: 'admin.settings.changed', category: 'admin', outcome: 'succeeded', source: 'database', resource_type: 'profile', resource_id: actor, dedup_key: `target:${actor}`, properties: { setting: 'account_status' } }])).rows[0].id;
  await adminSql("insert into public.events(id,user_id,event_type,properties) values($1,$2,'legacy_fixture',$3)", [legacy,actor,{ target_user_id: actor }]);
  await adminSql('delete from auth.users where id=$1', [actor]);
  const events = (await adminSql('select user_id,resource_id,dedup_key,properties,actor_type,schema_version from public.events where id=any($1::uuid[])', [[verified,legacy]])).rows;
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal(event.user_id, null); assert.equal(event.resource_id, null); assert.equal(event.dedup_key, null);
    assert.ok(!JSON.stringify(event).includes(actor));
    if (event.schema_version===0) assert.deepEqual(event.properties, {});
    else assert.equal(event.actor_type, 'system');
  }
  const staff = (await adminSql('select user_id,resource_id,dedup_key,actor_type,actor_role from public.events where id=$1', [administrative])).rows[0];
  assert.equal(staff.user_id, ADMIN); assert.equal(staff.actor_type, 'user'); assert.equal(staff.actor_role, 'admin');
  assert.equal(staff.resource_id, null); assert.equal(staff.dedup_key, null);
});

test('actual migration chain compiles against synthetic Auth/Storage provider schemas', async () => {
  const { rows } = await adminSql("select count(*)::int n from pg_proc where proname in ('save_session_notes','reserve_operation','authorize_recovery_intent','save_practice_quiz')");
  assert.equal(rows[0].n, 4);
});
test('ordinary A/B session reads have a positive control and no cross-owner visibility', async () => {
  await role('authenticated', A); assert.equal((await sql('select id from public.study_sessions where id=$1', [SA])).rows.length, 1);
  assert.equal((await sql('select id from public.study_sessions where id=$1', [SB])).rows.length, 0);
});
test('role helpers do not recurse through RLS and stale claims cannot grant admin', async () => {
  await role('authenticated', A); assert.equal((await sql('select public.is_admin($1) allowed', [A])).rows[0].allowed, false);
  await role('authenticated', ADMIN); assert.equal((await sql('select public.is_admin($1) allowed', [ADMIN])).rows[0].allowed, true);
});
test('historical discount vouchers are visible to canonical admins but not learners', async () => {
  await adminSql("insert into public.coupon_codes(code,discount_type,discount_value) values('FIXTURE-ONLY','percentage',10)");
  await role('authenticated', A);
  assert.equal((await sql("select code from public.coupon_codes where code='FIXTURE-ONLY'")).rows.length, 0);
  try { await sql("update public.coupon_codes set redemption_count=1 where code='FIXTURE-ONLY'"); }
  catch (error) { assert.match(error.message, /permission|denied|policy/i); }
  assert.equal((await adminSql("select redemption_count from public.coupon_codes where code='FIXTURE-ONLY'")).rows[0].redemption_count, 0);
  await role('authenticated', ADMIN);
  assert.equal((await sql("select code from public.coupon_codes where code='FIXTURE-ONLY'")).rows.length, 1);
});
test('direct event forgery and privileged budget/recovery RPCs reject ordinary JWT roles', async () => {
  await role('authenticated', A);
  await rejectsSql("insert into public.events(user_id,event_type) values($1,'auth.login.succeeded')", [A]);
  await rejectsSql("select public.reserve_operation($1,$2,'aiRequests',1,0,'fixture-model','chat','live')", [OP, A]);
  await rejectsSql('select public.consume_recovery_proof($1,$2,$3)', ['f'.repeat(64), A, OP]);
});
test('notes save atomically with ownership, revision and retry receipt', async () => {
  await role('authenticated', A);
  const first = (await sql('select public.save_session_notes($1,$2,0,$3) result', [SA, 'Synthetic durable note', OP])).rows[0].result;
  assert.equal(first.session.notes_revision, 1); assert.equal(first.noteWrite.replayed, false);
  const replay = (await sql('select public.save_session_notes($1,$2,0,$3) result', [SA, 'Synthetic durable note', OP])).rows[0].result;
  assert.equal(replay.noteWrite.replayed, true); assert.equal(replay.session.notes_revision, 1);
  await rejectsSql('select public.save_session_notes($1,$2,0,$3)', [SA, 'Changed retry payload', OP]);
  await rejectsSql('select public.save_session_notes($1,$2,0,$3)', [SB, 'Denied foreign note', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'], /SESSION_NOT_FOUND/);
  await rejectsSql('update public.study_sessions set notes=$1 where id=$2', ['Direct denied edit', SA]);
});
test('stale concurrent-style note revision does not overwrite a newer persisted revision', async () => {
  await role('authenticated', A);
  await sql('select public.save_session_notes($1,$2,1,$3)', [SA, 'Newer synthetic revision', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);
  await rejectsSql('select public.save_session_notes($1,$2,1,$3)', [SA, 'Stale synthetic revision', 'ffffffff-ffff-4fff-8fff-ffffffffffff']);
  assert.equal((await sql('select notes from public.study_sessions where id=$1', [SA])).rows[0].notes, 'Newer synthetic revision');
});
test('audit persistence failure rolls back note content, revision and receipt together', async () => {
  await adminSql('delete from private.activity_runtime');
  await role('authenticated', A);
  await assert.rejects(() => sql('select public.save_session_notes($1,$2,2,$3)', [SA, 'Must roll back', 'abababab-abab-4bab-8bab-abababababab']));
  await adminSql("insert into private.activity_runtime(singleton,environment,release_id) values(true,'local','synthetic-database-tests')");
  const { rows } = await adminSql('select notes,notes_revision from public.study_sessions where id=$1', [SA]);
  assert.equal(rows[0].notes, 'Newer synthetic revision'); assert.equal(rows[0].notes_revision, 2);
  assert.equal((await adminSql("select count(*)::int n from private.note_operations where operation_id='abababab-abab-4bab-8bab-abababababab'")).rows[0].n, 0);
});
test('sensitive role RPC requires AAL2 and preserves final owner', async () => {
  await role('authenticated', OWNER, 'aal1'); await rejectsSql("select public.admin_change_role($1,'admin')", [B], /MFA_REQUIRED/);
  await role('authenticated', ADMIN, 'aal2'); await rejectsSql("select public.admin_change_role($1,'admin')", [B], /OWNER_REQUIRED/);
  await role('authenticated', OWNER, 'aal2'); await rejectsSql("select public.admin_change_role($1,'user')", [OWNER], /final.*owner/i);
  await sql("select public.admin_change_role($1,'moderator')", [B]);
  assert.equal((await sql('select public.has_role_hierarchy($1,$2) allowed', [B, 'moderator'])).rows[0].allowed, true);
});
test('administrative usage and subscription changes validate MFA and roll back with audit failure', async () => {
  await adminSql("insert into public.subscription_usage(user_id,usage_date,ai_requests) values($1,(now() at time zone 'UTC')::date,4) on conflict(user_id,usage_date) do update set ai_requests=4", [A]);
  await role('authenticated', A);
  const beforeBudget = (await sql('select public.get_operation_budget_snapshot() value')).rows[0].value.usage;
  await role('authenticated', ADMIN, 'aal1');
  await rejectsSql('select public.admin_reset_usage($1)', [A], /MFA_REQUIRED/);
  await rejectsSql('select public.admin_extend_subscription($1,2)', [A], /MFA_REQUIRED/);
  await role('authenticated', ADMIN, 'aal2');
  await rejectsSql('select public.admin_extend_subscription($1,0)', [A], /INVALID_EXTENSION/);
  const before = (await adminSql('select current_period_end from public.subscriptions where user_id=$1', [A])).rows[0].current_period_end;
  await adminSql('delete from private.activity_runtime');
  await role('authenticated', ADMIN, 'aal2');
  await assert.rejects(() => sql('select public.admin_reset_usage($1)', [A]));
  await assert.rejects(() => sql('select public.admin_extend_subscription($1,2)', [A]));
  await adminSql("insert into private.activity_runtime(singleton,environment,release_id) values(true,'local','synthetic-database-tests')");
  assert.equal((await adminSql("select ai_requests from public.subscription_usage where user_id=$1 and usage_date=(now() at time zone 'UTC')::date", [A])).rows[0].ai_requests, 4);
  assert.equal((await adminSql('select current_period_end from public.subscriptions where user_id=$1', [A])).rows[0].current_period_end.toISOString(), before.toISOString());
  await role('authenticated', ADMIN, 'aal2');
  assert.equal((await sql('select public.admin_reset_usage($1) ok', [A])).rows[0].ok, true);
  assert.ok((await sql('select public.admin_extend_subscription($1,2) end_at', [A])).rows[0].end_at);
  assert.equal((await adminSql("select ai_requests from public.subscription_usage where user_id=$1 and usage_date=(now() at time zone 'UTC')::date", [A])).rows[0].ai_requests, 0);
  assert.equal((await adminSql("select count(*)::int n from public.audit_logs where user_id=$1 and action in ('usage_reset','subscription_extended')", [ADMIN])).rows[0].n, 2);
  await role('authenticated', A);
  const afterBudget = (await sql('select public.get_operation_budget_snapshot() value')).rows[0].value.usage;
  for (const key of ['aiRequests','quizzes','uploadsCount']) assert.equal(afterBudget[key], beforeBudget[key]);
});
test('suspending the final active owner is denied at the database mutation boundary', async () => {
  await role('authenticated', OWNER, 'aal2');
  await rejectsSql('update public.profiles set is_suspended=true where id=$1', [OWNER], /final.*owner/i);
});
test('suspension immediately denies ordinary existing-token reads through restrictive RLS', async () => {
  await adminSql('update public.profiles set is_suspended=true where id=$1', [B]);
  await role('authenticated', B); assert.equal((await sql('select id from public.study_sessions where id=$1', [SB])).rows.length, 0);
  await adminSql('update public.profiles set is_suspended=false where id=$1', [B]);
});
test('foreign parent IDs cannot be linked even through direct Data API-style writes', async () => {
  await role('authenticated', A);
  await rejectsSql('update public.study_sessions set course_id=$1 where id=$2', [C, SA], /Foreign course/);
});
test('service reservation is idempotent and terminal state cannot be rewritten', async () => {
  await role('service_role');
  const op = '12121212-1212-4212-8212-121212121212';
  const args = [op, A];
  const first = (await sql("select public.reserve_operation($1,$2,'aiRequests',1,0,'fixture-model','chat','live') result", args)).rows[0].result;
  const replay = (await sql("select public.reserve_operation($1,$2,'aiRequests',1,0,'fixture-model','chat','live') result", args)).rows[0].result;
  assert.equal(first.replayed, false); assert.equal(replay.replayed, true);
  await sql("select public.finish_operation($1,'succeeded','{\"promptTokens\":10,\"completionTokens\":2,\"durationMs\":5,\"tokenSource\":\"provider\"}')", [op]);
  await rejectsSql("select public.finish_operation($1,'released','{}')", [op], /OPERATION_ALREADY_FINALIZED/);
});
test('denied demo requests do not consume the accepted daily budget', async () => {
  await role('service_role');
  for (let i=0;i<10;i++) {
    assert.equal((await sql("select public.reserve_demo_operation($1,'gemini-2.5-flash','demo','mock') ok", [randomUUID()])).rows[0].ok, true);
  }
  assert.equal((await sql("select public.reserve_demo_operation($1,'gemini-2.5-flash','demo','mock') ok", [randomUUID()])).rows[0].ok, false);
  assert.equal((await adminSql("select count from private.demo_budget where window_start=date_trunc('minute',now())")).rows[0].count, 10);
  await adminSql("insert into private.demo_budget(window_start,count) values(date_trunc('day',now())+interval '1 second',90)");
  await role('service_role');
  assert.equal((await sql("select public.reserve_demo_operation($1,'gemini-2.5-flash','demo','mock') ok", [randomUUID()])).rows[0].ok, false);
  assert.equal((await adminSql("select sum(count)::int n from private.demo_budget where window_start>=date_trunc('day',now())")).rows[0].n, 100);
});
test('recovery intent/proof receipt is owner/session bound and atomically one-use', async () => {
  await role('service_role');
  const nonce = 'a'.repeat(64), browser = 'b'.repeat(64), email = 'c'.repeat(64), rate = 'd'.repeat(64), proof = 'e'.repeat(64);
  assert.equal((await sql('select public.create_recovery_intent($1,$2,$3,$4) ok', [nonce, browser, email, rate])).rows[0].ok, true);
  assert.equal((await sql('select public.authorize_recovery_intent($1,$2,$3,$4,$5,$6) ok', [nonce, 'f'.repeat(64), email, A, OP, proof])).rows[0].ok, false);
  assert.equal((await sql('select public.authorize_recovery_intent($1,$2,$3,$4,$5,$6) ok', [nonce, browser, email, A, OP, proof])).rows[0].ok, true);
  assert.equal((await sql('select public.authorize_recovery_intent($1,$2,$3,$4,$5,$6) ok', [nonce, browser, email, A, OP, 'f'.repeat(64)])).rows[0].ok, false);
  assert.equal((await sql('select public.consume_recovery_proof($1,$2,$3) ok', [proof, B, OP])).rows[0].ok, false);
  assert.equal((await sql('select public.consume_recovery_proof($1,$2,$3) ok', [proof, A, OP])).rows[0].ok, true);
  assert.equal((await sql('select public.consume_recovery_proof($1,$2,$3) ok', [proof, A, OP])).rows[0].ok, false);
});

async function material(user = A) {
  const id = randomUUID();
  await adminSql('insert into public.uploaded_materials(id,user_id,file_name,file_type,storage_path) values($1,$2,$3,$4,$5)', [id, user, 'fixture.txt', 'text/plain', `${user}/${id}.txt`]);
  return id;
}
function practice(overrides = {}) {
  return { operation_id: randomUUID(), title: 'Synthetic practice', type: 'mcq', total_questions: 1, score: 100, time_spent: 2,
    questions: [{ question_text: 'Synthetic question', correct_answer: 'a', user_answer: 'a', is_correct: true, options: ['a', 'b'] }], ...overrides };
}

test('ordinary Storage and material mutations cannot bypass the server reservation workflow', async () => {
  const id = await material();
  await adminSql('insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)', ['uploaded-materials', `${A}/${SA}/${id}.txt`, A]);
  await role('authenticated', A);
  // SELECT is the positive owner control; INSERT/UPDATE/DELETE use actual policies.
  assert.equal((await sql('select id from public.uploaded_materials where id=$1', [id])).rows.length, 1);
  await rejectsSql('insert into public.uploaded_materials(user_id,file_name,file_type,storage_path) values($1,$2,$3,$4)', [A, 'denied.txt', 'text/plain', `${A}/denied.txt`]);
  await rejectsSql('update public.uploaded_materials set status=$1 where id=$2', ['ready', id]);
  await rejectsSql('delete from public.uploaded_materials where id=$1', [id]);
  await rejectsSql('insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)', ['uploaded-materials', `${A}/${SA}/denied.txt`, A], /row-level security|permission/i);
  assert.equal((await sql('update storage.objects set name=$1 where name=$2 returning id', [`${A}/${SA}/changed.txt`, `${A}/${SA}/${id}.txt`])).rows.length, 0);
  assert.equal((await sql('delete from storage.objects where name=$1 returning id', [`${A}/${SA}/${id}.txt`])).rows.length, 0);
});

test('processing completion is service-only and validates claim identity and expiry', async () => {
  const id = await material(), claim = randomUUID();
  await role('authenticated', B); await rejectsSql('select public.claim_material_processing($1,$2)', [id, claim]);
  await role('authenticated', A);
  assert.equal((await sql('select public.claim_material_processing($1,$2) status', [id, claim])).rows[0].status, 'claimed');
  await rejectsSql("select public.finish_material_processing($1,$2,'ready','{}')", [id, claim]);
  await role('service_role');
  await rejectsSql("select public.finish_material_processing($1,$2,'ready','{}')", [id, randomUUID()]);
  assert.equal((await sql("select public.finish_material_processing($1,$2,'ready','{\"chunk_count\":1,\"summary\":\"Synthetic summary\"}') ok", [id, claim])).rows[0].ok, true);
  assert.equal((await adminSql('select status from public.uploaded_materials where id=$1', [id])).rows[0].status, 'ready');
  const expired = await material(), oldClaim = randomUUID();
  await role('authenticated', A); await sql('select public.claim_material_processing($1,$2)', [expired, oldClaim]);
  await adminSql("update private.material_processing_claims set expires_at=now()-interval '1 minute' where material_id=$1", [expired]);
  await role('service_role');
  assert.equal((await sql("select public.finish_material_processing($1,$2,'ready','{}') ok", [expired, oldClaim])).rows[0].ok, false);
});

test('practice receipts preserve owner-bound idempotence and label answers as client reported', async () => {
  const payload = practice();
  await role('authenticated', A);
  const first = (await sql('select public.save_practice_quiz($1) id', [payload])).rows[0].id;
  assert.equal((await sql('select public.save_practice_quiz($1) id', [payload])).rows[0].id, first);
  assert.equal((await sql('select result_source from public.quizzes where id=$1', [first])).rows[0].result_source, 'client_reported_practice');
  await rejectsSql('select public.save_practice_quiz($1)', [{ ...payload, title: 'Changed retry' }], /OPERATION_ID_REUSED/);
  await rejectsSql('select public.save_practice_quiz($1)', [practice({ course_id: C })]);
  await rejectsSql("insert into public.quizzes(user_id,type,score) values($1,'mcq',100)", [A]);
  await role('authenticated', B);
  assert.equal((await sql('select id from public.quizzes where id=$1', [first])).rows.length, 0);
});

test('practice RPC rejects omitted or null required fields rather than SQL UNKNOWN', async () => {
  await role('authenticated', A);
  for (const field of ['total_questions', 'score', 'title', 'type', 'questions']) {
    for (const value of [undefined, null]) {
      const payload = practice();
      if (value === undefined) delete payload[field]; else payload[field] = value;
      await assert.rejects(() => sql('select public.save_practice_quiz($1)', [payload]), `Required practice field ${field} (${String(value)}) accepted`);
    }
  }
  for (const field of ['question_text', 'correct_answer', 'is_correct']) {
    const payload = practice(); delete payload.questions[0][field];
    await assert.rejects(() => sql('select public.save_practice_quiz($1)', [payload]), `Required question field ${field} accepted`);
  }
});

test('practice quota is enforced inside the RPC and receipt retries do not spend twice', async () => {
  const original = (await adminSql("select limits from private.plan_operation_limits where plan='free'")).rows[0].limits;
  const used = (await adminSql("select count(*)::int n from public.quizzes where user_id=$1 and created_at>=date_trunc('month',now())", [A])).rows[0].n;
  await adminSql("update private.plan_operation_limits set limits=jsonb_set(limits,'{quizzes}',to_jsonb($1::int)) where plan='free'", [used + 1]);
  try {
    const payload = practice(); await role('authenticated', A);
    const id = (await sql('select public.save_practice_quiz($1) id', [payload])).rows[0].id;
    assert.equal((await sql('select public.save_practice_quiz($1) id', [payload])).rows[0].id, id);
    await sql('delete from public.quizzes where id=$1', [id]);
    await rejectsSql('select public.save_practice_quiz($1)', [payload], /PRACTICE_RESULT_DELETED/);
    await rejectsSql('select public.save_practice_quiz($1)', [practice()], /PRACTICE_LIMIT_REACHED/);
  } finally { await adminSql("update private.plan_operation_limits set limits=$1 where plan='free'", [original]); }
});
test('direct quiz holds and results share quota while AI generation leaves the final save slot', async () => {
  const original = (await adminSql("select limits from private.plan_operation_limits where plan='free'")).rows[0].limits;
  await adminSql("update private.plan_operation_limits set limits=jsonb_set(limits,'{quizzes}','1'::jsonb) where plan='free'");
  const reservation = randomUUID();
  const generation = randomUUID();
  let savedQuizId;
  try {
    await role('service_role');
    assert.equal((await sql("select public.reserve_operation($1,$2,'quizzes',1,0,'gemini-2.5-flash','quiz','live') result", [reservation,B])).rows[0].result.state, 'pending');
    await role('authenticated', B);
    await rejectsSql('select public.save_practice_quiz($1)', [practice()], /PRACTICE_LIMIT_REACHED/);
    assert.equal((await sql('select public.get_operation_budget_snapshot() value')).rows[0].value.usage.quizzes, 1);
    await role('service_role'); await sql("select public.finish_operation($1,'released','{}')", [reservation]);
    assert.equal((await sql("select public.reserve_operation($1,$2,'aiRequests',1,0,'gemini-2.5-flash','quiz','live') result", [generation,B])).rows[0].result.state, 'pending');
    await sql("select public.finish_operation($1,'succeeded','{\"promptTokens\":10,\"completionTokens\":10,\"durationMs\":5,\"tokenSource\":\"provider\"}')", [generation]);
    await role('authenticated', B);
    assert.equal((await sql('select public.get_operation_budget_snapshot() value')).rows[0].value.remaining.quizzes, 1);
    savedQuizId = (await sql('select public.save_practice_quiz($1) id', [practice()])).rows[0].id;
    await role('service_role');
    await rejectsSql("select public.reserve_operation($1,$2,'quizzes',1,0,'gemini-2.5-flash','quiz','live')", [randomUUID(),B], /QUOTA_EXHAUSTED/);
    await role('authenticated', B);
    assert.equal((await sql('select public.get_operation_budget_snapshot() value')).rows[0].value.usage.quizzes, 1);
  } finally {
    if (savedQuizId) {
      await adminSql('delete from private.practice_receipts where quiz_id=$1', [savedQuizId]);
      await adminSql('delete from public.quizzes where id=$1', [savedQuizId]);
    }
    await adminSql('delete from public.ai_requests where operation_id=$1', [generation]);
    await adminSql('delete from private.operation_reservations where id=any($1::uuid[])', [[reservation,generation]]);
    await adminSql("update private.plan_operation_limits set limits=$1 where plan='free'", [original]);
  }
});

test('cleanup leases are bounded and only the expected revision can complete a job', async () => {
  const id = await material();
  await role('authenticated', A); await sql('select public.queue_material_index_cleanup($1)', [id]);
  await rejectsSql('select public.lease_material_cleanup_jobs(1)');
  await rejectsSql('select public.complete_material_cleanup($1,1)', [id]);
  await role('service_role');
  const leased = (await sql('select public.lease_material_cleanup_jobs(1) jobs')).rows[0].jobs;
  assert.equal(leased.length, 1); assert.equal(leased[0].material_id, id); assert.equal(leased[0].attempts, 1);
  assert.equal((await sql('select public.lease_material_cleanup_jobs(1) jobs')).rows[0].jobs.length, 0);
  await role('authenticated', A);
  const queued = (await sql('select public.delete_material_and_enqueue_cleanup($1) job', [id])).rows[0].job;
  assert.equal(queued.cleanup_revision, 2);
  await role('service_role');
  assert.equal((await sql('select public.complete_material_cleanup($1,1) ok', [id])).rows[0].ok, false);
  await sql('select public.fail_material_cleanup($1,1)', [id]);
  const current = (await adminSql('select revision,last_error_code,next_attempt_at<=now() due from private.material_cleanup_jobs where material_id=$1', [id])).rows[0];
  assert.equal(current.revision, 2); assert.equal(current.last_error_code, null); assert.equal(current.due, true);
  await role('service_role');
  await rejectsSql('select public.complete_material_cleanup($1,null)', [id], /CLEANUP_REVISION_REQUIRED/);
  assert.equal((await sql('select public.complete_material_cleanup($1,2) ok', [id])).rows[0].ok, true);
  for (const limit of [null, 0, 21]) await rejectsSql('select public.lease_material_cleanup_jobs($1)', [limit], /Invalid cleanup limit/);
});

test('reply sender identity and ticket timestamp are enforced in the same database statement', async () => {
  const ticket = randomUUID();
  await adminSql("insert into public.support_tickets(id,user_id,subject,message,last_reply) values($1,$2,'Synthetic ticket','Synthetic message','2000-01-01')", [ticket, A]);
  await role('authenticated', A);
  await rejectsSql("insert into public.support_ticket_replies(ticket_id,user_id,message) values($1,$2,'Forged sender')", [ticket, B], /row-level security|permission/i);
  await sql("insert into public.support_ticket_replies(ticket_id,user_id,message) values($1,$2,'Synthetic reply')", [ticket, A]);
  assert.ok(new Date((await sql('select last_reply from public.support_tickets where id=$1', [ticket])).rows[0].last_reply).getTime() > Date.UTC(2000, 0, 1));
});

test('published broadcast audience and expiry apply to direct authenticated reads', async () => {
  const published = randomUUID(), draft = randomUUID(), expired = randomUUID(), other = randomUUID();
  await adminSql("insert into public.broadcasts(id,title,content,status,target_audience,expires_at) values($1,'Visible fixture','Synthetic','published','all',null),($2,'Draft fixture','Synthetic','draft','all',null),($3,'Expired fixture','Synthetic','published','all','2000-01-01'),($4,'Other audience','Synthetic','published','enterprise',null)", [published, draft, expired, other]);
  await role('authenticated', A);
  assert.deepEqual((await sql('select id from public.broadcasts where id=any($1::uuid[])', [[published, draft, expired, other]])).rows.map(r => r.id), [published]);
  await role('authenticated', ADMIN);
  assert.equal((await sql('select id from public.broadcasts where id=any($1::uuid[])', [[published, draft, expired, other]])).rows.length, 4);
});

test('AI rows distinguish measured known-price usage, unknown outcomes and simulations', async () => {
  const cases = [
    { model: 'gemini-2.5-flash', mode: 'live', state: 'succeeded', tokens: 'provider', cost: 0.0008 },
    { model: 'fixture-model', mode: 'live', state: 'succeeded', tokens: 'provider', cost: null },
    { model: 'gemini-2.5-flash', mode: 'live', state: 'unknown', tokens: 'unavailable', cost: null },
    { model: 'gemini-2.5-flash', mode: 'live', state: 'failed', tokens: 'unavailable', cost: null },
    { model: 'gemini-2.5-flash', mode: 'mock', state: 'simulated', tokens: 'estimated', cost: null },
  ];
  for (const c of cases) {
    const id = randomUUID(); await role('service_role');
    await sql("select public.reserve_operation($1,$2,'aiRequests',1,0,$3,'chat',$4)", [id, A, c.model, c.mode]);
    await sql('select public.finish_operation($1,$2,$3)', [id, c.state, { promptTokens: 1000, completionTokens: 200, durationMs: 321, tokenSource: c.tokens }]);
    const row = (await adminSql('select authoritative_outcome,latency_ms,estimated_cost,cost_status,pricing_version from public.ai_requests where operation_id=$1', [id])).rows[0];
    assert.equal(row.authoritative_outcome, c.state); assert.equal(row.latency_ms, 321);
    assert.equal(row.estimated_cost === null ? null : Number(row.estimated_cost), c.cost);
    assert.equal(row.cost_status, c.cost === null ? 'unavailable' : 'estimated');
    if (c.cost !== null) assert.match(row.pricing_version, /^google-standard-/);
  }
  await role('authenticated', A); await rejectsSql("insert into public.ai_requests(user_id,status) values($1,'success')", [A]);
  await role('authenticated', ADMIN);
  const bi = (await sql("select public.get_admin_business_intelligence(now()-interval '1 hour',now()+interval '1 minute','Africa/Lagos','hour',false) result")).rows[0].result;
  assert.ok(bi.metrics); assert.equal(bi.metrics.ai_requests, 4); assert.equal(bi.metrics.ai_failures, 1);
  assert.equal(bi.metrics.ai_unknown, 1); assert.equal(bi.metrics.ai_simulated, 1);
  assert.equal(bi.metrics.ai_estimated_cost, null);
});

test('processing artifacts require the service and live owner claim and are purged on matching tombstone cleanup', async () => {
  const id = await material(), claim = randomUUID(), key = 'a'.repeat(64);
  await role('authenticated', A); await sql('select public.claim_material_processing($1,$2)', [id,claim]);
  await rejectsSql("select public.get_material_processing_artifact($1,$2,$3,'extraction')", [id,claim,key]);
  await role('service_role');
  await rejectsSql("select public.put_material_processing_artifact($1,$2,$3,'extraction',$4)", [id,randomUUID(),key,[{text:'Synthetic'}]]);
  await sql("select public.put_material_processing_artifact($1,$2,$3,'extraction',$4)", [id,claim,key,[{text:'Synthetic material'}]]);
  assert.deepEqual((await sql("select public.get_material_processing_artifact($1,$2,$3,'extraction') value",[id,claim,key])).rows[0].value,[{text:'Synthetic material'}]);
  await rejectsSql("select public.put_material_processing_artifact($1,$2,$3,'embedding',$4)",[id,claim,key,[0.1]],/dimensions/);
  await role('authenticated', A);
  const job = (await sql('select public.delete_material_and_enqueue_cleanup($1) job',[id])).rows[0].job;
  await role('service_role');
  await rejectsSql("select public.get_material_processing_artifact($1,$2,$3,'extraction')",[id,claim,key]);
  assert.equal((await sql('select public.complete_material_cleanup($1,$2) ok',[id,job.cleanup_revision])).rows[0].ok,true);
  assert.equal((await adminSql('select count(*)::int n from private.material_processing_artifacts where material_id=$1',[id])).rows[0].n,0);
});

test('budget snapshots count uncertain and pending operations and cannot read another actor', async () => {
  await role('authenticated', A);
  const snapshot = (await sql('select public.get_operation_budget_snapshot() value')).rows[0].value;
  assert.equal(snapshot.budgetSource,'durable_reservations'); assert.equal(snapshot.plan,'free');
  assert.ok(snapshot.usage.aiRequests>=4); assert.ok(snapshot.remaining.aiRequests<snapshot.limits.aiRequests);
  await role('anon'); await rejectsSql('select public.get_operation_budget_snapshot()');
  await role('authenticated', B);
  const other = (await sql('select public.get_operation_budget_snapshot() value')).rows[0].value;
  assert.equal(other.usage.aiRequests,0);
});

test('stale provider holds become unknown rather than released or successful, once', async () => {
  const id = randomUUID(); await role('service_role');
  await sql("select public.reserve_operation($1,$2,'aiRequests',1,0,'fixture-model','chat','live')",[id,B]);
  await adminSql("update private.operation_reservations set created_at=now()-interval '1 hour' where id=$1",[id]);
  await role('authenticated',B); await rejectsSql('select public.reconcile_stale_operations(100)');
  await role('service_role');
  assert.equal((await sql('select public.reconcile_stale_operations(100) n')).rows[0].n,1);
  assert.equal((await sql('select public.reconcile_stale_operations(100) n')).rows[0].n,0);
  assert.equal((await adminSql('select state from private.operation_reservations where id=$1',[id])).rows[0].state,'unknown');
});

test('learner feedback own-read and admin feedback/broadcast/coupon/institution mutations enforce role and MFA boundaries', async () => {
  await role('authenticated', A);
  const fbId = (await sql("insert into public.feedback(user_id,type,message,rating) values($1,'general','Synthetic feedback',5) returning id", [A])).rows[0].id;
  assert.equal((await sql('select count(*)::int n from public.feedback where id=$1', [fbId])).rows[0].n, 1);
  assert.equal((await sql("update public.feedback set status='planned' where id=$1 returning id", [fbId])).rows.length, 0);
  await role('authenticated', B);
  assert.equal((await sql('select count(*)::int n from public.feedback where id=$1', [fbId])).rows[0].n, 0);
  await rejectsSql("insert into public.broadcasts(title,content,created_by,status,target_audience) values('T','C',$1,'published','all')", [B], /row-level security|permission|denied/i);
  await role('authenticated', ADMIN, 'aal1');
  await sql("update public.feedback set status='planned',admin_notes='Reviewed' where id=$1", [fbId]);
  const bId = (await sql("insert into public.broadcasts(title,content,created_by,status,target_audience) values('Synthetic','Body',$1,'published','all') returning id", [ADMIN])).rows[0].id;
  assert.ok(bId);
  await rejectsSql("insert into public.coupon_codes(code,discount_type,discount_value,is_active) values('SYNTHETIC10','percentage',10,true)", [], /MFA_REQUIRED/);
  const instId = (await sql("insert into public.institutions(name,institution_type,is_verified) values('Synthetic Institute','University',false) returning id")).rows[0].id;
  await rejectsSql('update public.institutions set is_verified=true where id=$1', [instId], /MFA_REQUIRED/);
  await role('authenticated', ADMIN, 'aal2');
  await sql("insert into public.coupon_codes(code,discount_type,discount_value,is_active) values('SYNTHETIC10','percentage',10,true)");
  await sql("update public.coupon_codes set is_active=false where code='SYNTHETIC10'");
  await sql('update public.institutions set is_verified=true where id=$1', [instId]);
  await sql('delete from public.institutions where id=$1', [instId]);
});

test('hardened legacy admin RPCs enforce AAL2 on no-op and state-changing calls, reject missing targets and avoid legacy v0 event pollution', async () => {
  await role('authenticated', ADMIN, 'aal1');
  await rejectsSql('select public.admin_toggle_suspension($1,false)', [B], /MFA_REQUIRED/);
  await rejectsSql('select public.admin_toggle_soft_delete($1,false)', [B], /MFA_REQUIRED/);
  await rejectsSql('select public.admin_delete_user($1)', [B], /MFA_REQUIRED/);
  await rejectsSql("select public.admin_assign_plan($1,'pro','active',false)", [B], /MFA_REQUIRED/);
  await role('authenticated', ADMIN, 'aal2');
  await rejectsSql('select public.admin_toggle_suspension($1,true)', [randomUUID()], /TARGET_NOT_FOUND/);
  await rejectsSql('select public.admin_toggle_soft_delete($1,true)', [randomUUID()], /TARGET_NOT_FOUND/);
  await rejectsSql("select public.admin_assign_plan($1,'pro','active',false)", [randomUUID()], /TARGET_NOT_FOUND/);
  await rejectsSql("select public.admin_assign_plan($1,'invalid_plan','active',false)", [B], /INVALID_PLAN/);
  await rejectsSql("select public.admin_assign_plan($1,'pro','invalid_status',false)", [B], /INVALID_PLAN_STATUS/);
  const v0Before = (await adminSql('select count(*)::int n from public.events where schema_version=0')).rows[0].n;
  await role('authenticated', ADMIN, 'aal2');
  await sql('select public.admin_delete_user($1)', [B]);
  await sql('select public.admin_toggle_soft_delete($1,false)', [B]);
  const v0After = (await adminSql('select count(*)::int n from public.events where schema_version=0')).rows[0].n;
  assert.equal(v0After, v0Before);
});



test('profile update audit omits name PII and hard user deletion scrubs target identifiers from audit_logs', async () => {
  const tempUser = randomUUID();
  await adminSql('insert into auth.users(id,email) values($1,$2)', [tempUser, 'pii@fixture.invalid']);
  await role('authenticated', tempUser);
  await sql("update public.profiles set first_name='PrivateFirst',last_name='PrivateLast' where id=$1", [tempUser]);
  const selfLog = (await adminSql("select details from public.audit_logs where user_id=$1 and action='profile_updated' order by created_at desc limit 1", [tempUser])).rows[0];
  assert.equal(selfLog.details.old_name, undefined);
  assert.equal(selfLog.details.new_name, undefined);
  await role('authenticated', ADMIN, 'aal2');
  await sql('select public.admin_toggle_suspension($1,true)', [tempUser]);
  await adminSql('delete from auth.users where id=$1', [tempUser]);
  const leaked = (await adminSql('select count(*)::int n from public.audit_logs where user_id=$1 or details::text like $2', [tempUser, `%${tempUser}%`])).rows[0].n;
  assert.equal(leaked, 0);
});

test('upload reservations and recovery proof consumption emit v1 activity lifecycle events', async () => {
  const upOp = randomUUID(), nonce = 'b'.repeat(64), browser = 'c'.repeat(64), email = 'd'.repeat(64), rate = 'e'.repeat(64), proof = '9'.repeat(64);
  await role('service_role');
  await sql("select public.reserve_operation($1,$2,'uploads',1,2048,null,'material_upload','live')", [upOp, A]);
  await sql("select public.finish_operation($1,'succeeded','{}')", [upOp]);
  await sql('select public.create_recovery_intent($1,$2,$3,$4)', [nonce, browser, email, rate]);
  await sql('select public.authorize_recovery_intent($1,$2,$3,$4,$5,$6)', [nonce, browser, email, A, OP, proof]);
  assert.equal((await sql('select public.consume_recovery_proof($1,$2,$3) ok', [proof, A, OP])).rows[0].ok, true);
  const events = (await adminSql("select event_type,outcome from public.events where dedup_key in ($1,$2,$3) order by event_type", [`upload:start:${upOp}`, `upload:terminal:${upOp}`, `recovery:complete:${proof}`])).rows;
  assert.deepEqual(events, [
    { event_type: 'auth.recovery.completed', outcome: 'succeeded' },
    { event_type: 'material.upload.completed', outcome: 'succeeded' },
    { event_type: 'material.upload.started', outcome: 'pending' },
  ]);
});
