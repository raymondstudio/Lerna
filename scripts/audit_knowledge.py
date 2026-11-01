"""Project-local audit knowledge layer and deterministic Graphify overlay CLI."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
GRAPHIFY_HELPER = ROOT / ".agents/skills/graphify/scripts/graphify_local.py"
GRAPHIFY_DIR = ROOT / ".stabilization-local/graphify"
AUDIT_LOCAL_DIR = ROOT / ".stabilization-local/audit"
OVERLAY_PATH = AUDIT_LOCAL_DIR / "audit-overlay-graph.json"
COVERAGE_PATH = ROOT / "docs/audit/coverage.json"
FINDINGS_PATH = ROOT / "docs/audit/findings.json"

EXCLUDED_PREFIXES = (
    ".agents/skills/",
    ".claude/skills/",
    ".cline/skills/",
    "public/",
    "src/app/fonts/",
    "brag-output/",
    "node_modules/",
    ".next/",
    ".stabilization-local/",
)
PRIVATE_EXACT = {".env", ".env2", ".env.local", ".env.development", ".env.production"}
PRIVATE_PREFIXES = ("private/", "uploads/", ".env.")


def is_private_path(rel: str) -> bool:
    if rel == ".env.example":
        return False
    return rel in PRIVATE_EXACT or rel.startswith(PRIVATE_PREFIXES)
SHARED_BOUNDARY_PREFIXES = (
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "src/proxy.ts",
    "src/lib/auth/",
    "supabase/migrations/",
)
ELIGIBLE_CODE_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx"}


def norm_sha256(path: Path) -> str:
    payload = path.read_bytes()
    try:
        payload.decode("utf-8")
    except UnicodeDecodeError:
        pass
    else:
        payload = payload.replace(b"\r\n", b"\n")
    return hashlib.sha256(payload).hexdigest()


def git_head(root: Path = ROOT) -> str:
    return subprocess.run(
        ["git", "--no-pager", "rev-parse", "HEAD"],
        cwd=root, capture_output=True, text=True, check=True,
    ).stdout.strip()


def tracked_files(root: Path = ROOT) -> list[str]:
    out = subprocess.run(
        ["git", "--no-pager", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=root, capture_output=True, text=True, check=True,
    ).stdout.splitlines()
    return sorted({line.strip().replace("\\", "/") for line in out if line.strip()})


def assign_scope(rel: str) -> str:
    if rel.startswith(("src/proxy.ts", "src/app/auth/", "src/app/api/auth/", "src/lib/auth/", "src/lib/supabase/", "src/providers/auth-provider.tsx", "src/components/auth/", "src/context/auth-context.tsx", "src/hooks/use-auth.ts")):
        return "auth-security"
    if rel.startswith(("src/app/api/study-sessions/", "src/app/(dashboard)/study/", "src/components/study/", "src/hooks/use-persisted-notes.ts", "src/lib/study-sessions/", "src/lib/repositories/study-sessions.ts")):
        return "study-notes"
    if rel.startswith(("src/app/api/chat/", "src/app/api/demo-chat/", "src/app/(dashboard)/chat/", "src/components/chat/", "src/lib/chat/", "src/lib/gemini/", "src/lib/elastic/", "src/lib/repositories/operations.ts", "src/lib/repositories/budget.ts", "src/lib/services/quota.ts", "src/lib/services/business.ts", "src/lib/services/features.ts")):
        return "chat-rag-provider"
    if rel.startswith(("src/app/api/materials/", "src/app/api/upload/", "src/app/api/quiz/", "src/app/api/courses/", "src/app/(dashboard)/materials/", "src/app/(dashboard)/quiz/", "src/app/(dashboard)/courses/", "src/components/materials/", "src/components/courses/", "src/lib/materials/", "src/lib/uploads/", "src/lib/quiz/", "src/lib/repositories/materials.ts", "src/lib/repositories/practice.ts", "src/lib/repositories/quiz-context.ts", "src/lib/repositories/processing-artifacts.ts", "src/hooks/use-materials.ts", "src/hooks/use-courses.ts")):
        return "materials-quiz-courses"
    if rel.startswith(("src/app/api/admin/", "src/app/api/analytics/", "src/app/api/internal/", "src/lib/activity/", "src/lib/admin/", "src/lib/repositories/activity.ts", "src/lib/repositories/admin-report.ts", "src/lib/repositories/health.ts", "src/lib/services/admin.ts", "src/hooks/use-activity-feed.ts")):
        return "activity-admin-api"
    if rel.startswith(("src/app/admin/", "src/components/admin/")):
        return "admin-ui"
    if rel.startswith(("src/app/api/account/", "src/app/api/tickets/", "src/app/api/feedback/", "src/app/api/institutions/", "src/app/onboarding/", "src/app/welcome/", "src/app/(dashboard)/account/", "src/lib/account/", "src/lib/onboarding.ts", "src/lib/profile.ts", "src/lib/repositories/account.ts", "src/lib/repositories/auth.ts", "src/lib/repositories/billing.ts", "src/lib/repositories/institutions.ts", "src/lib/repositories/users.ts", "src/lib/services/users.ts")):
        return "account-onboarding"
    if rel.startswith(("scripts/", "tests/")):
        return "tooling-tests"
    return "landing-shell-ui"


def build_coverage_and_scopes(root: Path = ROOT, run_graphify: bool = True) -> dict:
    rev = git_head(root)
    files = tracked_files(root)
    scope_Buckets: dict[str, list[str]] = {}
    entries: list[dict] = []
    excluded_missing_brag = 0

    for rel in files:
        full = root / rel
        if not full.is_file():
            if rel.startswith(EXCLUDED_PREFIXES):
                excluded_missing_brag += 1
                continue
            entries.append({
                "path": rel,
                "status": "blocked",
                "review_mode": "excluded",
                "scope": None,
                "reason": "Tracked path missing from working tree.",
                "sha256": None,
                "size_bytes": 0,
            })
            continue
        size = full.stat().st_size
        sha = "self" if rel == "docs/audit/coverage.json" else norm_sha256(full)
        if rel == "next-env.d.ts" or rel.startswith(EXCLUDED_PREFIXES):
            entries.append({
                "path": rel,
                "status": "excluded",
                "review_mode": "excluded",
                "scope": None,
                "reason": "Generated TypeScript route env or third-party/portable skill/static asset bundle excluded from first-party code graph.",
                "sha256": sha,
                "size_bytes": size,
            })
            continue
        if is_private_path(rel):
            raise ValueError(f"Private/secret input must never be indexed: {rel}")

        suffix = full.suffix.lower()
        parts = Path(rel).parts
        helper_filtered = any(
            part.startswith(".") or part in {"node_modules", "uploads", "private", "build", "out", "coverage"}
            for part in parts
        )
        if suffix in ELIGIBLE_CODE_SUFFIXES and size <= 512 * 1024 and not helper_filtered:
            base_scope = assign_scope(rel)
            bucket = scope_Buckets.setdefault(base_scope, [])
            if len(bucket) >= 35:
                idx = 2
                while len(scope_Buckets.setdefault(f"{base_scope}-{idx}", [])) >= 35:
                    idx += 1
                base_scope = f"{base_scope}-{idx}"
                bucket = scope_Buckets[base_scope]
            bucket.append(rel)
            entries.append({
                "path": rel,
                "status": "analyzed",
                "review_mode": "graphify+direct",
                "scope": base_scope,
                "reason": "First-party code module indexed in bounded Graphify structural scope and reviewed directly.",
                "sha256": sha,
                "size_bytes": size,
            })
        else:
            reason = (
                "SQL migration reviewed directly and tested in ordered PGlite schema suite."
                if rel.startswith("supabase/migrations/")
                else "Excluded from Graphify AST extraction by helper path-component filter ('uploads'/'private'/'build'/'out'/'coverage'); reviewed directly and linked via overlay."
                if helper_filtered and suffix in ELIGIBLE_CODE_SUFFIXES
                else "Configuration, documentation, stylesheet, or CommonJS/ESM test module reviewed directly."
            )
            entries.append({
                "path": rel,
                "status": "analyzed",
                "review_mode": "direct",
                "scope": None,
                "reason": reason,
                "sha256": sha,
                "size_bytes": size,
            })

    graphify_py = ROOT / (".stabilization-local/agent-tools/graphify/Scripts/python.exe" if os.name == "nt" else ".stabilization-local/agent-tools/graphify/bin/python")
    runner_py = str(graphify_py) if graphify_py.is_file() else sys.executable
    scopes_manifest: dict[str, dict] = {}
    for scope_name, scope_files in sorted(scope_Buckets.items()):
        total_bytes = sum((root / f).stat().st_size for f in scope_files)
        if len(scope_files) > 40 or total_bytes > 5 * 1024 * 1024:
            raise ValueError(f"Scope {scope_name} exceeds Graphify helper bounds.")
        graph_file = GRAPHIFY_DIR / scope_name / "graph.json"
        need_build = run_graphify
        if graph_file.is_file():
            try:
                existing = json.loads(graph_file.read_text(encoding="utf-8"))
                recorded = existing.get("metadata", {}).get("files", {})
                if set(recorded.keys()) == set(scope_files) and all(
                    hashlib.sha256((root / f).read_bytes()).hexdigest() == recorded[f]
                    for f in scope_files
                ):
                    need_build = False
            except Exception:
                need_build = run_graphify
        if need_build and root == ROOT:
            subprocess.run(
                [runner_py, "-I", "-B", str(GRAPHIFY_HELPER), "build", "--root", str(root), "--scope", scope_name, "--files", *scope_files],
                cwd=root, check=True, capture_output=True, text=True,
            )
        scopes_manifest[scope_name] = {
            "file_count": len(scope_files),
            "total_bytes": total_bytes,
            "files": scope_files,
            "graph_path": f".stabilization-local/graphify/{scope_name}/graph.json",
        }

    coverage = {
        "schema_version": 1,
        "reviewed_revision": rev,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "graphify_version": "0.9.97",
        "graphify_reviewed_revision": "0a8cd4e1e342235fe53e881fb5d591bf0460071f",
        "summary": {
            "total_tracked": len(entries),
            "analyzed_graphify_and_direct": sum(1 for e in entries if e["review_mode"] == "graphify+direct"),
            "analyzed_direct": sum(1 for e in entries if e["review_mode"] == "direct"),
            "excluded": sum(1 for e in entries if e["status"] == "excluded"),
            "blocked": sum(1 for e in entries if e["status"] == "blocked"),
            "scopes_count": len(scopes_manifest),
        },
        "scopes_manifest": scopes_manifest,
        "files": entries,
    }
    return coverage


def resolve_ts_import(spec: str, from_rel: str, known_files: set[str]) -> str | None:
    if spec.startswith("@/"):
        base = "src/" + spec[2:]
    elif spec.startswith(("./", "../")):
        parent = Path(from_rel).parent
        base = (parent / spec).as_posix()
        parts: list[str] = []
        for part in base.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                if parts:
                    parts.pop()
            else:
                parts.append(part)
        base = "/".join(parts)
    else:
        return None
    for cand in (base, f"{base}.ts", f"{base}.tsx", f"{base}.js", f"{base}.mjs", f"{base}/index.ts", f"{base}/index.tsx"):
        if cand in known_files:
            return cand
    return None


def build_overlay_graph(root: Path, coverage: dict, findings_doc: dict) -> dict:
    known_files = {e["path"] for e in coverage["files"] if e["status"] == "analyzed"}
    file_to_scope = {e["path"]: e["scope"] for e in coverage["files"] if e.get("scope")}
    native_nodes: list[dict] = []
    native_edges: list[dict] = []
    symbol_index: dict[str, list[dict]] = {}

    for scope_name, meta in coverage.get("scopes_manifest", {}).items():
        gpath = root / meta["graph_path"]
        if not gpath.is_file():
            raise ValueError(f"Missing Graphify scope graph: {meta['graph_path']}")
        gdata = json.loads(gpath.read_text(encoding="utf-8"))
        for node in gdata.get("nodes", []):
            scoped_id = f"{scope_name}::{node['id']}"
            entry = {**node, "scoped_id": scoped_id, "scope": scope_name, "origin": node.get("_origin", "ast")}
            native_nodes.append(entry)
            label = str(node.get("label", ""))
            clean_label = label[:-2] if label.endswith("()") else label
            if clean_label:
                symbol_index.setdefault(clean_label, []).append(entry)
        for edge in gdata.get("edges", []):
            native_edges.append({
                **edge,
                "scope": scope_name,
                "scoped_source": f"{scope_name}::{edge['source']}",
                "scoped_target": f"{scope_name}::{edge['target']}",
                "origin": edge.get("_origin", "ast"),
            })

    cross_scope_edges: list[dict] = []
    unresolved_imports: list[dict] = []
    dynamic_edges: list[dict] = []
    import_re = re.compile(r"(?:from|import)\s*\(?['\"]([^'\"]+)['\"]\)?")
    rpc_re = re.compile(r"\.rpc\(\s*['\"]([a-zA-Z0-9_]+)['\"]")
    fetch_re = re.compile(r"fetch\(\s*[`'\"](/api/[^`'\"{}?]+)")

    for rel, scope_name in sorted(file_to_scope.items()):
        full = root / rel
        if not full.is_file():
            continue
        text = full.read_text(encoding="utf-8", errors="ignore")
        for match in import_re.finditer(text):
            spec = match.group(1)
            if not spec.startswith(("@/", "./", "../")):
                continue
            target = resolve_ts_import(spec, rel, known_files)
            if not target:
                if not spec.endswith((".css", ".json")):
                    unresolved_imports.append({"source_file": rel, "specifier": spec})
                continue
            target_scope = file_to_scope.get(target)
            if target_scope and target_scope != scope_name:
                cross_scope_edges.append({
                    "source_file": rel,
                    "source_scope": scope_name,
                    "target_file": target,
                    "target_scope": target_scope,
                    "relation": "cross_scope_import",
                    "confidence": "EXTRACTED_IMPORT_SPECIFIER",
                    "origin": "local_audit_overlay",
                })
        for match in rpc_re.finditer(text):
            dynamic_edges.append({
                "source_file": rel,
                "target_rpc": match.group(1),
                "relation": "calls_postgres_rpc",
                "confidence": "DYNAMIC_BOUNDARY",
                "origin": "local_audit_overlay",
            })
        for match in fetch_re.finditer(text):
            dynamic_edges.append({
                "source_file": rel,
                "target_route": match.group(1),
                "relation": "fetches_api_route",
                "confidence": "DYNAMIC_BOUNDARY",
                "origin": "local_audit_overlay",
            })

    overlay_nodes: list[dict] = []
    overlay_edges: list[dict] = []
    unresolved_links: list[dict] = []

    for finding in findings_doc.get("findings", []):
        fid = finding["id"]
        overlay_nodes.append({
            "id": f"finding::{fid}",
            "finding_id": fid,
            "label": f"{fid}: {finding['title']}",
            "severity": finding["severity"],
            "status": finding["status"],
            "review_status": finding["review_status"],
            "origin": "local_audit_overlay",
        })
        for af in finding.get("affected_files", []):
            if af not in known_files:
                unresolved_links.append({"finding_id": fid, "kind": "affected_file", "target": af})
                continue
            overlay_edges.append({
                "source": f"finding::{fid}",
                "target": af,
                "relation": "affects_file",
                "confidence": "OVERLAY_DETERMINISTIC",
                "origin": "local_audit_overlay",
            })
        for sym in finding.get("affected_symbols", []):
            matches = symbol_index.get(sym, [])
            if not matches:
                direct_found = False
                for af in finding.get("affected_files", []):
                    if (root / af).is_file():
                        if sym in (root / af).read_text(encoding="utf-8", errors="ignore"):
                            direct_found = True
                            overlay_edges.append({
                                "source": f"finding::{fid}",
                                "target": f"direct::{af}::{sym}",
                                "relation": "affects_direct_symbol",
                                "confidence": "OVERLAY_DETERMINISTIC",
                                "origin": "local_audit_overlay",
                            })
                if not direct_found:
                    unresolved_links.append({"finding_id": fid, "kind": "affected_symbol", "target": sym})
            else:
                for m in matches:
                    overlay_edges.append({
                        "source": f"finding::{fid}",
                        "target": m["scoped_id"],
                        "source_file": m.get("source_file"),
                        "relation": "affects_symbol",
                        "confidence": "OVERLAY_DETERMINISTIC",
                        "origin": "local_audit_overlay",
                    })
        for ev in finding.get("evidence_refs", []):
            if not (root / ev).is_file():
                unresolved_links.append({"finding_id": fid, "kind": "evidence_ref", "target": ev})
            else:
                overlay_edges.append({
                    "source": f"finding::{fid}",
                    "target": ev,
                    "relation": "verified_by_evidence",
                    "confidence": "OVERLAY_DETERMINISTIC",
                    "origin": "local_audit_overlay",
                })

    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_revision": coverage["reviewed_revision"],
        "provenance": {
            "structural_extractor": "graphifyy==0.9.97 (ast structural-only)",
            "overlay": "local_audit_overlay (deterministic path/symbol/hash matching; never claimed as Graphify-native or LLM semantic output)",
        },
        "summary": {
            "native_ast_nodes": len(native_nodes),
            "native_ast_edges": len(native_edges),
            "overlay_finding_nodes": len(overlay_nodes),
            "overlay_edges": len(overlay_edges),
            "cross_scope_edges": len(cross_scope_edges),
            "dynamic_edges": len(dynamic_edges),
            "unresolved_imports": len(unresolved_imports),
            "unresolved_finding_links": len(unresolved_links),
        },
        "native_nodes": native_nodes,
        "native_edges": native_edges,
        "overlay_nodes": overlay_nodes,
        "overlay_edges": overlay_edges,
        "cross_scope_edges": cross_scope_edges,
        "dynamic_edges": dynamic_edges,
        "unresolved_imports": unresolved_imports,
        "unresolved_links": unresolved_links,
    }


def validate_knowledge(root: Path = ROOT, coverage_path: Path = COVERAGE_PATH, findings_path: Path = FINDINGS_PATH, overlay_path: Path = OVERLAY_PATH) -> dict:
    if not coverage_path.is_file() or not findings_path.is_file():
        raise ValueError("Missing tracked coverage.json or findings.json.")
    if not overlay_path.is_file():
        raise ValueError("Missing derived audit overlay graph (.stabilization-local/audit/audit-overlay-graph.json).")
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    findings_doc = json.loads(findings_path.read_text(encoding="utf-8"))
    if coverage.get("schema_version") != 1 or findings_doc.get("schema_version") != 1:
        raise ValueError("Unsupported schema_version in audit knowledge files.")

    files_map = {}
    for entry in coverage.get("files", []):
        p = entry.get("path")
        if not p or p in files_map:
            raise ValueError(f"Invalid or duplicate coverage path: {p}")
        if is_private_path(p) and entry.get("review_mode") != "excluded":
            raise ValueError(f"Private path must be excluded from coverage indexing: {p}")
        files_map[p] = entry

    required_finding_keys = {
        "id", "title", "severity", "category", "status", "review_status", "reviewer",
        "introduced_commit", "fixed_commit", "reviewed_commit", "resource_boundary",
        "affected_files", "affected_symbols", "hypothesis", "reproduction",
        "positive_control", "negative_control", "dependency_config_assumptions",
        "evidence_refs", "status_history",
    }
    valid_severities = {"Critical", "High", "Medium", "Low", "Informational"}
    seen_ids = set()
    for f in findings_doc.get("findings", []):
        missing = required_finding_keys - set(f.keys())
        if missing:
            raise ValueError(f"Finding {f.get('id')} missing required fields: {sorted(missing)}")
        fid = f["id"]
        if not re.fullmatch(r"LERNA-(?:SEC|STAB-REV|STAB-AUD|DEP)-\d{3}", str(fid)) or fid in seen_ids:
            raise ValueError(f"Invalid or duplicate finding ID: {fid}")
        seen_ids.add(fid)
        if f["severity"] not in valid_severities:
            raise ValueError(f"Invalid severity in {fid}: {f['severity']}")
        if not isinstance(f["affected_files"], list) or not f["affected_files"]:
            raise ValueError(f"Finding {fid} must list affected_files.")
        if not isinstance(f["status_history"], list) or not f["status_history"]:
            raise ValueError(f"Finding {fid} must preserve non-empty status_history.")

    rebuilt_overlay = build_overlay_graph(root, coverage, findings_doc)
    if rebuilt_overlay["unresolved_links"]:
        raise ValueError(f"Unresolved finding links: {json.dumps(rebuilt_overlay['unresolved_links'])}")

    return {
        "status": "PASS",
        "tracked_files": len(files_map),
        "findings": len(seen_ids),
        "scopes": len(coverage.get("scopes_manifest", {})),
        "native_ast_nodes": rebuilt_overlay["summary"]["native_ast_nodes"],
        "overlay_edges": rebuilt_overlay["summary"]["overlay_edges"],
        "cross_scope_edges": rebuilt_overlay["summary"]["cross_scope_edges"],
    }


def compute_staleness(root: Path = ROOT, coverage_path: Path = COVERAGE_PATH, findings_path: Path = FINDINGS_PATH, overlay_path: Path = OVERLAY_PATH) -> dict:
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    findings_doc = json.loads(findings_path.read_text(encoding="utf-8"))
    overlay = json.loads(overlay_path.read_text(encoding="utf-8")) if overlay_path.is_file() else build_overlay_graph(root, coverage, findings_doc)

    current_tracked = set(tracked_files(root))
    recorded_map = {e["path"]: e for e in coverage.get("files", [])}
    recorded_paths = set(recorded_map.keys())

    added_files = sorted(current_tracked - recorded_paths)
    deleted_files = sorted(recorded_paths - current_tracked)
    modified_files: list[str] = []

    for rel, entry in sorted(recorded_map.items()):
        if rel == "docs/audit/coverage.json" or entry.get("status") == "excluded":
            continue
        full = root / rel
        if not full.is_file():
            if rel not in deleted_files:
                deleted_files.append(rel)
            continue
        if norm_sha256(full) != entry.get("sha256"):
            modified_files.append(rel)

    changed_set = set(added_files) | set(deleted_files) | set(modified_files)
    shared_boundary_changed = sorted(p for p in changed_set if p.startswith(SHARED_BOUNDARY_PREFIXES))

    # Build file-to-file structural neighborhood from native AST + cross-scope edges
    node_to_file: dict[str, str] = {}
    for n in overlay.get("native_nodes", []):
        sf = str(n.get("source_file", "")).replace("\\", "/")
        if sf:
            node_to_file[n["scoped_id"]] = sf

    neighbors: dict[str, set[str]] = {}
    for e in overlay.get("native_edges", []):
        f1 = node_to_file.get(e.get("scoped_source", ""))
        f2 = node_to_file.get(e.get("scoped_target", ""))
        if f1 and f2 and f1 != f2:
            neighbors.setdefault(f1, set()).add(f2)
            neighbors.setdefault(f2, set()).add(f1)
    for ce in overlay.get("cross_scope_edges", []):
        f1, f2 = ce["source_file"], ce["target_file"]
        neighbors.setdefault(f1, set()).add(f2)
        neighbors.setdefault(f2, set()).add(f1)

    widened_files = set(changed_set)
    for ch in list(changed_set):
        widened_files |= neighbors.get(ch, set())

    stale_findings: list[dict] = []
    for f in findings_doc.get("findings", []):
        reasons: list[str] = []
        direct_hits = [af for af in f.get("affected_files", []) if af in changed_set]
        if direct_hits:
            reasons.append(f"direct_file_modified:{','.join(direct_hits)}")
        neighbor_hits = [af for af in f.get("affected_files", []) if af not in changed_set and af in widened_files]
        if neighbor_hits:
            reasons.append(f"caller_or_dependency_modified:{','.join(neighbor_hits)}")
        if shared_boundary_changed:
            reasons.append(f"shared_boundary_modified:{','.join(shared_boundary_changed)}")
        if reasons:
            stale_findings.append({"id": f["id"], "title": f["title"], "reasons": reasons})

    return {
        "reviewed_revision": coverage.get("reviewed_revision"),
        "current_head": git_head(root) if (root / ".git").exists() else coverage.get("reviewed_revision"),
        "added_files": added_files,
        "deleted_files": deleted_files,
        "modified_files": modified_files,
        "shared_boundary_changed": shared_boundary_changed,
        "widened_affected_files": sorted(widened_files),
        "stale_findings": stale_findings,
        "external_advisory_notice": "Unchanged first-party source never waives periodic npm audit or hosted provider/RLS configuration checks.",
    }


def query_file(rel: str, coverage_path: Path = COVERAGE_PATH, findings_path: Path = FINDINGS_PATH, overlay_path: Path = OVERLAY_PATH) -> dict:
    norm = rel.replace("\\", "/").lstrip("./")
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    findings_doc = json.loads(findings_path.read_text(encoding="utf-8"))
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    cov_entry = next((e for e in coverage["files"] if e["path"] == norm), None)
    if not cov_entry:
        raise ValueError(f"File not found in coverage.json: {norm}")

    direct = [f for f in findings_doc["findings"] if norm in f.get("affected_files", [])]
    ast_nodes = [n for n in overlay["native_nodes"] if str(n.get("source_file", "")).replace("\\", "/") == norm]
    cross_edges = [e for e in overlay["cross_scope_edges"] if e["source_file"] == norm or e["target_file"] == norm]
    dyn_edges = [e for e in overlay["dynamic_edges"] if e["source_file"] == norm]
    neighbor_files = {
        e["target_file"] if e["source_file"] == norm else e["source_file"]
        for e in cross_edges
    }
    neighbor_findings = [
        {"id": f["id"], "title": f["title"], "status": f["status"]}
        for f in findings_doc["findings"]
        if f not in direct and any(af in neighbor_files for af in f.get("affected_files", []))
    ]
    return {
        "file": norm,
        "coverage": cov_entry,
        "ast_symbols": [n.get("label") for n in ast_nodes if n.get("label") != Path(norm).name],
        "direct_findings": [{"id": f["id"], "severity": f["severity"], "status": f["status"], "title": f["title"]} for f in direct],
        "neighbor_findings": neighbor_findings,
        "cross_scope_edges": cross_edges,
        "dynamic_edges": dyn_edges,
    }


def query_symbol(symbol: str, findings_path: Path = FINDINGS_PATH, overlay_path: Path = OVERLAY_PATH) -> dict:
    findings_doc = json.loads(findings_path.read_text(encoding="utf-8"))
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    needle = symbol.strip().rstrip("()")
    matched_nodes = [
        n for n in overlay["native_nodes"]
        if str(n.get("label", "")).rstrip("()") == needle or needle.casefold() in str(n.get("label", "")).casefold()
    ]
    matched_ids = {n["scoped_id"] for n in matched_nodes}
    matched_files = {str(n.get("source_file", "")).replace("\\", "/") for n in matched_nodes}
    edges = [
        e for e in overlay["native_edges"]
        if e["scoped_source"] in matched_ids or e["scoped_target"] in matched_ids
    ][:25]
    direct_findings = [
        {"id": f["id"], "severity": f["severity"], "status": f["status"], "title": f["title"]}
        for f in findings_doc["findings"]
        if needle in f.get("affected_symbols", []) or any(af in matched_files for af in f.get("affected_files", []))
    ]
    return {
        "symbol": needle,
        "ast_nodes": matched_nodes,
        "ast_edges": edges,
        "findings": direct_findings,
    }


def query_open(findings_path: Path = FINDINGS_PATH) -> dict:
    findings_doc = json.loads(findings_path.read_text(encoding="utf-8"))
    open_items = [
        {"id": f["id"], "severity": f["severity"], "status": f["status"], "title": f["title"], "assumptions": f["dependency_config_assumptions"]}
        for f in findings_doc["findings"]
        if not f["status"].startswith("fixed_")
    ]
    pending_runtime = [
        {"id": f["id"], "severity": f["severity"], "status": f["status"], "title": f["title"], "assumptions": f["dependency_config_assumptions"]}
        for f in findings_doc["findings"]
        if f["status"] == "fixed_local_verified_unit_sql"
    ]
    return {
        "open_or_external_findings": open_items,
        "fixed_in_source_pending_live_containers_or_staging": len(pending_runtime),
        "sample_pending_runtime_ids": [f["id"] for f in pending_runtime[:10]],
        "blocked_environment_gates": [
            "Local Docker/Podman container daemon (npipe:////./pipe/dockerDesktopLinuxEngine) unavailable for live Supabase Auth/Storage/Mailpit E2E replay",
            "Owner-controlled Supabase service-role key rotation and access-log containment (LERNA-SEC-001)",
            "Hosted staging/production migration application, private.activity_runtime initialization, and OAuth/SMTP verification",
        ],
    }


def self_test() -> dict:
    base = ROOT / ".stabilization-local/audit-selftest"
    if base.exists():
        shutil.rmtree(base)
    base.mkdir(parents=True, exist_ok=True)
    try:
        for sub in ("src", "tests", "docs/audit", ".stabilization-local/graphify/fixture-scope", ".stabilization-local/audit"):
            (base / sub).mkdir(parents=True, exist_ok=True)

        callee = base / "src/callee.ts"
        caller = base / "src/caller.ts"
        lockfile = base / "package-lock.json"
        evidence = base / "tests/control.test.ts"
        callee.write_text("export function checkAuth() { return true; }\n", encoding="utf-8")
        caller.write_text("import { checkAuth } from './callee';\nexport function handleRoute() { return checkAuth(); }\n", encoding="utf-8")
        lockfile.write_text('{"name": "fixture", "lockfileVersion": 3}\n', encoding="utf-8")
        evidence.write_text("// synthetic test evidence\n", encoding="utf-8")

        subprocess.run(
            [sys.executable, "-B", str(GRAPHIFY_HELPER), "build", "--root", str(base), "--scope", "fixture-scope", "--files", "src/callee.ts", "src/caller.ts"],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        shutil.copyfile(
            ROOT / ".stabilization-local/graphify/fixture-scope/graph.json",
            base / ".stabilization-local/graphify/fixture-scope/graph.json",
        )
        shutil.rmtree(ROOT / ".stabilization-local/graphify/fixture-scope", ignore_errors=True)

        cov = {
            "schema_version": 1,
            "reviewed_revision": "0" * 40,
            "scopes_manifest": {
                "fixture-scope": {
                    "file_count": 2,
                    "total_bytes": callee.stat().st_size + caller.stat().st_size,
                    "files": ["src/callee.ts", "src/caller.ts"],
                    "graph_path": ".stabilization-local/graphify/fixture-scope/graph.json",
                }
            },
            "files": [
                {"path": "src/callee.ts", "status": "analyzed", "review_mode": "graphify+direct", "scope": "fixture-scope", "reason": "fixture", "sha256": norm_sha256(callee), "size_bytes": callee.stat().st_size},
                {"path": "src/caller.ts", "status": "analyzed", "review_mode": "graphify+direct", "scope": "fixture-scope", "reason": "fixture", "sha256": norm_sha256(caller), "size_bytes": caller.stat().st_size},
                {"path": "package-lock.json", "status": "analyzed", "review_mode": "direct", "scope": None, "reason": "fixture", "sha256": norm_sha256(lockfile), "size_bytes": lockfile.stat().st_size},
                {"path": "tests/control.test.ts", "status": "analyzed", "review_mode": "direct", "scope": None, "reason": "fixture", "sha256": norm_sha256(evidence), "size_bytes": evidence.stat().st_size},
            ],
        }
        findings = {
            "schema_version": 1,
            "findings": [
                {
                    "id": "LERNA-SEC-901",
                    "title": "Synthetic caller finding",
                    "severity": "High",
                    "category": "authorization",
                    "status": "fixed_local_verified_unit_sql",
                    "review_status": "reviewed",
                    "reviewer": "synthetic-reviewer",
                    "introduced_commit": "0" * 40,
                    "fixed_commit": "0" * 40,
                    "reviewed_commit": "0" * 40,
                    "resource_boundary": "fixture",
                    "affected_files": ["src/caller.ts"],
                    "affected_symbols": ["handleRoute"],
                    "hypothesis": "synthetic",
                    "reproduction": "synthetic",
                    "positive_control": "synthetic",
                    "negative_control": "synthetic",
                    "dependency_config_assumptions": "synthetic",
                    "evidence_refs": ["tests/control.test.ts"],
                    "status_history": [{"date": "2026-10-29", "status": "fixed_local_verified_unit_sql", "commit": "0" * 40}],
                }
            ],
        }
        cov_path = base / "docs/audit/coverage.json"
        find_path = base / "docs/audit/findings.json"
        over_path = base / ".stabilization-local/audit/audit-overlay-graph.json"
        cov_path.write_text(json.dumps(cov, indent=2), encoding="utf-8")
        find_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")
        over = build_overlay_graph(base, cov, findings)
        over_path.write_text(json.dumps(over, indent=2), encoding="utf-8")
        validate_knowledge(base, cov_path, find_path, over_path)
        results = {}

        # 1. Stale file + caller widening
        orig_callee = callee.read_text(encoding="utf-8")
        callee.write_text(orig_callee + "// modified\n", encoding="utf-8")
        stale = compute_staleness(base, cov_path, find_path, over_path)
        if "src/callee.ts" not in stale["modified_files"] or not any(s["id"] == "LERNA-SEC-901" for s in stale["stale_findings"]):
            raise AssertionError("Stale file and caller widening control failed")
        callee.write_text(orig_callee, encoding="utf-8")
        results["stale_file_and_caller_widening"] = "passed"

        # 2. Changed lockfile detection
        orig_lock = lockfile.read_text(encoding="utf-8")
        lockfile.write_text(orig_lock + "\n", encoding="utf-8")
        stale_lock = compute_staleness(base, cov_path, find_path, over_path)
        if "package-lock.json" not in stale_lock["shared_boundary_changed"] or not stale_lock["stale_findings"]:
            raise AssertionError("Lockfile drift control failed")
        lockfile.write_text(orig_lock, encoding="utf-8")
        results["changed_lockfile_detection"] = "passed"

        # 3. Removed symbol detection
        bad_sym = json.loads(json.dumps(findings))
        bad_sym["findings"][0]["affected_symbols"] = ["removedFunction"]
        find_path.write_text(json.dumps(bad_sym, indent=2), encoding="utf-8")
        try:
            validate_knowledge(base, cov_path, find_path, over_path)
        except ValueError:
            results["removed_symbol_rejected"] = "passed"
        else:
            raise AssertionError("Removed symbol was not rejected")
        find_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")

        # 4. Missing graph/evidence detection
        evidence.unlink()
        try:
            validate_knowledge(base, cov_path, find_path, over_path)
        except ValueError:
            results["missing_evidence_or_graph_rejected"] = "passed"
        else:
            raise AssertionError("Missing evidence was not rejected")
        evidence.write_text("// synthetic test evidence\n", encoding="utf-8")

        # 5. Invalid record / duplicate ID detection
        dup = json.loads(json.dumps(findings))
        dup["findings"].append(dup["findings"][0])
        find_path.write_text(json.dumps(dup, indent=2), encoding="utf-8")
        try:
            validate_knowledge(base, cov_path, find_path, over_path)
        except ValueError:
            results["invalid_or_duplicate_record_rejected"] = "passed"
        else:
            raise AssertionError("Duplicate finding ID was not rejected")
        find_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")

        # 6. Excluded private input rejection
        priv_cov = json.loads(json.dumps(cov))
        priv_cov["files"].append({"path": ".env", "status": "analyzed", "review_mode": "direct", "scope": None, "reason": "bad", "sha256": "0" * 64, "size_bytes": 1})
        cov_path.write_text(json.dumps(priv_cov, indent=2), encoding="utf-8")
        try:
            validate_knowledge(base, cov_path, find_path, over_path)
        except ValueError:
            results["private_input_exclusion_enforced"] = "passed"
        else:
            raise AssertionError("Private .env path was not rejected")

        return {"status": "PASS", "controls": results, "paid_provider_calls": 0}
    finally:
        shutil.rmtree(base, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build")
    sub.add_parser("validate")
    sub.add_parser("open")
    sub.add_parser("changed")
    sub.add_parser("stale")
    sub.add_parser("self-test")
    p_file = sub.add_parser("file")
    p_file.add_argument("path")
    p_sym = sub.add_parser("symbol")
    p_sym.add_argument("name")
    args = parser.parse_args()

    if args.command == "build":
        cov = build_coverage_and_scopes(ROOT, run_graphify=True)
        COVERAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        COVERAGE_PATH.write_text(json.dumps(cov, indent=2) + "\n", encoding="utf-8")
        findings_doc = json.loads(FINDINGS_PATH.read_text(encoding="utf-8"))
        overlay = build_overlay_graph(ROOT, cov, findings_doc)
        AUDIT_LOCAL_DIR.mkdir(parents=True, exist_ok=True)
        OVERLAY_PATH.write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": "PASS", "coverage": cov["summary"], "overlay": overlay["summary"]}, indent=2))
    elif args.command == "validate":
        print(json.dumps(validate_knowledge(), indent=2))
    elif args.command == "file":
        print(json.dumps(query_file(args.path), indent=2))
    elif args.command == "symbol":
        print(json.dumps(query_symbol(args.name), indent=2))
    elif args.command == "open":
        print(json.dumps(query_open(), indent=2))
    elif args.command in ("changed", "stale"):
        print(json.dumps(compute_staleness(), indent=2))
    elif args.command == "self-test":
        print(json.dumps(self_test(), indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        raise SystemExit(str(exc))
