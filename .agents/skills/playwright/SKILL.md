---
name: playwright
description: Automates an authorized real-browser workflow for navigation, forms, snapshots, screenshots, and UI debugging with the pinned project-local Playwright CLI. Use for browser interaction; use the existing Playwright test suite when an assigned task needs regression test files.
license: Apache-2.0
metadata:
  author: OpenAI; Lerna portability adaptation
---

# Playwright browser workflow

Use the local cross-platform runner from the repository root:

```text
python .agents/skills/playwright/scripts/playwright_cli.py --help
python .agents/skills/playwright/scripts/playwright_cli.py open http://127.0.0.1:3100 --browser=chrome
python .agents/skills/playwright/scripts/playwright_cli.py snapshot
python .agents/skills/playwright/scripts/playwright_cli.py click e3
python .agents/skills/playwright/scripts/playwright_cli.py close
```

If the isolated CLI is missing, report the prerequisite or, during an
authorized tooling setup, run `python scripts/agent_skills.py setup-runtime
--runtime playwright`. Do not install global packages or resolve `latest`.
The pin is separate from application dependencies. Run `--help` and command
help for the installed version before relying on a flag.

Snapshot before using element refs; re-snapshot after navigation, modal/tab
changes or a stale-ref failure. Assert user-visible outcomes. Capture console
and network evidence for a reproduced defect. Prefer named commands to code
evaluation; do not invent refs or use evaluation to bypass a missing snapshot.
Read [CLI commands](references/cli.md) or [workflows](references/workflows.md)
only as needed. Their `pwcli` shorthand means this project's Python runner.

The runner chooses a worktree-specific session and an ignored working folder.
It does not restore or import user authentication automatically. Use only
authorized targets and disposable identities; keep traces, screenshots,
cookies and storage out of Git. Close the owned browser session when done.
An empty or reused context is not a fresh-login test. Local mocked tests do
not establish hosted Auth/provider correctness. Never make paid AI calls as
a browser installation check.

Provenance: OpenAI `skills` revision
`49f948faa9258a0c61caceaf225e179651397431`, with Apache-2.0 license retained.
Local adaptation replaces Codex-home/Bash/global-npx installation steps with
a pinned project runtime; both upstream reference documents remain bundled.
