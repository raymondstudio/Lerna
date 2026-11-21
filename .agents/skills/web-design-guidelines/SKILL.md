---
name: web-design-guidelines
description: Reviews assigned web UI for accessibility, keyboard/focus, responsive layout, reduced motion and performance using pinned Vercel Web Interface Guidelines.
license: MIT
metadata:
  author: Vercel; Lerna portable pinned-reference adaptation
---

# Web Interface Guidelines

Read [the reviewed guideline snapshot](references/guidelines.md), then inspect
only the assigned surface. Treat cosmetic preferences as guidance; preserve
Lerna branding and existing workflows. Verify keyboard/focus, semantics,
mobile layout, reduced motion and measured performance with an authorized
browser when runtime evidence is needed. Separate observed failures from
source-only concerns; report useful file/line locations.

This bundle pins guidelines instead of fetching unreviewed main on every use.
Updates need deliberate diff/license review. No host-specific WebFetch tool
or runtime package is required. The reference's $ARGUMENTS means the assigned
files, not authorization to change the app.

Skill source: vercel-labs/agent-skills, revision
1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62, MIT declaration in README.
Reference source: vercel-labs/web-interface-guidelines, revision
434b7f91364665f2f733b310ec54809bf8f37937; MIT license retained.
