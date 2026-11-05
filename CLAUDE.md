# bluestep-ai — BlueStep tooling for spec-driven development

This repo (`Bluestep-Systems/bluestep-ai`) ships BlueStep's agent plugins: **`bluestep-tools`**
(Claude Code, Cursor, Codex) sets up BlueStep projects with skills, subagents, hooks, an on-demand
platform reference, and spec-driven conventions; **`phi-guard`** is the opt-in write-time
client-data hook; **`core-tools`** is the base workflow set for non-BlueStep repos (Claude Code
only). It is a plain git repo — no npm package, no binary — and doubles as **three marketplaces**.
All tooling lives in `plugins/`. The repo was called `bspecs` until phase 2 of
`tooling-repo-consolidation.md`; old registrations reach it through GitHub's redirect, so no repo
may ever take the old name again.

**Every "why" below is an ADR.** `docs/decisions/` is the source of truth for the reasoning; this
file carries only what a session needs before touching anything.

## Architecture

```text
.claude-plugin/marketplace.json   ← Claude Code marketplace ("bluestep"): the three plugins (one-tools is internal since phase 3)
.cursor-plugin/marketplace.json   ← GENERATED Cursor marketplace, serves dist/cursor/
.agents/plugins/marketplace.json  ← GENERATED Codex marketplace, serves dist/codex/
plugins/<name>/                   ← THE SOURCE OF TRUTH — author only here
  .claude-plugin/plugin.json      ← manifest: `version` (one stream per plugin), `crossTool` (true → Cursor/Codex)
plugins/bluestep-tools/           ← crossTool true
  skills/                         ← one folder per skill, incl. bluestep-reference (the platform reference)
  agents/                         ← three subagents
  hooks/                          ← hooks.json + block-generated-files, tab-guard, canary, lib/hook-input.sh
  .mcp.json                       ← bundles the bluestep-gateway MCP server ($B6PT_TOKEN)
plugins/phi-guard/                ← crossTool true — hooks/phi-guard.sh + hooks/lib/{hook-input,phi-detect}.sh
plugins/core-tools/               ← crossTool false (Claude Code only) — skills/, lane/, docs/, tools/
tools/gen-cross-tool/             ← the generator over plugins/* — npm run gen / gen:check
dist/{cursor,codex}/<name>/       ← GENERATED per crossTool plugin, committed, never hand-edited
.github/workflows/                ← ci.yml, release-tag.yml, publish.yml (manual-tag path)
```

Plugins serve content **verbatim** — there is no `{{VAR}}` templating anywhere in `plugins/`. The
per-project files that need substitution ship with `/b6p-setup` and are filled in
conversationally.

## Key behaviors

- **One source, three surfaces.** `plugins/**` is the only place content is authored; `npm run gen`
  emits the committed `dist/` trees and the two generated marketplace manifests for every
  `crossTool: true` plugin. CI's `cross-tool-drift` job regenerates and diffs, so stale or
  hand-edited output cannot merge. → `cross-tool-plugin-output.md`
- **Hooks.** bluestep-tools has two guardrails (`PreToolUse`: `block-generated-files`; and
  `tab-guard`, Claude Code only, which asks before a browser script runs a GraphQL mutation) plus
  `canary.sh` (`SessionStart`, Claude Code only; it also nudges when a project runs the git
  client-data check but phi-guard is not installed). The **phi-guard plugin** blocks a write that
  looks like real client data in a B6P project; the git hooks `/b6p-setup` copies into projects
  are separate. The detector has two copies that must match —
  `plugins/phi-guard/hooks/lib/phi-detect.sh` and
  `plugins/bluestep-tools/skills/b6p-setup/assets/phi-guard/phi-detect.sh` (same for the two
  `hook-input.sh`); `gen:check` and `test:hooks` fail when they differ → `client-data-guard.md`.
  Hooks run in **whatever shell hosts the agent — Git Bash on Windows, not WSL** — so they must
  not assume `jq` or WSL tools; that assumption is why they silently allowed everything for 77
  days. Parser fallback is jq → python3 → python → node, and the guardrails **fail closed**.
