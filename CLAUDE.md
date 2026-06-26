# bspecs — scaffolder for spec-driven BlueStep projects

`@bluestep-systems/bspecs` is an interactive CLI (`bspecs`) that sets up BlueStep projects with Claude Code skills, hooks, and conventions for spec-driven development. It has three verbs: `bspecs new` scaffolds a brand-new project in a subdirectory, `bspecs init` installs the tooling into the **current** directory non-destructively (skips any file that already exists; merges the b6p-cli devDependency into an existing `package.json`), and `bspecs sync` updates infrastructure files in an already-set-up project. Bare `bspecs` prints help. Scaffolded projects declare `@bluestep-systems/b6p-cli` as a devDependency and reach the `b6p` binary via `npx b6p`, which resolves the project's local `node_modules/.bin/b6p` — no global install and no shell/PATH detection.

## Architecture

```text
cli.js                    ← entry point, arg parsing
src/
  prompts.js              ← @clack/prompts interactive wizard (4 questions)
  scaffold.js             ← file generation, prettier pre-flight, install step, git init
  utils.js                ← template engine ({{VAR}} substitution), fs helpers
templates/
  root/                   → project root files (CLAUDE.md, .gitignore, .prettierrc, README)
  claude/                 → .claude/ tree (settings, skills, agents, hooks, instructions, spec-templates)
  module/                 → .claude/templates/ (per-component scaffolding)
```

`scaffold()` calls `copyTemplateTree()` three times (root, claude, module). Claude-only: no GitHub Copilot mirror is generated — the template tree → `.claude/` is the single source of truth. See `docs/decisions/instruction-tree-and-claude-only.md`.

Template variables: `PROJECT_NAME`, `CLIENT_NAME`, `PROJECT_DESCRIPTION`, `SCAFFOLD_DATE`. Applied via `{{VAR}}` substitution in `utils.applyTemplate()`. Files ending in `.template` have that extension stripped on copy. `PROJECT_DESCRIPTION` is optional (the wizard allows an empty value).

## Key behaviors

