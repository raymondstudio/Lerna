# Lerna AI security audit

**Private workspace report — 12 October 2026 (Africa/Lagos).** Audited branch: main. Commit: 9b37a7e8de96b09340ef4ecb5d0ded52840f5476. Origin: https://github.com/raymondstudio/Lerna. Status: **blocked by confirmed risks**, additionally blocked by missing high-impact deployment/database verification. No recommendation is marked fixed.

## Scope, identity and preservation

This is a completed evidence-driven repository and isolated boundary audit, not a certification or exhaustive claim. The application, API handlers, authentication/authorization helpers, migrations, uploads/parsers, search/RAG, Gemini calls, billing foundation, support/admin/export paths, dependency configuration and reachable selected-text Git history were examined. References are one-based lines in this checkout; historical references explicitly name their blob/commit. The deployed commit and equivalence to this source are unknown.

Initial git status: modified next-env.d.ts; untracked docs/. Both were preserved. Read .agents/AGENTS.md and project README, docs/LERNA_PROJECT_CONTEXT.md and docs/LERNA_AUDIT.md. docs/LERNA_NEXT_STAGE.md was not present. No ancestor/root/app-tree AGENTS.md was found; the existing .agents/AGENTS.md requires repository queries, non-destructive schema work and no fabricated production stats. Separate video/skill instructions were outside application scope. Existing SECURITY.md/AGENTS.md and prior reports were not overwritten. No application/dependency/schema/cloud/credential changes, commits, deployments or external report publication were made.

The shell tool could not initialize; read-only Git/checks and new audit-file writes used the available Node runtime. No escalation was requested. Only docs/security reports, synthetic test code and redacted results were created. No persistent backend fixtures were created, so no remote cleanup was necessary. Temporary markers exist only in tests/in-memory stores.

## Environment and execution safety

Local .env has nonempty remote Supabase/Elastic URLs, server Supabase/Gemini/Elastic credential variables and ADMIN_EMAILS. They were inventoried by names/booleans; values were never emitted. These are not proof of working credentials, billing status or migration deployment. Their remote destinations are not isolated merely because the app would run on localhost. No app dev/build server, bootstrap/seed script, migrations, provider SDK requests, paid AI calls, email sends or production attack probes were executed.

No local Supabase config/runtime, psql or Docker was available. Ordinary-role SQL/RLS/storage/realtime enforcement is therefore **not tested/blocked**, rather than inferred from mocks. Dependency-mocked VM tests instantiate synthetic A/B/admin/anonymous identities and use a whitelist require function: unexpected imports throw, provider clients are replaced, process.env is synthetic, fetch is unavailable, and all writes are in-memory. Parser tests use installed local parser libraries with OCR mocked to throw. Requests are small, sequential; maximum demo sequence per run is 13 attempts, 12 model mock calls. Helpers have 1-second VM evaluation and process timeouts (15–20 seconds). No destructive/large/decompression-bomb/malware fixtures or real network destinations were used.

Only official documentation/advisories and one ordinary public-homepage fetch were requested remotely. The public page https://www.uselerna.app could not be accessed by the web tool; this does not establish an outage, TLS failure, deployed stack or headers. No redirect-discovered hosts were probed.

## Verified stack

Lockfile and installed versions agree for Next.js 16.2.6, React/React DOM 19.2.6, Supabase JS 2.106.0, Supabase SSR 0.6.1, Google GenAI 2.8.0, Elastic SDK 9.4.0, pdf-parse 1.1.1, Mammoth 1.12.0, JSZip 3.10.1 and fast-xml-parser 5.8.0. Lockfile also records TypeScript 5.9.3, Tailwind 3.4.19, legacy Google Generative AI 0.24.1, react-markdown 10.1.0, KaTeX 0.17.0, ESLint 9.39.4 and eslint-config-next 15.3.2. Installed sharp is 0.34.5. React Query/devtools 5.104.0 are locked but missing locally.

Actual code uses App Router, src/proxy.ts (valid Next 16 naming), Supabase Auth/Postgres/Storage, direct Elastic REST fetches, Google @google/genai for gemini-2.5-flash / gemini-embedding-001 (768 dimensions), and React Markdown. Elastic SDK and legacy Gemini SDK declarations do not prove active usage; current Elastic client uses fetch. Vercel hosting is reported, not independently configured/verified. No Server Actions/use server/use cache implementations, custom server, i18n locales, URL-import endpoint, model tools, shell execution or application code interpreter were found in src. Absent features are not treated as vulnerable implementations.

## Threat model and boundaries

Assets: account/session identity, profiles and moderation state, roles/entitlements, private originals, extracted/embedded text, chats, sessions, quizzes/notes, support messages, telemetry/audit trails, billing metadata and paid provider capacity. Attackers: anonymous automated caller; malicious registered A; compromised B; demoted/compromised admin; malicious document author; quota abuser. A legitimate staff export is a capability; reading another learner's private document through a learner endpoint is not.

~~~mermaid
flowchart LR
  Browser[Untrusted browser / documents] --> Auth[Supabase Auth validation]
  Auth --> Routes[Next route guards / trusted user ID]
  Routes --> DB[User-role Postgres + RLS / parent ownership]
  Routes --> Admin[Canonical admin authorization]
  Admin --> Priv[Service-role exports / privileged RPCs]
  Routes --> Storage[Private originals / object ownership]
  Storage --> Parser[Bounded parsing / extraction]
  Parser --> Budget[Atomic server budgets / worker limits]
  Budget --> Embed[Gemini embedding / OCR]
  Embed --> ES[Elastic tenant + document filters]
  ES --> Prompt[Untrusted retrieved text + history]
  Prompt --> Model[Gemini text generation]
  Model --> Render[Untrusted Markdown / citations]
  Routes --> Audit[Trusted audit / cost telemetry]
~~~

Identity must be derived after server validation, role checked centrally at privileged ingress, ownership checked transitively before writes/downloads/search, input validated before buffering/parsing, and atomic budget reserved before every downstream paid operation. SQL RLS is a real second boundary for ordinary user clients; service_role/definer operations require their own authorization. Model instructions never replace these checks. Browser UI, client history, file metadata and model output are untrusted. Gemini receives profile preferences/transcripts/private context intentionally; provider retention and customer disclosure settings need review. No secrets were found in prompt construction.

## Intended permission matrix (defined before local negative tests)

A/B own disposable resources; admin means authorized through the canonical role store. Owner-only means admin also gets only its own learner resources on ordinary learner APIs; staff access must use an explicit authorized admin feature. Service-role is an internal capability, never an end-user role.

| Resource / operation | Anonymous | A on A | A on B | B on B | Admin | Enforcement expected |
| --- | --- | --- | --- | --- | --- | --- |
| Landing, health, bounded demo | Allow | Allow | N/A | Allow | Allow | Public capability + abuse budget |
| Signup/OAuth/recovery | Allow flow initiation | Allow own | Deny identity substitution | Allow own | Allow own | Auth provider, PKCE, safe returns |
| Profile/preferences read or edit | Deny | Allowed editable fields | Deny | Allowed editable fields | Own; explicit staff read | Field restrictions + RLS |
| Moderation flags / roles / plans | Deny | Deny protected mutation | Deny | Deny protected mutation | Explicit granted staff actions | Canonical role + guarded RPC |
| Session/messages/course/quiz CRUD | Deny | Own only | Deny | Own only | Own through learner APIs | Ownership before side effects + RLS |
| Upload / attach / reprocess | Deny | Owned parent/object + budget | Deny foreign parent/object | Same as A | Own through learner APIs | Parent validation + parser budget |
| Signed material view/download | Deny direct access | Owned active material | Deny | Own active material | Explicit staff access only if implemented | RLS storage + short signed URL |
| Retrieval/citations/extracted text | Deny | Authorized active originals only | Deny | Same as A | Own learner retrieval | Trusted tenant/document filter before prompt |
| Support ticket/reply | Deny | Own ticket, own sender | Deny | Own ticket, own sender | Staff tickets/replies | Ticket relation + actor binding |
| Feedback | Deny | Submit own | Deny impersonation | Submit own | Read/moderate | Bounded validated body + RLS |
| Published announcements | Deny (current policy) | Read relevant published | N/A | Read relevant published | Manage drafts/targets | Lifecycle/audience filter |
| Staff dashboards / raw exports | Deny | Deny | Deny | Deny | Allow least-privilege reviewed datasets | Fail-closed role, step-up, audit |
| Usage/security/billing telemetry writes | Deny except narrow low-trust page ingress | Deny authoritative writes | Deny | Deny authoritative writes | Narrow operations; server writer | Trusted identity + grants + atomicity |

The matrix is the security contract, not a statement every row currently passes. Current normal support replies and published announcements are legitimate capabilities even when their API paths begin /admin. User/persona account_type does not confer administrative privileges.

