"""Bounded, offline Graphify structural extraction; no installer or semantic CLI."""
from __future__ import annotations

import argparse
from collections import deque
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
VERSION = "0.9.97"
BASE = ROOT / ".stabilization-local" / "graphify"
RUNTIME = ROOT / ".stabilization-local" / "agent-tools" / "graphify"
PYTHON = RUNTIME / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def scope_path(scope):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,47}", scope):
        raise ValueError("Use a short lowercase scope name.")
    return BASE / scope


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_runtime():
    if not PYTHON.is_file():
        raise ValueError("Missing isolated runtime. Run python scripts/agent_skills.py setup-runtime --runtime graphify.")
    if Path(sys.executable).resolve() != PYTHON.resolve():
        child_env = {k: v for k, v in os.environ.items() if k not in {
            "GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
            "GRAPHIFY_BACKEND", "GRAPHIFY_MODEL", "GRAPHIFY_OUT",
        }}
        raise SystemExit(subprocess.call([str(PYTHON), "-I", "-B", str(Path(__file__).resolve()), *sys.argv[1:]], env=child_env))
    if importlib.metadata.version("graphifyy") != VERSION:
        raise ValueError("Runtime version differs from the reviewed pin; do not auto-upgrade.")


def offline(event, _args):
    if event in {"socket.connect", "socket.getaddrinfo", "subprocess.Popen", "os.system"}:
        raise PermissionError("Network and subprocess operations are disabled in structural extraction.")


def build(root, names, scope):
    root = Path(root).resolve(strict=True)
    if not root.is_relative_to(ROOT):
        raise ValueError("Use this project's root or an explicit fixture/subdirectory within it.")
    if not 1 <= len(names) <= 40:
        raise ValueError("Select 1–40 explicit code files.")
    files = []
    for name in names:
        relative = Path(name)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("File paths must stay inside the explicit root.")
        if any(part.startswith(".") or part in {"node_modules", "uploads", "private", "build", "out", "coverage"} for part in relative.parts):
            raise ValueError("Private/generated input is excluded.")
        cursor = root
        for part in relative.parts:
            cursor /= part
            if cursor.is_symlink() or (hasattr(cursor, "is_junction") and cursor.is_junction()):
                raise ValueError("Symlink/junction inputs are excluded.")
        path = (root / relative).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file() or path.suffix not in {".py", ".js", ".jsx", ".ts", ".tsx"}:
            raise ValueError("Only explicit Python/JavaScript/TypeScript source is supported.")
        if path.stat().st_size > 512 * 1024:
            raise ValueError("An input exceeds 512 KiB.")
        files.append(path)
    if sum(p.stat().st_size for p in files) > 5 * 1024 * 1024:
        raise ValueError("Scope exceeds 5 MiB.")
    output = scope_path(scope)
    output.mkdir(parents=True, exist_ok=True)
    revision = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    os.environ["GRAPHIFY_OUT"] = str(output)
    sys.addaudithook(offline)
    from graphify.extract import extract
    result = extract(files, cache_root=root, root=root, parallel=False)
    graph = {"metadata": {"graphify": VERSION, "mode": "structural-only", "root": str(root),
             "revision": revision, "built_at": datetime.now(timezone.utc).isoformat(),
             "files": {p.relative_to(root).as_posix(): digest(p) for p in files}}, **result}
    (output / "graph.json").write_text(json.dumps(graph, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"scope": scope, "nodes": len(result["nodes"]), "edges": len(result["edges"]), "mode": "structural-only"}))
    return graph


def load(scope):
    graph = json.loads((scope_path(scope) / "graph.json").read_text(encoding="utf-8"))
    root = Path(graph["metadata"]["root"]).resolve(strict=True)
    if not root.is_relative_to(ROOT):
        raise ValueError("Index root is outside this project.")
    for name in graph["metadata"]["files"]:
        path = Path(name)
        if path.is_absolute() or ".." in path.parts or path.suffix not in {".py", ".js", ".jsx", ".ts", ".tsx"}:
            raise ValueError("Invalid indexed source path.")
        if not (root / path).resolve().is_relative_to(root):
            raise ValueError("Indexed source escapes its root.")
    stale = [name for name, value in graph["metadata"]["files"].items() if not (root / name).is_file() or digest(root / name) != value]
    if stale:
        raise ValueError("Index is stale; explicitly rebuild the same scope: " + ", ".join(stale))
    return graph


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    sub.add_parser("smoke")
    p = sub.add_parser("build"); p.add_argument("--root", default=str(ROOT)); p.add_argument("--files", nargs="+", required=True); p.add_argument("--scope", required=True)
    p = sub.add_parser("query"); p.add_argument("--scope", required=True); p.add_argument("--text", required=True)
    p = sub.add_parser("path"); p.add_argument("--scope", required=True); p.add_argument("--start", required=True); p.add_argument("--end", required=True)
    args = parser.parse_args()
    ensure_runtime()
    if args.command == "status":
        print(json.dumps({"runtime": str(PYTHON), "graphify": VERSION, "mode": "structural-only"})); return
    if args.command == "build":
        build(args.root, args.files, args.scope); return
    if args.command == "smoke":
        fixture = ROOT / ".stabilization-local" / "graphify-fixture"
        fixture.mkdir(parents=True, exist_ok=True)
        (fixture / "a.ts").write_text("export function add(a: number, b: number) { return a + b; }\n", encoding="utf-8")
        (fixture / "b.ts").write_text("import { add } from './a';\nexport function twice(n: number) { return add(n, n); }\n", encoding="utf-8")
        graph = build(fixture, ["a.ts", "b.ts"], "fixture")
        labels = {n.get("label") for n in graph["nodes"]}
        call = any(e.get("source") == "b_twice" and e.get("target") == "a_add" and e.get("relation") == "calls" for e in graph["edges"])
        if not {"add()", "twice()"}.issubset(labels) or not call:
            raise ValueError("Fixture extraction did not map both functions and relationships.")
        print("PASS: two synthetic modules mapped; extraction blocked network/subprocess calls."); return
    graph = load(args.scope)
    if args.command == "query":
        nodes = [n for n in graph["nodes"] if args.text.casefold() in json.dumps(n).casefold()][:10]
        ids = {n["id"] for n in nodes}
        edges = [e for e in graph["edges"] if e.get("source") in ids or e.get("target") in ids][:20]
        print(json.dumps({"metadata": graph["metadata"], "nodes": nodes, "edges": edges}, indent=2)); return
    adjacency = {}
    for edge in graph["edges"]:
        adjacency.setdefault(edge["source"], []).append((edge["target"], edge))
        adjacency.setdefault(edge["target"], []).append((edge["source"], edge))
    todo = deque([(args.start, [])]); seen = {args.start}
    while todo:
        node, edges = todo.popleft()
        if node == args.end:
            print(json.dumps({"traversal": "undirected navigation; edge direction preserved below", "edges": edges}, indent=2)); return
        for target, edge in adjacency.get(node, []):
            if target not in seen:
                seen.add(target); todo.append((target, edges + [edge]))
    raise ValueError("No indexed path between these exact node IDs.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, importlib.metadata.PackageNotFoundError) as error:
        raise SystemExit(str(error))
