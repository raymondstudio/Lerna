import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = new Map();
function load(relative, mocks = {}, cache = modules) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const packet = { exports: {} };
  cache.set(filename, packet.exports);
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks, cache);
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks, cache);
    return require(name);
  };
  const context = vm.createContext({ module: packet, exports: packet.exports, require: localRequire, setTimeout, clearTimeout,
    TextEncoder, TextDecoder, crypto: webcrypto, Buffer, Response, Request, AbortSignal, URLSearchParams, fetch: mocks.fetch ?? fetch, console });
  vm.runInContext(compiled, context, { filename });
  cache.set(filename, packet.exports);
  return packet.exports;
}
const { NoteSaveController, NoteSaveError } = load("src/lib/study-sessions/note-save-controller.ts");
const drafts = load("src/lib/study-sessions/note-drafts.ts");
const plain = value => JSON.parse(JSON.stringify(value));
const remote = (notes = "", notesRevision = 0) => ({ id: "11111111-1111-4111-8111-111111111111", notes, notesRevision });
const id = (() => { let number = 0; return () => `00000000-0000-4000-8000-${String(++number).padStart(12, "0")}`; })();
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function clock() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  return { setTimer: (callback, ms) => { const key = ++sequence; timers.set(key, { callback, at: now + ms }); return key; },
    clearTimer: key => timers.delete(key),
    tick: ms => { const end = now + ms; while (true) { const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; next[1].callback(); } now = end; },
  };
}
function server(initial = remote()) {
  let snapshot = initial;
  const receipts = new Map();
  const requests = [];
  let writes = 0;
  return { requests, get snapshot() { return snapshot; }, get writes() { return writes; },
    save: async operation => {
      requests.push(plain(operation));
      if (receipts.has(operation.operationId)) return { session: snapshot, noteWrite: { ...receipts.get(operation.operationId), replayed: true } };
      if (operation.expectedNotesRevision !== snapshot.notesRevision) throw new NoteSaveError("Conflict", 409, snapshot);
      snapshot = { ...snapshot, notes: operation.notes, notesRevision: snapshot.notesRevision + 1 };
      writes++;
      const receipt = { operationId: operation.operationId, appliedRevision: snapshot.notesRevision, replayed: false };
      receipts.set(operation.operationId, receipt);
      return { session: snapshot, noteWrite: receipt };
    },
  };
}
function controller(service, snapshot = service.snapshot, overrides = {}, recovered) {
  const states = [];
  const draftStates = [];
  const time = clock();
  const instance = new NoteSaveController(snapshot, { save: service.save, newId: id, changed: (state, draft) => { states.push(plain(state)); draftStates.push(plain(draft)); },
    delay: async () => {}, ...time, ...overrides }, recovered);
  return { instance, states, draftStates, time };
}

test("hydration never saves an empty/stale initialization over existing notes", async () => {
  const service = server(remote("Existing work", 7));
  const { instance, time } = controller(service);
  instance.schedule(); time.tick(10_000);
  assert.equal(await instance.flush(), true);
  assert.equal(service.requests.length, 0);
  instance.hydrate(remote("Current server work", 8));
  assert.equal(instance.getSnapshot().value, "Current server work");
  assert.equal(service.requests.length, 0);
});

test("an edit made while a save is pending is serialized and never acknowledged early", async () => {
  const service = server();
  const first = deferred();
  let count = 0;
  const { instance, states } = controller(service, service.snapshot, { save: async operation => {
    if (++count === 1) await first.promise;
    return service.save(operation);
  } });
  instance.edit("First draft");
  const pending = instance.flush();
  instance.edit("Newer draft");
  assert.equal(instance.getSnapshot().status, "saving");
  first.resolve();
  assert.equal(await pending, true);
  assert.deepEqual(service.requests.map(request => [request.notes, request.expectedNotesRevision]), [["First draft", 0], ["Newer draft", 1]]);
  assert.equal(states.some(state => state.status === "saved" && state.value === "First draft"), false);
  assert.equal(service.snapshot.notes, "Newer draft");
});

