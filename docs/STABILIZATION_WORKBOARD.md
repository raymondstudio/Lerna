# Lerna stabilization workboard

Started 17 October 2026 (Africa/Lagos). Integration branch: `security/stabilization`.
Base: `35914eb39c4f1fdb79666c5829d28ca4f17841f4`; original checkout remains on clean `main`.
The approved implementation plan and lead-agent brief govern scope. No push, merge,
hosted migration, deployment, production credential rotation or history rewriting.

## Contracts and ownership

The lead owns all migrations, package/lock/config files, shared auth and session DTOs,
shared context and chat/Gemini integration. Specialists receive detached checkouts,
exclusive file ownership and explicit interfaces. Only the lead integrates and commits.
Security/data-loss changes require review by another role. Existing chat models,
prompts, composer, routing, material mentions and message state are protected.

| Gate | Status | Work / evidence |
| --- | --- | --- |
| M0.1 repository/base/branch | Complete | Verified clean base and exact local/remote branch absence; isolated checkout created |
| M0.2 dependencies/checks/local fixtures | In progress | Next/config 16.4.1 and React Query restored; isolated `npm ci` installed 833 packages from the current lockfile. Lint, typecheck, Node/Vitest and production build pass. Supabase CLI 2.121.0 was recovered separately; its npm package does not contain the Windows binary in the clean install. Docker/Podman is unavailable and the official per-user Docker installer was rejected by automatic policy review before execution. Real Auth/Storage/mailbox and full clean-checkout gates remain blocked/open. |
| M0.3 protected behavior/contracts | In progress | Baseline secure boundary assertions: 5 pass / 11 fail; prompt/model IDs unchanged; new local-only browser scenarios for fresh auth, recovery, A/B isolation and protected chat are written but require real containers. |
| M1 security | Implemented, review/checks in progress | Canonical/active authorization, MFA, parent policies, server-only bounded uploads, retrieval revalidation, practice transaction and operation reservations; later route sweep moved all API `auth.getUser()` calls onto the active boundary and blocked chat provider calls after material authorization failure. Independent review corrections ongoing. |
| M2 sessions/notes | Implemented, review/checks in progress | Transaction/revisions/receipts, 24h recovery, serial autosave and explicit conflicts; reviewer found identity/history and delayed-completion issues, corrected in source. A mobile refresh/concurrent-tab/completion/fresh-login browser scenario is authored but real execution is blocked. |
| M3 auth/recovery | Implemented, review/checks in progress | PKCE/cookie/return fixes; nonce + browser + verified-session-bound one-use recovery proof; source independently reviewed. A Mailpit recovery browser test is written; real execution remains blocked. |
| M4 activity | Implemented, review/checks in progress | Versioned durable contract, scoped reported ingestion, filtering/polling/exports/adapters; retention, maintenance and BI outcome integration being completed |
| M5 app usability | Source integrated, review/checks in progress | Study Sessions save/conflict/reopen states and Account data/error handling; protected-chat send/reopen/material-scope mobile scenario is authored, while independent shared-component review and real browser execution remain open. |
| M6 landing | Source integrated, review/checks in progress | Branded dimensional product story, synthetic illustration, honest copy and actual entrypoints; static and integrated local hydrated checks passed at five widths, including light/keyboard/reduced-motion/slow CTA. Real auth entry and production performance comparison remain open |
| M7 independent re-audit | Pending | Reviewer must not author the reviewed change; track fixes separately |
| M8 release handoff | Pending | Clean reproduction, commits/evidence, migration/config/rollback instructions |

## Protected behavior and test truth

Preserve current session/message IDs, chat API envelope, model IDs and prompt strings,
composer/mentions, material selection, personalization, history/reopening, cancellation
where implemented, mobile viewport/scroll and light/dark behavior. Record a concrete
need and targeted checks before each surgical chat-adjacent change.
Unit mocks establish only application behavior. Real local Auth/Postgres/Storage and
ordinary-role enforcement are separate gates. No current test may reach remote URLs,
charge an AI account, send real mail or read/write real user fixtures.

## Commit manifest

Each completed mini-milestone receives a nonempty reviewed commit. Its SHA is recorded
in the next workboard update/handoff. Failing and blocked gates are never marked complete.

- `e9e13fd`: M0.1 isolated branch/workboard established (documentation only).
- `16c94e6`: M0.2a tooling/font source checkpoint, independently reviewed by security specialist
  on 19 October. Includes strict runners,
  restored dependencies and locally bundled existing fonts. Clean-install, full lint,
  typecheck, build and real provider gates remain open; this is not M0 acceptance.
- `644a80b`: M6a landing source and metadata, authored in the isolated design worktree
  and reviewed by the lead against the brief, public assets, static five-width fixture,
  keyboard/reduced-motion source, strict lint/typecheck and integrated production
  build. Hydrated browser, auth-entry and performance gates remain open; M6 is not accepted.
