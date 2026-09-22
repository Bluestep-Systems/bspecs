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

- `skills/` — `/b6p-setup` (machine, project and update in one run), the `/b6p-*` platform CLI skills, the `/spec-*`
  workflow, `quick-task`, `task-comment`, `bspecs-feedback`, and `bluestep-reference` (the on-demand
  platform reference).
- `agents/` — BlueStep subagents (`b6p-task-implementer`, `b6p-commenter`, `b6p-code-review`).
- `hooks/` — one guardrail hook (block-generated-files) and the session canary (canary.sh: warns once at start if no JSON parser is on PATH; nudges once when a folder holds components but no rules file).
- `.mcp.json` — bundles the `bluestep-gateway` MCP server for in-session `[PLATFORM]` authoring
  (auto-registers once the plugin is enabled and `$B6PT_TOKEN` is set).

Usage, setup (`/b6p-setup`), and the release process are documented in the
[repo README](../README.md).

## Requirements

The `/b6p-*` skills invoke a bare `b6p` on PATH — install the b6p-cli standalone artifact first.
