# Security remediation plan

**Private — 12 October 2026, Africa/Lagos.** Applies to main @ 9b37a7e8de96b09340ef4ecb5d0ded52840f5476. All tasks are **proposed / not applied**. Current status remains blocked by confirmed risks and missing deployment/database verification.

## Dependency order and assumptions

1. **Contain the historical configured privileged credential exposure (SEC-001)** and preserve incident evidence. Coordinate revocation, server-secret replacement and private access-log review. Rotation is not performed by this audit; repository rewriting alone is insufficient.
2. **Establish isolated test infrastructure and deployed inventory**, then resolve SEC-016 before exposing a Windows server. Restore lockfile install in a disposable checkout with lifecycle-script review; align check tooling. Record deployed commit and provider/environment key type. Source reports cannot validate the current live runtime.
3. **Make privilege and identity decisions canonical (SEC-003/002/007)**. Remove permanent email bootstrap, revoke unguarded usage RPC access and lock protected profile fields. Confirm an owner remains available.
4. **Enforce parent/child authorization (SEC-006)** before side effects and repair existing inconsistent rows.
5. **Reserve atomic budgets (SEC-004)**, then bound uploads/parsing/reprocessing (SEC-005). Source and ordinary-role negative tests must stop all downstream paid/storage work on denial.
6. **Fix OAuth returns/logs (SEC-008/009), support sender and telemetry/audit integrity (SEC-010/011/015)**; these can progress independently once isolation is established.
7. **Close private deletion/retrieval gaps (SEC-012)**, distinguish trusted quiz results (SEC-013), and remove public enumeration (SEC-014).
8. **Retest integrated flows and deployed configuration**, document containment and prove a small restore before scaling. No task is complete merely because a patch compiles or a mocked check passes.

Effort ranges below assume one engineer familiar with this repository, an owner available for provider changes, access to accurate schema/config evidence, and working disposable services. They are engineering ranges, not calendar promises; data repair, provider rotation, incident analysis and migrations can extend them. Tasks overlap; do not sum blindly. Avoid destructive table/column migrations; follow .agents/AGENTS.md and preserve backward-compatible signup/onboarding triggers and repositories.

## Isolation prerequisite (before integrated testing)

Use a fresh disposable checkout plus separate Auth/Postgres/storage/search fixtures. Record every service URL, project/index/bucket name, credential type/scope and container/network identity in a private test manifest; keep values redacted. Enforce outbound denial except local fixture services. Replace Gemini/email/payment with application-boundary mocks; disable queues, cron and bootstrap scripts. Authenticate disposable A/B/admin against the isolated Auth instance, not production. Ordinary anon/authenticated Data API clients must test RLS; service-role tests only confirm server capabilities. Establish a synthetic marker prefix and clean only owned fixture IDs. Validate the positive control for each denied operation. Never import real user records to improve test realism.

A localhost label, preview flag or nonempty environment is insufficient. If an environment cannot be proven isolated, run only whitelist-mocked boundary tests and configuration/source review, as this audit did.

## Ordered implementation tasks

### R01 — LERNA-SEC-001: Supabase service-role credential survives in reachable Git history

**Status:** Proposed; not fixed. **Effort:** 0.5–2 days plus incident investigation.

**Dependencies:** Immediate containment; identify actual key type before rotation.

**Affected files/evidence:** Historical scratch/query-sessions.js:4, blob 29e86867c1ce; introduced e837413 (2026-06-10), removed 52c33e2 (2026-06-10). Current .env SUPABASE_SERVICE_ROLE_KEY (value redacted).

**Concrete proposed change:** First revoke/rotate using the supported Supabase key procedure; update only server secret stores and restart deployments; verify old credential rejection under owner-controlled checks. Review provider access logs and incident scope. Then coordinate history/fork/cache cleanup and secret scanning. Do not rotate public publishable keys merely because they are public.

