# bluestep-tools (Claude Code plugin)

The shared BlueStep (B6P) development tooling, distributed as a native Claude Code plugin via the
`bluestep` marketplace (this repo). It supersedes the old "copy a `.claude/**` tree into each
project" model — the plugin is the single source of truth; projects enable it instead of vendoring
a copy.

## Install

```
/plugin marketplace add Bluestep-Systems/bspecs
/plugin install bluestep-tools@bluestep
```

Internal staff normally get it pre-enabled via managed settings (`extraKnownMarketplaces` +
`enabledPlugins`). Updates: `/plugin marketplace update bluestep` (or `autoUpdate`).

## Contents

- `skills/` — `/bluestep-init` (project bootstrap), the `/b6p-*` platform CLI skills, the `/spec-*`
  workflow, `bug-fix`, `task-comment`, `bspecs-feedback`, and `bluestep-reference` (the on-demand
  platform reference).
- `agents/` — BlueStep subagents (`b6p-task-implementer`, `b6p-commenter`, `b6p-code-review`).
- `hooks/` — guardrail hooks (block-generated-files, block-tsc, prettier-on-save).

Usage, project bootstrapping (`/bluestep-init`), and the release process are documented in the
[repo README](../README.md).

## Requirements

The `/b6p-*` skills invoke a bare `b6p` on PATH — install the b6p-cli standalone artifact first.
