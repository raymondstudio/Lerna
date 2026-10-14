# Security test matrix

**Private — 12 October 2026, Africa/Lagos.** main @ 9b37a7e8de96b09340ef4ecb5d0ded52840f5476. Current code is unmodified. Scope is source review and dependency-mocked boundary tests; deployed and ordinary-role DB outcomes remain blocked. No tests are counted green merely because a route fails.

## Identities, resources and isolation

- Anonymous: null user in validated-auth mock, never a real anonymous provider session.
- A: 00000000-0000-4000-8000-000000000001 / a@fixture.invalid. B: corresponding ...0002 / b@fixture.invalid. Admin: ...0003 / admin@fixture.invalid. These are synthetic in-memory objects, not real account credentials.
- A owns session-a/material-a; B owns session-b/material-b. SECURITY_FIXTURE markers identify fake notes/text/questions and generated IDs. Admin identity uses mocked is_admin=true for positive control, false/error for demotion tests; metadata and email values are synthetic.
- All application import dependencies are whitelisted mocks. Unexpected import throws. No dotenv, provider SDK, server listener, real Auth/database/index/email/payment client or paid call is used. The query fixture performs only the supplied filters and writes in-memory; it does **not** emulate RLS/constraints/grants. Do not relabel those results database enforcement.
- Parser fixtures are 7–413 bytes; native local parser dependencies are used and Gemini OCR is stubbed to throw. No remote destinations/decompression bombs/malicious executable payloads. Markdown script/javascript-link strings are inert rendering test input, not executed.
- Scripts run under 15–20-second process limits, VM evaluation 1 second. The longest mock request loop is 13 sequential demo attempts; 12 model stubs execute. Two test modes run independently. No persistent backend fixture cleanup required.

## Runnable checks

~~~powershell
node docs/security/security-boundary-tests.mjs
node docs/security/security-boundary-tests.mjs --secure
node docs/security/parser-render-tests.mjs
~~~

The first command characterizes the current behavior: **16 pass**, which includes successful reproductions of flaws. The second expresses expected secure behavior: **5 pass, 11 fail, exit 1**. It is deliberately red until remediation. Do not invert expectations or replace vulnerable paths with mocks that enforce missing app checks to produce a green result. The parser/render command passes bounded observations; its MIME-spoof acceptance is a documented behavior, not secure content validation.

| Test | Operation / paired control | Observed (synthetic) | Coverage status | Secure requirement |
| --- | --- | --- | --- | --- |
| AUTH-01 | Validated user required before material queries | {"status":401,"effects":0} | Verified control (mock scope) | Pass |
| BOLA-01 | Owned session reads succeed; user A cannot read user B session | {"own":200,"other":404} | Verified control (mock scope) | Pass |
| BOLA-02 | Foreign-parent notes must be denied before insert | {"own":200,"other":500,"foreignNotesWrites":1} | Confirmed vulnerability (mock/source scope) | Fail |
| ADMIN-01 | Anonymous and ordinary users denied; disposable admin accepted | [401,403,200] | Verified control (mock scope) | Pass |
| ADMIN-02 | Database demotion must override email fallback | {"databaseAdmin":false,"accepted":true} | Confirmed vulnerability (mock/source scope) | Fail |
| ADMIN-03 | Database outage must fail closed even with prior admin metadata | {"accepted":true} | Confirmed vulnerability (mock/source scope) | Fail |
| OAUTH-01 | Local return accepted; external callback return denied | {"ownOrigin":"https://lerna.fixture.invalid","otherOrigin":"https://redirect.fixture.invalid"} | Confirmed vulnerability (mock/source scope) | Fail |
| OAUTH-02 | Callback must not log authorization codes | {"syntheticCodeLogged":true} | Confirmed vulnerability (mock/source scope) | Fail |
| OAUTH-03 | Existing sanitizer rejects external, protocol-relative and backslash returns | {"valid":"/chat?fixture=1","bad":["/chat","/chat","/chat","/chat"]} | Verified control (mock scope) | Pass |
| QUOTA-01 | Quota service must deny on backend outage | {"positiveAllowed":true,"allowed":true} | Confirmed vulnerability (mock/source scope) | Fail |
| COST-01 | Demo limiter positive 200 and negative 429; header and instance reset bypass | {"first":200,"eleventh":429,"rotated":200,"otherInstance":200,"modelMockCalls":12} | Confirmed vulnerability (mock/source scope) | Fail |
| UPLOAD-01 | Foreign session and unsupported MIME must stop before storage and processing | {"own":200,"other":200,"storageWrites":1,"processingCalls":2} | Confirmed vulnerability (mock/source scope) | Fail |
| QUIZ-01 | Client-reported impossible score must be rejected | {"own":200,"forged":200,"savedScore":999} | Confirmed vulnerability (mock/source scope) | Fail |
| DELETE-01 | Elastic deletion failure must propagate or durably enqueue retry | {"attempts":3,"rejected":false} | Confirmed vulnerability (mock/source scope) | Fail |
| RAG-01 | Tenant filter precedes search even with foreign document ID | {"hasTrustedTenant":true,"hasMaterialFilter":true} | Verified control (mock scope) | Pass |
| RAG-02 | Explicit empty authorized set must not expand to all user materials | {"searchCount":3,"unscopedFallback":true} | Confirmed vulnerability (mock/source scope) | Fail |