test("a committed write with a dropped response retries one operation and writes once", async () => {
  const service = server();
  let drop = true;
  const { instance, draftStates } = controller(service, service.snapshot, { save: async operation => {
    const receipt = await service.save(operation);
    if (drop) { drop = false; throw new NoteSaveError("Response dropped"); }
    return receipt;
  } });
  instance.edit("Keep this work");
  assert.equal(await instance.flush(), true);
  assert.equal(service.writes, 1);
  assert.equal(service.requests[0].operationId, service.requests[1].operationId);
  assert.equal(draftStates.some(draft => draft?.operation?.operationId === service.requests[0].operationId), true);
  assert.equal(instance.getDraft(), null);
});

test("failed writes keep the draft and same retry identity across a reload", async () => {
  const service = server();
  const { instance } = controller(service, service.snapshot, { save: async () => { throw new NoteSaveError("Offline"); } });
  instance.edit("Offline draft");
  assert.equal(await instance.flush(), false);
  const recovered = plain(instance.getDraft());
  assert.equal(instance.getSnapshot().status, "failed");
  const { instance: reopened } = controller(service, service.snapshot, {}, recovered);
  assert.equal(await reopened.flush(), true);
  assert.equal(service.requests[0].operationId, recovered.operation.operationId);
  assert.equal(service.snapshot.notes, "Offline draft");
});

test("two tabs surface a conflict, retain both versions and require explicit reconciliation", async () => {
  const service = server(remote("Original", 3));
  const first = controller(service).instance;
  const second = controller(service).instance;
  first.edit("Tab A"); second.edit("Tab B");
  assert.equal(await first.flush(), true);
  assert.equal(await second.flush(), false);
  assert.equal(second.getSnapshot().status, "conflict");
  assert.equal(second.getSnapshot().value, "Tab B");
  assert.equal(second.getSnapshot().conflict.notes, "Tab A");
  second.edit("Tab B kept");
  assert.equal(await second.flush(), false);
  assert.equal(service.writes, 1);
  assert.equal(await second.keepDraftAndSave(), true);
  assert.equal(service.snapshot.notes, "Tab B kept");
  assert.equal(service.snapshot.notesRevision, 5);
});

test("replaying an old successful write after another tab saved surfaces the newer version", async () => {
  const service = server();
  let drop = true;
  let outage = true;
  const { instance } = controller(service, service.snapshot, { save: async operation => {
    if (!drop && outage) throw new NoteSaveError("Offline");
    const result = await service.save(operation);
    if (drop) { drop = false; throw new NoteSaveError("Dropped"); }
    return result;
  } });
  instance.edit("Earlier content");
  assert.equal(await instance.flush(), false);
  await service.save({ notes: "Other tab", expectedNotesRevision: 1, operationId: id() });
  outage = false;
  assert.equal(await instance.flush(), false);
  assert.equal(instance.getSnapshot().status, "conflict");
  assert.equal(instance.getSnapshot().conflict.notes, "Other tab");
  assert.equal(service.writes, 2);
});

test("continuous typing is bounded by max wait; disposal cancels pending debounces", async () => {
  const service = server();
  const { instance, time } = controller(service);
  for (let index = 0; index < 10; index++) { instance.edit(`Draft ${index}`); time.tick(500); }
  assert.equal(service.requests.length, 1, "maximum wait starts a request even while keystrokes keep resetting debounce");
  await instance.flush();
  const otherService = server();
  const other = controller(otherService);
  other.instance.edit("Unsent"); other.instance.dispose(); other.time.tick(10_000);
  assert.equal(otherService.requests.length, 0);
});

