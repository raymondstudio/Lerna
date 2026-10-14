# Security scale gate

**Private — 12 October 2026, Africa/Lagos.** Audited branch main, commit 9b37a7e8de96b09340ef4ecb5d0ded52840f5476; deployed equivalence unknown. **Decision: blocked by confirmed risks.** High-impact missing verification independently prevents a confident rollout decision. No production/schema/dependency fixes were applied.

## Five priority blockers

1. **SEC-001:** a historical intended Supabase service-role credential matches current local configuration. Exposure is proven; provider validity/actual privilege/use are untested. Revoke/rotate appropriately, replace server configuration and investigate privately.
2. **SEC-002:** SECURITY DEFINER usage RPC lacks caller/ownership checks and permits signed arbitrary increments. Applied grants/policies are unverified; deny public/ordinary execution and replace with a narrowly authorized atomic writer.
3. **SEC-003:** database demotion/error can be overridden by email/prior admin metadata; raw exports then use service-role privileges. Canonical fail-closed authorization and revocation must pass.
4. **SEC-004:** expensive AI routes lack centralized budget reservation; demo limits are process-local; quota service fails open. Bounded distributed consumption and spending containment are required.
5. **SEC-005:** accepted uploads, parser expansion and replayed processing are insufficiently bounded. Enforce parent, content, memory/time/chunk and storage/AI budgets before side effects.

**Additional urgent verification:** SEC-016 has a conditional Critical Windows-hosted framework advisory match. Installed Next 16.2.6 is behind checked later fixes; do not expose this Windows runtime. Prove patched deployed version/runtime/image conditions. No production RCE was verified.

## Confirmed blockers requiring remediation and retesting

| Gate | Objective acceptance | Current state | Evidence required to close |
| --- | --- | --- | --- |
| Credential containment | Exposed intended privileged key revoked or conclusively invalid/unprivileged; correct server replacement; private history/access review | Fail — SEC-001 unresolved | Supported provider key-type/revocation evidence, server deployment record and redacted rescan/log review |
| Canonical privileged access | Anon/A/B deny every staff capability; admin succeeds; demotion/error/stale metadata deny before service query | Fail — SEC-003 mocked acceptance after demotion | Full method/dataset positive/negative integration plus deployed role/guard/config verification |
| RPC / protected field isolation | Ordinary roles cannot modify B usage/protected profile flags/sender IDs/privileged telemetry | Fail by migration evidence — SEC-002/007/010/011 | Applied pg_policies/grants/proacl and ordinary-role DB-01/03/04/05 results |
| Parent/child ownership | Every child write/reassignment/batch validates owned session/course/material before state change | Fail — SEC-006 foreign-note write attempted | DB-02 and endpoint tests, constraints/backfill reconciliation, deployed schema diff |
| Paid work containment | Atomic distributed budget caps every text/embedding/OCR/quiz/summary/process call; denial causes zero paid work; bounded retries/concurrency | Fail — SEC-004 | COST-INT across two instances, reservations/ledger and real provider spending limits/alert ownership |
| Safe private upload handling | Valid owned tiny documents work; malformed/disallowed/budget/foreign/replayed input rejected without side effects | Fail — SEC-005 | FILE-INT, worker/resource/bucket configuration and parser advisory reachability validation |
| Private retrieval/deletion | Only active authorized originals supply context; deleted text excluded immediately; durable idempotent cleanup retries | Fail — SEC-012 | Fault-injected DB-06, surviving A/B controls, index/bucket reconciliation and alert evidence |
| OAuth diagnostics/returns | Local valid PKCE/recovery works; external returns deny; fake auth markers absent from all logs | Fail — SEC-008/009 | Secure OAUTH assertions plus AUTH-INT/browser/provider settings and private log inventory |
| Security event trust | Critical staff operations have durable trusted actor logs; forged telemetry cannot influence authoritative usage/security | Fail by code/migrations — SEC-011/015 | DB-05/07, immutable writer/retention grants and fault-injected log handling |

These gates intentionally include Medium findings when they affect core private data/authentication/incident containment. The audit's mock characterization pass does not close a gate. secure-expectation mode currently reports 5 pass / 11 fail.

## High-impact missing verification

