"""Validate portable skill bundles, manage owned host copies, or explicitly set up pinned tools."""
from __future__ import annotations
import argparse
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
HOSTS = {"claude": ".claude/skills", "cline": ".cline/skills"}


def contained(root, relative):
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Invalid managed relative path")
    target = root / path
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError("Managed path escapes project")
    return target


def hashes(folder):
    result = {}
    for path in sorted(folder.rglob("*")):
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise ValueError("Unexpected link in managed skill: " + str(path))
        if path.is_file() and "__pycache__" not in path.parts:
            payload = path.read_bytes()
            try:
                payload.decode("utf-8")
            except UnicodeDecodeError:
                pass
            else:
                payload = payload.replace(b"\r\n", b"\n")
            result[path.relative_to(folder).as_posix()] = hashlib.sha256(payload).hexdigest()
    return result


def inventory(root):
    return json.loads((root / ".agents/skill-inventory.json").read_text(encoding="utf-8"))


def validate(root=ROOT):
    data = inventory(root)
    names = set()
    for item in data["skills"]:
        name = item["name"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or name in names:
            raise ValueError("Invalid or duplicate skill name: " + name)
        names.add(name)
        folder = contained(root, ".agents/skills/" + name)
        if hashes(folder) != item["files_sha256"]:
            raise ValueError("Canonical content drift: " + name + "; review changes and refresh inventory deliberately.")
        body = (folder / "SKILL.md").read_text(encoding="utf-8-sig")
        front = body.split("---", 2)
        if len(front) < 3 or not re.search(r"^name:\s*[\"']?" + re.escape(name) + r"[\"']?\s*$", front[1], re.M) or not re.search(r"^description:\s*\S", front[1], re.M):
            raise ValueError("Invalid standard frontmatter: " + name)
        for markdown in folder.rglob("*.md"):
            content = markdown.read_text(encoding="utf-8-sig")
            for link in re.findall(r"\]\(([^)]+)\)", content):
                target = link.split("#", 1)[0]
                if not target or ":" in target or "*" in target or " " in target or target.startswith("/"):
                    continue
                if target.endswith(".md") and not (markdown.parent / target).resolve().is_file():
                    raise ValueError("Broken local reference: " + str(markdown.relative_to(root)) + " -> " + target)
    return data


def state_path(root):
    return root / ".stabilization-local/agent-skill-adapters.json"


def sync(root, hosts):
    data = validate(root)
    state_file = state_path(root)
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    # Preflight every destination before any writes. Existing non-owned content
    # is never adopted, overwritten or deleted by this bootstrap.
    jobs = []
    for host in hosts:
        for item in data["skills"]:
            relative = HOSTS[host] + "/" + item["name"]
            target = contained(root, relative)
            if target.exists() and (relative not in state or hashes(target) != state[relative]):
                raise ValueError("Refusing unmanaged/modified host skill: " + relative)
            if relative in state and target.exists() and set(hashes(target)) - set(item["files_sha256"]):
                raise ValueError("Reviewed update removes files; remove the owned adapter first: " + relative)
            jobs.append((item, relative, target))
    for item, relative, target in jobs:
        source = root / ".agents/skills" / item["name"]
        for name in item["files_sha256"]:
            destination = target / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / name, destination)
        state[relative] = hashes(target)
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generated_complete_host_copies": len(jobs), "hosts": hosts, "native_discovery": "not established by copying"}))


def check_adapters(root=ROOT):
    path = state_path(root)
    if not path.exists():
        return 0
    state = json.loads(path.read_text(encoding="utf-8"))
    canonical = {item["name"]: item["files_sha256"] for item in inventory(root)["skills"]}
    for relative, expected in state.items():
        if not any(relative.startswith(prefix + "/") for prefix in HOSTS.values()):
            raise ValueError("Unexpected adapter state path")
        if relative.rsplit("/", 1)[-1] not in canonical or hashes(contained(root, relative)) != expected or expected != canonical[relative.rsplit("/", 1)[-1]]:
            raise ValueError("Generated adapter drift: " + relative)
    return len(state)