## Prioritized findings

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| LERNA-SEC-001 | High | Supabase service-role credential survives in reachable Git history | Confirmed historical exposure; current local value matches; remote validity untested |
| LERNA-SEC-002 | High | Privileged usage RPC accepts arbitrary target users and signed increments | Code-confirmed migration flaw; ordinary-role database reproduction blocked |
| LERNA-SEC-003 | High | Admin demotion and database failure do not reliably revoke export access | Source-confirmed; helper behavior reproduced with mocks |
| LERNA-SEC-004 | High | Expensive AI operations lack authoritative quotas and distributed abuse limits | Code-confirmed; demo limiter and quota failure behavior mocked |
| LERNA-SEC-005 | High | Upload and reprocessing boundaries permit uncontrolled parser and embedding work | Code-confirmed; small route/parser fixtures exercised |
| LERNA-SEC-006 | Medium | Child writes are not consistently tied to an owned parent | Source-confirmed; foreign-note write ordering reproduced with mocks; SQL enforcement untested |
| LERNA-SEC-007 | Medium | Suspension and soft deletion are enforced in the browser and editable by the owner | Code-confirmed; database/account lifecycle reproduction blocked |
| LERNA-SEC-008 | Medium | OAuth callback permits an external post-login redirect | Mock-runtime confirmed application behavior; real OAuth flow untested |
| LERNA-SEC-009 | Medium | OAuth authorization codes and callback parameters are emitted to logs | Source and synthetic logging reproduction confirmed |
| LERNA-SEC-010 | Medium | Direct support-reply inserts can forge the sender identity | Code-confirmed RLS flaw; ordinary-role enforcement untested |
| LERNA-SEC-011 | Medium | Permissive telemetry policies allow fabricated cross-user records | Code-confirmed policy flaw; effective remote grants unverified |
| LERNA-SEC-012 | Medium | Deletion can succeed while searchable private text remains retrievable | Source-confirmed; failure swallowing and empty-scope expansion reproduced with mocks |
| LERNA-SEC-013 | Medium | Saved quiz scores and answers are trusted from client input | Source-confirmed; impossible score accepted in mock route |
| LERNA-SEC-014 | Low | Unauthenticated email-existence endpoint exposes account membership | Code-confirmed; no real-address probes performed |
| LERNA-SEC-015 | Medium | Administrative actions can return success without a durable audit record | Code-confirmed migration/application mismatch; actual write grants untested |
| LERNA-SEC-016 | Critical (conditional) | Installed Next.js is within later advisory ranges; deployment-dependent RCE needs resolution | Credible suspected vulnerability requiring configuration/reachability verification; no exploit test |

### LERNA-SEC-001 — Supabase service-role credential survives in reachable Git history

**Severity:** High. **Confidence:** High. **Evidence status:** Confirmed historical exposure; current local value matches; remote validity untested.

**Affected evidence:** Historical scratch/query-sessions.js:4, blob 29e86867c1ce; introduced e837413 (2026-06-10), removed 52c33e2 (2026-06-10). Current .env SUPABASE_SERVICE_ROLE_KEY (value redacted).

**Root cause / trust boundary:** A privileged credential was hard-coded into a committed diagnostic script. Removing the file did not remove reachable history. Exact in-memory comparison found the historical value equals the current configured value.

**Prerequisites and safe reproduction:** Read the historical blob locally using a redacting scanner and compare the service-role assignment with the configured credential without printing either value. secret-scan-results.json records the match.

**Expected:** No privileged credential in reachable source history; exposed credentials revoked.

**Observed:** Exact match in a reachable historical blob. No authentication against Supabase was attempted.

**Impact and severity reasoning:** Anyone with repository/history access can obtain a credential intended to bypass RLS and potentially access or alter all tenants and Auth administration. High because exposure is proven but validity, remote repository visibility, actual project and deployment use are not verified; a valid publicly exposed production key would warrant Critical escalation.

**Existing mitigation / uncertainty:** HEAD does not track .env/.env2, and the script was removed. Neither proves revocation. No other privileged-secret pattern/exact match found within the bounded scan.

**Remediation and order:** First revoke/rotate using the supported Supabase key procedure; update only server secret stores and restart deployments; verify old credential rejection under owner-controlled checks. Review provider access logs and incident scope. Then coordinate history/fork/cache cleanup and secret scanning. Do not rotate public publishable keys merely because they are public.

**Rollback / migration risk:** Do not restore the exposed credential to recover availability. Coordinate dependent service changes; legacy JWT signing-key rotation may affect tokens and anon/service keys, so identify the actual key type first.

**Regression verification:** SECRET-01: credential fingerprint comparison, revocation evidence and rescan of all refs/build artifacts. No live credential appears in reports.

**References:** ASVS v5.0.0-13.3.1; OWASP API8:2023.


### LERNA-SEC-002 — Privileged usage RPC accepts arbitrary target users and signed increments

**Severity:** High. **Confidence:** High. **Evidence status:** Code-confirmed migration flaw; ordinary-role database reproduction blocked.

**Affected evidence:** supabase/migrations/20260711000000_subscription_foundation.sql:261 (function), :285 (untrusted increments), :294 (updates).

**Root cause / trust boundary:** public.increment_subscription_usage is SECURITY DEFINER with attacker-supplied target_user_id/date/field/increment and no auth.uid, ownership, admin, positivity or budget validation. No later revoke/redefinition was found. PostgreSQL default PUBLIC EXECUTE is a relevant exposure unless actual grants override it.

**Prerequisites and safe reproduction:** On an isolated database only: seed A/B usage; as anonymous/A call the RPC with B, today, aiRequests, +1; separately test -1 on A. Compare before/after. Positive control: approved server writer increments A once. Never run against configured remote endpoints.

**Expected:** Anonymous and ordinary direct calls cannot modify another user or reduce authoritative usage.

**Observed:** Function body unconditionally inserts/updates requested rows. Actual deployed grants, API exposure and function ownership are unknown.

**Impact and severity reasoning:** Cross-user usage corruption and artificial quota exhaustion; negative increments can undermine OCR/voice accounting. Does not currently prove arbitrary SQL execution: field_name is compared using CASE, not interpolated into SQL. Existing main chat AI quota uses ai_requests counts rather than this counter, so its primary cost flaw is separately SEC-004.

**Existing mitigation / uncertainty:** Table SELECT policies are owner-scoped, but definer execution bypasses that table boundary. September daily-stat RPC hardening does not revoke this separate function.

**Remediation and order:** Revoke EXECUTE from PUBLIC/anon/authenticated and expose only the bounded server reservation operation. Derive target/date server-side; allowlist resource, require positive bounded amounts, enforce atomically, pin empty search_path with qualified relations. Inspect existing counter integrity.

**Rollback / migration risk:** Preserve/backfill valid counters before enforcing constraints; retain a safe server-only compatibility path for legitimate metering.

**Regression verification:** DB-01 includes A/B/anon and positive service-writer control; verify pg_proc/proacl and all exposed schemas.

**References:** ASVS v5.0.0-8.2.1, -8.4.1; OWASP API1/API5:2023.


### LERNA-SEC-003 — Admin demotion and database failure do not reliably revoke export access

**Severity:** High. **Confidence:** High. **Evidence status:** Source-confirmed; helper behavior reproduced with mocks.

**Affected evidence:** src/lib/auth/require-admin-api.ts:16-25; src/lib/auth/require-admin.ts:28-38; src/app/api/admin/exports/route.ts:48, :71, :104; supabase/migrations/20260706030000_repair_and_backfill_saas.sql:43-53.

**Root cause / trust boundary:** Independent email/app_metadata fallback grants remain effective after is_admin=false or RPC error. SQL is_admin also permanently recognizes a hard-coded auth email independently of user_roles. The raw export path subsequently creates a service-role client.

**Prerequisites and safe reproduction:** ADMIN-01 establishes 401 anonymous, 403 A, 200 admin. ADMIN-02 changes database admin result to false while retaining synthetic ADMIN_EMAILS membership: helper still accepts. ADMIN-03 injects an RPC outage and trusted prior admin metadata: accepts.

**Expected:** Explicit demotion and role-service failure deny privileged operations; a controlled bootstrap mechanism cannot override runtime revocation.

**Observed:** Both mocked denial/outage paths accept. Raw export privilege use is source-traced, not remotely reproduced.

**Impact and severity reasoning:** A compromised or demoted allowlisted admin can retain bulk access to user emails, identities, activity and billing metadata, especially through service-role exports that cannot rely on downstream RLS. No normal-user user_metadata-to-admin escalation was found; app_metadata is a different, privileged field.

**Existing mitigation / uncertainty:** getUser validates identity; database-guarded RPCs often recheck admin. Raw exports bypass that second check. Current exports omit chat message content and cap rows at 100,000.

**Remediation and order:** Use one authoritative admin-role source, fail closed on errors, remove permanent email fallback after a controlled bootstrap and synchronize trusted metadata removal. Apply the same guard to every admin route. Require MFA/step-up for raw exports and role changes and record actor/dataset/reason.

