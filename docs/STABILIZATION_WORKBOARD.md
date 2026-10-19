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
| M0.2 dependencies/checks/local fixtures | In progress | Next/config 16.4.1 and React Query restored; npm install and dependency inventory passed after disk/network failures; strict lint remediation continues. Docker installer failed (Windows 0x80073cfc); CLI platform binary missing; real Auth/Storage/mailbox gates blocked |
| M0.3 protected behavior/contracts | In progress | Baseline secure boundary assertions: 5 pass / 11 fail; all provider calls mocked |
| M1 security | Implemented, review/checks in progress | Canonical/active authorization, MFA, parent policies, server-only bounded uploads, retrieval revalidation, practice transaction and operation reservations; independent review corrections ongoing |
| M2 sessions/notes | Implemented, review/checks in progress | Transaction/revisions/receipts, 24h recovery, serial autosave and explicit conflicts; reviewer found identity/history and delayed-completion issues being corrected |
| M3 auth/recovery | Implemented, review/checks in progress | PKCE/cookie/return fixes; nonce + browser + verified-session-bound one-use recovery proof; source independently reviewed, real mailbox journey still blocked |
| M4 activity | Implemented, review/checks in progress | Versioned durable contract, scoped reported ingestion, filtering/polling/exports/adapters; retention, maintenance and BI outcome integration being completed |
| M5 app usability | Pending | Study Sessions first; protected-chat/shared-component review |
| M6 landing | Pending | Scoped dimensional product story, actual branding/entrypoints, honest copy |
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
- M0.2a tooling/font source checkpoint: independently reviewed by security specialist
  on 19 October; commit SHA recorded in the next update. Includes strict runners,
  restored dependencies and locally bundled existing fonts. Clean-install, full lint,
  typecheck, build and real provider gates remain open; this is not M0 acceptance.

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