test("Unicode byte limits reject oversized writes while explicit clearing is saved", async () => {
  const service = server(remote("Before", 1));
  const { instance } = controller(service);
  instance.edit("🧠".repeat(25_001));
  assert.equal(await instance.flush(), false);
  assert.equal(instance.getSnapshot().value.length, 50_002);
  assert.equal(service.writes, 0);
  instance.edit("");
  assert.equal(await instance.flush(), true);
  assert.equal(service.snapshot.notes, "");
});

test("draft storage is scoped, expires at 24 hours and reports quota failure", () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const key = drafts.noteDraftKey("user-a", "session-a");
  const draft = { version: 1, content: "Unsent", baseContent: "", baseRevision: 0, savedAt: 100 };
  assert.equal(drafts.writeNoteDraft(storage, key, draft), true);
  assert.equal(drafts.readNoteDraft(storage, drafts.noteDraftKey("user-b", "session-a"), 200), null);
  assert.equal(drafts.readNoteDraft(storage, key, 200).content, "Unsent");
  assert.equal(drafts.readNoteDraft(storage, key, 100 + drafts.DRAFT_TTL_MS), null);
  assert.equal(entries.has(key), false);
  assert.equal(drafts.writeNoteDraft({ ...storage, setItem: () => { throw new Error("Quota"); } }, key, draft), false);
});

test("dirty drafts are never overwritten by background revalidation or older responses", () => {
  const service = server(remote("Original", 2));
  const { instance } = controller(service);
  instance.edit("My draft");
  instance.hydrate(remote("Elsewhere", 3));
  instance.hydrate(remote("Stale response", 1));
  assert.equal(instance.getSnapshot().value, "My draft");
  assert.equal(instance.getSnapshot().conflict.notes, "Elsewhere");
  instance.useSavedVersion();
  assert.equal(instance.getSnapshot().value, "Elsewhere");
  assert.equal(instance.getSnapshot().status, "saved");
});

test("a delayed acknowledgement cannot replace a newer revision observed during the request", async () => {
  const service = server();
  const response = deferred();
  const { instance } = controller(service, service.snapshot, { save: async operation => {
    const result = await service.save(operation);
    await response.promise;
    return result;
  } });
  instance.edit("My saved edit");
  const pending = instance.flush();
  instance.hydrate(remote("Newer other-tab work", 2));
  response.resolve();
  assert.equal(await pending, false);
  assert.equal(instance.getSnapshot().status, "conflict");
  assert.equal(instance.getSnapshot().conflict.notes, "Newer other-tab work");
  assert.equal(instance.getSnapshot().value, "My saved edit");
});

test("recovering a historical version pauses all automatic writes until explicit confirmation", async () => {
  const service = server(remote("Current saved note", 4));
  const { instance, time } = controller(service);
  instance.recoverVersion("Earlier preserved note");
  time.tick(10_000);
  assert.equal(instance.getSnapshot().status, "conflict");
  assert.equal(service.requests.length, 0);
  assert.equal(await instance.flush(), false);
  assert.equal(await instance.keepDraftAndSave(), true);
  assert.equal(service.snapshot.notes, "Earlier preserved note");
  assert.equal(service.snapshot.notesRevision, 5);
});

test("authentication and validation failures are not retried or reported as saved", async () => {
  const service = server();
  let calls = 0;
  const { instance } = controller(service, service.snapshot, { save: async () => { calls++; throw new NoteSaveError("Sign in again", 401); } });
  instance.edit("Private unsaved draft");
  assert.equal(await instance.flush(), false);
  assert.equal(calls, 1);
  assert.equal(instance.getSnapshot().status, "failed");
  assert.equal(instance.getSnapshot().value, "Private unsaved draft");
});

test("the actual HTTP transport rejects a fulfilled500 and treats a broken200 as ambiguous", async () => {
  const operation = { notes: "Unsent", expectedNotesRevision: 0, operationId: id() };
  const unavailable = load("src/hooks/use-persisted-notes.ts", { fetch: async () => new Response(JSON.stringify({ success: false, error: { message: "Unavailable" } }), { status: 500 }) }, new Map());
  await assert.rejects(unavailable.saveNote(remote().id, operation), error => error.status === 500);
  const broken = load("src/hooks/use-persisted-notes.ts", { fetch: async () => new Response("Broken response", { status: 200 }) }, new Map());
  await assert.rejects(broken.saveNote(remote().id, operation), error => error.status === 0);
});

