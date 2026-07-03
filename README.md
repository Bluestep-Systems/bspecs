# bluestep-tools

A **Claude Code plugin** that sets up BlueStep projects with spec-driven development conventions: skills, BlueStep subagents, guardrail hooks, and an on-demand platform reference.

## What it does

The `bluestep-tools` plugin provides:

- Claude Code skills — `/spec-create`, `/spec-execute`, `/spec-status`, `/b6p-pull`, `/b6p-push`, `/b6p-audit`, `/quick-task`, `/task-comment`, `/bspecs-feedback`, and `/bluestep-init`
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

The plugin lives in `plugin/`; the repo-root `.claude-plugin/marketplace.json` lists it (`source: ./plugin`). There is **no npm publish and no binary build**. A GitHub Release is cut on each plugin version tag (`plugin-vX.Y.Z`) by `.github/workflows/publish.yml`; `.github/workflows/ci.yml` runs smoke checks on every pull request and push to the default branch.

The npm CLI that previously scaffolded these files (`cli.js`/`src/*`) is retained in the repo but **dormant** — unpublished and unsupported. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md) and [`docs/decisions/content-sanitization-for-public-tooling.md`](docs/decisions/content-sanitization-for-public-tooling.md).

## Releasing

Merging a PR to `main` does **not** ship it to installed users. The plugin's `version` in [`plugin/.claude-plugin/plugin.json`](plugin/.claude-plugin/plugin.json) is the update signal: Claude Code caches each install by that version and, on `/plugin marketplace update` or `autoUpdate`, **skips the plugin when the version is unchanged**. Merged `plugin/**` changes stay dormant until a version bump ships them.

**When to release** — whenever you want merged `plugin/**` changes to reach installed users. Batch several merged PRs into one release if you like; the release *is* the bump, not the merge.

**How to release:**

1. Bump `version` in `plugin/.claude-plugin/plugin.json` (semver — patch = fix, minor = feature, major = breaking).
2. Merge the bump to `main`. Users get everything since the previous version on their next `autoUpdate` (Claude Code startup) or manual `/plugin marketplace update`.
3. Tag it and push, so a GitHub Release is recorded (and admins can pin to it):
   ```sh
   git tag plugin-v0.2.0 && git push origin plugin-v0.2.0
   ```
   `.github/workflows/publish.yml` cuts the Release for the tag. **Use the `plugin-vX.Y.Z` namespace** — the plain `vX.Y.Z` tags (`v0.2.0`..`v0.15.0`) belong to the frozen npm-package history and must not be reused.

**Enforced:** CI fails any PR that changes `plugin/**` without bumping the version (the `plugin-version-bump` job), so a release can't be silently forgotten. Repo-only changes (docs, CI, the dormant CLI) don't touch `plugin/**`, need no bump, and don't affect installs.

The marketplace tracks this repo's default branch, so the bump on `main` is what propagates to users; the `plugin-vX.Y.Z` tag is for the Release record and version pinning. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md).

## Proposing changes

Found something that should improve across all BlueStep projects — a skill, hook, reference rule, or subagent? Use the `/bspecs-feedback` skill (or open an issue/PR in this repo). Once merged and released, `/plugin marketplace update` propagates it.