def remove_adapters(root, hosts):
    state_file = state_path(root)
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    selected = [(key, value) for key, value in state.items() if any(key.startswith(HOSTS[h] + "/") for h in hosts)]
    for relative, expected in selected:
        target = contained(root, relative).resolve()
        for name in expected:
            contained(target, name)
        if not target.is_relative_to(root.resolve()) or hashes(target) != expected:
            raise ValueError("Refusing removal of modified/out-of-root adapter: " + relative)
    for relative, expected in selected:
        target = root / relative
        for name in expected:
            (target / name).unlink()
        for directory in sorted((p for p in target.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
            directory.rmdir()
        target.rmdir()
        del state[relative]
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"removed_owned_host_copies": len(selected)}))


def setup_runtime(which):
    base = contained(ROOT, ".stabilization-local/agent-tools")
    base.mkdir(parents=True, exist_ok=True)
    if which == "graphify":
        if os.name != "nt" or sys.version_info[:2] != (3, 14):
            raise ValueError("This wheel lock is Windows x64/Python 3.14. Review a platform lock before setup elsewhere.")
        environment = base / "graphify"
        python = environment / "Scripts/python.exe"
        if not python.exists():
            subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True)
        subprocess.run([str(python), "-m", "pip", "install", "--only-binary=:all:", "--require-hashes", "-r", str(ROOT / ".agents/runtime/graphify-requirements-windows-py314.txt")], check=True)
    else:
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise ValueError("Node/npm is required; this script does not install or upgrade it.")
        runtime = base / "playwright"
        runtime.mkdir(exist_ok=True)
        for name in ["package.json", "package-lock.json"]:
            source = ROOT / ".agents/runtime/playwright" / name
            target = runtime / name
            if target.exists() and target.read_bytes() != source.read_bytes():
                raise ValueError("Existing isolated runtime manifest differs: " + name)
            shutil.copyfile(source, target)
        subprocess.run([npm, "ci", "--prefix", str(runtime), "--ignore-scripts", "--no-audit", "--no-fund"], check=True)


def self_test():
    parent = ROOT / ".stabilization-local"
    parent.mkdir(exist_ok=True)
    fixture = Path(tempfile.mkdtemp(prefix="skill-sync-fixture-", dir=parent)).resolve()
    if not fixture.is_relative_to(parent.resolve()):
        raise ValueError("Invalid fixture path")
    skill = fixture / ".agents/skills/fixture"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: fixture\ndescription: Synthetic sync test only\n---\nFixture\n", encoding="utf-8")
    data = {"skills": [{"name": "fixture", "files_sha256": hashes(skill)}]}
    (fixture / ".agents/skill-inventory.json").write_text(json.dumps(data), encoding="utf-8")
    sync(fixture, ["claude"])
    generated = fixture / ".claude/skills/fixture/SKILL.md"
    generated.write_text("Unrelated user edit", encoding="utf-8")
    try:
        sync(fixture, ["claude"])
    except ValueError:
        if generated.read_text(encoding="utf-8") != "Unrelated user edit":
            raise AssertionError("Modified content was overwritten")
    else:
        raise AssertionError("Modified adapter was not rejected")
    print("PASS: isolated adapter copy and no-overwrite negative control; no user tool state touched.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validate"); sub.add_parser("self-test")
    for name in ["sync", "remove-adapters"]:
        p = sub.add_parser(name); p.add_argument("--agents", nargs="+", choices=HOSTS, required=True)
    p = sub.add_parser("setup-runtime"); p.add_argument("--runtime", choices=["graphify", "playwright"], required=True)
    args = parser.parse_args()
    if args.command == "validate":
        data = validate(); copies = check_adapters()
        print(json.dumps({"canonical_skills": len(data["skills"]), "owned_copies_checked": copies, "status": "PASS", "host_discovery": "requires host UI/CLI verification"}))
    elif args.command == "sync": sync(ROOT, args.agents)
    elif args.command == "remove-adapters": remove_adapters(ROOT, args.agents)
    elif args.command == "self-test": self_test()
    else: setup_runtime(args.runtime)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