Positive controls: AUTH-01 shares materials source path with owned upload fixtures; BOLA-01/02 exercise A-owned session success as well as B-denied/foreign-write paths; ADMIN-01 has all three identity roles; ADMIN-02/03 use the same callable helper after a valid admin control; OAUTH-01/03 local path versus external; COST-01 first successful call, eleventh denial and alternate instance/header; UPLOAD-01 valid owned text versus unsupported foreign parent; QUIZ-01 ordinary result versus impossible score; DELETE-01 successful cleanup control before failed-dependency scenario; RAG-01 tenant+document filter and RAG-02 fallback. QUOTA-01 pairs a positive below-quota mock with backend-outage denial expectations; real exhausted budget behavior and atomic reservations remain blocked/new requirements. OAUTH-02 tests error-path logging and OAUTH-01 tests successful exchange logic. Negative tests without an integrated positive provider path do not establish end-to-end authorization.

Additional local results: parser-test-results.json shows TXT/PPTX accepted, unsupported format rejected and MIME-spoofed HTML-as-text accepted. render-test-results.json shows no script element/javascript href and a successful HTTPS link using installed react-markdown defaults. Actual chat component plugins/KaTeX/full browser were not loaded; source confirms default URL transform/no rehypeRaw but integrated XSS tests are pending.

## Method-level permission and execution coverage

The role/resource contract in SECURITY_AUDIT.md governs all operations. This table lists every detected route method and explicitly separates the executed mocks from unexecuted integrated role tests. Path/category source guards are not automatically counted verified. Admin helper tests do not substitute for individual admin endpoint tests or deployed RLS.