| Missing evidence | Why it blocks confidence | Exact input/access needed |
| --- | --- | --- |
| Deployed commit/runtime and reachable advisories | Local source may differ; conditional framework RCE could dominate all app guards | Redacted deployment/build/package inventory, host OS/Cache Components/image optimizer details; supported patched version satisfying current advisories |
| Applied DB/RLS/grants and direct user access | Source intent cannot establish policy deployment, combined grants, or provider Data API reachability | Read-only schema/policy/grant/function metadata; applied migrations; exposed schemas; isolated ordinary-role fixtures |
| Auth/OAuth/cookies/MFA/revocation | Session and callback controls cross provider/browser boundaries | Supabase Site URL/allowlist and Google settings, recovery/signup enforcement, cookie flags, JWT/session lifetime/revocation/MFA evidence; disposable isolated Auth runtime |
| Private storage/search policies | Originals and extracted text have distinct authorization/lifecycle boundaries | Bucket visibility/limits/object policies, real signed-link behavior, Elastic mappings/index/API-key roles, egress settings; independent disposable bucket/index |
| Abuse budgets/observability | Server quotas alone may fail under races, outages or changing provider rates | Provider account spend caps/alerts, trustworthy proxy IP rule, distributed store/atomicity and two-instance fixture test |
| Credential exposure investigation | Historical key may still grant broad backend authority | Sanitized key type/revocation history, repository/fork visibility and provider logs reviewed by owner; no credential values in reports |
| Containment and recovery | Incident response and backup restoration must work under faults | Named owner/contact, kill-switch procedure, restore of a small synthetic backup and DB/storage/index integrity verification |
| Build/browser integration | Missing dependencies/typecheck/lint failures prevent reliable reproduced app checks | Clean locked install in isolated checkout, compatible lint setup, passing intended project checks and full browser journey |

Current credentials point remotely; no isolated DB runtime is available. Supply the information through approved private read-only exports or an isolated fixture environment. Do not paste production secrets/private rows. Missing provider authorization never justifies attack probing a live service.

## Lower-risk tracked follow-up

SEC-013 quiz results must become trusted server-graded or clearly self-reported before they support public results/rankings/progress claims. SEC-014 enumeration, CSV whitespace edge cases, published/audience broadcast filtering, role-directory visibility, cache clearing on account switch, server-only import boundaries and dependency/tooling hygiene can have scoped owners and deadlines. These are not excuses to defer the confirmed High blockers. Any follow-up becoming a route to private-data disclosure or privilege changes must be reclassified and gated.

## Residual risks and responsibilities

- **Founders/provider owner:** maintain credential access/rotation records, review historical-key exposure, restrict preview/admin access, approve small controlled rollout and own containment contacts. Rotation must not restore exposed secrets as rollback.
- **Backend maintainer:** maintain canonical authorization/RLS/field/parent policies, atomic budgets, deletion retries, clean event provenance and drift checks. Monitor denied cross-owner requests, role errors, cleanup backlog and unexplained usage changes.
- **AI/retrieval maintainer:** keep model input/output untrusted, tenant filters outside the model, bounded context/tool permissions if tools are introduced; monitor injection/poisoning markers without logging private conversations. System prompts cannot eliminate prompt injection.
- **Operations owner:** monitor AI/embedding/OCR/storage spending, failed jobs, unusual exports and auth failures; maintain dependency advisories and tested patched rollback; run a small recovery drill. Record tolerable spending limits from actual usage rather than arbitrary UI counters.
- **Product maintainer:** separate practice/self-reported/trusted quiz metrics; get explicit publication opt-in for share cards; verify actual provider support/webhook/payment mechanisms before activation.

Parser bugs, stolen valid accounts, prompt injection, new dependencies and configuration drift remain after patches; maintain a vulnerability process and periodic targeted retesting. No numerical security score, certification or complete-security claim is made.

## Criteria for a future bounded rollout decision

All confirmed blockers above are fixed in a reviewable deployed commit and retested with positive/negative controls; no reachable Critical/High risk remains unresolved; high-impact deployment/provider evidence is recorded; remaining lower-risk items have owners and dates; provider spend/feature caps, alerts and a tested containment/recovery procedure are active. Start at a measured usage cap, review anomalies/spend and pause expansion on failures. This is a future requirement, **not the status of this audited commit**.

First work in dependency order: contain SEC-001 -> isolated/config inventory + applicable framework patches -> canonical admin/RPC/protected-field guards -> parent ownership -> atomic budgets -> bounded uploads -> OAuth/logging/support/event/deletion/result follow-up -> integrated/deployed retest. See SECURITY_REMEDIATION_PLAN.md and SECURITY_TEST_MATRIX.md.
