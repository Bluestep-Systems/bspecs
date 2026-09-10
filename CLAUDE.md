# bspecs — BlueStep tooling for spec-driven development

This repo ships **`bluestep-tools`**, an agent plugin (Claude Code, Cursor, Codex) that sets up
BlueStep projects with skills, subagents, hooks, an on-demand platform reference, and spec-driven
conventions. It is a plain git repo — no npm, no binary — and doubles as **three marketplaces**.
The old npm CLI (`cli.js`, `src/*`) is **dormant**: it loads but scaffolds nothing, and
`templates/` is empty because all tooling moved into `plugin/`.

**Every "why" below is an ADR.** `docs/decisions/` is the source of truth for the reasoning; this
file carries only what a session needs before touching anything.

## Architecture

```text
.claude-plugin/marketplace.json   ← Claude Code marketplace ("bluestep"), source: ./plugin
.cursor-plugin/marketplace.json   ← GENERATED Cursor marketplace, serves dist/cursor/
.agents/plugins/marketplace.json  ← GENERATED Codex marketplace, serves dist/codex/
plugin/                           ← THE SOURCE OF TRUTH — author only here
  .claude-plugin/plugin.json      ← manifest; its `version` is the ONE shared version stream
  skills/                         ← one folder per skill, incl. bluestep-reference (the platform reference)
  agents/                         ← three subagents
  hooks/                          ← hooks.json + block-generated-files, block-tsc, canary
  .mcp.json                       ← bundles the bluestep-gateway MCP server ($B6PT_TOKEN)
tools/gen-cross-tool/             ← the generator — npm run gen / gen:check
dist/cursor/, dist/codex/         ← GENERATED, committed, never hand-edited
.github/workflows/                ← ci.yml, release-tag.yml, publish.yml (manual-tag path)
cli.js, src/, templates/          ← DORMANT / empty
```

Plugins serve content **verbatim** — there is no `{{VAR}}` templating anywhere in `plugin/`. The
per-project files that need substitution ship with `/project-init` and are filled in
conversationally.

## Key behaviors

- **One source, three surfaces.** `plugin/**` is the only place content is authored; `npm run gen`
  emits the committed `dist/` trees and the two generated marketplace manifests. CI's
  `cross-tool-drift` job regenerates and diffs, so stale or hand-edited output cannot merge.
  → `cross-tool-plugin-output.md`
- **Hooks** are two guardrails (`block-generated-files`, `block-tsc`, `PreToolUse`) plus
  `canary.sh` (`SessionStart`, Claude Code only). They run in **whatever shell hosts the agent —
  Git Bash on Windows, not WSL** — so they must not assume `jq` or WSL tools; that assumption is
  why they silently allowed everything for 77 days. Parser fallback is jq → python3 → python →
  node, and the guardrails **fail closed**.
- **Everything else: read the skill file for what it does, the ADR for why.** Gateway MCP and
  `[PLATFORM]` authoring → `platform-mcp-integration.md` and the single-source procedure page
  `plugin/skills/bluestep-reference/conventions/mcp-platform-authoring.md`. Bare `b6p` →
  `b6p-cli-distribution.md`. `/b6p-init`, `/project-init`, `/b6p-update` (and why migrations are
  catalogue assets, not steps in the skill) → `per-project-migrations.md`. On-demand reference, no
  `@`-imports → `instruction-tree-and-claude-only.md`. Delegated `/spec-execute` →
  `subagents-and-delegated-execution.md`. `/bspecs-feedback` intake and its close-email path →
  `feedback-intake-bluehq-endpoint.md`.

## Editing the plugin

- Skills are `plugin/skills/<name>/SKILL.md`, verbatim markdown, bundled resources referenced via
  `${CLAUDE_PLUGIN_ROOT}`. Subagents are `plugin/agents/<name>.md` with `name`/`description`/
  `tools` frontmatter and an optional generic `model` alias.
- The platform reference is `plugin/skills/bluestep-reference/`. A new topic file needs a matching
  one-line entry in its `SKILL.md`. **Every committed reference file is category-level only** — no
  literal customer names, org subdomains, file IDs, employee names, domain/sector terms, or
  business figures. → `content-sanitization-for-public-tooling.md`
- Skills and agents point at the reference's bundled files rather than restating platform rules.
- After any change under `plugin/**` or the emitter, **run `npm run gen` inside WSL** and commit
  the regenerated output. From Windows over `\wsl.localhost` it emits a wrong relative path and
  cannot record the executable bit, and the drift job fails.
- A new `hooks/*.sh` needs its executable bit **in the index**: this checkout has
  `core.fileMode=false`, so `chmod +x` alone does nothing — run `git update-index --chmod=+x` on
  the script and on its two `dist/*/hooks/shared/` copies.
- Run `npm run test:hooks` (WSL) after touching a hook.

## Running / testing

No automated suite. By hand: add the in-repo marketplace, install the plugin into a scratch
project, and confirm the skills appear, the two guardrail hooks fire on Edit/Write/Bash, and
`bluestep-reference` serves files on demand; then `/project-init` in a scratch dir writes the root
files and a plugin-enabling `.claude/settings.json` with no hooks block.

## Working on tasks

Before substantive changes (implement / add / fix / refactor), skim `TODO.md` (open `[ ]` items)
and the latest 3 `## [x.y.z]` blocks of `CHANGELOG.md`, and report any match — already planned,
already shipped, or covered by an ADR — before starting. Skip for questions and trivial edits.

When a task is done and the user confirms, **propose** a commit message (title + body) from the
diff. Do not run `git commit` unless the user says so.

## Releasing

A release **is** a `version` bump in `plugin/.claude-plugin/plugin.json` merged to `main` — CI
tags it and cuts the GitHub Release, so never push a tag by hand, and a merge without a bump ships
nothing to any tool. Full procedure: **Releasing** under "For maintainers" in `README.md`.

## ClickUp

Feedback lives on AI.List (`901414350506`), plugin items tagged `ai-plugin`. Use the REST API, not
the MCP, for anything beyond one task; the token is `$CLICKUP_TOKEN` from `~/.profile` in WSL.
Calls, paging, write endpoints and the close-out order are in
`.claude/skills/bspecs-triage/SKILL.md` → "ClickUp REST API"; that skill owns triage. An
unattended bot triages each new intake — its `🤖 [intake-triage]` comments, lane moves and
`automation = candidate` values are **proposals** an interactive session may overturn, and it never
closes anything (skill → "Unattended half").
