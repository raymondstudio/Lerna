# Lerna AI next development stage

Decision basis: repository/local audit dated 12 October 2026, main @ 9b37a7e8de96b09340ef4ecb5d0ded52840f5476. Read LERNA_PROJECT_CONTEXT.md and LERNA_AUDIT.md first. This document is an implementation handoff, not work performed in this audit.

## Recommended stage

Stabilize the authenticated learning journey and operational evidence before expanding features. The product has substantial implemented functionality, but the supplied runtime does not render, production code can report fake model/index success, moderation/privileged function controls need repair, and reporting contracts/telemetry are inconsistent. A small pre-revenue team benefits more from dependable existing tutoring and visible failures than another feature surface. Preserve the current brand and existing data.

No prerequisite is 'replace the stack'. First prove the actual failing boundaries with a safe staging environment. Do not infer production defects or database migration state from this checkout alone.

## Stabilization sequence

### S1. Establish reproducible local/staging baseline (F01)

**Dependencies:** none for local setup; founder identifies deployed SHA/environment and supplies access to an isolated staging project or schema-only snapshots. Never paste secrets/private messages into reports.

**Tasks:** restore exact package-lock installation; repair Next 16-compatible lint configuration/invocation without suppressing checks; regenerate stale .next types; resolve remaining independent type errors; make font build dependable; record all required environment names and safe setup. Replay migrations only in disposable Supabase-compatible staging. Compare applied schema/function signatures/policies/grants/storage configuration against repository. Keep production migration decisions separate and reviewable.

**Acceptance:** clean install, lint, type-check and build pass; / and learner/admin shells render; local credentials/URLs cannot address production; repeatable staging setup documented; sources/onboarding/BI columns and RPC signatures reconciled. A green build is not a passed learner journey.

### S2. Close authorization and auth diagnostic gaps (F04/F05/F12)

**Dependencies:** S1 for live tests; code-level design can start independently. Founder provides nonsecret OAuth Site URL/allowlist and deployed origin evidence.

**Tasks:** apply return-path sanitizer at callback/initiation; redact codes/URLs; implement request/response cookie refresh consistently; unify admin guard/owner behavior and remove accidental email-bootstrap dependencies. Protect moderation columns and enforce active-account server/service checks. Restrict quota SECURITY DEFINER execution, caller/delta/search_path; validate linked parent ownership. Split published learner broadcasts from admin drafts; enforce reply author identity. Review all public privileged functions and inherited grants in staging, including legacy helper functions.

**Acceptance:** password/Google sign-in completes locally and on staging, reload/expired session/logout work; malicious next stays local; no credentials in logs. Anonymous/user-A/user-B/admin access matrix passes direct APIs and Data API/storage/RPC tests. Suspended/deleted identities cannot use costly APIs or clear flags; nonowner quota writes/negative deltas denied; no draft disclosure or forged replies. Actual production dashboard settings remain explicit deployment prerequisites.

### S3. Make provider/retrieval failures truthful and enforce budgets (F02/F03/F07/F08/F16)

**Dependencies:** S2 identity boundary and S1 staging; schema changes planned separately. Use provider stubs for repeated failure testing; real paid evaluation only with an agreed budget.

**Tasks:** disable automatic Gemini/Elastic mocks in live mode; retain explicit isolated developer simulation. Typed dependency failures/circuit state and visible retryable UX; no ready material until durable index exists. Separate system instruction from profile/history/untrusted material data. Define explicit-session/material scope, relevance rejection and empty-retrieval behavior. Version embedding model/dimensions; verify existing indices before use. Wire distributed per-user request/reprocess limits and token/file bounds across every endpoint; cheap validation before provider calls.

**Acceptance:** missing key/429/outage/empty content/index disconnect never produce live success; restart preserves ready material; context-less answer never claims uploaded evidence; foreign/deleted/unrelated documents excluded. Visible sources identify actual retrieved page/slide; hostile material does not override tutor instructions in evaluation. Limit rejection makes zero provider calls, including concurrent/retry/secondary-path tests. Simulation separately labeled/recorded and excluded from operating metrics.

### S4. Repair durable send/upload/save/reload recovery (F06/F08/F15)

**Dependencies:** S2/S3; preserve existing originals and conversations; identify affected records before backfill/reindex.

**Tasks:** request/attempt IDs and retry deduplication; server-owned recent history; publish new session ID before send; retained/failed composer state. Consolidate upload validation/status handling; owned parent/path/type/signature/size checks; durable leased processing job with checkpoint/retry, recovery from partial index and timeout. Make cleanup visible/retryable, reconcile tombstones. Correct notes conflict target and atomic quiz saves. Make unassigned materials visible after conversation deletion and add stable session/message/material pagination.

**Acceptance:** staged failures at each boundary produce one user message/session and explicit attempt outcomes, no lost already-stored reply; reload matches durable state. Successful reprocessing is idempotent; corrupted/oversized/scanned documents fail clearly; formats consistently advertised. Repeated notes save updates one row; quiz is complete or fails atomically. Deleted/orphaned material lifecycle intentional. >1000 messages paginate without duplication/truncation. Measure ingestion memory/duration with safe representative files.

### S5. Make founder reporting reconcile to durable facts (F09/F10/F11/F17)

**Dependencies:** S3/S4 outcome semantics. S1 applied schema. Founder signs off definitions of active users, chats, model attempts/successes and historic coverage; old 22 monthly-user figure stays historical until reconciled.

