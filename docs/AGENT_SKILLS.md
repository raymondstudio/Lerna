# Portable Lerna coding skills

Installed on 2026-10-29 in the `security/stabilization` integration checkout. Open this checkout in your coding tool; the separate main checkout and global tool configuration were not changed. Portability means shared readable bundles plus supported host adapters. It does not guarantee that every AI coding product implements native skill discovery.

## Installed inventory

| Bundle | Source / status |
| --- | --- |
| Graphify | Graphify-Labs/graphify at `0a8cd4e1`; attributed structural-only adapter; graphifyy 0.9.97 |
| React best practices | vercel-labs/agent-skills at `1a2c79d4`; complete references; three upstream generated relative links corrected |
| Web design guidelines | Same skill source; pinned guidelines at `434b7f91`; local resource replaces unpinned fetch |
| Security best practices | openai/skills at `49f948fa`; complete references and Apache license |
| Playwright | Same OpenAI revision; complete references, local cross-platform runner replaces global npx/Codex-home instructions |
| Supabase | Existing repository bundle reused unchanged, version 0.1.2; upstream revision/license unverified |
| Supabase Postgres best practices | Existing repository bundle reused unchanged, version 1.1.1; MIT frontmatter |

Full revisions, file SHA256 values (UTF-8 text normalizes CRLF to LF for Windows checkout portability), source locations, adaptations and license declarations are recorded in `.agents/skill-inventory.json`. Graphify includes upstream licenses and notice; OpenAI bundles include their license. Vercel skill licensing declarations and the separate guidelines MIT license are retained. Existing video skills remain in place and are outside this selected inventory.

The Apple community candidate at `c95fa132` was reviewed but **not installed**: no verified license was present. Official Apple HIG is linked in routing. Next's `next-dev-loop` was reviewed but not installed because it requires additional browser tooling/upgrades. Next.js guidance comes from the installed project docs. Debugging, observability and AI/RAG use project evidence and official docs; these are documentation categories, not installed skills.

## Host routing and verification limits

| Host | Project entry point | Status |
| --- | --- | --- |
| Codex / generic AGENTS readers | `AGENTS.md`, `.agents/skills` | Files validated; new skills enter a future session's discovery |
| Cursor | `.agents/skills`, `.cursor/rules/lerna-skill-routing.mdc` | Canonical path documented; CLI 3.24.18 detected; native list/invocation not verified |
| Antigravity | `.agents/skills`, root `AGENTS.md` | Paths documented; application discovery not verified |
| Claude Code | `CLAUDE.md`, generated `.claude/skills` | Complete copies validated; VS Code extension 2.1.312 detected; native list/invocation not verified |
| Cline | `.clinerules/lerna-skill-routing.md`, generated `.cline/skills` | Complete copies validated; VS Code extension 4.1.26 source recognizes both canonical and legacy paths; native precedence/invocation not verified |
| GitHub Copilot | `.agents/skills`, `.github/copilot-instructions.md` | Paths documented; installed host discovery not verified |
| Gemini CLI | `.agents/skills`, `GEMINI.md` | Alias documented; CLI not detected; native discovery not verified |
| Other coding tools | Read `AGENTS.md` and `docs/AGENT_SKILL_ROUTING.md` | Manual readable guidance; configure a supported project entry point if needed |

Open this checkout, reload the editor and inspect its skill/customization list. Confirm the seven selected names and read one referenced resource before claiming native invocation. Cline may prefer one of several compatible directories; use its native list to confirm deduplication. If its canonical discovery suffices, remove only the generated Cline copies with the command below. No paid agent invocation was made merely to claim compatibility. No extension, editor or global skill configuration was installed or modified.

Canonical source is `.agents/skills`; host copies are ignored generated complete bundles. Do not independently edit host copies. Small tracked adapters point to `docs/AGENT_SKILL_ROUTING.md`. These instructions cannot grant permission to mutate production or override the user's request.

## Reproduce and update

From the integration checkout, using Python 3.14 on Windows:

```text
python scripts/agent_skills.py validate
python scripts/agent_skills.py setup-runtime --runtime graphify
python scripts/agent_skills.py setup-runtime --runtime playwright
python scripts/agent_skills.py sync --agents claude cline
python scripts/agent_skills.py self-test
python scripts/check_agent_skill_fixtures.py
```

The first validate command works without installed runtimes. Graphify's runtime lock is Windows x64 / CPython 3.14: 31 pinned wheels with hashes, including graphifyy 0.9.97. Other platforms require a reviewed platform lock; the Markdown bundles remain portable. No system Python packages are installed. Playwright uses Node/npm and local `@playwright/cli` 0.1.22, with its locked upstream Playwright 1.64.0 alpha dependency. This isolated tooling dependency is separate from the application. Setup uses `npm ci --ignore-scripts`; it does not install browsers. Chrome was already available for the fixture.

Runtimes, graph artifacts, generated ownership state and browser outputs live under ignored `.stabilization-local/`. Explicit setup can access package registries. Skill invocation does not automatically install or upgrade tools. Graphify runs the reviewed structural extraction API rather than the upstream CLI's automatic global skill registration. Extraction blocks network/subprocess activity and omits semantic providers, hooks, watchers and servers.

For updates, review upstream provenance/license and the complete diff first, then intentionally regenerate the inventory file hashes. Validate canonical files before syncing. Sync refuses unmanaged or modified target directories; it never adopts or overwrites an unrelated existing bundle. Do not resolve a refusal by deleting user content.

To remove this installation's generated copies:

```text
python scripts/agent_skills.py remove-adapters --agents claude cline
```

Removal requires the ignored ownership record and unchanged hashes, preflights project containment, and removes only recorded files. If ownership state is missing or files changed, inspect manually. Tracked canonical bundles, routing and manifests can be removed in a reviewed Git change; preserve existing Supabase/video bundles and the Next-generated AGENTS block. Review ignored runtime paths before deleting them; there is no automatic broad uninstall.

## Evidence and limits

Synthetic TypeScript `add` / `twice` modules produced four nodes and five relationships, including the expected import and call edge. Query/path helpers worked. Private-input and stale-index negative controls passed. A temporary local HTTP fixture opened in a fresh nonpersistent Chrome context, exposed a button in a snapshot, accepted a click and displayed its resulting state. The owned browser session was closed. Adapter copying and refusal to overwrite a changed file passed; canonical references and generated hashes passed.

Only synthetic files were indexed. No Lerna application graph or private content was processed. Fixture outcomes are stored locally in `.stabilization-local/agent-skill-fixtures.json`; graph provenance includes source hashes and revision. Graphify query/path are small Lerna navigation helpers, not semantic reasoning claims. These checks establish tooling operation, not application security, database policy correctness or full browser journeys.

Application source, root dependencies/lockfile, schema, credentials, hosted services and production were not changed by this setup. The pre-existing `next-env.d.ts` modification was excluded. No push, deployment or paid provider call occurred.

## Official compatibility references

- Cursor: https://cursor.com/docs/skills
- Antigravity: https://www.antigravity.google/docs/skills?tab=ide and https://antigravity.google/docs/rules/
- Claude: https://code.claude.com/docs/en/skills
- Cline: https://docs.cline.bot/customization/skills
- Copilot: https://docs.github.com/en/copilot/concepts/customizations/agent-skills
- Gemini: https://geminicli.com/docs/cli/skills/
- Portable format: https://agentskills.io/home
