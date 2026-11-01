# Lerna AI — Architectural Invariants, Threat Assumptions & Review Decisions

This document records the durable security and persistence invariants established on `security/stabilization`, key threat assumptions, and append-only status transitions for audit findings.

## 1. Core Architectural Invariants

1. **Canonical Active-Account & Role Boundary (`M1`)**
   - Every authenticated API route and page guard must validate the user through Supabase Auth (`auth.getUser()`) AND verify `public.is_active_user(user.id)` (`not is_suspended and not is_deleted`).
   - Administrative authorization uses `public.is_admin(user.id)` (`is_active_user` + `public.user_roles.role in ('admin', 'owner')`). Legacy `ADMIN_EMAILS`, JWT `user_metadata` / `app_metadata`, and `public.admin_users` are never trusted for privilege elevation.
   - Sensitive administrative mutations (role changes, suspension/deletion, plan assignment/extension, legacy counter resets, coupon mutations, feature-flag updates, institution verification/deletion, and administrative exports) require verified `aal2` MFA both in API guards (`requireAdminApi({ requireMfa: true })`) and in SQL (`private.require_sensitive_admin()`).
   - The final active `owner` in `public.user_roles` is protected by transaction-scoped advisory lock `917210` and cannot be demoted, suspended, or soft-deleted.

2. **Parent Ownership Before Side Effects (`M1` / `M2`)**
   - Every child resource (`study_messages`, `notes`, `uploaded_materials`, `quizzes`, `support_ticket_replies`, `storage.objects` in `uploaded-materials`) must belong to an active, owned parent (`study_sessions`, `courses`, `support_tickets`).
   - API handlers verify parent ownership before any storage upload, provider reservation, or child write. Restrictive RLS policies (`stabilization_*_parent`) and `BEFORE INSERT OR UPDATE` trigger `private.validate_learning_parents()` enforce ownership in PostgreSQL.

3. **Authoritative Operation Reservations & Provider Cost Containment (`M1` / `M4`)**
   - Paid or resource-intensive operations (`aiRequests`, `uploads`, `quizzes`, `flashcards`, `ocrPages`, `voiceSeconds`) reserve capacity in `private.operation_reservations` via `public.reserve_operation` (or `public.reserve_demo_operation` for anonymous demo requests) **before** invoking Gemini or writing storage objects.
   - Reservations serialize per user via `pg_advisory_xact_lock`, fail closed (`503` / `429`) when budget state is unavailable or exhausted, and reject duplicate `operation_id` replay (`409`) so lost acknowledgements never trigger duplicate paid calls.
   - Crashed or timed-out pending holds are transitioned to `unknown` by `public.reconcile_stale_operations` and remain counted against quota until operator reconciliation.
   - Quiz question generation charges `aiRequests` (or `flashcards`), while saving a completed practice result charges `quizzes` in `public.save_practice_quiz` (`private.practice_receipts`), allowing a user's final quiz slot to both generate and save.


4. **Transactional Revisioned Notes & 24h Scoped Recovery (`M2`)**
   - `public.study_sessions.notes` is the canonical note store, paired with `notes_revision` (`bigint`), `notes_updated_at`, and compatibility projection `public.notes`.
   - `PATCH /api/study-sessions/[sessionId]` note writes require `notes`, `expectedNotesRevision`, and `operationId` (`428` on missing preconditions, `409` with `currentSession` on revision mismatch or reused `operationId` with different payload).
   - `public.save_session_notes` executes ownership lock, revision check, canonical update, `public.notes` projection upsert, `private.note_operations` receipt, and `note.saved` v1 event in a single transaction.
   - Browser `NoteSaveController` enforces a 750 ms debounce / 5 s max wait, single in-flight write, same `operationId` across retries, and 24-hour `localStorage` recovery drafts scoped to `userId:sessionId:tabId`.

