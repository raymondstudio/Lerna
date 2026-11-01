# Lerna AI — Durable Audit Knowledge & Graphify Overlay

This directory contains the project-local, versioned security and stabilization audit knowledge layer for Lerna AI (`security/stabilization`). Its purpose is to preserve verified audit coverage, findings, architectural invariants, and freshness evidence across engineering sessions so future agents do not rediscover old findings or silently regress reviewed boundaries.

## Important Epistemic Limits

1. **Historical evidence, not a permanent security guarantee**: Records in `coverage.json`, `findings.json`, and `decisions.md` document what was inspected and tested at a specific Git revision and file-hash state. They do **not** prove that the application is "fully secure" or "audited forever."
2. **Structural graph != runtime proof**: Graphify (`graphifyy==0.9.97`, reviewed revision `0a8cd4e1e342235fe53e881fb5d591bf0460071f`) provides deterministic AST structural extraction (`contains`, `imports`, `imports_from`, `calls`) over bounded Python/JS/TS/TSX scopes. It cannot verify SQL semantics, Row-Level Security (RLS), `SECURITY DEFINER` privilege boundaries, runtime cookie handling, hosted Supabase/Elastic/Vercel configuration, or external dependency advisories.
3. **Provenance separation**: Structural nodes and edges extracted by Graphify retain their native confidence (`EXTRACTED` / `INFERRED`) and `_origin: "ast"`. Audit findings, coverage status, and review links are connected through a separate deterministic overlay (`origin: "local_audit_overlay"`) stored in ignored `.stabilization-local/audit/audit-overlay-graph.json`. Never relabel overlay relationships as Graphify-native AST facts or semantic LLM extraction.
4. **Environment boundary**: Source and PGlite synthetic-schema checks (`tests/database.test.mjs`) do not close real multi-connection Supabase Auth/Postgres/Storage/Mailpit or deployed production verification gates. Preserve `"not_verified"` / `"blocked"` across environment boundaries until proved against the target runtime.

## Tracked vs. Ignored Artifacts

| Path | Tracked | Purpose |
| --- | --- | --- |
| `docs/audit/README.md` | Yes | Usage, provenance, freshness rules, regeneration, and review policy |
| `docs/audit/coverage.json` | Yes | Complete tracked-file inventory, `analyzed` / `excluded` / `blocked` status, review mode (`graphify+direct` vs `direct`), bounded Graphify scope mapping, reviewed Git revision, and SHA256 content hashes |
| `docs/audit/findings.json` | Yes | Sanitized, versioned finding records (`LERNA-SEC-*` and `LERNA-STAB-*`) with severity, status history, affected files/symbols/boundaries, hypotheses, positive/negative controls, reviewer attribution, commit references, and evidence links |
| `docs/audit/decisions.md` | Yes | Architectural invariants, threat assumptions, accepted limitations, and append-only status transitions |
| `.stabilization-local/graphify/<scope>/graph.json` | No (ignored) | Raw bounded Graphify structural extraction per code scope ($\le 40$ files, $\le 512\text{ KiB}$/file, $\le 5\text{ MiB}$/scope) |
| `.stabilization-local/audit/audit-overlay-graph.json` | No (ignored) | Derived joined graph linking `findings.json` and `coverage.json` to Graphify file/symbol nodes with cross-scope edge and unresolved-import diagnostics |

Never commit secrets, session cookies, recovery links, personal learner data, or private uploaded documents into `docs/audit/`.

## Local CLI Usage (`scripts/audit_knowledge.py`)

Run from the repository root using Python (`python -B`):

```text
# 1. Build or refresh all bounded Graphify source scopes and the local audit overlay
python -B scripts/audit_knowledge.py build

# 2. Validate schemas, stable IDs, file/symbol links, exclusions, and overlay integrity
python -B scripts/audit_knowledge.py validate

# 3. Query what findings and structural neighbors affect a file or symbol
python -B scripts/audit_knowledge.py file src/app/api/chat/route.ts
python -B scripts/audit_knowledge.py symbol reserve_operation

# 4. List open findings, blocked gates, dependency risks, and external owner actions
python -B scripts/audit_knowledge.py open

# 5. Check what changed since the recorded review and which reviews/tests are stale
python -B scripts/audit_knowledge.py changed
python -B scripts/audit_knowledge.py stale

# 6. Run synthetic negative controls (stale file, lockfile drift, missing symbol/graph, invalid record, excluded secret path)
python -B scripts/audit_knowledge.py self-test
```

## Freshness and Re-Audit Policy

A review record is **stale** when any of the following holds:
- Any `affected_files` entry has a current SHA256 different from `coverage.json`, was renamed, or was deleted.
- Any file in the same bounded Graphify scope or any direct structural caller/importer of an affected file/symbol changed.
- Shared boundary files (`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `src/proxy.ts`, `src/lib/auth/*`, `supabase/migrations/*`) changed since the finding's `reviewed_commit`.
- Dynamic dispatch (`rpc(...)`, `fetch(...)`, worker threads) touches a modified contract; unknown dynamic edges conservatively widen review to the target module/migration family.
- External dependency advisories (`npm audit`) or provider/deployment configurations have not been re-evaluated for the current release window, even if first-party source is unchanged.

## Review and Update Policy

- **Append-only history**: Never delete resolved findings. Transition `status` (e.g., `open` $\rightarrow$ `fixed_local_unverified_runtime` $\rightarrow$ `verified`) and append to `status_history` and `docs/audit/decisions.md`.
- **Independent review**: Material security, authorization, and persistence changes require review by a role that did not author the change (`reviewer` field in `findings.json`). Without independent review capability, leave `review_status` as `"unreviewed_by_independent_agent"`.
