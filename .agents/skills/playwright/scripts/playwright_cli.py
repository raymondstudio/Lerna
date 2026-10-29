"""Run the pinned isolated browser CLI without global installs or npx downloads."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
RUNTIME = ROOT / ".stabilization-local" / "agent-tools" / "playwright"


def main():
    manifest = RUNTIME / "node_modules" / "@playwright" / "cli" / "package.json"
    if not manifest.is_file():
        raise SystemExit("Missing isolated CLI. Run python scripts/agent_skills.py setup-runtime --runtime playwright.")
    package = json.loads(manifest.read_text(encoding="utf-8"))
    if package["version"] != "0.1.22":
        raise SystemExit("Browser CLI differs from the reviewed pin; do not auto-upgrade.")
    entry = package["bin"]
    if isinstance(entry, dict):
        entry = entry["playwright-cli"]
    script = (manifest.parent / entry).resolve()
    if not script.is_relative_to(manifest.parent.resolve()) or not script.is_file():
        raise SystemExit("Invalid browser CLI entry point.")
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js is required for the isolated CLI.")
    session = "lerna-" + hashlib.sha256(str(ROOT).encode()).hexdigest()[:10]
    arguments = sys.argv[1:]
    if not any(a == "--session" or a.startswith("--session=") or a == "-s" or a.startswith("-s=") for a in arguments):
        arguments = ["--session=" + session, *arguments]
    workspace = RUNTIME / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env.pop("PLAYWRIGHT_CLI_SESSION", None)
    raise SystemExit(subprocess.call([node, str(script), *arguments], cwd=workspace, env=env))


if __name__ == "__main__":
    main()