**Acceptance criteria:** No privileged credential in reachable source history; exposed credentials revoked. Require SECRET-01: credential fingerprint comparison, revocation evidence and rescan of all refs/build artifacts. No live credential appears in reports. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Do not restore the exposed credential to recover availability. Coordinate dependent service changes; legacy JWT signing-key rotation may affect tokens and anon/service keys, so identify the actual key type first.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R02 — LERNA-SEC-016: Installed Next.js is within later advisory ranges; deployment-dependent RCE needs resolution

**Status:** Proposed; not fixed. **Effort:** 1–3 days plus deployment coordination.

**Dependencies:** Isolated clean install/runtime inventory; do not start an exposed Windows server first.

**Affected files/evidence:** package-lock.json node_modules/next=16.2.6; next.config.ts:4-20; installed sharp=0.34.5; local OS=Windows.

**Concrete proposed change:** Do not expose the old Windows server publicly. Plan a current supported patched Next release satisfying all applicable advisories (16.3.6 is the checked September minimum, not a promise it is latest), align compatible React/ESLint stack, rebuild in isolated env, and verify deployment metadata. No versions changed in audit.

**Acceptance criteria:** Deployed and exposed local servers are patched against applicable advisories, with feature reachability confirmed. Require DEP-01 signed build/deployment inventory and advisory recheck; no exploit or production scan required. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Do not rollback to an affected release; keep a tested patched fallback and review image/SSR behavior before upgrade.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R03 — LERNA-SEC-003: Admin demotion and database failure do not reliably revoke export access

**Status:** Proposed; not fixed. **Effort:** 1–2 days.

**Dependencies:** Provision a verified owner; know applied role schema before removing fallbacks.

**Affected files/evidence:** src/lib/auth/require-admin-api.ts:16-25; src/lib/auth/require-admin.ts:28-38; src/app/api/admin/exports/route.ts:48, :71, :104; supabase/migrations/20260706030000_repair_and_backfill_saas.sql:43-53.

**Concrete proposed change:** Use one authoritative admin-role source, fail closed on errors, remove permanent email fallback after a controlled bootstrap and synchronize trusted metadata removal. Apply the same guard to every admin route. Require MFA/step-up for raw exports and role changes and record actor/dataset/reason.

**Acceptance criteria:** Explicit demotion and role-service failure deny privileged operations; a controlled bootstrap mechanism cannot override runtime revocation. Require ADMIN-01/02/03; in isolated integration, demote disposable admin and require immediate 403 for every method/dataset including raw exports. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Provision and verify an owner/admin through the safe role store before removing fallback to avoid locking staff out. Never roll back to unconditional email grants.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R04 — LERNA-SEC-002: Privileged usage RPC accepts arbitrary target users and signed increments

**Status:** Proposed; not fixed. **Effort:** 0.5–1.5 days.

**Dependencies:** Inspect actual grants/owner; coordinate callers with the new server writer.

**Affected files/evidence:** supabase/migrations/20260711000000_subscription_foundation.sql:261 (function), :285 (untrusted increments), :294 (updates).

**Concrete proposed change:** Revoke EXECUTE from PUBLIC/anon/authenticated and expose only the bounded server reservation operation. Derive target/date server-side; allowlist resource, require positive bounded amounts, enforce atomically, pin empty search_path with qualified relations. Inspect existing counter integrity.

**Acceptance criteria:** Anonymous and ordinary direct calls cannot modify another user or reduce authoritative usage. Require DB-01 includes A/B/anon and positive service-writer control; verify pg_proc/proacl and all exposed schemas. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Preserve/backfill valid counters before enforcing constraints; retain a safe server-only compatibility path for legitimate metering.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R05 — LERNA-SEC-007: Suspension and soft deletion are enforced in the browser and editable by the owner

**Status:** Proposed; not fixed. **Effort:** 1–2 days.

**Dependencies:** Canonical roles/guards from SEC-003; column-grant/backfill inspection.

**Affected files/evidence:** src/providers/auth-provider.tsx:117-138; src/lib/auth/require-user.ts:8-14; src/app/api/chat/route.ts:84-105; supabase/migrations/20260705000000_user_profiles.sql:52; supabase/migrations/20260924000000_onboarding_reliability.sql:277-280; supabase/migrations/20260706000000_saas_stabilization.sql:14.

