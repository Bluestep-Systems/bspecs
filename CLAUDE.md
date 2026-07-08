# bspecs — BlueStep tooling for spec-driven development

This repo ships **`bluestep-tools`**, a **Claude Code plugin** that sets up BlueStep projects with skills, subagents, hooks, an on-demand platform reference, and spec-driven conventions. The plugin is the **single delivery path**: it is distributed via the in-repo public `bluestep` **marketplace** (a plain git repo — no npm, no binary, no build step), and bootstrapping a new project is the plugin's own `/bluestep-init` skill. See `docs/decisions/plugin-distribution.md`.

The old npm CLI (`bspecs new`/`init`/`sync`, `cli.js`/`src/*`) is **dormant**: unpublished, unsupported, kept in the repo as a frozen fallback. It still loads (`node cli.js -v`/`-h`) but scaffolds nothing — `templates/` is now empty because all tooling moved into `plugin/`.

## Architecture

```text
.claude-plugin/
  marketplace.json        ← repo-root marketplace ("bluestep"), lists the plugin (source: ./plugin)
plugin/
  .claude-plugin/
    plugin.json           ← plugin manifest (name "bluestep-tools", version)
  skills/                 ← /b6p-pull, /b6p-push, /b6p-audit, /spec-create, /spec-execute,
                            /spec-status, /quick-task, /task-comment, /bspecs-feedback, /bluestep-init,
                            /bluestep-mcp-connect, /bluestep-vite-report, and bluestep-reference (the on-demand platform reference)
  agents/                 ← three subagents (b6p-task-implementer, b6p-commenter, b6p-code-review)
  hooks/                  ← hooks.json + three scripts (block-generated-files, block-tsc, prettier-on-save)
cli.js, src/              ← DORMANT npm CLI (frozen fallback; loads but scaffolds nothing)
templates/                ← empty (all tooling migrated into plugin/)
```

Plugins serve content **verbatim** — there is no `{{VAR}}` templating in the plugin tree. The only per-project files that need value substitution (a project `CLAUDE.md`, `README.md`, `package.json`) are bundled with the `/bluestep-init` skill and filled in conversationally by Claude. See `docs/decisions/plugin-distribution.md`.

## Key behaviors

**`/bluestep-init` (project bootstrap)**: the single bootstrap path. Run inside Claude Code with the plugin enabled, it writes the per-project files in-session — `CLAUDE.md`, `README.md`, a `package.json` (with **no** `@bluestep-systems/b6p-cli` devDependency — `b6p` is a standalone artifact, not an npm dep), `.gitignore`, `.prettierrc`, and a plugin-enabling `.claude/settings.json` (permissions + `extraKnownMarketplaces` for the `bluestep` marketplace + `enabledPlugins: ["bluestep-tools@bluestep"]`; **no** hooks block and **no** `SessionStart` sync — hooks come from the plugin) — then guides `git init`. Bundled root templates live in `plugin/skills/bluestep-init/templates/`. This replaces the dormant CLI's scaffold step and works for everyone, including no-npm staff. `plugin/skills/bluestep-init/SKILL.md`.

**b6p invocation (bare `b6p`)**: the `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills call a bare `b6p`. `b6p` reaches the machine as the standalone **b6p-cli** artifact (installed separately, on PATH independently of bspecs) — no `npx b6p`, no project-local devDependency, no global npm install. This is a tracked cross-repo dependency. See `docs/decisions/b6p-cli-distribution.md`.

**`/bluestep-mcp-connect` (platform MCP connection)**: the platform exposes a **per-org** MCP server at `https://<org>.bluestep.net/mcp` (HTTP transport). The skill registers a `bluestep-<subdomain>` entry per org, authed by a **single global `b6pt_` token** the user creates once in the UI and stores in the `B6PT_TOKEN` env var. **Default scope is user/global** (`claude mcp add … --scope user`) so one setup works across every workspace — token injected from `$B6PT_TOKEN`, resolved into the user-private, uncommitted `~/.claude.json`. The `claude` CLI is **not a hard dependency**: the global path is used only when `claude` is on PATH (terminal-CLI host); otherwise the skill falls back to a **per-workspace `.mcp.json`** with `${B6PT_TOKEN}` (runtime-expanded — a `.mcp.json`-only feature; needs no CLI), which is also the opt-in for containment / secret-only-in-env / team-shared config. Desktop-app users configure it as a claude.ai custom connector instead. This is a *separate* credential system from the b6p CLI's `~/.b6p/` WebDAV creds. A new connection registers only in a **fresh session**; the skill verifies with a curl `initialize` handshake first. `/bluestep-init` offers it as an optional step. Migrating the actual `[PLATFORM]` / `/b6p-*` operations onto MCP tools is a **phased follow-up** — see `docs/decisions/platform-mcp-integration.md`.

**`bluestep-reference` skill (on-demand platform reference)**: the former on-demand `instructions/` tree, re-homed as a plugin skill. Its `SKILL.md` is the former `index.md` manifest; the two Tier-2 overviews (`b6p-platform.md`, `bsjs-development.md`) and the atomic single-topic files under `reference/`, `conventions/`, `gotchas/` are bundled resources Claude resolves relatively and reads on demand. The on-demand-read pattern (no `@`-imports) of `docs/decisions/instruction-tree-and-claude-only.md` is preserved; only the entry point moved from `.claude/instructions/index.md` to a skill. Skills/agents reference the bundled paths rather than restating platform rules (no-duplication invariant).