// API/repository tests below exercise public boundaries with synthetic clients, not a real database.
const json = (value, options) => new Response(JSON.stringify(value), { ...options, headers: { "content-type": "application/json" } });
class FixtureAuthApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}
const apiMocks = { "next/server": { NextResponse: { json } }, "@/lib/auth/require-active-user-api": { AuthApiError: FixtureAuthApiError } };
const api = load("src/lib/study-sessions/api.ts", apiMocks, new Map());
test("note input requires preconditions and rejects malformed/oversized writes", () => {
  assert.throws(() => api.noteOperation({ notes: "Legacy unsafe write" }), error => error.status === 428);
  assert.throws(() => api.noteOperation({ notes: "x", expectedNotesRevision: -1, operationId: id() }), error => error.status === 400);
  assert.throws(() => api.noteOperation({ notes: "é".repeat(50_001), expectedNotesRevision: 0, operationId: id() }), error => error.status === 413);
  const valid = api.noteOperation({ notes: "Math: ∑ x\n[source](material-id)", expectedNotesRevision: 2, operationId: id() });
  assert.equal(valid.expectedNotesRevision, 2);
});

test("bounded JSON parsing rejects nonobjects, bad JSON and oversized streams", async () => {
  await assert.rejects(api.readSessionBody(new Request("http://local.test", { method: "POST", body: "[]" })), error => error.status === 400);
  await assert.rejects(api.readSessionBody(new Request("http://local.test", { method: "POST", body: "{" })), error => error.status === 400);
  await assert.rejects(api.readSessionBody(new Request("http://local.test", { method: "POST", body: "x".repeat(650_001) })), error => error.status === 413);
});

test("owner lookup precedes the notes RPC, with allowed and denied positive controls", async () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const own = remote("Own", 1).id;
  const other = "22222222-2222-4222-8222-222222222222";
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => {
      let sessionId;
      const query = { select: () => query, eq: (column, value) => { if (column === "id") sessionId = value; return query; },
        maybeSingle: async () => ({ data: sessionId === own ? { id: own, user_id: userId, notes: "Own", notes_revision: 1 } : null, error: null }) };
      return query;
    },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { session: { id: own, notes: args.p_notes, notes_revision: 2 }, noteWrite: { operationId: args.p_operation_id, appliedRevision: 2, replayed: false } }, error: null }; },
  };
  const route = load("src/app/api/study-sessions/[sessionId]/route.ts", { ...apiMocks, "@/lib/auth/require-active-user-api": {
    AuthApiError: FixtureAuthApiError, requireActiveUserApi: async () => ({ supabase: client, user: { id: userId } }),
  } }, new Map());
  const request = () => new Request("http://local.test", { method: "PATCH", body: JSON.stringify({ notes: "Synthetic work", expectedNotesRevision: 1, operationId: id() }) });
  const allowed = await route.PATCH(request(), { params: Promise.resolve({ sessionId: own }) });
  assert.equal(allowed.status, 200);
  const allowedBody = await allowed.json();
  assert.equal(allowedBody.data.session.notesRevision, 2);
  const denied = await route.PATCH(request(), { params: Promise.resolve({ sessionId: other }) });
  assert.equal(denied.status, 404);
  assert.equal(calls.length, 1);
});

test("database conflict responses preserve the safe owner snapshot and never become Saved", async () => {
  const repository = load("src/lib/repositories/study-sessions.ts", {}, new Map());
  const client = { rpc: async () => ({ data: null, error: { code: "PT409", message: "NOTES_CONFLICT", details: JSON.stringify({ id: remote().id, notes: "Saved elsewhere", notes_revision: 8 }) } }) };
  await assert.rejects(repository.saveOwnedNotes(client, remote().id, { notes: "Draft", expectedNotesRevision: 7, operationId: id() }), error => error.status === 409 && error.currentSession.notes === "Saved elsewhere" && error.currentSession.notesRevision === 8);
});

