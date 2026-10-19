# M0 tooling source checkpoint — 19 October 2026

Base: `35914eb39c4f1fdb79666c5829d28ca4f17841f4`; isolated branch `security/stabilization`.

Independent reviewer: security/auth specialist, who did not author dependency files,
runner configuration or local-font integration. Source review found matching package
and lock specifications, Next/config 16.4.1, Node security/persistence/activity suites
included in `npm test`, correct Vitest alias and strict ESLint with no rule waivers.
The existing font families/variables/styles remain; assets and OFL licenses are bundled.

`npm install` recovered the dependency tree after the disk/network failures. This was
not a clean `npm ci` reproduction. Earlier integrated runs passed 55 Node tests and
78 Vitest assertions before later review corrections. Full strict lint/typecheck/build
and clean checkout reproduction remain completion gates, not waived by this checkpoint.

The reviewer found additional parser tracing requirements. Those changes are excluded
from this tooling commit and remain subject to source review and traced-runtime tests.
Docker installation failed with Windows `0x80073cfc`; Supabase's optional Windows CLI
binary was unavailable. Actual local Auth/Storage/mailbox/browser flows remain blocked.

Dependencies were checked against the official [Next October update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
KaTeX is pinned to the patched 0.19.0 line. Remaining transitive advisories require a
final inventory and reachability assessment; no blanket vulnerability-free claim is made.