**Rollback / migration risk:** Provision and verify an owner/admin through the safe role store before removing fallback to avoid locking staff out. Never roll back to unconditional email grants.

**Regression verification:** ADMIN-01/02/03; in isolated integration, demote disposable admin and require immediate 403 for every method/dataset including raw exports.

**References:** ASVS v5.0.0-8.2.1, -8.3.1; OWASP API5:2023.


### LERNA-SEC-004 — Expensive AI operations lack authoritative quotas and distributed abuse limits

**Severity:** High. **Confidence:** High. **Evidence status:** Code-confirmed; demo limiter and quota failure behavior mocked.

**Affected evidence:** src/app/api/chat/route.ts:331; src/app/api/quiz/generate/route.ts:197; src/app/api/study-sessions/[sessionId]/summary/route.ts:71; src/app/api/demo-chat/route.ts:7, :44, :81; src/lib/services/quota.ts:68-71; src/lib/gemini/client.ts:259-262; src/lib/chat/service.ts:68-90.

**Root cause / trust boundary:** Authenticated chat/quiz/summary routes do not call quota guards before model calls. Demo uses a process-local Map keyed by forwarding headers. checkQuota itself returns allowed=true on failure. Gemini generation omits explicit maxOutputTokens/cancellation, and recent-message count is capped but individual message length/body size is not.

**Prerequisites and safe reproduction:** COST-01 sends 11 small requests to one module: first 200, eleventh 429. One changed fixture forwarding header and one fresh module each yield 200; only 12 mock model calls. QUOTA-01 injects quota-backend failure: allowed=true.

**Expected:** A distributed trusted budget caps expensive work across instances; exhausted or unavailable budget rejects before model calls; requests/output and fan-out are bounded.

**Observed:** Local limiter works only for a single key/instance. Centralized enforcement absent on reachable expensive routes. Real platform forwarding-header overwrite is unverified, so remote IP spoofing is not claimed.

**Impact and severity reasoning:** Anonymous demo and cheap registered accounts can repeatedly consume paid model capacity and server resources. Long messages, query reformulation plus embeddings plus answers, repeat summaries and repeated processing multiply cost. Provider hard quotas may cap loss but were not inspected.

**Existing mitigation / uncertainty:** Demo input is capped at 500 characters and per-instance 10/minute; quiz count normally clamps 3-15; summary chat excerpt 3,000 characters. These are partial limits, not a spending ceiling.

**Remediation and order:** Reserve usage atomically by validated user/plan and trustworthy proxy identity before every paid call. Add distributed demo limits, concurrency bounds, provider spending alarms/kill switch, output/context ceilings, timeout and abort propagation, idempotent retry keys. Meter actual reformulation/embedding/OCR/answer calls, including failures.

**Rollback / migration risk:** Tune limits using real usage and low-bandwidth retry data; fail closed with retryable errors and refund unused reservations rather than charging twice.

**Regression verification:** QUOTA-01/COST-01 plus isolated exhausted-budget and 2-request race tests with mock billing; assert zero downstream calls on denial.

**References:** ASVS v5.0.0-16.5.3; OWASP API4/API6:2023; OWASP LLM10:2025.


### LERNA-SEC-005 — Upload and reprocessing boundaries permit uncontrolled parser and embedding work

**Severity:** High. **Confidence:** High. **Evidence status:** Code-confirmed; small route/parser fixtures exercised.

**Affected evidence:** src/app/api/upload/route.ts:23-45, :84; src/app/api/materials/route.ts:86-102; src/lib/materials/extract.ts:60, :78-96, :118-139; src/lib/materials/ingestion.ts:58-85, :118-129; src/app/api/materials/[id]/process/route.ts:35.

**Root cause / trust boundary:** Upload buffers the whole file without server file-size/type/content limits and writes storage before parent authorization. Metadata creation trusts fileSize/storagePath/MIME. Parsing lacks maximum uncompressed bytes/files/pages/text/time; embedding loops have no total-chunk budget. Reprocessing has no lock/version/idempotency or ready-state suppression.

**Prerequisites and safe reproduction:** UPLOAD-01 positive owned text fixture succeeds; a 16-byte unsupported-MIME fixture with foreign session also reaches storage and mocked processing. Actual extractor accepts 34-byte HTML-labelled-as-text with .pdf filename, accepts a 413-byte PPTX and rejects unsupported type. No oversized, compressed-bomb or paid payload used.

**Expected:** Reject disallowed content or foreign parents before storage/processing, and enforce budgets on accepted input and expansion.

**Observed:** Route passes invalid input to expensive processing; actual parser dispatch trusts MIME. Production storage caps and parser resource isolation are unknown.

**Impact and severity reasoning:** Registered users can spend extraction/embedding capacity, consume memory/storage and replay document processing. This is an availability/cost finding, not demonstrated malware execution or XSS. Direct browser-to-storage paths also need equivalent bucket controls.

**Existing mitigation / uncertainty:** Private bucket is defined; filenames get generated suffixes and upload upsert=false. Parsing unsupported MIME eventually fails, after storage/metadata writes. PPTX reads selected slide paths rather than extracting paths to filesystem.

**Remediation and order:** Validate File type, trusted owned parent, generated storage path, meaningful signatures and byte/page/pixel/ZIP expansion/text/chunk budgets on every entry point. Apply storage quotas and content rules too. Parse in a bounded worker, disallow external resources, cap deadlines, lock/deduplicate processing by material/version and fail closed on budget exhaustion.

**Rollback / migration risk:** Keep already-valid originals readable; quarantine/reject unsupported new uploads without deleting unrelated records. Roll out parser format changes with known-good fixtures.

**Regression verification:** UPLOAD-01/parser-render-tests plus small configured boundary fixtures and two concurrent mocked processing requests; no decompression bombs.

**References:** ASVS v5.0.0-5.2.1, -5.2.2, -5.2.3; OWASP API4:2023.


### LERNA-SEC-006 — Child writes are not consistently tied to an owned parent

**Severity:** Medium. **Confidence:** High. **Evidence status:** Source-confirmed; foreign-note write ordering reproduced with mocks; SQL enforcement untested.

**Affected evidence:** src/app/api/study-sessions/[sessionId]/route.ts:139-160; src/app/api/upload/route.ts:25, :60; src/lib/repositories/materials.ts:3-17; src/app/api/quiz/route.ts:132-142; supabase/migrations/20260520000000_study_sessions.sql:67-70, :88-91; supabase/migrations/20260704000000_production_persistence.sql:45-48; supabase/migrations/20260606222000_courses_study_quiz.sql:65.

**Root cause / trust boundary:** Child owner fields and foreign-key existence are treated as sufficient; policies do not require parent ownership for messages/materials/notes/quiz course/material references. PATCH upserts notes before it verifies that the target session belongs to the caller.

**Prerequisites and safe reproduction:** BOLA-02 succeeds for A-owned session, then sends A notes to B session; one notes upsert occurs before the session update fails with 500. DB-02 should repeat via ordinary Data API roles with real constraints and include reassignment/batch variants.

**Expected:** Foreign parents reject before any write; each child and parent have compatible owners.

**Observed:** Write attempted before denial. Migrations admit own child rows referring to foreign parents. Actual DB success blocked by unavailable isolated database.

**Impact and severity reasoning:** Cross-owner relationships and foreign-ID existence or integrity effects; unauthorized write attempts may leave orphan notes/material relationships. Does not prove disclosure of B messages: SELECT policies and explicit owner reads mitigate that. Parent UUID secrecy is not authorization.

**Existing mitigation / uncertainty:** Main chat validates selected course/material and session ownership; course reads explicitly scope child queries. quiz_questions policies do check owning quiz, a useful positive counterexample.

**Remediation and order:** Verify parent ownership before side effects and atomically bind child owner to parent owner with RLS EXISTS checks/composite constraints or guarded RPC. Validate session/course/material transitive relationships and metadata paths. Return safe 404/403, not late generic failures.

**Rollback / migration risk:** Inspect and repair existing inconsistent rows without deleting unrelated private data; add constraints after backfill.

**Regression verification:** BOLA-02/UPLOAD-01 and DB-02 with positive A parent, negative B parent, reassignment and mixed batches.

**References:** ASVS v5.0.0-8.2.2, -8.4.1; OWASP API1:2023.


### LERNA-SEC-007 — Suspension and soft deletion are enforced in the browser and editable by the owner

**Severity:** Medium. **Confidence:** High. **Evidence status:** Code-confirmed; database/account lifecycle reproduction blocked.

**Affected evidence:** src/providers/auth-provider.tsx:117-138; src/lib/auth/require-user.ts:8-14; src/app/api/chat/route.ts:84-105; supabase/migrations/20260705000000_user_profiles.sql:52; supabase/migrations/20260924000000_onboarding_reliability.sql:277-280; supabase/migrations/20260706000000_saas_stabilization.sql:14.