**Concrete proposed change:** Centralize an active-account server guard and DB policy/guarded operations where direct Data API is permitted. Revoke broad protected-field UPDATE and allowlist profile fields; retain server-controlled flags. Define and test access-token/session revocation expectations.

**Acceptance criteria:** Suspended/deleted identities cannot spend capacity or mutate protected resources, and cannot clear protected flags. Require DB-03 includes stale session, fresh login, direct profile update and admin restore controls. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Distinguish unonboarded users from suspended users; preserve legitimate signup/recovery access and use staged flag restrictions.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R06 — LERNA-SEC-006: Child writes are not consistently tied to an owned parent

**Status:** Proposed; not fixed. **Effort:** 1–3 days plus data backfill.

**Dependencies:** Active account guard and accurate applied relationships.

**Affected files/evidence:** src/app/api/study-sessions/[sessionId]/route.ts:139-160; src/app/api/upload/route.ts:25, :60; src/lib/repositories/materials.ts:3-17; src/app/api/quiz/route.ts:132-142; supabase/migrations/20260520000000_study_sessions.sql:67-70, :88-91; supabase/migrations/20260704000000_production_persistence.sql:45-48; supabase/migrations/20260606222000_courses_study_quiz.sql:65.

**Concrete proposed change:** Verify parent ownership before side effects and atomically bind child owner to parent owner with RLS EXISTS checks/composite constraints or guarded RPC. Validate session/course/material transitive relationships and metadata paths. Return safe 404/403, not late generic failures.

**Acceptance criteria:** Foreign parents reject before any write; each child and parent have compatible owners. Require BOLA-02/UPLOAD-01 and DB-02 with positive A parent, negative B parent, reassignment and mixed batches. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Inspect and repair existing inconsistent rows without deleting unrelated private data; add constraints after backfill.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R07 — LERNA-SEC-004: Expensive AI operations lack authoritative quotas and distributed abuse limits

**Status:** Proposed; not fixed. **Effort:** 2–4 days.

**Dependencies:** SEC-002 usage-writer lockdown; establish authoritative usage store; canonical identities/roles.

**Affected files/evidence:** src/app/api/chat/route.ts:331; src/app/api/quiz/generate/route.ts:197; src/app/api/study-sessions/[sessionId]/summary/route.ts:71; src/app/api/demo-chat/route.ts:7, :44, :81; src/lib/services/quota.ts:68-71; src/lib/gemini/client.ts:259-262; src/lib/chat/service.ts:68-90.

**Concrete proposed change:** Reserve usage atomically by validated user/plan and trustworthy proxy identity before every paid call. Add distributed demo limits, concurrency bounds, provider spending alarms/kill switch, output/context ceilings, timeout and abort propagation, idempotent retry keys. Meter actual reformulation/embedding/OCR/answer calls, including failures.

**Acceptance criteria:** A distributed trusted budget caps expensive work across instances; exhausted or unavailable budget rejects before model calls; requests/output and fan-out are bounded. Require QUOTA-01/COST-01 plus isolated exhausted-budget and 2-request race tests with mock billing; assert zero downstream calls on denial. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Tune limits using real usage and low-bandwidth retry data; fail closed with retryable errors and refund unused reservations rather than charging twice.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R08 — LERNA-SEC-005: Upload and reprocessing boundaries permit uncontrolled parser and embedding work

**Status:** Proposed; not fixed. **Effort:** 2–5 days.

**Dependencies:** SEC-004 budget reservation; SEC-006 parent ownership; patched parser/framework inventory.

**Affected files/evidence:** src/app/api/upload/route.ts:23-45, :84; src/app/api/materials/route.ts:86-102; src/lib/materials/extract.ts:60, :78-96, :118-139; src/lib/materials/ingestion.ts:58-85, :118-129; src/app/api/materials/[id]/process/route.ts:35.

**Concrete proposed change:** Validate File type, trusted owned parent, generated storage path, meaningful signatures and byte/page/pixel/ZIP expansion/text/chunk budgets on every entry point. Apply storage quotas and content rules too. Parse in a bounded worker, disallow external resources, cap deadlines, lock/deduplicate processing by material/version and fail closed on budget exhaustion.