- `c1300ed`: integrated source candidate after specialist source integration,
  targeted independent reviews and their corrections; 82 Node/117 Vitest
  tests, lint, typecheck and production build pass. This preserves the work in
  a local commit; it does not accept M1–M7 or close provider/browser/re-audit gates.

## Integration progress — 20 October 2026

The actual ordered SQL migrations pass 30/30 PGlite controls against synthetic
Auth/Storage schemas and ordinary A/B roles. The integrated run passes 82/82 Node
tests and 117/117 Vitest assertions at the last full run; TypeScript typecheck,
source lint (zero errors, 37 warnings) and the Next 16.4.1 production build also pass. These checks do not
establish the real Supabase/Storage/mailbox or browser gates.
Supabase CLI 2.121.0 now runs locally and generated the budget migration file.
`supabase status` confirms Docker/Podman is unavailable, so real local Auth,
Storage, mailbox and search evidence remains blocked. The official Docker
installer request was rejected by automatic policy review before execution.
No production or hosted target has been used.
An isolated `npm ci` from the current dependency files installed 833 packages;
Next type generation now precedes typecheck for a fresh checkout. The Supabase
npm package still lacks its Windows binary, so the separately verified CLI is
needed until that packaging issue is resolved. Current `npm audit` reports 10
advisory entries (7 high through dev-only `braces`, 3 moderate through Mammoth's
CLI-only `argparse`/`sprintf-js` chain); the two root advisories list no patched
release. Production dependency audit reports only the 3 moderate entries.
A local development browser check passed at all five specified
widths with mocked providers, actual light theme, keyboard skip link, finite
motion and a throttled CTA. Full browser authentication remains blocked by
local Auth availability. The original static-only landing evidence has been
supplemented by this integrated development evidence, not replaced.
Historical discount vouchers had no plan entitlement definition: their former
redemption path incremented a voucher and then granted Pro in a separate write.
Account redemption is held at 503 with an honest UI notice, while voucher
inventory is admin-only in the additive policy migration. A payment/entitlement
contract and its owner decision are required before redemption can reopen.
An independent security/persistence review found split quiz accounting,
invalid chat references leaving new sessions, denied demo requests spending
daily quota, long-running exports lacking a final authorization check, and
ticket content copied into legacy audit details. Source corrections and
targeted positive/negative tests passed, and re-review found no remaining
blocking issue in those specific corrections;
the source is preserved in `c1300ed`, with M1/M2 acceptance still open.
Administrative usage reset now uses a transaction with the audit record and
is labelled as a legacy daily-counter reset. It does not replenish durable
AI, upload, or quiz limits; the budget snapshot is checked before/after.
Quiz generation charges the AI-request budget and completed practice results
charge quiz quota, so a generated quiz can use the final save slot. The
separate persistence re-audit found a recovery callback that forwarded
exchanged Auth cookies after browser-binding proof failure; source and a
negative callback test now suppress those positive cookies. Independent
re-review found these corrections sound. Failure responses in the recovery
completion route also forward only cookie removals. Deletion tests remove
account IDs from dedup keys/legacy metadata while preserving unrelated staff
identity; pre-read activity audit events truthfully use `attempted`.
Real local mailbox/Auth execution and overall milestone acceptance remain open.
The final local logs are in `.stabilization-local/evidence/final-*-20261020.log`.
Vitest is limited to two isolated workers after an unrestricted concurrent
run failed to spawn a Windows worker; the bounded full rerun passed.

## Integration progress — 19 October 2026

Persistence identity-switch guards, serial-save follow-ups and the isolated landing
source have been integrated from hash-verified specialist manifests. Strict lint is
being repaired without rule waivers. Independent SQL tests caught and prompted fixes
for a policy syntax error, NULL validation, cleanup revision races and practice result
deletion resetting its budget. Processing retry artifacts and maintenance are under
independent review. No hosted changes, paid test calls or branch publication occurred.

## Interim verification — 18 October 2026

The integrated runner passed 55 Node tests and 78 Vitest assertions before subsequent
review fixes. Node checks include the actual ordered SQL migrations in PGlite with
synthetic Auth/Storage schemas and ordinary database roles. They are PostgreSQL/WASM
controls, not a live Supabase Auth, Storage, mailbox, concurrent multi-connection or
browser integration result. Re-run all affected gates after corrections.

Independent review identified and prompted corrections for recovery ambient-session
acceptance, alternate role/last-owner paths, nullable event constraints, direct Storage
quota bypass, untrusted processing completion, paid-output loss on telemetry failure,
quota double counting and async identity changes. No reviewer approves their own
material authorization or persistence implementation.

Landing source/fixture checks are prepared in the design worktree; full hydrated app,
authenticated layouts, slow-network and protected-chat browser checks remain open.
No tests have called a paid AI provider or changed hosted data.

## Open external evidence

Historical configured privileged credential exposure remains open pending owner-controlled
containment evidence. Deployed commit/OS, actual grants/policies/provider settings,
Google test identity, hosted SMTP, spend caps, retention scheduling and restore evidence
remain separate from local code readiness.
