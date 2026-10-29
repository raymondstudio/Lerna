# Local workflow and attribution

Upstream: https://github.com/Graphify-Labs/graphify
Reviewed revision: `0a8cd4e1e342235fe53e881fb5d591bf0460071f` (v8).
Distribution: `graphifyy==0.9.97`; executable: `graphify`.
License: Apache-2.0, with upstream MIT/NOTICE material retained alongside it.

The published wheel's 96 Python files matched the reviewed source (line-ending
normalization only); its SHA256 is recorded in the project inventory/runtime
requirements. The base runtime includes its declared tree-sitter grammars;
optional semantic/cloud/database/watch extras are not installed.

This is an attributed Lerna adapter, not an unchanged upstream skill. The
stock generic skill is Bash-oriented, mandates host-specific Agent tools,
offers unpinned installs and a break-system-packages fallback, and requests
semantic extraction. Those instructions are not installed as active guidance.
The complete resources for this structural-only adapter are this document,
the helper, and retained license notices. The original reviewed source stays
in the ignored review checkout, not a second active skill.

The helper calls `graphify.extract.extract(paths, cache_root=root, root=root,
parallel=False)`, the same API used by upstream structural extraction. It
accepts at most 40 explicit Python/JS/TS files, at most 512 KiB per file and
5 MiB total. It rejects symlinks, private/generated directories and non-code
inputs. JSON/cache output lives under ignored `.stabilization-local/graphify`.
Its query/path commands are Lerna's deterministic navigation helpers and are
not substitutes for upstream's semantic/query CLI. No HTML renderer or graph
service is started. `smoke` indexes only two synthetic TypeScript modules.

Index contents can still reveal source relationships: keep outputs private.
The runtime lock targets the tested Windows/Python 3.14 environment. Another
OS/Python must have a separately reviewed compatible wheel lock; skill text
portability does not install runtimes on remote/cloud machines.