**Root cause / trust boundary:** Server guards check authenticated identity but not moderation/deletion state. Owner UPDATE is table-wide, so protected moderation fields remain user-editable through direct Data API even if UI hides them.

**Prerequisites and safe reproduction:** DB-03: suspend disposable A and reuse an established session for a direct chat call with AI mocked; then attempt ordinary-role profiles UPDATE setting is_suspended/is_deleted=false. Positive B remains allowed; admin can suspend A. No real accounts changed.

**Expected:** Suspended/deleted identities cannot spend capacity or mutate protected resources, and cannot clear protected flags.

**Observed:** Only browser sign-out checks found; source/RLS do not enforce the promised restriction.

**Impact and severity reasoning:** An abusive or compromised account can bypass moderation without running the normal UI and potentially self-restore. Does not grant admin or another user data by itself.

**Existing mitigation / uncertainty:** The normal UI signs out flagged users; Auth getUser rejects invalid identities. Genuine Auth bans/revocation settings were not inspected.

**Remediation and order:** Centralize an active-account server guard and DB policy/guarded operations where direct Data API is permitted. Revoke broad protected-field UPDATE and allowlist profile fields; retain server-controlled flags. Define and test access-token/session revocation expectations.

**Rollback / migration risk:** Distinguish unonboarded users from suspended users; preserve legitimate signup/recovery access and use staged flag restrictions.

**Regression verification:** DB-03 includes stale session, fresh login, direct profile update and admin restore controls.

**References:** ASVS v5.0.0-8.2.3, -8.3.1; OWASP API3:2023.


### LERNA-SEC-008 — OAuth callback permits an external post-login redirect

**Severity:** Medium. **Confidence:** High. **Evidence status:** Mock-runtime confirmed application behavior; real OAuth flow untested.

**Affected evidence:** src/app/auth/callback/route.ts:8, :59, :111; src/lib/auth/return-path.ts:1-13 (unused by callback).

**Root cause / trust boundary:** Callback resolves attacker-controlled next directly against request.url after code exchange instead of the existing internal-return sanitizer.

**Prerequisites and safe reproduction:** OAUTH-01 mocks successful exchange with a synthetic code: /chat returns local origin, https://redirect.fixture.invalid/landing returns external origin. No external request or redirect following occurs.

**Expected:** Successful login returns only to an approved local application path.

**Observed:** External redirect accepted; safe sanitizer separately rejects external/protocol-relative/backslash cases in OAUTH-03.

**Impact and severity reasoning:** Trusted login URLs can funnel a user to a phishing site. Requires a successful code exchange/flow capable of carrying next. This is not demonstrated transfer of access tokens or cookies to the external host; response cookies remain scoped to original host.

**Existing mitigation / uncertainty:** Supabase SDK performs code exchange and PKCE binding; legitimate OAuth redirect allowlists may constrain flow initiation, but they do not replace callback return-path validation.

**Remediation and order:** Call sanitizeAuthReturnPath on every callback next/redirectTo branch and use a canonical trusted app origin. Validate production/preview provider allowlists exactly.

**Rollback / migration risk:** Preserve allowed local path/query behavior; avoid breaking password recovery return paths.

**Regression verification:** OAUTH-01/03 and isolated real PKCE negative/replay cases with positive normal flow.

**References:** OWASP unvalidated redirect guidance; ASVS OAuth configuration remains separately unverified.


### LERNA-SEC-009 — OAuth authorization codes and callback parameters are emitted to logs

**Severity:** Medium. **Confidence:** High. **Evidence status:** Source and synthetic logging reproduction confirmed.

**Affected evidence:** src/app/auth/callback/route.ts:14-24; src/providers/auth-provider.tsx:277-283.

**Root cause / trust boundary:** fullUrl and allParams include complete authorization codes despite a separate truncated code field. Logging is not limited to development. Browser OAuth diagnostics also emit the authorization URL.

**Prerequisites and safe reproduction:** OAUTH-02 supplies a recognizable fake code and provider error; captured console arguments contain the full marker. Report records only a boolean, never real codes.

**Expected:** Logs record request ID/status without authentication codes or token-bearing URLs.

**Observed:** Full synthetic code appears in captured logs.

**Impact and severity reasoning:** Log readers/export sinks gain access to short-lived sensitive auth artifacts and any injected private parameters. PKCE binding and one-use exchange reduce direct account takeover; no reset token or session theft was reproduced.

**Existing mitigation / uncertainty:** The explicitly truncated code field and generic production error exist, but fullUrl/allParams defeat that redaction. Log-retention/access controls are unknown.

**Remediation and order:** Remove raw URLs/parameter dumps; allowlist non-sensitive diagnostic fields, redact upstream errors centrally, restrict log access/retention and inspect historical auth logs privately for exposure.

**Rollback / migration risk:** Retain request IDs and non-sensitive error classification so troubleshooting still works.

**Regression verification:** OAUTH-02 plus success/error/recovery logs with fake code/token markers and no private content.

**References:** ASVS v5.0.0-16.2.5; OWASP API8:2023.


### LERNA-SEC-010 — Direct support-reply inserts can forge the sender identity

**Severity:** Medium. **Confidence:** High. **Evidence status:** Code-confirmed RLS flaw; ordinary-role enforcement untested.

**Affected evidence:** supabase/migrations/20260710000000_polish_and_premium.sql:29-39; src/app/api/admin/tickets/replies/route.ts:72-75, :28-44.

**Root cause / trust boundary:** Reply INSERT policy checks ticket ownership/admin rights but never requires reply.user_id=auth.uid(). authenticated has INSERT. The API correctly derives sender but direct Data API bypasses it.

**Prerequisites and safe reproduction:** DB-04: A opens its own synthetic ticket, then direct INSERT with that ticket and disposable admin sender ID. Control: own sender succeeds; B ticket must deny. Render staff reply list using only synthetic identities.

**Expected:** Caller can reply as themselves only unless a separately authorized audited automation sends a system reply.

**Observed:** Policy permits foreign sender when ticket is owned. Actual database and profile joins untested.

**Impact and severity reasoning:** Impersonation of staff/other accounts within support history. Name/email disclosure through joined profiles depends on profile SELECT RLS and is not confirmed. Owning a ticket is a legitimate public reply capability even though route is under /admin; absence of a role guard alone is not the finding.

**Existing mitigation / uncertainty:** API derives user_id; SELECT policy limits replies by ticket owner/admin.

**Remediation and order:** Add sender binding WITH CHECK plus role-specific staff permissions and immutable creator fields. Keep learner replies supported. Verify staff/customer views and avoid trusted identity from future public webhooks/forms.

**Rollback / migration risk:** Identify any historical inconsistent senders; preserve ticket conversation with an audit correction rather than silently rewriting identities.

**Regression verification:** DB-04 sender/ticket combinations and admin positive control.

**References:** ASVS v5.0.0-8.2.3; OWASP API3:2023.


### LERNA-SEC-011 — Permissive telemetry policies allow fabricated cross-user records

**Severity:** Medium. **Confidence:** High. **Evidence status:** Code-confirmed policy flaw; effective remote grants unverified.

**Affected evidence:** supabase/migrations/20260704000000_production_persistence.sql:22-27; supabase/migrations/20260701000000_admin_dashboard_and_analytics.sql:164-169; src/app/api/analytics/event/route.ts:7-20; src/lib/services/business.ts:123-157.

**Root cause / trust boundary:** Later INSERT policies TO public WITH CHECK(true) combine permissively with owner policies; authenticated already has INSERT on attribution/events/page_views/performance/feature_usage. ai_requests exposure additionally depends on actual INSERT grants, not granted to authenticated in the earlier migration.

**Prerequisites and safe reproduction:** DB-05: as A insert a synthetic page_view/attribution for B; positive own record; anonymous attempt separately tests actual grants. Also attempt fabricated ai_requests only in disposable DB and record whether permission denies. Never infer anon access from policy alone.

**Expected:** Trusted billing/AI telemetry is server-derived; client analytics cannot impersonate other users or security events.

**Observed:** Unconditional policies override restrictive owner INSERT checks for tables with effective INSERT grants. September server timestamp trigger fixes created_at, not identity/properties.

**Impact and severity reasoning:** Corrupts analytics, attribution and abuse signals; if ai_requests INSERT is exposed, fabricates quota/cost evidence for victims. No confirmed anonymous database write or paid-entitlement escalation.

**Existing mitigation / uncertainty:** Newer events policy binds user_id, and server event API derives identity. Old telemetry policies remain. September recalculate RPC is separately guarded/revoked.

**Remediation and order:** Remove permissive public write policies; separate low-trust client analytics from server-only AI/cost/security records. Derive identities/timestamps and validate bounded event schemas, permitted names and rate limits. Reconcile historical counts.

