# Stabilization handoff (draft, 20 October 2026)

This is a working handoff for `security/stabilization`, based on clean main
`35914eb39c4f1fdb79666c5829d28ca4f17841f4`. It is not a production
authorization or completion claim. The branch has not been pushed, merged or
deployed, and no hosted migration, credential rotation or history rewrite has
occurred. The original main checkout remains untouched.

## Commit and evidence manifest

| Commit | Review and scope | Current gate |
| --- | --- | --- |
| `e9e13fd` | M0.1 isolated workboard | Complete documentation checkpoint |
| `16c94e6` | M0.2a dependencies/check configuration and bundled fonts; security specialist reviewed source | Source checkpoint only; clean install and real provider gate open |
| `644a80b` | M6a landing/source metadata authored in isolated design worktree, reviewed by lead; five-width static fixture | Hydrated local browser passed in the integrated follow-up; auth entry and performance comparison remain open |
| `c1300ed` | Integrated source candidate; targeted independent reviews and corrections; 82 Node/117 Vitest, lint, typecheck and production build pass | Overall milestone acceptance, full integrated re-audit and real provider/browser gates remain open |

The [workboard](STABILIZATION_WORKBOARD.md) is the authoritative list as more
reviewed commits land. Integrated security, persistence, authentication,
observability and shared-component source is preserved in `c1300ed` after
targeted independent review. Full integrated re-audit and milestone acceptance
remain open; do not deploy this candidate. The baseline audit's
5 passing/11 failing secure expectations remain historical evidence. The
old dependency-mocked runner is incompatible with several revised module
boundaries (3 pass/13 harness errors on current replay), so it cannot certify
the new branch. Current application checks passed 82 Node and 117 Vitest tests;
the ordered SQL chain passed 30 synthetic controls, including deletion
pseudonymization, administrative transaction rollback and the final quiz save
slot. This is not live Supabase or browser evidence.
Final test/lint/typecheck/build logs are retained under the ignored
`.stabilization-local/evidence/final-*-20261020.log` paths. An unrestricted
concurrent Vitest run hit Windows `spawn EPERM`; two isolated workers passed
the full rerun. Lint has zero errors and 37 warnings.

## Local reproduction prerequisites

Use an isolated checkout with Node 24, npm 11, enough free disk space, Docker
Desktop/WSL2 or a compatible local container runtime, and the Supabase CLI
2.121.0. The CLI platform binary was recovered and verified on this machine;
its Windows binary was absent from both the initial install and an isolated
`npm ci` that installed 833 packages from the current dependency files. Confirm
`supabase --version` on a clean checkout before attempting local services.
`supabase status` currently reports Docker/Podman unavailable. The official
per-user Docker installer was rejected by automatic policy review before
execution, so no real local Auth, Storage or mailbox journey has run.

Copy the tracked `.env.example` to an ignored local env file and fill only keys
from the **local** Supabase CLI. All test origins must be loopback. Use a
separate local search instance at the configured loopback origin; do not point
fixtures to a hosted Elastic or Supabase project. Keep `GEMINI_API_KEY` blank
for provider-mocked local tests, set `LERNA_TEST_MODE=local`, and run the app
with `npm run dev` on port 3100. Browser preflight rejects a production-mode
or live-provider app before a prompt can be sent. Never copy production
credentials, real learner data or browser auth state into fixtures.

