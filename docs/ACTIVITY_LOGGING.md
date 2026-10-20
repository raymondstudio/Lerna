# Activity logging

This change supplies local application contracts, ingestion, investigation UI, exports, and source adapters. It does not establish production delivery, apply hosted migrations, configure hosted source credentials, or prove retention scheduling. Real integration evidence must identify the database and rollout revision.

## Ledger and trust

`public.events` is the canonical v1 stream. Existing `id`, `user_id`, `event_type`, `properties`, and `created_at` remain compatible; additional v1 fields record environment/release, category/outcome/severity, received/occurred timestamps, actor/source, safe routes/resources, correlations, and deduplication identity. Legacy rows remain version 0 and are excluded from v1 counts. Existing operational tables remain authoritative for their own business records.

`src/lib/activity/contracts.ts` defines the event and metadata allowlists. Browser ingestion accepts only `page.viewed` and `study_session.opened`, labels them `browser_reported` / `reported`, derives actor from a validated active session, and obtains environment server-side. A page report is not evidence of reading, learning, authentication success, or a durable write. Unknown fields, trusted outcome claims, forged actor/environment fields, content, control characters, and oversized input are rejected.

Server event producers use `appendActivityEvent` in the repository, calling restricted `append_activity_event(p_event jsonb)`. The SQL writer must independently validate the environment against `private.activity_runtime` and enforce its own event/metadata constraints. Normal users receive no general trusted-event insertion privileges. App append-only permissions do not make owner/service-role maintenance cryptographically tamper-proof.

Never use auth tokens or raw auth-session IDs as correlations. Activity IDs are random, non-secret per-tab IDs cleared on account change. Retain no passwords, cookies, recovery links, request/response bodies, prompts/answers, note/document content, titles, search strings, raw user agents, full referrers, or precise locations. Event metadata uses bounded scalar fields and allowlisted error codes, not raw exceptions. Identity display uses authorized profile lookups; ledger payloads contain IDs only. Account deletion must null actor references and clear unnecessary identifying resource correlations through privileged maintenance.

## Delivery and failure behavior

Administrative feed/source reads persist `admin.activity.read` as `attempted`
before querying data. This records authorized access intent and fails closed
if audit storage is unavailable; it does not claim the source read completed.
Exports recheck administrative identity/MFA after collection and commit their
export audit before releasing rows.

Database note/session/admin hooks belong to the same transaction as their durable mutation. Failed writes cannot generate successful operation events. Sensitive privilege/settings mutations fail if their required audit record cannot commit. AI operation intents and terminal outcomes are integrated by the lead with budget reservations and existing completion checkpoints; simulated responses must use `simulated`, uncertain outcomes `unknown`, and real success `succeeded`. They must not double-count the previous Gemini and chat writers. No per-token instrumentation or prompt/state/model change is required.

Reported navigation is best effort: queue at most 100 items, batches at most 20, delay one second, request timeout eight seconds, three bounded retries, then drop. Queue, dropped, and failed-batch counters are available from `activityBufferDiagnostics()`. Account changes discard queued reports. Browser failure does not interrupt navigation or tutoring; no unload-only or fire-and-forget serverless durability claim is made.

Ingestion reads at most 32 KiB, requires same-origin POST and an active verified user, validates all entries before writing, and calls service-only `consume_activity_ingest_budget(p_user_id)` before appending. The database limiter must be atomic and bound accepted batches per identity. A partially persisted retry is safe because dedup keys include verified actor, activity ID, and client event ID. Browser-generated UUIDs never establish another user's identity.

The retired `/api/analytics/event` and `/api/analytics/pageview` return 410 instead of accepting arbitrary event names/properties. The repository tracker uses `/api/analytics/activity`. Attribution remains a separate existing endpoint and requires its own privacy/security review.

## Investigation and export

Admin endpoints require the common fail-closed admin guard; export additionally requires MFA. Repository reads select only safe v1 fields and apply environment, UTC half-open interval, actor, category, outcome, severity, event type, normalized route, and request/activity correlation filters before pagination. Limits default to 50 and cannot exceed 100. Chronology uses `(received_at DESC, id DESC)` keysets; cursors bind filters and snapshot time and retain database microsecond precision. Timeline and export use the same filters. Legacy history is not falsely presented as verified v1 history.