**Tasks:** one trusted awaited telemetry writer after authorization, server-owned event types and stable request/attempt IDs; actual model/mode/outcome/usage/latency/pricing version. Separate user messages, assistant completions, sessions, reformulation, OCR, embeddings and retries. Connect every analytics tab to the canonical timezone/range RPC/response. Zero-fill calendar averages; retain significant transition events and label unrecoverable historic gaps. Fix users export subscription relation, deterministic paging and cap disclosure. Remove invented health defaults/provider statuses; make liveness and readiness distinct.

**Acceptance:** controlled fixture journey's provider calls/messages/uploads/session totals exactly reconcile with dashboard and exports. Reject/capture logging failures; no duplicate or simulated live counts. Lagos/UTC start inclusive/end exclusive, hours/day/week/month, comparison windows, empty buckets, tied timestamps, DST edge fixtures where supported and >1000 rows pass. CSV/JSON same filtered totals, formula-safe, truncation disclosed. No unknown service shown Operational or missing latency shown as a measurement. Cost estimates have model/rate version; no claim of invoice accuracy.

### S6. Complete support delivery and verify UX/branding (F13/F14/F17)

**Dependencies:** S1 renders; S2 ownership. Support channel decision can occur early without delaying learning stabilization.

**Tasks:** fix profile relations; learner-visible ticket thread/status and admin reply workflow; reliable audit/notification state. Choose native intake initially unless Formspree provides a defined benefit. If Formspree selected, verify chosen plan/webhook/API capability, authenticated ingestion/reconciliation, idempotent external ID, validated sender mapping, spam limits. For email replies add transport, threading/bounce/delivery and inbound reply handling; a form endpoint alone cannot do it. Add scroll-to-latest, associated labels/button names, safe long-table overflow; verify mobile keyboard/sidebar and slow send/reload. Correct canonical/www domain/social assets/legacy visible filenames and honest feature copy. Preserve internal Elastic indices pending migration plan.

**Acceptance:** learner -> staff -> learner complete persisted conversation after reload; other user denied; notification failure recoverable. 320/360/390 mobile and desktop test with long content, keyboard and slow requests: no unwanted overflow, input usable, one navigation surface, latest-scroll usable by keyboard/screen reader; modal focus/escape/reduced-motion checked. Canonical/OG/privacy URLs match chosen uselerna.app host and assets resolve. Unimplemented features visibly planned. Real users can understand and recover failures without seeing provider diagnostics.

### S7. Demonstrate release and recovery readiness

**Dependencies:** S1-S6 relevant core gates passed; deployed-state comparison resolved.

**Tasks:** scoped release checklist, CI checks, dependency/model configuration inventory, bounded-cost operational alerts, backup/restore runbook for SQL/files/index reconstruction and rollback/data compatibility plan. Pilot the existing learning journey with a few consenting testers using staging/safe data. Test restoration, not only backup existence. Choose a production deployment only in a later authorized task with concrete verified result.

**Acceptance:** evidenced sign-in -> role onboarding -> each supported upload format -> extraction/index -> grounded question/follow-up -> durable messages/title -> reload -> cleanup; fault cases recover. Monitor detects dependency/telemetry failure; founder report agrees with sampled operations. Restore of synthetic account/material/conversation works. Known unresolved issues and cost observations explicit. No production-ready claim solely from build.

## New features after stabilization

| Candidate | Preconditions | Definition of done |
| --- | --- | --- |
| Weekday/time lessons | Learner need, scheduling/timezone/reminder delivery model | Persisted role-independent schedules, timezone/DST rules, edits/cancellation/delivery with retry |
| Progress/mastery | Reliable event/time/quiz definitions and baseline coverage | Measured longitudinal learning signal; explain limits of inferred mastery |
| Voice | Proven tutoring quality/mobile, explicit usage budget/privacy decision | Real recording/live audio/transcription/synthesis, cancellation/accessibility and accurate voice usage |
| Model selector | Supported account/model IDs, quality/cost evaluation and telemetry routing | Options actually route to available models; clear unsupported/fallback state, measured usage |
| Offline learning/AI | Define download/cache vs local inference separately; target device/privacy/storage constraints | Real offline behavior with durable data/sync and no simulated answer marketed as intelligence |
| Paystack monetization | Pricing/entitlements decision, S2/S5 integrity, provider credentials/test mode | Real signed webhook verification/idempotency, no unconditional mock success, invoices/refunds/cancel/grace behavior verified |

Prioritize among new features using observed learner/support evidence after the stabilization pilot. Possible 400-student departmental adoption is not committed demand; no revenue assumption or paid infrastructure estimate is made here.

## Information still needed from founders

- Deployed Git SHA/environment identity, sanitized Supabase OAuth URL settings, applied migration/RLS/function/storage schema and Realtime evidence; safe staging access with two learners/admin. Share credentials through an appropriate secret mechanism, never in audit documents.
- An anonymized reproduction for historical material tagging/black overlay/mobile overflow if still observed (device/browser, action, expected vs actual). This does not block the concrete source findings.
- Agree what historical chats/AI requests/average monthly users meant, support delivery channel (in-app/email), and the intended canonical www/apex host. No Formspree project type has been assumed.

Future sessions should read these three documents. No AGENTS.md was added or changed. Audit findings are a snapshot; re-check them against the next branch and applied service state before implementation.