test("pagination preserves timestamp microseconds and a deterministic ID tie breaker", async () => {
  const repository = load("src/lib/repositories/study-sessions.ts", {}, new Map());
  const timestamp = "2026-10-17T11:20:30.123456+00:00";
  const rows = [{ id: remote().id, updated_at: timestamp }, { id: "22222222-2222-4222-8222-222222222222", updated_at: timestamp }];
  const filters = [];
  const ordering = [];
  const client = { from: () => {
    const query = { select: () => query, eq: () => query, or: value => { filters.push(value); return query; }, order: (column, options) => { ordering.push([column, options.ascending]); return query; }, limit: async () => ({ data: rows, error: null }) };
    return query;
  } };
  const page = await repository.listOwnedSessions(client, "fixture", { limit: 1, before: null, search: "" });
  const decoded = JSON.parse(Buffer.from(page.nextCursor, "base64url").toString("utf8"));
  assert.equal(decoded.at, timestamp);
  await repository.listOwnedSessions(client, "fixture", { limit: 1, before: page.nextCursor, search: "" });
  assert.ok(filters[0].includes(timestamp));
  assert.deepEqual(ordering.slice(0, 2), [["updated_at", false], ["id", false]]);
});

test("metadata races retry against current data without losing topics or decreasing duration", async () => {
  const repository = load("src/lib/repositories/study-sessions.ts", {}, new Map());
  let attempts = 0;
  const writes = [];
  let current = { id: remote().id, updated_at: "2026-10-17T10:00:00Z", duration_seconds: 120, topics_covered: ["Existing"], status: "active" };
  const client = { from: () => {
    let fields;
    const query = { select: () => query, eq: () => query, update: value => { fields = value; return query; }, maybeSingle: async () => {
      if (!fields) return { data: current, error: null };
      writes.push(plain(fields));
      if (++attempts === 1) { current = { ...current, topics_covered: ["Existing", "Other tab"], duration_seconds: 200, updated_at: "2026-10-17T10:00:01Z" }; return { data: null, error: null }; }
      return { data: { ...current, ...fields }, error: null };
    } };
    return query;
  } };
  const result = await repository.updateOwnedSession(client, "fixture", remote().id, { duration_seconds: 100, topics_covered: ["My topic"] });
  assert.equal(writes.length, 2);
  assert.equal(result.durationSeconds, 200);
  assert.deepEqual(plain(result.topicsCovered), ["Existing", "Other tab", "My topic"]);
});