**Acceptance criteria:** Reject disallowed content or foreign parents before storage/processing, and enforce budgets on accepted input and expansion. Require UPLOAD-01/parser-render-tests plus small configured boundary fixtures and two concurrent mocked processing requests; no decompression bombs. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Keep already-valid originals readable; quarantine/reject unsupported new uploads without deleting unrelated records. Roll out parser format changes with known-good fixtures.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R09 — LERNA-SEC-008: OAuth callback permits an external post-login redirect

**Status:** Proposed; not fixed. **Effort:** 0.5 day.

**Dependencies:** Isolated Auth flow fixture; safe return-path helper already exists.

**Affected files/evidence:** src/app/auth/callback/route.ts:8, :59, :111; src/lib/auth/return-path.ts:1-13 (unused by callback).

**Concrete proposed change:** Call sanitizeAuthReturnPath on every callback next/redirectTo branch and use a canonical trusted app origin. Validate production/preview provider allowlists exactly.

**Acceptance criteria:** Successful login returns only to an approved local application path. Require OAUTH-01/03 and isolated real PKCE negative/replay cases with positive normal flow. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Preserve allowed local path/query behavior; avoid breaking password recovery return paths.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R10 — LERNA-SEC-009: OAuth authorization codes and callback parameters are emitted to logs

**Status:** Proposed; not fixed. **Effort:** 0.5–1 day plus log review.

**Dependencies:** Log inventory/access controls; SEC-001 incident review.

**Affected files/evidence:** src/app/auth/callback/route.ts:14-24; src/providers/auth-provider.tsx:277-283.

**Concrete proposed change:** Remove raw URLs/parameter dumps; allowlist non-sensitive diagnostic fields, redact upstream errors centrally, restrict log access/retention and inspect historical auth logs privately for exposure.

**Acceptance criteria:** Logs record request ID/status without authentication codes or token-bearing URLs. Require OAUTH-02 plus success/error/recovery logs with fake code/token markers and no private content. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Retain request IDs and non-sensitive error classification so troubleshooting still works.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R11 — LERNA-SEC-010: Direct support-reply inserts can forge the sender identity

**Status:** Proposed; not fixed. **Effort:** 0.5–1 day.

**Dependencies:** Parent/field restrictions from SEC-006/007; no need to remove legitimate learner replies.

**Affected files/evidence:** supabase/migrations/20260710000000_polish_and_premium.sql:29-39; src/app/api/admin/tickets/replies/route.ts:72-75, :28-44.

**Concrete proposed change:** Add sender binding WITH CHECK plus role-specific staff permissions and immutable creator fields. Keep learner replies supported. Verify staff/customer views and avoid trusted identity from future public webhooks/forms.

**Acceptance criteria:** Caller can reply as themselves only unless a separately authorized audited automation sends a system reply. Require DB-04 sender/ticket combinations and admin positive control. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Identify any historical inconsistent senders; preserve ticket conversation with an audit correction rather than silently rewriting identities.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R12 — LERNA-SEC-011: Permissive telemetry policies allow fabricated cross-user records

**Status:** Proposed; not fixed. **Effort:** 1–2 days plus reconciliation.

**Dependencies:** SEC-004 authoritative metering design; new server ingress deployed before revoking old writes.

**Affected files/evidence:** supabase/migrations/20260704000000_production_persistence.sql:22-27; supabase/migrations/20260701000000_admin_dashboard_and_analytics.sql:164-169; src/app/api/analytics/event/route.ts:7-20; src/lib/services/business.ts:123-157.

**Concrete proposed change:** Remove permissive public write policies; separate low-trust client analytics from server-only AI/cost/security records. Derive identities/timestamps and validate bounded event schemas, permitted names and rate limits. Reconcile historical counts.

**Acceptance criteria:** Trusted billing/AI telemetry is server-derived; client analytics cannot impersonate other users or security events. Require DB-05 all roles/tables with positive controls, inspect grants and policy combinations, then replay synthetic forged identity events. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Keep anonymous page analytics through a narrow validated ingress if required; do not grant client writers access to authoritative usage records.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R13 — LERNA-SEC-015: Administrative actions can return success without a durable audit record