From a clean checkout after all commits and prerequisites:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
supabase start
supabase db reset --local
npm run test:provision
# Start npm run dev with the local-only env in another terminal, then:
npm run test:e2e
```

`supabase db reset --local` is an intentionally local, destructive reset of
disposable fixture data. It must not be run against a linked or hosted project.
The CLI config uses local Auth, Postgres, Storage and mailbox ports; the seed
sets the private activity runtime to `local`. A real local end-to-end run must
capture the CLI version, applied migration list, local database identity,
fresh fixture IDs (without passwords), provider-mock readiness and test result.
Fresh A/B isolation, mailbox recovery and protected-chat browser scenarios are
now authored but have not run against real containers. The harness still needs
fuller admin, notes, retention and event-restart scenarios before M0–M8 acceptance.

## Additive schema and rollout order

The new `20261017*` and `20261019*`/`20261020*` stabilization files under
`supabase/migrations` are ordered by filename after the historical schema.
They add activity v1, canonical authorization and MFA guards, note revisions
and receipts, atomic operation limits, one-use recovery proof, material and
practice boundaries, cleanup, verified metric outcomes, budget snapshots,
processing retry artifacts, operation reconciliation, corrected legacy BI
wrappers and coupon read containment. No table/column is dropped. Reproduce
the **entire ordered chain** against real local Supabase before preparing a
hosted rollout. The synthetic SQL suite does not cover provider-specific
Storage/Auth service behavior, multiple connections or deployed grants.

Before any later authorized hosted rollout, record a restorable backup/PITR
point, applied-migration inventory, existing owner role, active sessions,
protected-field consumers, Storage policies, deployment revision, provider
configuration, separate `ACTIVITY_ENVIRONMENT` and private database runtime
environment. Apply migrations in a controlled maintenance window and verify
ordinary A/B/admin policies, MFA step-up, existing notes/IDs and rollback
behavior with disposable accounts. Configure a monitored schedule for bounded
retention, recovery receipt cleanup, stale operation reconciliation and
material cleanup. No hosted scheduler has been configured by this work.

## Containment, rollback and recovery

The historical configured privileged credential exposure remains an owner
incident. The owner must preserve evidence, revoke/rotate that credential and
related server configuration through the provider, inspect relevant access
records, then record containment. Rewriting Git history alone does not revoke
a key. No key value or validity test belongs in this handoff.

If an authorization regression appears before rollout, stop deployment and
provider calls, retain logs and the applied-migration inventory, and restore
the last known good application revision while keeping new additive columns.
Do not blindly reverse restrictive policies: first establish whether the old
revision depends on the former grants and whether reverting would reopen a
cross-account path. If data has been changed or lost, use the verified backup
and reconcile by account/operation receipts before reopening writes. The note
receipt identity permits safe retry; a 409 conflict requires deliberate user
reconciliation, never automatic overwrite. Unknown provider operations stay
charged until an operator compares provider and internal records; do not
silently release or replay a possibly paid call. Material cleanup failures
remain queued with revision-scoped retry status and must be investigated.

Historical percentage/fixed discount coupons do not define plan entitlement.
The old path incremented a voucher then granted Pro in a separate write.
Redemption now returns 503 without mutation, the account UI explains the
pause, and ordinary accounts cannot enumerate coupon inventory. Restoring
redemption requires an owner-approved checkout/entitlement contract,
transactional cap/idempotency/audit design, and independent security review.
The administrative “Reset Legacy Counters” action clears the current UTC
day's legacy usage cache in one MFA-guarded transaction with its audit record.
It does not replenish durable AI, upload or quiz allowances; those are charged
from operation reservations, practice receipts and live material rows. A
separate policy would be needed for authoritative quota adjustments.
Quiz generation spends an AI-request reservation; the completed practice
result spends quiz quota. A one-slot synthetic SQL control covers generation
followed by a durable save. A denied recovery browser proof now returns no
newly exchanged Auth session cookie; a mocked callback regression covers this,
while real local mailbox/Auth replay remains an open gate. Completion errors
also suppress refreshed Auth cookies. Deleted-account activity loses raw
account identifiers in deduplication/legacy metadata while retaining unrelated
staff accountability. Administrative pre-read audit records use `attempted`.

## Open release gates

Independent review of root-owned migrations, provider reservations, shared
auth/session/chat context and account/security changes remains outstanding.
Run the integrated diff re-audit, fix findings in separate commits, and rerun
affected gates. Browser verification must include fresh A/B/admin login,
local mailbox password recovery, notes create/refresh/reopen/concurrent tabs,
material ownership, live event to feed/export after restart, protected chat
send/reopen/selection/personalization/mobile, five viewport widths, keyboard,
reduced motion and slow network. Use zero paid test calls. The landing's static
fixture is not hydrated application proof, and no comparable baseline
production bundle was built.

The 20 October npm audit reports 10 advisory entries (0 critical, 7 high,
3 moderate). Seven high entries share the unpatched
[`braces` root](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in dev-only
ESLint/Tailwind tooling. Three moderate entries share the unpatched
[`sprintf-js` root](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) through Mammoth's command-line `argparse`; Mammoth's
server-side conversion library does not import that CLI. The production audit
contains those 3 moderate entries. Preserve these as open dependency risks,
re-evaluate advisories, reachable paths and compatible updates before release.
Production
readiness additionally requires separate credential containment, hosted
schema/configuration and provider evidence, authorized rollout, monitored
retention, and a demonstrated restore procedure. Until then the branch may
only be considered a local review candidate after all source commits/reviews.
