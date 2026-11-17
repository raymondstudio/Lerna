# Lerna portable skill routing

Read the relevant skill in `.agents/skills/<name>/SKILL.md`, including referenced resources, only when the task needs it. This routing supplements the repository instructions and the user's request; it grants no production, credential, paid-provider, or application-change authority.

| Task | Skill / reference |
| --- | --- |
| Architecture navigation or bounded impact mapping | `graphify`; explicit file scope, structural extraction only; check freshness and confirm against source |
| React rendering and performance | `vercel-react-best-practices` |
| UI accessibility and interaction review | `web-design-guidelines` |
| Security review and secure implementation | `security-best-practices` plus relevant Supabase guidance |
| Incremental audit knowledge and Graphify finding overlay | Read `docs/audit/README.md`, `docs/audit/decisions.md`, `docs/audit/findings.json`, `docs/audit/coverage.json`; query with `python -B scripts/audit_knowledge.py validate\|stale\|open\|file\|symbol` |
| Supabase Auth, storage, policies, schema | Existing `supabase`; `supabase-postgres-best-practices` for SQL |
| Browser reproduction and UI verification | `playwright`; project-local runner and disposable contexts |
| Next.js APIs and architecture | Installed `node_modules/next/dist/docs/` (project baseline 16.4.1); root AGENTS.md |
| Apple design principles | Official https://developer.apple.com/design/human-interface-guidelines/ ; community candidate held for missing license |
| Debugging, observability and AI/RAG | Repository evidence and official framework/provider docs; no extra skill installed for these categories |

Preserve protected chat behavior, model/prompts, familiar navigation and existing stabilization boundaries. A skill recommendation alone does not justify replacing React Query, adding SWR, changing dependencies or adding background services. Next `after()` is not a substitute for durable transactional events. Do not apply migrations or use hosted credentials merely to demonstrate a skill.

Graphify is optional navigation assistance, not proof of authorization, correctness or runtime behavior. Never automatically index the entire repository, secrets, uploads, private documents or generated output. No semantic extraction, provider calls, hooks, watchers or MCP server are configured.

Canonical bundles and provenance: `.agents/skill-inventory.json`. Setup, validation, compatibility limits and removal: `docs/AGENT_SKILLS.md`. Generated host copies must be synchronized using `python scripts/agent_skills.py sync --agents claude cline`; never edit them independently.