**Status:** Proposed; not fixed. **Effort:** 1–2 days.

**Dependencies:** Canonical admin and trusted write operation; narrow atomic DB logging path.

**Affected files/evidence:** supabase/migrations/20260706000000_saas_stabilization.sql:85-97; src/app/api/admin/users/[userId]/actions/route.ts:112-117, :136-141; src/app/api/admin/tickets/replies/route.ts:92-98; src/app/api/admin/coupons/route.ts:75-84.

**Concrete proposed change:** Use a tightly scoped server/DB operation that derives actor from validated identity and atomically records sensitive mutation. Inspect returned errors and alert on logging failures. Avoid general authenticated INSERT grants that let actors forge log identity/content.

**Acceptance criteria:** Authorized sensitive mutations commit with a durable trusted actor log or fail/report an observable logging failure. Require DB-07 authorized success+record, denied action, failed log persistence and tampered actor control. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** If the log store is down, explicitly choose deny for privilege changes/exports and a documented safe degraded policy for low-risk support; avoid silent success.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R14 — LERNA-SEC-012: Deletion can succeed while searchable private text remains retrievable

**Status:** Proposed; not fixed. **Effort:** 1–3 days plus cleanup backlog.

**Dependencies:** SEC-006 active-original list; isolated index/bucket fixtures and cleanup queue.

**Affected files/evidence:** src/lib/materials/elastic.ts:78-94, :187-191; src/app/api/materials/[id]/route.ts:47-64; src/lib/materials/retrieval.ts:78-95; src/app/api/chat/route.ts:316-331.

**Concrete proposed change:** Treat [] as no authorized documents and validate every retrieved document against active SQL ownership/status before prompt inclusion. Tombstone/filter first, enqueue idempotent cleanup with retries/alerts and check both rejected promises and resolved SDK error fields. Include original, chunks, vectors, summaries and account deletion retention.

**Acceptance criteria:** Deleted content is immediately excluded from retrieval and physical cleanup succeeds or enters a durable observable retry. Require DELETE-01/RAG-01/02 and DB-06 injected partial failures with authorized surviving A/B document controls. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Restore a document only with explicit owner action; never revive stale index entries to mask cleanup failures. Backfill deletion jobs safely.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R15 — LERNA-SEC-013: Saved quiz scores and answers are trusted from client input

**Status:** Proposed; not fixed. **Effort:** 2–4 days for trusted grading; 0.5 day to label practice self-reports.

**Dependencies:** Owned parent constraints and an explicit trusted/self-reported quiz contract.

**Affected files/evidence:** src/app/api/quiz/route.ts:114-159; src/app/api/quiz/generate/route.ts:237-240; src/app/(dashboard)/quiz/page.tsx:531.

**Concrete proposed change:** Define trusted versus self-reported practice data. For trusted mode persist server-issued attempt/question/version snapshot, derive score from submitted answers, bound schema and block protected-field direct updates. Keep immediate-answer practice behavior as an explicit mode.

**Acceptance criteria:** Trusted results match stored questions/answers and server-computed grading; explicitly self-reported practice records are labelled and excluded from trusted metrics. Require QUIZ-01 plus stored-version answer tampering, duplicate submit and owner/bystander cases. Timed deadlines belong to planned feature design. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Label historical client-reported results; do not silently regrade with a different generated question set.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

### R16 — LERNA-SEC-014: Unauthenticated email-existence endpoint exposes account membership

**Status:** Proposed; not fixed. **Effort:** 0.5–1 day.

**Dependencies:** Auth/recovery UX review and distributed public ingress limits from SEC-004.

**Affected files/evidence:** src/app/api/auth/check-email/route.ts:6-14; src/lib/repositories/users.ts:69-81.

**Concrete proposed change:** Use generic signup/recovery messages and avoid preflight account-existence lookup; if product retains it, explicitly accept privacy tradeoff and use narrow abuse limits/monitoring.

