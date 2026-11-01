# Stabilization review log — 20 October 2026

Independent reviewers made no edits to the changes they reviewed. The lead
implemented corrections and reran affected controls. This log records source
review coverage; it does not accept M1–M4 or establish real provider behavior.

| Finding | Correction and evidence | Review status |
| --- | --- | --- |
| Split quiz quota and double charge on generation/completion | Provider quiz generation charges AI requests; practice receipts charge quizzes. Direct quiz holds and receipts share accounting. One remaining quiz slot can generate and save. | Re-reviewed; targeted SQL and mapping test pass |
| Chat references created orphan sessions; malformed IDs became absent | Explicit IDs require UUID syntax; foreign/missing sessions and foreign/deleted references return before writes/provider calls. | Re-reviewed; negative route controls pass |
| Long exports could release data after demotion | Recheck identity, canonical role and MFA immediately before audit/data release; deterministic timestamp/ID ordering. | Re-reviewed; demotion test passes; live paging/concurrency gate open |
| Denied demo attempts spent the daily allowance | Check serialized accepted counters before incrementing. | Re-reviewed; minute/day denial controls pass; multi-connection gate open |
| Legacy ticket audit copied resolution content | Remove duplicate content-bearing write; database staff event stays transactional and content-free. | Re-reviewed; direct route test passes |
| Administrative usage reset implied quota replenishment | Transactional MFA-guarded legacy meter reset; explicit UI scope; durable AI/upload/quiz counters stay intact. Subscription extension is bounded and transactional. | Re-reviewed; rollback/MFA/snapshot controls pass |
| Failed recovery browser proof forwarded exchanged Auth cookies | Failure responses forward only cookie removals, including completion failures after refresh. | Re-reviewed; injected positive-cookie denial controls pass |
| Deleted actor remained identifiable through dedup keys/legacy metadata | Clear identifying data on deletion while preserving an unrelated staff actor. | Re-reviewed; synthetic deletion controls pass |
| Pre-read investigation audit claimed success before source query | Record an attempted read before accessing the source. | Re-reviewed; failed-source controls pass |
| Missing feedback/broadcast/coupon/institution privileges and policies (`LERNA-STAB-AUD-001`) | Added `feedback_select_own`, `feedback_admin_update`, and authenticated `INSERT`/`UPDATE`/`DELETE` grants on `broadcasts`, `coupon_codes`, and `institutions` in `20261029120000_stabilization_audit_repairs.sql`. | Repaired 29 Oct 2026; PGlite role/MFA controls pass; independent review pending |
| Legacy `SECURITY DEFINER` admin RPCs (`admin_toggle_suspension`, `admin_toggle_soft_delete`, `admin_delete_user`, `admin_assign_plan`) bypassed AAL2 MFA on no-op/missing targets and emitted v0 events (`LERNA-STAB-AUD-002`) | Enforced entry-level `private.require_sensitive_admin()`, target existence checks, plan/status validation, and v1-only event emission in `20261029120000_stabilization_audit_repairs.sql`. | Repaired 29 Oct 2026; PGlite AAL1/target/v0 controls pass; independent review pending |
| Unchecked client `audit_logs` inserts, broadcast title leakage, and `audit_logs` PII on profile edit/delete (`LERNA-STAB-AUD-003`, `LERNA-STAB-AUD-004`) | Removed failing client `audit_logs` writes in ticket/broadcast/coupon routes; removed name PII from `log_profile_update()`; extended `pseudonymize_deleted_actor()` to scrub `audit_logs.details`. | Repaired 29 Oct 2026; SQL and route controls pass; independent review pending |
| Missing v1 upload/recovery completion events, admin error string leakage, stale privacy canonical, and VM boundary harness drift (`LERNA-STAB-AUD-005`..`007`) | Wired `material.upload.started`/`completed`/`failed` and `auth.recovery.completed` in SQL; sanitized admin route 500/503 responses + `no-store` headers; fixed `/privacy-policy` canonical; repaired VM module loader (`16/16` `--secure` pass). | Repaired 29 Oct 2026; 86 Node / 118 Vitest / 16 VM boundary controls pass; independent review pending |

On 29 October 2026, the local suite passed 86 Node tests (including 34 ordered-migration
controls in PGlite synthetic provider schemas), 118 Vitest assertions, 16/16
offline VM security boundary checks (`docs/security/security-boundary-tests.mjs --secure`),
parser/render checks (`docs/security/parser-render-tests.mjs`), and Graphify
audit-knowledge validation/self-tests (`scripts/audit_knowledge.py`).

The source candidate is preserved in local commit `c1300ed`. Remaining
acceptance work includes full integrated/untouched-boundary review,
separate correction commits if required, clean source-checkout reproduction,
real local Supabase/Auth/Storage/mailbox/search and multi-connection tests,
the authored browser journeys, retention/restart/export reconciliation and
production landing performance comparison. No hosted operation or paid
provider test was performed.