test("inactive and unavailable account verification preserve403/503 before any session query", async () => {
  for (const [status, code] of [[403, "ACCOUNT_INACTIVE"], [503, "AUTH_UNAVAILABLE"]]) {
    const route = load("src/app/api/study-sessions/[sessionId]/route.ts", { ...apiMocks, "@/lib/auth/require-active-user-api": {
      AuthApiError: FixtureAuthApiError,
      requireActiveUserApi: async () => { throw new FixtureAuthApiError("Account check failed", status, code); },
    } }, new Map());
    const response = await route.GET(new Request("http://local.test"), { params: Promise.resolve({ sessionId: remote().id }) });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
});

test("controlled logout flushes first and does not prompt after a confirmed save", async () => {
  const registry = load("src/lib/study-sessions/unsaved-work.ts", {}, new Map());
  let dirty = true;
  let prompted = false;
  const unregister = registry.registerUnsavedWork({ isUnsaved: () => dirty, flush: async () => { dirty = false; return true; }, hasRecoveryDraft: () => false });
  assert.equal(await registry.confirmUnsavedWorkBeforeSignOut(() => { prompted = true; return false; }), true);
  assert.equal(prompted, false);
  unregister();
});

test("controlled logout can be cancelled when a write fails and keeps recovery honest", async () => {
  const registry = load("src/lib/study-sessions/unsaved-work.ts", {}, new Map());
  const prompts = [];
  const unregister = registry.registerUnsavedWork({ isUnsaved: () => true, flush: async () => false, hasRecoveryDraft: () => false });
  assert.equal(await registry.confirmUnsavedWorkBeforeSignOut(message => { prompts.push(message); return false; }), false);
  assert.match(prompts[0], /local recovery is unavailable/);
  assert.equal(await registry.confirmUnsavedWorkBeforeSignOut(() => true), true);
  unregister();
  assert.equal(await registry.confirmUnsavedWorkBeforeSignOut(() => { throw new Error("No editor should remain"); }), true);
});

test("account switch while completion flushes prevents PATCH, and a current account can complete", async () => {
  const { StudyActionScope, completeCurrentStudySession } = load("src/lib/study-sessions/action-scope.ts");
  const scope = new StudyActionScope(); scope.activate();
  const flush = deferred();
  const calls = [];
  const options = { isCurrent: scope.capture(), flush: () => flush.promise,
    save: async () => { calls.push("PATCH"); return "account A session"; },
    completed: session => calls.push(session), summary: async () => { calls.push("summary"); } };
  const pending = completeCurrentStudySession(options);
  scope.close(); scope.activate(); flush.resolve(true);
  assert.equal(await pending, "obsolete");
  assert.deepEqual(calls, []);
  assert.equal(await completeCurrentStudySession({ ...options, isCurrent: scope.capture(), flush: async () => true }), "completed");
  assert.deepEqual(calls, ["PATCH", "account A session", "summary"]);
});

test("late A completion cannot update B cache, phase, or summary after its PATCH was sent", async () => {
  const { StudyActionScope, completeCurrentStudySession } = load("src/lib/study-sessions/action-scope.ts");
  const scope = new StudyActionScope(); scope.activate();
  const response = deferred();
  const sent = deferred();
  const calls = [];
  const pending = completeCurrentStudySession({ isCurrent: scope.capture(), flush: async () => true,
    save: () => { calls.push("A PATCH"); sent.resolve(); return response.promise; },
    completed: session => calls.push(`cache and phase ${session}`), summary: async () => { calls.push("A summary"); } });
  await sent.promise;
  assert.deepEqual(calls, ["A PATCH"]);
  scope.close(); scope.activate(); response.resolve("A");
  assert.equal(await pending, "obsolete");
  assert.deepEqual(calls, ["A PATCH"]);
  assert.equal(await completeCurrentStudySession({ isCurrent: scope.capture(), flush: async () => true,
    save: async () => "B", completed: session => calls.push(`cache and phase ${session}`), summary: async () => { calls.push("B summary"); } }), "completed");
  assert.deepEqual(calls, ["A PATCH", "cache and phase B", "B summary"]);
});

test("aborted A history is discarded even when its transport resolves after B history", async () => {
  const delayed = deferred();
  let requests = 0;
  const { loadStudyHistory } = load("src/lib/study-sessions/history-loader.ts", { fetch: async () => {
    requests++;
    return requests === 1 ? delayed.promise : Response.json({ success: true, data: { sessions: [{ id: "B", title: "B title" }], nextCursor: null } });
  } }, new Map());
  const accountA = new AbortController();
  const pendingA = loadStudyHistory(accountA.signal);
  accountA.abort();
  const accountB = new AbortController();
  const pageB = await loadStudyHistory(accountB.signal);
  assert.equal(pageB.sessions[0].title, "B title");
  delayed.resolve(Response.json({ success: true, data: { sessions: [{ id: "A", title: "A title" }], nextCursor: "older A" } }));
  assert.equal(await pendingA, null);
  assert.equal(pageB.sessions[0].title, "B title");
});
