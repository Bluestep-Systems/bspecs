# bluestep-tools

A **Claude Code plugin** that sets up BlueStep projects with spec-driven development conventions: skills, BlueStep subagents, guardrail hooks, and an on-demand platform reference.

## What it does

The `bluestep-tools` plugin provides:

- Claude Code skills — `/spec-create`, `/spec-execute`, `/spec-status`, `/b6p-pull`, `/b6p-push`, `/b6p-audit`, `/bug-fix`, `/task-comment`, `/bspecs-feedback`, and `/bluestep-init`
- BlueStep subagents — `b6p-task-implementer` (isolated task execution; `/spec-execute` delegates to it), `b6p-commenter` (component README), `b6p-code-review` (report-only review)
- Guardrail hooks — prettier on save, generated-file blocking, `tsc` blocking
- `bluestep-reference` — an on-demand platform/BsJs/RelateScript reference Claude reads as needed
- Spec templates (`requirements.md`, `design.md`, `tasks.md`), bundled with `/spec-create`

## Installation

The plugin is distributed via the public `bluestep` **marketplace** — this repo doubles as the marketplace, so there is no npm, no token, and no `~/.npmrc` setup. From inside Claude Code:

```
/plugin marketplace add Bluestep-Systems/bspecs
/plugin install bluestep-tools@bluestep
```

(Internal staff typically get the marketplace pre-registered and the plugin force-enabled via managed settings, so this step is automatic.)

Keep the tooling current with `/plugin marketplace update` (or `autoUpdate`).

### The `b6p` CLI (required for the `/b6p-*` skills)

The `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills call a bare `b6p`. Install the standalone **b6p-cli** artifact separately so `b6p` is on your PATH — it is its own release, not an npm dependency of this plugin. Then set your platform credentials once per machine:

```sh
b6p auth set
```

Credentials are stored globally in `~/.b6p`, not per project.

### prettier (required for the auto-format hook)

The prettier-on-save hook needs `prettier` available in the project (the hook runs in WSL on Windows).

## Usage

### Bootstrap a project

With the plugin enabled, from the directory you want to set up:

```
/bluestep-init
```

`/bluestep-init` writes the per-project files in-session — `CLAUDE.md`, `README.md`, a `package.json`, `.gitignore`, `.prettierrc`, and a plugin-enabling `.claude/settings.json` — then guides `git init`. The generated `package.json` carries **no** `b6p-cli` devDependency (`b6p` is a standalone artifact). Claude asks for the project and client values conversationally.

> The first time a project's `.claude/settings.json` enables the plugin, Claude Code asks you to confirm the install on folder-trust — enablement is not silent. Confirm once and the skills/hooks are available.

### The spec-driven workflow

Once bootstrapped, drive features through `/spec-create` → `/spec-execute` → `/spec-status`, pull/push BlueStep components with the `/b6p-*` skills, and let the guardrail hooks keep the tree clean.

## Distribution

The plugin lives in `plugin/`; the repo-root `.claude-plugin/marketplace.json` lists it (`source: ./plugin`). There is **no npm publish and no binary build**. A GitHub Release is cut on each version tag (`vX.Y.Z`) by `.github/workflows/publish.yml`; `.github/workflows/ci.yml` runs smoke checks on every pull request and push to the default branch.

The npm CLI that previously scaffolded these files (`cli.js`/`src/*`) is retained in the repo but **dormant** — unpublished and unsupported. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md) and [`docs/decisions/content-sanitization-for-public-tooling.md`](docs/decisions/content-sanitization-for-public-tooling.md).

## Proposing changes

Found something that should improve across all BlueStep projects — a skill, hook, reference rule, or subagent? Use the `/bspecs-feedback` skill (or open an issue/PR in this repo). Once merged and released, `/plugin marketplace update` propagates it.