| Method / route | Required identities and permissions | Observed execution status |
| --- | --- | --- |
| `GET /api/account/billing` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/account/billing` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/account/invoices` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/account/onboarding` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/account/onboarding` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/account/subscription` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/account/usage` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/analytics` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/audit-logs` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/billing` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/broadcasts/audience-count` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/broadcasts` | Anon deny; A/B published relevant; admin drafts/all | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/broadcasts` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/coupons` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/coupons` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `DELETE /api/admin/coupons` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/events` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/exports` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/feature-flags` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/feature-flags` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/feedback` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `PUT /api/admin/feedback` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/health` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/institutions/analytics` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/institutions/verify` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/institutions/verify` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `DELETE /api/admin/institutions/verify` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/stats` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/tickets/replies` | Anon deny; A/B own tickets/own sender; admin authorized staff | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/tickets/replies` | Anon deny; A/B own tickets/own sender; admin authorized staff | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/tickets` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `PUT /api/admin/tickets` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/toggle-admin` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/transactions` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/users` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/admin/users/[userId]/actions` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/users/[userId]` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/admin/users/[userId]/timeline` | Anon/A/B deny; canonical admin allow (dataset/action scoped) | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/analytics/attribution` | Validated low-trust ingress; no foreign identity/server event spoof | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/analytics/event` | Validated low-trust ingress; no foreign identity/server event spoof | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/analytics/pageview` | Validated low-trust ingress; no foreign identity/server event spoof | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/auth/check-email` | Public flow; membership privacy expected | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/chat/references` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/chat` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/courses` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/courses` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/courses/[id]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `PATCH /api/courses/[id]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `DELETE /api/courses/[id]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/demo-chat` | Anon/A/B/admin: bounded public capability | COST-01 mock positive/429 + instance/header bypass |
| `GET /api/feedback` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/feedback` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/health` | Anon/A/B/admin: public GET | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/institutions/custom` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/institutions/search` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/materials` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | AUTH-01 anonymous mock 401; authenticated integrated blocked |
| `POST /api/materials` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/materials/[id]/process` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `DELETE /api/materials/[id]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/materials/[id]/view` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/quiz/generate` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/quiz` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/quiz` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | QUIZ-01 mock valid and forged both 200; integrated schema blocked |
| `GET /api/quiz/[id]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/study-sessions` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/study-sessions` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/study-sessions/[sessionId]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | BOLA-01 mock A own 200 / B object 404; integrated roles blocked |
| `PATCH /api/study-sessions/[sessionId]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | BOLA-02 mock own 200 / foreign 500 after write; integrated blocked |
| `DELETE /api/study-sessions/[sessionId]` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/study-sessions/[sessionId]/summary` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `GET /api/tickets` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/tickets` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | Not tested / blocked: integrated four-identity + DB roles |
| `POST /api/upload` | Anon deny; A/B own resource/parents; foreign deny; admin own learner scope | UPLOAD-01 mock owned/invalid foreign both 200; real storage/DB blocked |
| `GET /auth/callback` | Only transaction-bound callback; local safe returns | OAUTH-01/02 application mocks; real PKCE/provider blocked |

## Ordinary-role database and integrated tests to execute after isolation

**Current status of every row below: Not tested / blocked.** Requirements: disposable isolated Auth+Postgres/Data API/private bucket/index; fixtures A/B/admin; known applied migrations/grants; egress denial and mock Gemini/email/payments. Use ordinary anon/authenticated role clients for denials and positive owners/admin for success. Service-role clients may seed/delete only created fixtures; their ability to access data is not isolation proof.

| ID | Procedure / allowed positive control | Denied operation and acceptance | Finding |
| --- | --- | --- | --- |
| SECRET-01 | Owner identifies key type/project; supported rotation, server redeploy and authorized controlled revocation verification | Exposed credential no longer accepted; history/artifact scan redacted; repository visibility/forks/access-log review captured | 001 |
| DB-01 | Approved server writer increments A once | Anon/A direct RPC targeting B, negative own increments, arbitrary period/field, duplicate reservation: all deny or no unauthorized state. Inspect pg_proc owner/proacl/proconfig | 002/004 |
| DB-02 | A creates/updates own message/material/note/quiz/course relation; B succeeds on B | A referencing B session/course/material/parent and mixed-owner batch/reassignment deny before writes. Verify child-parent RLS WITH CHECK, FK/unique behavior, lists/counts/pages | 006 |
| DB-03 | B active server request works; admin suspends/restores A | Suspended/soft-deleted A direct request and protected profile UPDATE deny; stale and freshly obtained identity cannot bypass. Unonboarded active A remains usable where intended | 007 |
| DB-04 | A reply to A ticket as A; admin replies as admin | A to B ticket and A reply with admin/B sender deny; no fabricated staff display/identity. Read own allowed; cross-ticket list/count/attachments deny | 010 |
| DB-05 | Narrow permitted own low-trust page event persists; trusted server usage event persists | Forged victim identity/privileged event/AI cost/attribution insert via anon/A denied according to actual grants; test permissive combinations and realtime. Untrusted events cannot become authoritative quotas | 011 |
| DB-06 | Active surviving A document returns A context; B retrieves B only | Delete fixture under search/storage partial failure; signed-view denied, deleted text never in prompt/quiz/citation, cleanup job retries. [] authorization must stay empty; list/search/count/page/realtime exclude tombstone | 012 |
| DB-07 | Approved admin mutation succeeds with correct immutable actor/action/request log | Logging failure is visible or sensitive transaction denies; fabricated actor/update/delete denied; export audit recorded without exported private data | 015 |
| ADMIN-INT | Disposable canonical admin accesses each staff method/dataset, then is demoted | Anon/A/B all denied; demoted admin, role error and stale metadata/email denied before privileged query. MFA/step-up and owner recovery tested | 003 |
| COST-INT | Reservation below plan budget succeeds with one counted mock call | Exhausted quota and provider/backend failure do not call models; two concurrent requests for last unit allow at most one; idempotent retries no double charges. Distributed demo limit across two instances | 004 |
| FILE-INT | Tiny valid PDF/DOCX/PPTX/TXT/images work with mocked OCR/embedding; own upload/view/delete succeed | Disallowed signatures, mismatched metadata, small overconfigured limits, extra ZIP entries, page/text/chunk counts, duplicate process and foreign IDs deny before expensive work | 005/006 |
| AUTH-INT | Disposable password/verified-email/Google PKCE/recovery/refresh/logout flows succeed | Forged/expired cookies, PKCE mismatch/code replay/login-CSRF/external callback returns and reset-token reuse deny. Record redirects, cookie Secure/SameSite flags, provider allowlists, MFA and revocation | 008/009 |
| CSRF-INT | Same-origin approved mutation succeeds | Cross-origin and same-site untrusted subdomain mutations, CORS/preflight/body content-type variants deny according to documented browser/API design. Do not claim every missing Origin check is exploitable | gap |
| XSS-INT | Normal Markdown/math/filenames/admin replies render and HTTPS links work | Inert HTML/event/protocol/SVG/citation/AI markers cannot execute or navigate to unsafe protocols; capture actual full component/browser/plugin behavior | gap |
| QUIZ-INT | Issued question/version plus submitted answers grades correctly for owner | Forged score/answer key/isCorrect/parent/duplicate submission denied; client practice imports explicitly labelled self-reported and excluded from trusted metrics | 013 |
| AUTH-02 | Existing/missing synthetic emails and normal signup/recovery work | Public response/timing does not reveal account membership; bounded distributed abuse guard | 014 |
| CSV-INT | Synthetic normal export opens correctly in intended spreadsheet consumer | =+-@ and leading whitespace/tab/CR/LF cell cases remain literal, quoted boundaries cannot introduce new cells/formulas; export authorization/log/caching checks pass | follow-up |
| CACHE-INT | A own results, logout, B own results and safe refresh succeed | A data absent from B query cache/SSR/stream/CDN responses; private cache headers verified on deployed build | gap |
| DEP-01 | Current patched build deployed; approved package/source/runtime inventory available | No applicable unremediated framework/parser/native advisory; Windows/non-Windows conditions and image service patching documented. No malicious exploit required | 016 |
| OPS-01 | Owner runs synthetic containment/cleanup/recovery drill | Stop public demo/expensive feature, revoke disposable credential, alert on failed deletion/export abuse, restore a tiny backup and verify authorized rows/files/index consistency | gap |

Begin configuration collection with configuration-evidence.sql (read-only metadata queries). Export sanitized results privately; do not include credential strings, reset links, private rows or routine definitions containing secrets. In a disposable database, use the current intended migration state and ordinary-role sessions. A returned error must be evaluated together with successful positive controls; “both valid and invalid failed” is inconclusive.

## Cleanup and evidence rules

Keep a fixture manifest of IDs and fake markers. Delete only created objects/accounts/index entries after capturing redacted before/after evidence; clear only fixture jobs/quotas. Never run broad ownerless cleanup or drop shared indexes. Assertions inspect HTTP outcome, DB row state, storage/index state and model/billing call counts. Record deployed schema differences as evidence rather than silently changing test assumptions. No live provider tests or fixture cleanup occurred in this audit.

## Existing project checks

Typecheck exit 2 (missing React Query and implicit-any errors); npm run lint exit 1 (Next 16 next lint removed); npm ls reports two missing packages; npm audit returned an error object without metadata. No build/provider-backed UI run. These outcomes are limitations and stabilization work, not substitutes for security results. See SECURITY_AUDIT.md.