**Delegated `/spec-execute` (default)**: `/spec-execute` implements a `[CODE]` task by delegating to the `b6p-task-implementer` subagent, which reads declarations/source and the relevant `bluestep-reference` content in its own context and returns a summary — keeping that bulk out of the main session. The approval gate stays in the main session (review the diff, mark `[x]`, STOP). `--inline` implements in-session for trivial tasks. The `b6p-commenter` and `b6p-code-review` subagents are on-demand only (suggested at the STOP, never auto-fired). See `docs/decisions/subagents-and-delegated-execution.md`.

**Hooks**: `plugin/hooks/hooks.json` wires the three scripts (block-generated-files, block-tsc, prettier-on-save), referenced via `${CLAUDE_PLUGIN_ROOT}`. They run in WSL and must use the WSL-native toolchain. Hooks ship with the plugin, so an enabled plugin gets them automatically — no per-project hooks block.

## Editing the plugin

- Skills live in `plugin/skills/<name>/SKILL.md` — verbatim markdown (no vars). A skill that bundles resources (e.g. `spec-create` bundles `spec-templates/`, `bluestep-init` bundles root templates, `b6p-commenter`'s README template) references them via `${CLAUDE_PLUGIN_ROOT}`.
- Subagents live in `plugin/agents/<name>.md` — plain markdown with `name`/`description`/`tools` frontmatter. They reference the `bluestep-reference` skill's bundled files on demand rather than restating platform rules. See `docs/decisions/subagents-and-delegated-execution.md`.
- The platform reference lives in `plugin/skills/bluestep-reference/` — `SKILL.md` (the manifest), the two overviews, and the `reference/`/`conventions/`/`gotchas/` subfolders. When adding a topic file, add a matching one-line entry to `SKILL.md` (it links one hop to every file). **Every committed reference file is category-level only** — no literal customer names, org subdomains, file IDs, employee names, domain/sector terms, or business figures. See `docs/decisions/content-sanitization-for-public-tooling.md`.
- Hook scripts are in `plugin/hooks/*.sh`.
- The plugin manifest is `plugin/.claude-plugin/plugin.json`; the marketplace manifest is the repo-root `.claude-plugin/marketplace.json`.

## Running / testing

No test suite. Manual testing of the plugin: add the in-repo marketplace and install the plugin into a scratch project, then confirm `/bluestep-tools:*` skills appear, the three hooks fire on Edit/Write/Bash, and the `bluestep-reference` skill serves reference files on demand. Bootstrap: in a scratch dir with the plugin enabled, run `/bluestep-init` and verify it writes the root files + a plugin-enabling `.claude/settings.json` (no hooks block, no sync) and guides `git init`; the generated `package.json` has no `b6p-cli` devDependency.

```bash
node cli.js -v       # dormant CLI still loads (prints version)
node cli.js -h       # dormant CLI still loads (prints help)
```

The dormant CLI no longer produces a complete project (its tooling now lives in the plugin) — expected.

## Working on tasks

Before substantive changes (implement / add / fix / refactor), skim `TODO.md` (open `[ ]` items) and the latest 3 `## [x.y.z]` blocks of `CHANGELOG.md`. Report any match — already planned, already shipped, or covered by an ADR in `docs/decisions/` — before starting. Skip for questions, exploration, or trivial edits.

When a task is done and the user confirms, propose a commit message (title + body) based on the diff. Do not run `git commit` unless the user says so.

## Distribution

The plugin is distributed via the public `bluestep` marketplace (this repo doubles as the marketplace — `.claude-plugin/marketplace.json` at the root, `source: ./plugin`). Repo: `github.com/Bluestep-Systems/bspecs`. **There is no npm publish.** Installation is `/plugin marketplace add Bluestep-Systems/bspecs` → `/plugin install bluestep-tools@bluestep` → `/bluestep-init`; updates are `/plugin marketplace update` / `autoUpdate`. Admin enforcement uses managed settings (`extraKnownMarketplaces` + `enabledPlugins` + `strictKnownMarketplaces`), which also defends against lookalike marketplaces.

A **Release** is cut by bumping `version` in `plugin/.claude-plugin/plugin.json` and merging to `main` — **existing installs only update when that version changes** (an unchanged version means `/plugin marketplace update` and `autoUpdate` skip the plugin), so a merge alone ships nothing. CI fails any PR touching `plugin/**` without a version bump (the `plugin-version-bump` job in `ci.yml`). Push a matching `plugin-vX.Y.Z` tag (the `plugin-` namespace avoids the frozen npm-package tags `v0.2.0`..`v0.15.0`) so `.github/workflows/publish.yml` records a GitHub Release (`gh release create`) for pinning. No `npm publish`, no binary build. `.github/workflows/ci.yml` also runs smoke checks on every PR / push to the default branch. Full procedure: the **Releasing** section of `README.md`. See `docs/decisions/plugin-distribution.md`.