**Rollback / migration risk:** Keep anonymous page analytics through a narrow validated ingress if required; do not grant client writers access to authoritative usage records.

**Regression verification:** DB-05 all roles/tables with positive controls, inspect grants and policy combinations, then replay synthetic forged identity events.

**References:** ASVS v5.0.0-8.2.3, -16.4.2; OWASP API3/API4:2023.


### LERNA-SEC-012 — Deletion can succeed while searchable private text remains retrievable

**Severity:** Medium. **Confidence:** High. **Evidence status:** Source-confirmed; failure swallowing and empty-scope expansion reproduced with mocks.

**Affected evidence:** src/lib/materials/elastic.ts:78-94, :187-191; src/app/api/materials/[id]/route.ts:47-64; src/lib/materials/retrieval.ts:78-95; src/app/api/chat/route.ts:316-331.

**Root cause / trust boundary:** All three Elastic delete failures are swallowed. Storage resolved error payloads are ignored. SQL tombstone precedes cleanup, and RAG fallback can expand an explicit empty authorized document set to all ready indexed documents for that user without checking SQL tombstones.

**Prerequisites and safe reproduction:** DELETE-01 positive deletes succeed; stub all Elastic deletions to fail: helper resolves after 3 failures. RAG-02 supplies documentIds=[]: 3 searches include unscoped same-user fallback. End-to-end DB-06 must seed A synthetic indexed text, delete under fault injection and assert it never returns to prompt.

**Expected:** Deleted content is immediately excluded from retrieval and physical cleanup succeeds or enters a durable observable retry.

**Observed:** Cleanup failure is hidden; broad fallback can return stale indexed rows. Actual retained remote text was not fetched.

**Impact and severity reasoning:** Same-user deletion/privacy/retention failure, including a compromised account continuing to retrieve supposedly removed documents. Cross-user retrieval is still constrained by the trusted user filter; no cross-user leak claimed.

**Existing mitigation / uncertainty:** SQL lists and views exclude deleted rows; Elastic retrieval always includes user_id and ready status. Existing signed URLs may remain usable until their 10-minute expiry.

**Remediation and order:** Treat [] as no authorized documents and validate every retrieved document against active SQL ownership/status before prompt inclusion. Tombstone/filter first, enqueue idempotent cleanup with retries/alerts and check both rejected promises and resolved SDK error fields. Include original, chunks, vectors, summaries and account deletion retention.

**Rollback / migration risk:** Restore a document only with explicit owner action; never revive stale index entries to mask cleanup failures. Backfill deletion jobs safely.

**Regression verification:** DELETE-01/RAG-01/02 and DB-06 injected partial failures with authorized surviving A/B document controls.

**References:** ASVS v5.0.0-8.2.2; OWASP LLM02:2025 (private data lifecycle context).


### LERNA-SEC-013 — Saved quiz scores and answers are trusted from client input

**Severity:** Medium. **Confidence:** High. **Evidence status:** Source-confirmed; impossible score accepted in mock route.

**Affected evidence:** src/app/api/quiz/route.ts:114-159; src/app/api/quiz/generate/route.ts:237-240; src/app/(dashboard)/quiz/page.tsx:531.

**Root cause / trust boundary:** Client supplies score, totalQuestions, correctAnswer and isCorrect; route performs only basic type checks and persists them as result records. No server-owned attempt/question version is used. Owners can also mutate quiz rows through the Data API.

**Prerequisites and safe reproduction:** QUIZ-01 saves a valid synthetic result then score=999,totalQuestions=1,questions=[]; both return 200 in mocked persistence.

**Expected:** Trusted results match stored questions/answers and server-computed grading; explicitly self-reported practice records are labelled and excluded from trusted metrics.

**Observed:** Forged score 999 saved by actual handler logic in mock store. Real SQL schema drift may reject both valid and invalid records; live persistence not verified.

**Impact and severity reasoning:** Learning/reporting integrity and misleading admin analytics. Severity is Medium; no certificates, rewards or payment entitlement depend on these scores in current checkout.

**Existing mitigation / uncertainty:** Current quiz is self-study; correct answers delivered to browser are expected in practice mode and are not themselves a vulnerability. Ownership limits direct row access.

**Remediation and order:** Define trusted versus self-reported practice data. For trusted mode persist server-issued attempt/question/version snapshot, derive score from submitted answers, bound schema and block protected-field direct updates. Keep immediate-answer practice behavior as an explicit mode.

**Rollback / migration risk:** Label historical client-reported results; do not silently regrade with a different generated question set.

**Regression verification:** QUIZ-01 plus stored-version answer tampering, duplicate submit and owner/bystander cases. Timed deadlines belong to planned feature design.

**References:** ASVS v5.0.0-8.2.3; OWASP API3:2023.


### LERNA-SEC-014 — Unauthenticated email-existence endpoint exposes account membership

**Severity:** Low. **Confidence:** High. **Evidence status:** Code-confirmed; no real-address probes performed.

**Affected evidence:** src/app/api/auth/check-email/route.ts:6-14; src/lib/repositories/users.ts:69-81.

**Root cause / trust boundary:** Public caller supplies an email; service-role profile lookup returns a direct exists boolean without an application rate limit or equivalent privacy response.

**Prerequisites and safe reproduction:** In isolated mocks only, supply a@fixture.invalid (seeded) and missing@fixture.invalid; expected control distinguishes lookup correctness while public responses should avoid exposing membership. Do not probe real emails.

**Expected:** Public registration/recovery responses preserve membership privacy with bounded abuse handling.

**Observed:** Source returns existence directly from privileged lookup.

**Impact and severity reasoning:** Enables membership enumeration for phishing/privacy harm, not password compromise. Low because account membership alone is the demonstrated information.

**Existing mitigation / uncertainty:** Query selects only ID and parameterizes equality. Provider/WAF rate limits are unverified.

**Remediation and order:** Use generic signup/recovery messages and avoid preflight account-existence lookup; if product retains it, explicitly accept privacy tradeoff and use narrow abuse limits/monitoring.

**Rollback / migration risk:** Preserve useful user recovery directions without restoring bulk enumeration.

**Regression verification:** AUTH-02 synthetic existing/missing controls, response/timing and distributed rate-limit tests.

**References:** OWASP API2/API6:2023.


### LERNA-SEC-015 — Administrative actions can return success without a durable audit record

**Severity:** Medium. **Confidence:** High. **Evidence status:** Code-confirmed migration/application mismatch; actual write grants untested.

**Affected evidence:** supabase/migrations/20260706000000_saas_stabilization.sql:85-97; src/app/api/admin/users/[userId]/actions/route.ts:112-117, :136-141; src/app/api/admin/tickets/replies/route.ts:92-98; src/app/api/admin/coupons/route.ts:75-84.

**Root cause / trust boundary:** API uses the authenticated Supabase client to INSERT audit_logs; migration defines only an admin SELECT policy and service-role table grants. Callers await INSERT but do not inspect SDK error results. These security audit paths cannot prove writes succeeded.

**Prerequisites and safe reproduction:** DB-07: approved disposable admin resets synthetic usage or replies to own test ticket; inject/observe audit INSERT denial and compare action success versus missing log. Positive supported writer must create an immutable record. No remote action performed.

**Expected:** Authorized sensitive mutations commit with a durable trusted actor log or fail/report an observable logging failure.

**Observed:** Source returns success after ignored audit INSERT error. Some definer RPC/trigger actions do write audit/events successfully in their own privileged context; not every action is affected.

**Impact and severity reasoning:** Lost attribution impairs compromise/demotion/cost-abuse investigations. Lack of logging is not itself proof an attacker can modify all audit logs.

**Existing mitigation / uncertainty:** RPC events and profile trigger exist, and September events UPDATE/DELETE revocation improves integrity. Actual audit SELECT grants, destinations, retention and alerts remain unverified.

**Remediation and order:** Use a tightly scoped server/DB operation that derives actor from validated identity and atomically records sensitive mutation. Inspect returned errors and alert on logging failures. Avoid general authenticated INSERT grants that let actors forge log identity/content.

**Rollback / migration risk:** If the log store is down, explicitly choose deny for privilege changes/exports and a documented safe degraded policy for low-risk support; avoid silent success.

**Regression verification:** DB-07 authorized success+record, denied action, failed log persistence and tampered actor control.

**References:** ASVS v5.0.0-16.4.2; OWASP API8:2023.


### LERNA-SEC-016 — Installed Next.js is within later advisory ranges; deployment-dependent RCE needs resolution

**Severity:** Critical (conditional). **Confidence:** High version match; Medium deployment applicability. **Evidence status:** Credible suspected vulnerability requiring configuration/reachability verification; no exploit test.

**Affected evidence:** package-lock.json node_modules/next=16.2.6; next.config.ts:4-20; installed sharp=0.34.5; local OS=Windows.

**Root cause / trust boundary:** The checkout remains on the May security release while official July/August/September advisories describe later fixes. Windows-hosted App Router without Cache Components matches the local runtime configuration; whether any deployed server uses Windows is unknown.

