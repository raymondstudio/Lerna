# Lerna AI project context

Audit snapshot: 12 October 2026, Africa/Lagos. Read this document, LERNA_AUDIT.md and LERNA_NEXT_STAGE.md before continuing development. Application changes were not made in this audit.

## Product context supplied by the founders

Lerna AI (formerly EduAgent AI) is an existing AI tutor and study assistant for understanding materials, asking follow-up questions, and reopening saved learning sessions. Students are the primary audience; researchers, professionals, teachers and other learners also have onboarding roles. Preserve the current visual direction. Priorities are grounded tutoring, useful explanations and personalization, durable sessions/messages, mobile usability, trustworthy founder reporting and affordable operation.

Founders: Iorliam Raymond and Caleb Kalejaiye, Software Engineering students at Federal University of Technology Minna, Nigeria; both reportedly second-year students as of September 2026. Public product: https://www.uselerna.app. Reported repository: https://github.com/raymondstudio/Lerna/. Deployment equivalence is UNKNOWN; the public site was not contacted during this audit.

Historical founder reports dated 21 September 2026: 172 users; approximately 22 average monthly users (definition unverified); 76 uploaded documents, not distinct uploaders; 216 study sessions; 739 total chats (definition unverified); 1,437 AI requests (attempt/retry/success definition unverified); WhatsApp community over 120 members; no generated revenue; approximately NGN 50,000 invested; verbal HOD endorsement and possible adoption by approximately 400 departmental students, not confirmed adoption. These are not current database measurements.

## Verified checkout and tooling

- Workspace: `C:/Users/USER/Desktop/CODE PROJECTS/SMART TUTOR AI`.
- Git origin: `https://github.com/raymondstudio/Lerna`; branch `main`; commit `9b37a7e8de96b09340ef4ecb5d0ded52840f5476`, dated 2026-10-01, subject `feat: add admin analytics context and range handling`.
- Initial working tree: 1,356 tracked deletions under `brag-output/tools/py/` with inaccessible-directory warnings. No initial application changes reported. No audit operation touched those paths. Later status queries stopped listing inaccessible generated files; their missing-file status was inconsistent and recovery was not verified. Existing root audit documents were preserved. At handoff Git marks next-env.d.ts touched although normalized content matches HEAD and git diff is empty; the index was not rewritten.
- No applicable AGENTS.md was found in the workspace ancestors or application/source/database/script trees. `brag-output/composition/AGENTS.md` belongs to the separate video composition; it was outside application-audit scope. No AGENTS.md was created.
- Node 24.11.0, npm 11.6.1; npm lockfile version 3. Lockfile/installed: Next 16.2.6, React/React DOM 19.2.6, TypeScript 5.9.3, Tailwind 3.4.19, ESLint 9.39.4, eslint-config-next 15.3.2, Supabase JS 2.106.0, Supabase SSR 0.6.1, Google GenAI 2.8.0, legacy Google Generative AI 0.24.1, Elastic SDK 9.4.0.
- React Query and devtools are declared and locked at 5.104.0 but absent from this node_modules. This is a local installation failure; a clean locked installation was not performed in the audit.

## Actual architecture and data ownership

| Data / integration | Implemented responsibility |
| --- | --- |
| Supabase Auth | Password auth, Google OAuth, PKCE code exchange, cookie sessions, auth user IDs |
| Supabase `profiles` | Canonical learner identity, account role, goals, preferences, institution data, onboarding and moderation flags |
| Compatibility tables | `user_preferences` and `notification_preferences`; September profile trigger mirrors a subset of profile fields |
| Supabase `subscriptions`, `user_roles` | Entitlement/billing state and authorization roles; profile account_type is a learning persona, not an admin permission |
| Supabase `uploaded_materials` | File metadata, session/course links, status, summary, extraction/index metadata; full extracted text is not persisted here |
| Supabase Storage | Original files in private `uploaded-materials` bucket; original-file viewing uses ten-minute signed URLs |
| Elastic (raw server fetch; installed SDK unused) | Full searchable chunk text in `eduagent_document_chunks`; 768-dimension vectors plus duplicated chunk text in `eduagent_embeddings`; document metadata/summary in `eduagent_documents` |
| Supabase `study_sessions`, `study_messages` | Canonical conversations, titles, notes, duration/status, user/assistant messages and sources; not Elastic conversation memory |
| Supabase `courses`, `quizzes`, `quiz_questions`, `notes` | Course organization, completed quiz/flashcard records, answers, study notes |
| Supabase telemetry | `events`, `ai_requests`, `page_views`, `feature_usage`, `performance_metrics`, `user_attribution`, `audit_logs`, legacy `analytics_events` and derived `daily_stats`; actual write reliability is defective |
| Supabase support | `support_tickets`, `support_ticket_replies`, `feedback`; staff UI exists, customer reply delivery incomplete |
| Billing foundation | `subscription_usage`, `usage_events`, `subscription_history`, `billing_transactions`, `invoices`, coupons and webhook event tables; Paystack/Flutterwave adapters are mocks |
| Google Gemini | Active SDK `@google/genai`; `gemini-2.5-flash` text/query reformulation/OCR, `gemini-embedding-001` 768-dimension retrieval embeddings; no functioning model selector found |

