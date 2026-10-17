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
| M0.2 dependencies/checks/local fixtures | In progress | Next 16.2.6 baseline; React Query absent; Docker/Supabase CLI absent; real Auth/DB/mailbox tests not yet available |
| M0.3 protected behavior/contracts | In progress | Baseline secure boundary assertions: 5 pass / 11 fail; all provider calls mocked |
| M1 security | Pending | Canonical roles/active identity, ownership, RLS, budgets, upload/retrieval/deletion |
| M2 sessions/notes | Pending | Revision/idempotency transaction; truthful ordered autosave and recovery |
| M3 auth/recovery | Pending | PKCE/cookies/safe returns; dedicated recovery; local full-flow evidence |
| M4 activity | Pending | Versioned durable events, scoped ingestion, admin filters/polling/export/retention |
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

## Open external evidence

Historical configured privileged credential exposure remains open pending owner-controlled
containment evidence. Deployed commit/OS, actual grants/policies/provider settings,
Google test identity, hosted SMTP, spend caps, retention scheduling and restore evidence
remain separate from local code readiness.