**Prerequisites and safe reproduction:** No malicious requests. Compare installed package/config/runtime metadata with official advisories and identify deployed OS/image optimizer/provider patching. Positive deployment control must document a patched version or unaffected environment.

**Expected:** Deployed and exposed local servers are patched against applicable advisories, with feature reachability confirmed.

**Observed:** GHSA-p293-qw3h-jr36 affects Next >=16.0 <16.3.3 Windows servers without Cache Components; this Windows checkout has 16.2.6 and no Cache Components setting. GHSA-2xp9-vwfh-vxw4 affects <16.3.3 image AVIF optimization. GHSA-vcvr-r3jv-pc5j affects >=16.2.0 <16.3.6 Node next/og with attacker-controlled SVG; no ImageResponse/next/og source usage found.

**Impact and severity reasoning:** Potential remote code execution if relevant deployment conditions hold. No production RCE is confirmed. Vercel runtime OS/managed image optimizer handling and remote image content control are not verified; image remote allowlist to images.unsplash.com reduces attacker destination control.

**Existing mitigation / uncertainty:** Server route guards do not mitigate framework RCE. Several July cases require Server Actions, single-locale i18n or dynamic rewrites, none found here; do not report those as confirmed vulnerabilities.

**Remediation and order:** Do not expose the old Windows server publicly. Plan a current supported patched Next release satisfying all applicable advisories (16.3.6 is the checked September minimum, not a promise it is latest), align compatible React/ESLint stack, rebuild in isolated env, and verify deployment metadata. No versions changed in audit.

**Rollback / migration risk:** Do not rollback to an affected release; keep a tested patched fallback and review image/SSR behavior before upgrade.

**Regression verification:** DEP-01 signed build/deployment inventory and advisory recheck; no exploit or production scan required.

**References:** Official Vercel Next.js advisories linked in dependency section; upstream CWE-22 for Windows advisory only.

## Coverage and verification framework

The target is applicable ASVS 5.0.0 Level 2, including its prerequisite Level 1 requirements. Official stable release/CSV was retrieved on 12 October 2026. Only verified identifiers below are used. This is partial verification and expressly not ASVS compliance/certification. L3 admin revocation/step-up ideas may be sensible for this app, but are not mislabelled L2 requirements.

| Area / ASVS 5.0.0 reference | Status | Evidence and limits |
| --- | --- | --- |
| Function/data authorization (8.2.1, 8.2.2; L1) | Verified control, limited | getUser ingress and explicit session owner query; AUTH-01/BOLA-01/ADMIN-01 positive/negative mocks. Every deployed method/RLS role remains unverified. |
| Field authorization / tenant boundaries (8.2.3, 8.4.1; L2) | Confirmed vulnerability | SEC-002/006/007/010/011. Defined SQL flaws are not claims about applied cloud policies. |
| Trusted-layer enforcement (8.3.1; L1) | Confirmed vulnerability | SEC-003/007. UI sign-out and fallbacks insufficient. |
| File size/content (5.2.1/5.2.2; L1), compressed expansion (5.2.3; L2) | Confirmed vulnerability | SEC-005; tiny fixtures only, no stress test. |
| Backend secret handling (13.3.1; L2) | Confirmed vulnerability | SEC-001; exposed configured credential, actual privilege/validity unknown. |
| Sensitive logging (16.2.5; L2) | Confirmed vulnerability | SEC-009 fake code logged. |
| Log integrity (16.4.2; L2), fail-secure behavior (16.5.3; L2) | Confirmed vulnerability | SEC-004/015; actual provider/log grants pending. |
| OAuth transaction binding (10.2.1; L2) | Not tested / blocked | Installed SSR browser source specifies PKCE; server exchanges code. Full state/replay/login-CSRF/provider behavior needs disposable auth service. |
| Exact provider redirects (10.4.1; L1) | Not tested / blocked | Supabase/Google Site URL and allowlist unavailable; code-level callback open redirect separately confirmed. |
| Password login, signup, verification, recovery, logout/refresh/account lifecycle | Not tested / blocked | Source traced signInWithPassword/signUp/resetPasswordForEmail/updateUser/signOut. No live recovery or stale-session revocation/MFA settings inspected. No implemented learner hard-account-delete route found. Soft-delete flaw is SEC-007. |
| Token validation | Verified control, limited | Sensitive route helpers use auth.getUser; getSession is used for UI/layout restoration after user validation, not the principal API authorization source. Forged/expired provider token test blocked. |
| Cookie CSRF/CORS/origin behavior | Not tested / blocked | SDK defaults inspected; no global mutation Origin/CSRF guard or custom permissive CORS found. Browser session cookies require browser access, so HttpOnly absence alone is not a proven vulnerability here. Cookie Secure/SameSite behavior and related-domain attacks require isolated browser tests and deployed headers. |
| Storage/private downloads | Not tested / blocked | Migration private bucket with owner-based CRUD, generated path, upsert=false, owned metadata lookup and 600-second signed URLs at materials/[id]/view. No public object access/real signatures tested. Policies are object owner-based, not verified folder-prefix policy. |
| Search tenancy | Verified control, limited | RAG-01 checks trusted user_id in knn filters; quiz Elastic search also filters server user. Actual mappings/index ACLs and cross-user retrieval untested. Empty-scope/deletion failures confirmed SEC-012. |
| SQL grants/RLS, functions/views/realtime | Not tested / blocked | Migrations inventory and latest redefinitions reviewed. SECURITY DEFINER missing caller check confirmed SEC-002; several older definers lack pinned search_path, a hardening lead without proved attacker schema CREATE rights. No application SQL views/realtime subscriptions found; provider-created/exposed schemas remain unknown. |
| Injection / traversal / SSRF sinks | Verified control, source-limited | SQL/Supabase equality queries and static CASE fields, structured tenant search, encoded Elastic index/ID paths. No reachable user-supplied fetch host/shell/template execution found. PPTX reads selected ZIP entries without filesystem extraction. No local SSRF test because no application URL-import sink identified. Provider egress/redirect behavior unknown. |
| XSS / Markdown / model output | Verified control, limited | Installed react-markdown defaults omit executable raw HTML and neutralize javascript links; positive https link control passed. Chat component uses default transform and no rehypeRaw. Root dangerouslySetInnerHTML is static structured data. Full component/KaTeX/plugins/browser and admin/export render paths still need integration tests. |
| AI prompt injection / tools | Credible suspected vulnerability requiring verification | User history/profile/RAG text are concatenated with instructions. Harmless markers can enter prompt; no paid live model behavior tested. No model tools/actions or cross-tenant privilege misuse demonstrated. Model-only instruction disregard is not labelled a confirmed security exploit. |
| Resource / business logic | Confirmed vulnerability | SEC-004/005/013. No controlled concurrency race against real service performed. Coupon path reads then updates count and upgrades plan, but ordinary roles lack required writes in migrations; do not claim a verified free-Pro exploit. |
| Admin/support/integrations | Confirmed vulnerability / blocked portions | SEC-003/010/015. MFA/step-up not implemented in checked server guards, enrollment/provider settings unavailable. Support exists in SQL; Formspree absent. No outbound reply worker/delivery verified. |
| CSV exports / caches | Verified control, limited / suspected gap | Export uses static dataset+column allowlist, 1,000-row pages/100,000 cap, private no-store and quote escaping/prefix guard for =+-@. Tab/CR/LF-prefixed spreadsheet interpretation needs product-specific validation; not claimed RCE. GET is a sensitive capability and needs audit/step-up. Auth cache leakage not demonstrated; private no-store proxy/export and cookies are helpful. Client React Query cache transition across logout needs browser check. |
| Dependencies / build / deployment | Credible suspected vulnerability requiring verification | SEC-016; exact local versions checked, later official advisories reviewed. npm audit failed with empty error object; no clean scan claimed. No clean install/rebuild performed. |
| CI, previews, provider permissions, TLS, source maps, backups/recovery | Not tested / blocked | No .github workflows or vercel.json tracked; hosted settings/logs/preview ACLs/provider IAM unavailable. 34 existing .next/static JS/map files scanned with no privileged exact/pattern hit; those assets may be stale and are not deployed build proof. Backup restoration not verified. |
| Timed quiz/share cards/PDF packs/payment webhooks | Not applicable to current implementation | Planned review below; payment libraries are mocks and no checkout/webhook API route found. |

ASVS descriptions above are intentionally brief paraphrases. Supplementary frameworks: OWASP API Security Top 10 2023 (object/property/function authorization, unrestricted resource use, misconfiguration) and OWASP LLM Top 10 2025 (prompt injection, sensitive information, improper output handling and consumption). These are analysis aids, not numerical scores.

## Database / storage / search inventory