- **Everything else: read the skill file for what it does, the ADR for why.** Gateway MCP and
  `[PLATFORM]` authoring → `platform-mcp-integration.md` and the single-source procedure page
  `plugins/bluestep-tools/skills/bluestep-reference/conventions/mcp-platform-authoring.md`. Bare
  `b6p` → `b6p-cli-distribution.md`. `/b6p-setup` (one skill for machine, project and update since 0.37.0; why migrations are
  catalogue assets, not steps in the skill) → `per-project-migrations.md`. On-demand reference, no
  `@`-imports → `instruction-tree-and-claude-only.md`. Delegated `/spec-execute` →
  `subagents-and-delegated-execution.md`. `/bspecs-feedback` intake and its close-email path →
  `feedback-intake-bluehq-endpoint.md`. Several plugins in one repo, phi-guard opt-in, phase order
  → `tooling-repo-consolidation.md`.

## Editing the plugins

- Skills are `plugins/<name>/skills/<skill>/SKILL.md`, verbatim markdown, bundled resources
  referenced via `${CLAUDE_PLUGIN_ROOT}`. Subagents are `plugins/<name>/agents/<agent>.md` with
  `name`/`description`/`tools` frontmatter and an optional generic `model` alias.
- The platform reference is `plugins/bluestep-tools/skills/bluestep-reference/`. A new topic file
  needs a matching one-line entry in its `SKILL.md`. **Every committed reference file is
  category-level only** — no literal customer names, org subdomains, file IDs, employee names,
  domain/sector terms, or business figures. → `content-sanitization-for-public-tooling.md`
- Skills and agents point at the reference's bundled files rather than restating platform rules.
- After any change under `plugins/**` or the emitter, **run `npm run gen`** and commit the
  regenerated output. It runs natively from PowerShell or Git Bash on this checkout (LF via
  `.gitattributes`); no WSL.
- A new `.sh` needs its executable bit **in the index**: this checkout has `core.fileMode=false`,
  so `chmod +x` alone does nothing — run `git update-index --chmod=+x` on the script in its
  `plugins/<name>/` folder and on its copies under `dist/cursor/<name>/` and `dist/codex/<name>/`
  (`hooks/shared/`, `hooks/shared/lib/` for a lib script, or the same skill path). The same goes
  for a script under `skills/*/assets/` (the `phi-guard` git hooks); the emitters give any skill
  file that starts with `#!` mode 755.
- Run `npm run test:hooks` (PowerShell or Git Bash) after touching a hook.

## Running / testing

No automated suite. By hand: add the in-repo marketplace, install the plugins into a scratch
project, and confirm the skills appear, the Edit/Write guardrail hooks fire, and
`bluestep-reference` serves files on demand; then `/b6p-setup` in a scratch dir writes the root
files and a plugin-enabling `.claude/settings.json` with no hooks block.

## Working on tasks

Before substantive changes (implement / add / fix / refactor), skim the latest 3 `## [...]`
blocks of `plugins/bluestep-tools/CHANGELOG.md` (`plugins/core-tools/CHANGELOG.md` for a
core-tools task), and report any match — already planned, already shipped, or covered by an
ADR — before starting. Skip for questions and trivial edits.

When a task is done and the user confirms, **propose** a commit message (title + body) from the
diff. Do not run `git commit` unless the user says so.

## Releasing

A release **is** a `version` bump in a plugin's `plugins/<name>/.claude-plugin/plugin.json`
merged to `main` — CI tags that plugin `<name>-v<version>` (old `plugin-v*` tags count for
bluestep-tools) and cuts its GitHub Release, so never push a tag by hand. A merge without a bump
ships nothing for that plugin; a change under `tools/gen-cross-tool/**` needs a bump of every
`crossTool: true` plugin; a plugin's own `CHANGELOG.md` needs no bump. Full procedure:
**Releasing** under "For maintainers" in `README.md`.

## ClickUp

Feedback lives on AI.List (`901414350506`), plugin items tagged `ai-plugin`. Use the REST API, not
the MCP, for anything beyond one task; the token is `$CLICKUP_TOKEN`, set in the Windows user
environment (not WSL). Calls, paging, write endpoints and the close-out order are in
`.claude/skills/bspecs-triage/SKILL.md` → "ClickUp REST API"; that skill owns triage. An
unattended bot triages each new intake — its `🤖 [intake-triage]` comments, lane moves and
`automation = candidate` values are **proposals** an interactive session may overturn, and it never
closes anything (skill → "Unattended half").