**Acceptance criteria:** Public registration/recovery responses preserve membership privacy with bounded abuse handling. Require AUTH-02 synthetic existing/missing controls, response/timing and distributed rate-limit tests. Positive authorized operation must still work; denied calls must show no unauthorized state, prompt data or paid work. For SQL/deployment-dependent behavior, capture actual configuration plus ordinary-role/integrated results before closing.

**Rollback and compatibility:** Preserve useful user recovery directions without restoring bulk enumeration.

**Evidence to attach:** before/after isolated fixture results, redacted config/permission diffs, reviewed code diff, migration validation/backfill outcome where relevant, and the deployed commit after rollout. Never paste credentials/private records.

## Implementation proposals (not executable production patches)

- Admin guard contract: validated identity -> active account -> one authoritative role result -> deny on error/non-admin -> optional required aal2/recent step-up -> bounded action -> immutable log. Bootstrap must be a separate operator workflow, not an OR branch in every request. Do not treat app_metadata/user_metadata as interchangeable.
- Usage reservation contract: guarded server writer atomically checks plan/period/budget, creates an idempotent reservation, increments pending bounded capacity and returns remaining. Before provider invocation require successful reservation. Commit actual cost or release unused amount on failure/cancellation. Do not use count-then-call across independent requests. Revoke broad RPC EXECUTE first; adding a checkQuota call alone cannot fix SEC-004 while it fails open.
- Ownership contract: trusted subject and parent identifiers -> scoped parent lookup before any child insert/storage call; perform related writes in one guarded operation. SQL WITH CHECK must enforce both row owner and referenced parent owner; keep owner SELECT/USING/WITH CHECK coherent. A foreign key alone establishes existence, not tenant ownership.
- File contract: validated envelope + file stream limits -> owned parent + reserved storage/processing quota -> generated object key -> signature/format validation -> bounded extraction worker -> maximum text/chunks/embeddings -> index trusted owner metadata -> finalization. Direct storage uploads require the same bucket/content quota controls and trusted metadata finalization.
- Deletion contract: deny retrieval from SQL/tombstone immediately -> durable idempotent original/index cleanup job -> retries/alert -> owner-visible state. Validate IDs/status before text reaches model. Explicit empty authorized set returns no material context rather than all same-user chunks.
- Audit contract: actor comes from the authenticated request or guarded database session, not request body. Write security event with the privileged operation atomically; include action/resource/request ID/result, excluding document/chat/token content. A returned SDK error object must be handled, not just awaited.

Do not automatically apply these as cloud SQL snippets. Audit actual schema, grants and dependency behavior first, then implement a reviewed migration using the project's normal migration workflow. Avoid introducing broad service-role clients as a shortcut to make broken learner endpoints work.

## Lower-risk follow-up

Resolve client dependency/lint drift; inspect tab/CR/LF CSV edge cases in intended spreadsheet consumers; filter public announcements by published state/audience/time; narrow user_roles directory visibility; add server-only import boundaries and remove NEXT_PUBLIC_GEMINI_API_KEY sample/schema footgun; validate cache clearing on logout/account switches; pin older definer search_path/revoke excess execution after checking legitimate callers; tune pagination/body limits and sanitized error handling. None is a claim of fixed behavior or a verified remote exploit.

## Rollout and rollback policy

Prepare and review code/schema/config changes privately, run both positive and negative regression controls, then canary under a measured cap with alerts and a named owner. Record deployed build and applied permission changes. Keep a patched, permission-safe rollback artifact; never reinstate exposed keys or permissive public policies to recover a feature. Feature disablement with clear retryable UI is preferable to unsafe authorization/budget fallback. Do not silently alter existing historical quiz grades/analytics/notes: label, reconcile or backfill with recorded criteria.

## Verification exit criteria

All applicable secure assertions pass and additional DB/browser/integrated matrix rows are completed; no reachable Critical/High issue remains; rotation/permission/deployment evidence is captured; expensive work stops on denial across two instances; deleted sources cannot enter prompts; audit events are durable; staff can contain abuse and restore a small synthetic backup. After deployment, monitor denied access, failed cleanup, auth failures, unusual exports, quota saturation and model/storage spending without logging private content. See SECURITY_SCALE_GATE.md.