Migration-created public tables: `admin_users`, `ai_requests`, `analytics_events`, `audit_logs`, `billing_transactions`, `billing_webhook_events`, `broadcasts`, `coupon_codes`, `courses`, `daily_stats`, `email_queue`, `events`, `feature_flags`, `feature_usage`, `feedback`, `institutions`, `invoices`, `notes`, `notification_preferences`, `organization_members`, `organization_roles`, `organizations`, `page_views`, `performance_metrics`, `profiles`, `quiz_questions`, `quizzes`, `referral_codes`, `referral_rewards`, `referrals`, `study_messages`, `study_sessions`, `subscription_history`, `subscription_usage`, `subscriptions`, `support_ticket_replies`, `support_tickets`, `uploaded_materials`, `usage_events`, `user_attribution`, `user_preferences`, `user_roles`.

Auth users/sessions and storage.buckets/objects are provider-managed additional surfaces. Default exposed public schema is only an assumption to verify in Data API settings. Migration table grants and policies were examined, but no database schema or pg_policies snapshot was obtained. Read all 20 migration files with focused policy/grant/function and latest-definition review; no migrations applied.

Core learning tables have owner SELECT/INSERT/UPDATE/DELETE and grants, except child-owner/parent omissions in SEC-006. quiz_questions correctly ties access to an owned quiz. Profiles allow owner UPDATE across all columns; subscriptions/user_roles are intended server/admin-controlled. Newer billing tables primarily allow own SELECT/admin operations; usage_events INSERT grant has no matching learner insert policy. Telemetry public INSERT policies are permissive. user_roles roles_select_all allows all authenticated roles/UUIDs; assess need for public role-directory visibility as a lower-risk privacy/reconnaissance follow-up. Draft/scheduled announcements are visible via authenticated broadcasts SELECT true and unfiltered GET; restrict lifecycle/audience even though published announcement access is intentional. These lower-risk exposure leads should be tested with synthetic rows and product privacy expectations.

Latest complete_onboarding is SECURITY INVOKER, pins empty search_path, checks caller_id=target_user_id, validates learner persona and excludes protected role/plan fields (20260924000000:24-48). Newer profile compatibility/signup triggers pin their path and revoke ordinary EXECUTE. Latest admin business-intelligence RPC checks is_admin and validates range/timezone/bucket, pins path and revokes public/anon execution. Latest recalculate_daily_stats revokes public/anon and allows authenticated/service_role; ordinary non-admin auth.uid is denied. Earlier unguarded versions of these functions were superseded and are not reported as current callable bugs.

Original files: private uploaded-materials bucket, CRUD based on object owner. Extracted text and vectors: eduagent_documents, eduagent_document_chunks, eduagent_embeddings with user_id/document_id/session_id metadata; REST credentials are server-side but actual key scope/ACLs unverified. Deletion is incomplete under failures. Local Elastic automatic mock fallback can also hide service outages; it is not proof of durable isolation/persistence. No published material endpoint is implemented; signed links are bearer access valid until expiry.

## Routes and attack surface inventory

Pages: /, /welcome, /onboarding, /privacy-policy, /materials; dashboard /chat, /courses, /courses/[id], /study, /quiz, /account; /admin. Client-only hiding is not authorization. Proxy matches learner routes and some historical nonimplemented routes; dashboard uses requireUser, admin layout uses requireAdmin. APIs have their own auth checks. No current cron/jobs webhook route, server actions, debug SQL endpoint or schedule/progress/voice page implementation found. Mutating bootstrap-admin/seed-institutions scripts were inspected as privileged operator surfaces, never run.

