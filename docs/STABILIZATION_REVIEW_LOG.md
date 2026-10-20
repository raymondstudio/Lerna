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

The final local run passed 82 Node tests and 117 Vitest assertions. The Node
count includes 30 ordered-migration controls in PGlite synthetic provider
schemas. Lint passed with 37 warnings; typecheck passed. Exact final build
and log paths are in the workboard/handoff.

The source candidate is preserved in local commit `c1300ed`. Remaining
acceptance work includes full integrated/untouched-boundary review,
separate correction commits if required, clean source-checkout reproduction,
real local Supabase/Auth/Storage/mailbox/search and multi-connection tests,
the authored browser journeys, retention/restart/export reconciliation and
production landing performance comparison. No hosted operation or paid
provider test was performed.