App Router pages: `/`, `/welcome`, `/onboarding`, `/privacy-policy`, `/materials`, dashboard group `/chat`, `/courses`, `/courses/[id]`, `/study`, `/quiz`, `/account`, plus `/admin`. API handlers cover auth email checks, chat/references/demo, uploads/materials, sessions/summary, courses/quizzes, account state, support/feedback, analytics and admin management/export. There is no dedicated `/schedule`, `/progress`, `/voice` or payment checkout/webhook route in this checkout.

The root layout restores auth; client providers manage theme, auth, React Query and dashboard sessions. Next 16 `src/proxy.ts` protects matched learner pages, and dashboard layout calls `requireUser`. Admin layout and most admin APIs check admin rights. APIs use user-scoped Supabase clients; only selected operations such as raw exports and email existence use the service-role helper. Supabase RLS is therefore part of the authorization boundary, not redundant infrastructure.

The critical chat path is: auth -> welcome/onboarding -> session creation -> upload original file -> metadata insert -> extraction -> segment word chunking -> Gemini embeddings -> Elastic indexing -> query embedding/reformulation and user-filtered retrieval -> role/profile context and last eight client-supplied messages -> Gemini response -> SQL assistant message -> session update -> SQL reload. See audit findings for failures between these steps.

## Environment and safe setup

Required names available with nonempty local values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, compatibility `ELASTIC_SEARCH_API_KEY`, `ADMIN_EMAILS`. `.env2` contains the compatibility Elastic name. Values were neither displayed nor copied. Nonempty configuration does not prove credentials work, payment tier, provider availability, applied migrations or an active Elastic subscription.

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_DATA_API_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_GEMINI_API_KEY` were not present in the local dotenv inventory. Key lookup accepts publishable or legacy anon. Browser app URL falls back to window origin. The example is incomplete (omits publishable key and admin allowlist) and advertises an unnecessary public Gemini key. Actual Gemini requests read the server key. `.env` and `.env2` are ignored and not tracked at HEAD; `.env.example` is tracked. Whole Git history and external secret stores were not audited.

For future setup, restore the exact lockfile installation in a separate stabilization task using `npm ci`, then provision an isolated Supabase/storage/Elastic environment and explicitly identify Gemini simulation versus live operation. Do not run the mutating `bootstrap-admin` or `scripts/seed-institutions.js` against an unidentified project. No local Supabase configuration or complete staging setup is supplied.

Existing commands: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run bootstrap-admin`. Audit results:

- `npm ls --depth=0`: fails on two missing React Query dependencies.
- `npm run lint`: fails; Next 16 removed next lint.
- `node node_modules/eslint/bin/eslint.js src`: fails; ESLint 9 cannot find flat config.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: fails; missing React Query, cascading implicit-any errors, stale .next route validators.
- `npm run build`: fails; missing React Query and blocked Google Fonts downloads. No config was changed to force success.
- Dev server started on 127.0.0.1:3100 with provider URLs overridden to loopback and placeholder keys in process only. Health and selected anonymous API rejection checks worked. Root UI returned 500. Audit server stopped afterwards.

## What future sessions must verify

The deployed commit; applied SQL migrations/policies/grants; Supabase OAuth Site URL/allowlist and Google provider settings; real model/account availability; Elastic mappings and durability; actual authenticated sign-in -> upload -> grounded question -> saved reload; small-screen keyboard/scroll behavior; ticket delivery; telemetry/event definitions and counts; backups and restore procedure. No current traction or revenue counts were measured. Refer to LERNA_NEXT_STAGE.md for ordered acceptance criteria.