5. **Browser- & Session-Bound One-Use Password Recovery Proof (`M3`)**
   - `POST /api/auth/recovery` creates a hashed intent (`private.recovery_intents`) bound to a `HttpOnly` browser cookie (`lerna-recovery-browser`), nonce, and normalized email HMAC, with generic non-disclosing responses.
   - `/auth/callback` exchanges the PKCE code and calls `grantRecoveryProof`, which atomically consumes the intent and issues a 15-minute `lerna-recovery-proof` cookie bound to `user_id` and JWT `session_id`. If proof authorization fails, newly exchanged Auth session cookies are stripped from the failure redirect.
   - `/auth/reset-password` and `POST /api/auth/recovery/complete` require the valid proof cookie, consume it once (`public.consume_recovery_proof`), emit `auth.recovery.completed`, update the untrimmed password, and sign out globally.

6. **Durable Activity Ledger v1 & Privacy-Preserving Audit (`M4`)**
   - `public.events` (`schema_version = 1`) is written only through `private.append_event` (called by SQL triggers/RPCs or `service_role` `public.append_activity_event`), which validates `private.activity_runtime` environment and per-event metadata allowlists.
   - Browser activity (`POST /api/analytics/activity`) accepts only `page.viewed` and `study_session.opened`, labels them `browser_reported` / `reported`, normalizes route templates (`/notes/[id]`), and enforces a 30/minute per-user DB budget.
   - Administrative activity reads log `admin.activity.read` with outcome `attempted` (deduplicated per 15-minute bucket) before querying; exports re-verify admin + `aal2` MFA after collection and commit `admin.activity.export` before releasing rows.
   - Hard deletion of `auth.users` triggers `private.pseudonymize_deleted_actor()` to clear actor/target identifiers in `public.events` and `public.audit_logs` while preserving staff accountability.

## 2. Threat Assumptions & Accepted Limitations

- **Paused Coupon Redemption (`503`)**: Historical percentage/fixed discount coupons in `public.coupon_codes` did not encode plan entitlements and previously granted Pro non-transactionally. `POST /api/account/billing` intentionally returns `503` until an owner-approved checkout contract is designed.
- **Self-Reported Practice Quizzes**: Client-submitted practice quizzes are validated for internal consistency and stored with `result_source = 'client_reported_practice'`. They are excluded from trusted accuracy grading in admin BI reports (`quizAccuracy: null`).
- **Legacy v0 Telemetry**: Pre-stabilization rows in `public.events` (`schema_version = 0`) and legacy tables (`page_views`, `analytics_events`, `feature_usage`) remain unverified historical data and are excluded from v1 activity queries.
- **External Owner Gates**: Git history service-role key containment (`LERNA-SEC-001`), hosted Supabase/Elastic/Vercel configuration, Google OAuth & SMTP verification, and local Docker container execution remain separate from source readiness.

## 3. Append-Only Status Transition Log

- **2026-10-12 (`9b37a7e`)**: Initial repository & security audit recorded `LERNA-SEC-001` through `LERNA-SEC-016` on `main`.
- **2026-10-17 (`e9e13fd`)**: Isolated `security/stabilization` branch created from clean base `35914eb39c4f1fdb79666c5829d28ca4f17841f4`.
- **2026-10-19 (`16c94e6`, `644a80b`)**: Restored strict ESLint/TypeScript/Next 16.4.1 tooling, local fonts, and reviewed dimensional landing page.
- **2026-10-20 (`c1300ed`, `fb0f192`, `e4bb054`)**: Integrated M1–M6 source candidate and targeted independent review fixes (`LERNA-STAB-REV-001` through `LERNA-STAB-REV-009`).
- **2026-10-29 (`1aa101d`)**: Installed portable project skills and isolated offline Graphify (`0.9.97`) + Playwright CLI (`0.1.22`) runtimes.
- **2026-10-29 (Current Session)**: Completed full diff + untouched-boundary audit; identified and repaired `LERNA-STAB-AUD-001` through `LERNA-STAB-AUD-007` (`supabase/migrations/20261029120000_stabilization_audit_repairs.sql`, admin/learner route hardening, privacy canonical fix, and `docs/security/security-boundary-tests.mjs` + `docs/security/parser-render-tests.mjs` VM harness repair); established `docs/audit/*` and `scripts/audit_knowledge.py`.