**b6p invocation (`npx b6p`)**: scaffolded projects declare `@bluestep-systems/b6p-cli` as a devDependency (`templates/root/package.json.template`), resolved anonymously from public npm — no scope-mapped `.npmrc` and no token. The `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills invoke `npx b6p`, which resolves `node_modules/.bin/b6p` cross-platform — no global install, no shell or PATH detection, no `.claude/b6p-env.json`. The scaffolder runs `npm install` **best-effort** (`scaffold.js:installDependencies`): it attempts the install so `node_modules/.bin/b6p` exists for `npx b6p`, but falls back to printing a manual `npm install` reminder if it fails. Failure is expected when the machine is offline — so auto-install is never assumed to succeed and never fails the scaffold. (`npx b6p` still needs platform credentials set once per machine via `npx b6p auth set` — unrelated to npm.) See `docs/decisions/b6p-cli-distribution.md` and `docs/decisions/install-friction-and-registry.md`.

**prettier detection** (`scaffold.js:checkPrettierOnPath`): a self-contained best-effort probe (`command -v prettier`, plus WSL on Windows since the prettier-on-save hook runs in WSL) that only warns — it writes nothing. Independent of b6p.

**`SYNC_TARGETS` (dynamic)**: `src/sync.js` derives the synced-file list by walking `templates/claude/**` via `enumerateClaudeTargets(SYNC_EXCLUDE)` (`src/utils.js`) — one `.claude/**` target per file, with a trailing `.template` stripped (same transform as `copyTemplateTree`). Add a skill, agent, hook, or instruction file and `bspecs sync` / `bspecs.lock` pick it up automatically; there is no hardcoded list. `SYNC_EXCLUDE` (empty today) opts a scaffold-once file out of sync. See `docs/decisions/instruction-tree-and-claude-only.md`.

**Delegated `/spec-execute` (default)**: the scaffolded `/spec-execute` skill implements a `[CODE]` task by delegating to the `b6p-task-implementer` subagent, which reads declarations/source and the relevant `instructions/` in its own context and returns a summary — keeping that bulk out of the main session. The approval gate stays in the main session (review the diff, mark `[x]`, STOP). `--inline` implements in-session for trivial tasks. The `b6p-commenter` and `b6p-code-review` subagents are on-demand only (suggested at the STOP, never auto-fired). See `docs/decisions/subagents-and-delegated-execution.md`.

## What gets scaffolded into every project

- `CLAUDE.md`, `.prettierrc`, `.gitignore`, `README.md`, `package.json` (from `templates/root/`) — `package.json` declares the `b6p-cli` devDependency, resolved from public npm so `npm install` / `npx b6p` work with no token (no scaffolded `.npmrc`)
- `.claude/settings.json` — permissions + hooks (block-generated-files, block-tsc, prettier-on-save)
- `.claude/skills/` — `b6p-audit`, `b6p-pull`, `b6p-push`, `bspecs-feedback`, `bug-fix`, `spec-create`, `spec-execute`, `spec-status`, `task-comment`
- `.claude/agents/` — three BlueStep subagents: `b6p-task-implementer` (implements one spec task in an isolated context; `/spec-execute` delegates to it), `b6p-commenter` (fills in a component `draft/README.md`), `b6p-code-review` (BlueStep-aware, report-only review)
- `.claude/hooks/` — three shell scripts (run in WSL; must use WSL-native toolchain)
- `.claude/instructions/` — Tier-2 overviews (`b6p-platform.md`, `bsjs-development.md`), the `index.md` manifest, and atomic single-topic files under `reference/`, `conventions/`, `gotchas/` (read on demand, not `@`-imported). No `.github/` Copilot mirror.
- `.claude/spec-templates/` — `requirements.template.md`, `design.template.md`, `tasks.template.md`
- `.claude/templates/` — per-component scaffolding (module README template)

## Editing templates

- Skills live in `templates/claude/skills/<name>/SKILL.md` — no vars, plain markdown.
- Subagents live in `templates/claude/agents/<name>.md` — plain markdown like skills (no vars), with `name`/`description`/`tools` frontmatter. They reference the `instructions/` tree on demand rather than restating platform rules, to preserve the no-duplication invariant. See `docs/decisions/subagents-and-delegated-execution.md`.
- Instruction files live in `templates/claude/instructions/` — the two overviews plus `index.md` and the `reference/`/`conventions/`/`gotchas/` subfolders, all `*.md.template` (support `{{VAR}}`). Claude-only: no `.github/` mirror. When adding a file under a subfolder, add a matching one-line entry to `index.md.template` (it links one hop to every file).
- `templates/claude/settings.json.template` controls hooks and permissions for generated projects.
- Hook scripts are in `templates/claude/hooks/*.sh` — marked executable on copy (no-op on Windows).

## Running / testing

```bash
node cli.js new      # scaffold a new project in a subdirectory (interactive)
node cli.js init     # install tooling into the CURRENT directory (non-destructive)
node cli.js -v       # print version
node cli.js -h       # print help
```

Bare `node cli.js` (no recognized verb) prints help. No test suite. Manual testing: run `node cli.js new` (or `init` in a scratch dir) and verify the generated tree.

## Working on tasks

Before substantive changes (implement / add / fix / refactor), skim `TODO.md` (open `[ ]` items) and the latest 3 `## [x.y.z]` blocks of `CHANGELOG.md`. Report any match — already planned, already shipped, or covered by an ADR in `docs/decisions/` — before starting. Skip for questions, exploration, or trivial edits.

When a task is done and the user confirms, propose a commit message (title + body) based on the diff. Do not run `git commit` unless the user says so.

## Publishing

Package name `@bluestep-systems/bspecs`, published to the **public npm registry** (`access: public`, no token to install). Repo: `github.com/Bluestep-Systems/bspecs`. Only `cli.js`, `src/`, and `templates/` are included in the published package. `@bluestep-systems/b6p-cli` is **not** a dependency of bspecs itself — it is a devDependency of *scaffolded* projects (`templates/root/package.json.template`), also resolved from public npm.

Releases are automated, not hand-published: bump `version`, push a `vX.Y.Z` tag, and `.github/workflows/publish.yml` runs the version guard + smoke checks and publishes with `npm publish --provenance --access public` using the `NPM_TOKEN` repo secret. `.github/workflows/ci.yml` runs the smoke checks on every PR / push to the default branch. See `docs/decisions/install-friction-and-registry.md` and `docs/decisions/b6p-cli-distribution.md`.