| Route | Methods | Source boundary / caveat | File |
| --- | --- | --- | --- |
| `/api/account/billing` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/account/billing/route.ts` |
| `/api/account/invoices` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/account/invoices/route.ts` |
| `/api/account/onboarding` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/account/onboarding/route.ts` |
| `/api/account/subscription` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/account/subscription/route.ts` |
| `/api/account/usage` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/account/usage/route.ts` |
| `/api/admin/analytics` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/analytics/route.ts` |
| `/api/admin/audit-logs` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/audit-logs/route.ts` |
| `/api/admin/billing` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/billing/route.ts` |
| `/api/admin/broadcasts/audience-count` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/broadcasts/audience-count/route.ts` |
| `/api/admin/broadcasts` | GET, POST | GET authenticated public announcements; POST admin fallback | `src/app/api/admin/broadcasts/route.ts` |
| `/api/admin/coupons` | GET, POST, DELETE | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/coupons/route.ts` |
| `/api/admin/events` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/events/route.ts` |
| `/api/admin/exports` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/exports/route.ts` |
| `/api/admin/feature-flags` | GET, POST | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/feature-flags/route.ts` |
| `/api/admin/feedback` | GET, PUT | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/feedback/route.ts` |
| `/api/admin/health` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/health/route.ts` |
| `/api/admin/institutions/analytics` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/institutions/analytics/route.ts` |
| `/api/admin/institutions/verify` | GET, POST, DELETE | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/institutions/verify/route.ts` |
| `/api/admin/stats` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/stats/route.ts` |
| `/api/admin/tickets/replies` | GET, POST | Authenticated ticket owner/admin via RLS; sender flaw (SEC-010) | `src/app/api/admin/tickets/replies/route.ts` |
| `/api/admin/tickets` | GET, PUT | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/tickets/route.ts` |
| `/api/admin/toggle-admin` | POST | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/toggle-admin/route.ts` |
| `/api/admin/transactions` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/transactions/route.ts` |
| `/api/admin/users` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/users/route.ts` |
| `/api/admin/users/[userId]/actions` | POST | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/users/[userId]/actions/route.ts` |
| `/api/admin/users/[userId]` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/users/[userId]/route.ts` |
| `/api/admin/users/[userId]/timeline` | GET | getUser + is_admin/email/metadata fallback; SQL/RLS second boundary varies | `src/app/api/admin/users/[userId]/timeline/route.ts` |
| `/api/analytics/attribution` | POST | Optional identity; low-trust telemetry | `src/app/api/analytics/attribution/route.ts` |
| `/api/analytics/event` | POST | Optional identity; low-trust telemetry | `src/app/api/analytics/event/route.ts` |
| `/api/analytics/pageview` | POST | Optional identity; low-trust telemetry | `src/app/api/analytics/pageview/route.ts` |
| `/api/auth/check-email` | POST | Public existence lookup (SEC-014) | `src/app/api/auth/check-email/route.ts` |
| `/api/chat/references` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/chat/references/route.ts` |
| `/api/chat` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/chat/route.ts` |
| `/api/courses` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/courses/route.ts` |
| `/api/courses/[id]` | GET, PATCH, DELETE | getUser; owner query/RLS; see findings for writes | `src/app/api/courses/[id]/route.ts` |
| `/api/demo-chat` | POST | Intended anonymous demo; local IP limiter (SEC-004) | `src/app/api/demo-chat/route.ts` |
| `/api/feedback` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/feedback/route.ts` |
| `/api/health` | GET | Public minimal health | `src/app/api/health/route.ts` |
| `/api/institutions/custom` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/institutions/custom/route.ts` |
| `/api/institutions/search` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/institutions/search/route.ts` |
| `/api/materials` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/materials/route.ts` |
| `/api/materials/[id]/process` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/materials/[id]/process/route.ts` |
| `/api/materials/[id]` | DELETE | getUser; owner query/RLS; see findings for writes | `src/app/api/materials/[id]/route.ts` |
| `/api/materials/[id]/view` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/materials/[id]/view/route.ts` |
| `/api/quiz/generate` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/quiz/generate/route.ts` |
| `/api/quiz` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/quiz/route.ts` |
| `/api/quiz/[id]` | GET | getUser; owner query/RLS; see findings for writes | `src/app/api/quiz/[id]/route.ts` |
| `/api/study-sessions` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/study-sessions/route.ts` |
| `/api/study-sessions/[sessionId]` | GET, PATCH, DELETE | getUser; owner query/RLS; see findings for writes | `src/app/api/study-sessions/[sessionId]/route.ts` |
| `/api/study-sessions/[sessionId]/summary` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/study-sessions/[sessionId]/summary/route.ts` |
| `/api/tickets` | GET, POST | getUser; owner query/RLS; see findings for writes | `src/app/api/tickets/route.ts` |
| `/api/upload` | POST | getUser; owner query/RLS; see findings for writes | `src/app/api/upload/route.ts` |
| `/auth/callback` | GET | PKCE code exchange; unsafe next (SEC-008) | `src/app/auth/callback/route.ts` |

Inventory is source evidence, not successful endpoint execution. Each method's integrated four-identity test status is in SECURITY_TEST_MATRIX.md.

## Dependency/advisory assessment (retrieved 12 October 2026)

- [Next.js May release](https://vercel.com/changelog/next-js-may-2026-security-release): 16.2.6/React server-dom 19.2.6 fix that release's issues. This is not sufficient for later advisories.
- [July release](https://nextjs.org/blog/july-2026-security-release): 16.2.11/15.5.21 addressed several conditional risks. No Server Actions, i18n single-locale config or request-derived rewrite hostname found; those preconditions are absent in inspected code. Other framework behavior still needs deployment verification.
- [Windows RCE GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), 25 August 2026: 16.2.6 lies in >=16.0 <16.3.3 and local OS is Windows without Cache Components. No server was exposed during this audit. Production Windows hosting unknown.
- [AVIF optimizer GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), 25 August 2026: version match; actual image optimizer, AVIF ingestion and native-library fix/provider handling need verification. Only images.unsplash.com remotePattern configured; no arbitrary user-controlled remote host was found.
- [Node ImageResponse GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), 22 September 2026: version affected, but no next/og/ImageResponse implementation found. Not confirmed reachable now; relevant before implementing share cards. Checked patched minimum is 16.3.6, not an assertion of latest version.
- [Mozilla PDF.js GHSA-wgrm-67xf-hhpq](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq), 6 May 2024: bundled pdf-parse defaults to PDF.js v1.10.100, older than fixed 4.2.67. This advisory requires vulnerable evaluated rendering behavior; application calls getTextContent, not canvas rendering. No code execution demonstrated; maintain/replace old parser and verify configuration/reachability separately. Package scanners may miss vendored PDF.js.
- [Mozilla GHSA-hq66-cqwq-w95j](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j), 28 July 2026: scripting condition and affected >=5.6.83 do not match bundled v1.10.100. Do not apply that newer advisory indiscriminately.

No package install, lifecycle script, audit fix or automatic version changes were made. Parser/native transitive advisories beyond the listed leads require a successful current lockfile scanner; no assumption that all other dependencies are clean. eslint-config-next 15.3.2 mismatches Next 16; this is tooling drift, not a proved production exploit.

## Executed tools and checks

| Check | Actual result |
| --- | --- |
| Git identity/status/remote/history | main / 9b37a7e8…; initial modified next-env.d.ts + untracked docs preserved; 231 local reachable commits |
| Redacted current/selected-history credential scan | 2,163 historical text blobs (2,090 primary + 73 extra); 12 skipped primary candidates (size/type); one exact configured service-role variable match in historical script. No privileged pattern/exact matches in current inspected source or 34 existing browser artifacts. Format/validity of exposed credential is unrecognized/opaque; it differs from configured publishable key and has no obvious placeholder marker. Scope is inferred from intended server use, not authenticated with provider. |
| boundary tests characterization | 16/16 pass reproducing current behavior, **not security success**; all provider calls mocked |
| boundary tests --secure | **5 pass / 11 fail**, exit 1; expected secure requirements intentionally remain red for vulnerable behavior |
| Parser/render tests | small TXT/PPTX accepted; unsupported type rejected; MIME-spoofed HTML-as-text accepted. Script HTML / javascript link neutralized; valid HTTPS link rendered. No full browser/plugin claim |
| tsc --noEmit --incremental false | exit 2: missing React Query modules and 8 implicit-any errors; not fixed |
| npm run lint | exit 1: removed next lint command interpreted as nonexistent /lint directory; not fixed |
| npm ls --depth=0 --json | two missing locked React Query dependencies; no install performed |
| npm audit --json --ignore-scripts | failed with empty error details and no vulnerability metadata; **not a clean scan** |
| gitleaks / local DB tools | unavailable; bounded custom redacting scan used; psql/Docker unavailable |
| Full build/UI/deployed configuration | not run/blocked; build can evaluate app/provider paths, local install is incomplete, and production isolation is not established |

Reproducible scripts/results: security-boundary-tests.mjs, boundary-test-results.json, secure-expectation-results.json, parser-render-tests.mjs, parser-test-results.json, render-test-results.json and secret-scan-results.json in this directory. Synthetic tests cover application control flow; their in-memory query mock does **not implement PostgreSQL RLS/foreign keys/grants** and cannot prove database enforcement. Conditional runtime or cloud concerns are not upgraded to confirmed production exploits.

## Planned feature design review (separate from present vulnerabilities)

- **Timed quizzes:** create server-owned attempt/question snapshot, deadline and grace rule; store answers only server-side until the mode allows reveal; resume from server state after refresh; submit once with idempotent replay; verify owner and enforce server deadline. Practice mode may deliberately reveal answers.
- **Results/progress:** recompute grades from stored question/version data, identify invalidated questions and correction policy, label offline/self-reported scores; never mix them into trusted rankings or entitlements. Current result forgery is SEC-013, not an invented timed-mode bug.
- **PDF practice packs:** fetch only active owned sources; use sanitized static rendering with external loads disabled, bounded pages/fonts/images/time/output bytes; enforce generation quota; private storage and short-lived signed download, retry cleanup and deletion propagation.
- **Share cards:** explicit publication opt-in, minimal identity, immutable trusted saved result, no private document title/text by default; high-entropy revocable tokens and rate-limited lookup where sharing is private-link based. Avoid attacker-controlled SVG on vulnerable next/og; patch before adopting this renderer.
- **Support integration:** current SQL dashboard supports tickets/replies. Future Formspree delivery must use its actual documented supported authentication mechanism or a trusted fetch/reconciliation design; do not assume an invented signature. Bind account identity server-side, keep staff/customer permissions separate, sanitize replies/attachments, restrict replies to authorized channels and cap spam/outbound volume. No Formspree implementation or delivery tests were found.
- **Payments:** Paystack/Flutterwave libraries are simulation foundations; no current checkout/webhook endpoint. Before activation compute prices/currency/plans server-side, verify actual provider-supported authentication and successful transaction identity/amount, atomically deduplicate events, bind entitlement to trusted payment, handle refunds/cancellation/reconciliation, and prevent simulation success in production. Coupon logic is already present and requires an atomic server-managed redemption transaction before it can safely grant Pro; no current entitlement bypass is claimed because existing RLS may deny the writes.

No enterprise platform expansion is required; canonical guards, narrow SQL operations, bounded worker jobs, trusted metering and a short incident playbook fit the existing architecture.

## Chained paths and limits

Supported chain: configured email/prior privileged metadata survives database demotion -> requireAdminApi accepts -> raw dataset export creates service-role client -> potential bulk PII disclosure (SEC-003). First two links are mock-confirmed, privileged export linkage source-confirmed, actual deployment/data retrieval untested. Supported retention chain: swallowed Elastic cleanup failure -> SQL tombstone hidden from list -> empty authorized set broadens same-user retrieval -> stale private text may reenter prompt (SEC-012); integrated final retrieval needs fault-injected isolated index.

Do not infer profile edit -> admin takeover: current is_admin fallback checks auth.users.email, not user-editable profiles.email, and app_metadata is privileged. Do not infer document prompt injection -> tools/data exfiltration: no model tools and trusted user filters were found. No current reachable application code execution, normal-user admin takeover or verified cross-user private-content read was reproduced.

## Missing verification and exact inputs needed

Provide evidence through approved read-only access/export or provision **isolated disposable services**: (1) deployed commit/build/package versions and OS/runtime/image optimizer; (2) Supabase migration history, schema/exposed-schema settings, pg_policies/table/column grants, pg_proc owners/proacl/search_path, storage buckets/object policies, Auth Site URL/redirect allowlist/Google PKCE and signup/recovery settings, JWT lifetime/revocation/MFA; (3) sanitized credential type/revocation record and access-log review for exposed key; (4) local disposable A/B/admin auth fixtures and separate private buckets/Elastic indexes with mock Gemini/email/payment and egress denial; (5) Elastic mappings/role/API-key scopes, Vercel headers/preview ACLs/environment secrets/log permissions, Gemini spend/retention/quotas; (6) containment contacts, backup snapshot/restore exercise, retention and alert ownership. Do not paste live credentials or user data into chat or reports.

High-impact missing evidence blocks a confident scale decision even after source fixes. See SECURITY_SCALE_GATE.md for objective gates and SECURITY_REMEDIATION_PLAN.md for dependency order. No cloud provider control, real model resistance, end-to-end authenticated user journey, incident response or backup restoration was verified.

## Official references

[ASVS stable project](https://owasp.org/projects/asvs) / [5.0.0 stable CSV](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv), [OWASP API Security 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/), [OWASP GenAI risks](https://genai.owasp.org/llm-top-10/), [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs). Retrieved 12 October 2026. Supabase changelog.md was unavailable; HTML changelog was retrieved. Linked provider guidance informs recommendations, not proof of configured controls.

## Conclusion

The audited commit is **blocked by confirmed risks**, with significant missing verification. Rotate/revoke the historically exposed privileged credential first, then establish isolation and fix privileged access, budget and upload boundaries before expanding usage. Mocks verify concrete application defects and several useful controls; they do not establish production exploitability or universal security. Residual prompt injection, stolen-account abuse, parser risks, dependency changes and operational recovery need continuing monitoring after fixes and deployment retesting.
