"""Synthetic-only Graphify and browser installation controls. No Lerna app/provider calls."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import subprocess
import sys
from threading import Thread
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / ".agents/skills/graphify/scripts/graphify_local.py"
BROWSER = ROOT / ".agents/skills/playwright/scripts/playwright_cli.py"


def run(script, *args, allowed_failure=False):
    result = subprocess.run([sys.executable, str(script), *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=90)
    if result.returncode and not allowed_failure:
        raise RuntimeError(result.stdout + result.stderr)
    return result


class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<!doctype html><html lang="en"><title>Skill fixture</title><h1>Tooling fixture</h1><button onclick="document.getElementById(\'result\').textContent=\'Activated\'">Activate</button><p id="result" role="status">Waiting</p></html>'
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(body)

    def log_message(self, *_args):
        pass


def main():
    results = {}
    run(GRAPH, "smoke")
    results["graphify_two_module_extraction"] = "passed: add/twice import and call edge"
    run(GRAPH, "query", "--scope", "fixture", "--text", "twice")
    run(GRAPH, "path", "--scope", "fixture", "--start", "b_twice", "--end", "a_add")
    fixture = ROOT / ".stabilization-local/graphify-fixture"
    (fixture / ".env").write_text("SYNTHETIC_MARKER_ONLY=not-a-secret\n", encoding="utf-8")
    denied = run(GRAPH, "build", "--root", str(fixture), "--scope", "deny-fixture", "--files", ".env", allowed_failure=True)
    if denied.returncode == 0 or "excluded" not in denied.stderr + denied.stdout:
        raise AssertionError("Private fixture was not rejected before extraction")
    original = (fixture / "a.ts").read_bytes()
    try:
        (fixture / "a.ts").write_bytes(original + b"// synthetic stale-index control\n")
        stale = run(GRAPH, "query", "--scope", "fixture", "--text", "add", allowed_failure=True)
        if stale.returncode == 0 or "stale" not in stale.stderr + stale.stdout:
            raise AssertionError("Stale index was not rejected")
    finally:
        (fixture / "a.ts").write_bytes(original)
    results["graphify_private_input_and_stale_index_denials"] = "passed"
    server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    thread = Thread(target=server.serve_forever, daemon=True); thread.start()
    session = "--session=lerna-skill-smoke-" + uuid4().hex[:8]
    try:
        run(BROWSER, session, "open", f"http://127.0.0.1:{server.server_port}", "--browser=chrome", "--idle-timeout=30000")
        snapshot = run(BROWSER, session, "snapshot").stdout
        match = re.search(r'button "Activate"[^\n]*\[ref=(e\d+)\]', snapshot)
        if not match or "Tooling fixture" not in snapshot:
            raise AssertionError("Synthetic browser fixture was not observed: " + snapshot)
        run(BROWSER, session, "click", match.group(1))
        after = run(BROWSER, session, "snapshot").stdout
        if "Activated" not in after:
            raise AssertionError("Synthetic click outcome missing")
        results["playwright_local_snapshot_click_outcome"] = "passed: fresh nonpersistent Chrome context"
    finally:
        run(BROWSER, session, "close", allowed_failure=True)
        server.shutdown(); server.server_close(); thread.join(timeout=5)
    output = ROOT / ".stabilization-local/agent-skill-fixtures.json"
    output.write_text(json.dumps({"scope": "synthetic fixtures only", "results": results, "project_indexing": "none", "paid_provider_calls": 0}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "results": results, "evidence": str(output)}, indent=2))


if __name__ == "__main__":
    main()
