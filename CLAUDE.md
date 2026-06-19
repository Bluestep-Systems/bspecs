# bspecs — scaffolder for spec-driven BlueStep projects

`@bluestep/bspecs` is an interactive CLI (`bspecs`) that scaffolds a new BlueStep project with Claude Code skills, hooks, and conventions for spec-driven development. It generates a complete project directory from templates and detects the local `b6p` environment.

## Architecture

```text
cli.js                    ← entry point, arg parsing
src/
  prompts.js              ← @clack/prompts interactive wizard (5 questions)
  scaffold.js             ← file generation, b6p detection, git init
  utils.js                ← template engine ({{VAR}} substitution), fs helpers
templates/
  root/                   → project root files (CLAUDE.md, .gitignore, .prettierrc, README)
  claude/                 → .claude/ tree (settings, skills, hooks, instructions, spec-templates)
  module/                 → .claude/templates/ (per-component scaffolding)
  vscode/                 → .vscode/mcp.json (Context7 MCP)
```

`scaffold()` calls `copyTemplateTree()` four times (root, claude, module, vscode). Claude-only: no GitHub Copilot mirror is generated — the template tree → `.claude/` is the single source of truth. See `docs/decisions/instruction-tree-and-claude-only.md`.

Template variables: `PROJECT_NAME`, `CLIENT_NAME`, `PROJECT_DESCRIPTION`, `CONTEXT7_API_KEY`, `SCAFFOLD_DATE`. Applied via `{{VAR}}` substitution in `utils.applyTemplate()`. Files ending in `.template` have that extension stripped on copy.

## Key behaviors

**b6p detection** (`scaffold.js:detectEnvironmentFor`): probes `command -v b6p` through a prioritized list of shell prefixes (`''`, `wsl zsh -lc`, `wsl zsh -ic`, `wsl bash -lc`, `wsl bash -ic` on Windows; user shell with `-lc`/`-ic` on Linux/macOS). First match wins. Result written to `.claude/b6p-env.json` in the generated project.

**Shell prefix list** matters: `-lc` (login) loads `~/.zprofile` but not `.zshrc`; `-ic` (interactive) loads `.zshrc` so nvm-installed binaries work. Both are tried per shell.

**prettier detection**: same probe logic, but only warns — doesn't write anything.

**`SYNC_TARGETS` (dynamic)**: `src/sync.js` derives the synced-file list by walking `templates/claude/**` via `enumerateClaudeTargets(SYNC_EXCLUDE)` (`src/utils.js`) — one `.claude/**` target per file, with a trailing `.template` stripped (same transform as `copyTemplateTree`). Add a skill, hook, or instruction file and `bspecs sync` / `bspecs.lock` pick it up automatically; there is no hardcoded list. `SYNC_EXCLUDE` (empty today) opts a scaffold-once file out of sync. See `docs/decisions/instruction-tree-and-claude-only.md`.

## What gets scaffolded into every project

- `CLAUDE.md`, `.prettierrc`, `.gitignore`, `README.md` (from `templates/root/`)
- `.claude/settings.json` — permissions + hooks (block-generated-files, require-wsl-for-b6p, block-tsc, prettier-on-save)
- `.claude/skills/` — `b6p-audit`, `b6p-detect`, `b6p-pull`, `b6p-push`, `bug-fix`, `spec-create`, `spec-execute`, `spec-status`
- `.claude/hooks/` — four shell scripts (run in WSL; must use WSL-native toolchain)
- `.claude/instructions/` — Tier-2 overviews (`b6p-platform.md`, `bsjs-development.md`), the `index.md` manifest, and atomic single-topic files under `reference/`, `conventions/`, `gotchas/` (read on demand, not `@`-imported). No `.github/` Copilot mirror.
- `.claude/spec-templates/` — `requirements.template.md`, `design.template.md`, `tasks.template.md`
- `.claude/templates/` — per-component scaffolding (module README template)
- `.vscode/mcp.json` — Context7 MCP with the API key

## Editing templates

- Skills live in `templates/claude/skills/<name>/SKILL.md` — no vars, plain markdown.
- Instruction files live in `templates/claude/instructions/` — the two overviews plus `index.md` and the `reference/`/`conventions/`/`gotchas/` subfolders, all `*.md.template` (support `{{VAR}}`). Claude-only: no `.github/` mirror. When adding a file under a subfolder, add a matching one-line entry to `index.md.template` (it links one hop to every file).
- `templates/claude/settings.json.template` controls hooks and permissions for generated projects.
- Hook scripts are in `templates/claude/hooks/*.sh` — marked executable on copy (no-op on Windows).

## Running / testing

```bash
node cli.js          # interactive scaffold in cwd
node cli.js -v       # print version
node cli.js -h       # print help
```

No test suite. Manual testing: run `node cli.js` and verify the generated project has the expected structure.

## Working on tasks

Before substantive changes (implement / add / fix / refactor), skim `TODO.md` (open `[ ]` items) and the latest 3 `## [x.y.z]` blocks of `CHANGELOG.md`. Report any match — already planned, already shipped, or covered by an ADR in `docs/decisions/` — before starting. Skip for questions, exploration, or trivial edits.

When a task is done and the user confirms, propose a commit message (title + body) based on the diff. Do not run `git commit` unless the user says so.

## Publishing

Package name `@bluestep/bspecs`, registry `https://npm.pkg.github.com` (GitHub Packages, `access: restricted`). Repo: `github.com/bluestep/bspecs`. Only `cli.js`, `src/`, and `templates/` are included in the published package.