The UI offers 3 hours, 1/3/7/30 days, custom date/time, and explicit timezone, default Africa/Lagos. UTC is stored. The initial query returns resolved UTC boundaries so historical pages remain stable even when the preset was relative. Feed polls at 15-second intervals with one request in flight, pauses offline/hidden/on historical pages, and backs off to 60 seconds. Connection and last-updated states distinguish empty results from failure. It uses no direct browser database subscriptions.

Counts mean: all matching v1 events; successful persisted note-write events; successful **live** AI completion events; failed outcomes; browser-reported route views. Retries rely on SQL event deduplication. Mock/pending/unknown requests and administrative read events must not inflate product-active-user, successful-AI, or failed-AI denominators in the separate BI SQL. No hardcoded latency or invented growth charts are shown by the replaced activity feeds.

`createActivityExport(request)` in `src/lib/activity/export.ts` handles the shared export route's `dataset=user_activity` branch. Delegate to it before the generic dataset path. It rereads all active filters with keyset pages, caps at 10,000 rows and exposes `X-Lerna-Export-Truncated`, requires durable audit before returning data, and supports CSV/JSON. CSV prefixes formula-like values including leading whitespace/control prefixes and quotes every cell. Responses use private/no-store headers. Export audit means server generated the bounded dataset, not proof of browser receipt.

Admin read evidence is deduplicated per actor/filter/15-minute bucket so polling does not create an audit loop. Internal collector reads create system audit evidence without claiming an end-user identity. Invalid filters do not silently select a replacement interval.

## Environment sources

`ACTIVITY_ENVIRONMENT` accepts local, preview, staging, or production. Verified Vercel environment is the default where present; an otherwise unconfigured production process fails closed. `ACTIVITY_RELEASE_ID` or the deployment commit identifies the release. The private database runtime identity must be configured by local seed or an authorized rollout and agree with the application environment. No secret values belong in this document or source.

Each environment is a separate source. `ACTIVITY_SOURCE_<ENV>_URL` and `_TOKEN` configure server-only HTTPS source adapters. Sources without configuration remain visibly unavailable; local deployments cannot enable the production adapter even if those variables are accidentally present. The receiver `/api/internal/activity` accepts only its own environment, has fixed query capabilities, and authenticates a dedicated at-least-32-character `ACTIVITY_READ_TOKEN`; it cannot write arbitrary events or query arbitrary tables. Treat that token as sensitive read access, rotate via a separately authorized configuration change, and never expose it to browser code. Browser user grouping keys include environment plus user ID.

The deployed production admin defaults to production; local defaults to local. Never switch sources on errors, reuse production database/service credentials in development, fabricate missing historical events, or claim local source proof establishes production instrumentation.

## Retention and verification

Hard account deletion clears the deleted actor's ID/role, identifying resource
references, deduplication keys and unverified legacy metadata. An unrelated
administrator's actor identity remains on actions targeting the deleted
account. The synthetic SQL suite checks both cases.

Product defaults are 30 days for granular page views and 90 days for operational/security events; these are not legal-compliance claims. `runActivityRetention()` calls restricted `cleanup_activity_events(p_page_days=30,p_operational_days=90,p_batch_size=5000)`. The rollout must configure an authorized scheduler, monitor cleanup results, and document its last successful run. Until that configuration and execution are verified, automated retention is pending. Database owners retain privileged maintenance responsibility. Historical UI and exports disclose retention coverage rather than synthesizing missing events.

`node --test tests/activity.test.mjs` executes production validation, route normalization, interval/cursor/filter/CSV/environment logic, bounded browser retry behavior, and mocked ingestion/repository controls. `node --test tests/database.test.mjs` additionally executes the ordered additive SQL migrations against PGlite synthetic provider schemas and ordinary roles. These are local unit/SQL controls; they do **not** prove real database grants, durable delivery/restart, retention scheduling, hydrated browser behavior, remote collector availability, real model usage, or hosted deployment. Required integration gates include actor/environment spoofing, authorized success paired with A/B/anonymous denial, deduplication, transaction log-failure rollback, microsecond paging, filtered export, restart/reload, cleanup boundaries, disconnected polling, and protected-chat latency/behavior.
