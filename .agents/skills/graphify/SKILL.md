---
name: graphify
description: Maps cross-module code relationships and architecture impact using a bounded local Graphify structural index. Use for dependency/data-flow navigation when a relevant fresh index helps; direct source reading remains appropriate for small edits.
license: Apache-2.0
metadata:
  author: Graphify-Labs; Lerna portability adaptation
  version: 0.9.97-lerna.1
---

# Graphify — local structural workflow

This project adaptation uses Graphify's real deterministic extraction API.
It does not activate upstream's automatic installer, global registration,
query-first hooks, semantic agents, provider backends or watchers.
Read [the scope and provenance](references/local-workflow.md) before building.

Run from the project root, using the shell's Python command (`python` or
`python3`):

```text
python .agents/skills/graphify/scripts/graphify_local.py status
python .agents/skills/graphify/scripts/graphify_local.py smoke
python .agents/skills/graphify/scripts/graphify_local.py build --scope auth --files src/lib/auth/return-path.ts src/lib/auth/require-active-user-api.ts
python .agents/skills/graphify/scripts/graphify_local.py query --scope auth --text auth
python .agents/skills/graphify/scripts/graphify_local.py path --scope auth --start NODE_ID --end NODE_ID
```

`build` requires an explicit small file list; it never defaults to indexing
the repository. The helper uses the isolated pinned runtime and blocks
network/subprocess operations during extraction. A missing runtime is an
explicit setup requirement: `python scripts/agent_skills.py setup-runtime
--runtime graphify`. Never auto-install or upgrade it during a coding task.

Queries and paths are simple local navigation over Graphify output, not LLM
answers. Preserve extracted/inferred confidence and source locations. Check
the recorded file hashes and Git revision before trusting an index; rebuild
the same bounded scope after relevant changes (unchanged parser inputs use
Graphify's cache). Validate security/ownership conclusions in authoritative
source and migrations. Do not infer runtime authorization from graph edges.

Any semantic extraction, broader corpus, SQL extra, MCP connection or hosted
service needs a separately assigned task and reviewed configuration. A host
without shell/file access can read the bundle but cannot execute this runtime.
