# Done

Completed work for `@bluestep-systems/bspecs`, archived from `TODO.md` to keep the active list short. The authoritative, prose release notes live in `CHANGELOG.md`; this file is the lightweight per-version checklist history.

## Done in 0.9.0

- [x] `b6p` `npx` migration (A5): scaffolded projects declare `@bluestep-systems/b6p-cli` as a devDependency + ship a scope-mapped `.npmrc`, so `npx b6p` resolves the project-local bin cross-platform.
- [x] `/b6p-pull`, `/b6p-push`, `/b6p-audit` switched to `npx b6p …`; added an install-step instruction to the scaffolder (instruct, not auto-install — auto-install would need a PAT at scaffold time).
- [x] Removed the shell-detection workaround: `detectEnvironmentFor`/`probeCommand`/`shellPrefixCandidates` (+ helpers), `.claude/b6p-env.json`, the `/b6p-detect` skill, and the `require-wsl-for-b6p` hook & its `settings.json` registration.
- [x] Switched scaffolded prose (`CLAUDE.md`, `README.md`, `b6p-platform.md`) and this repo's `CLAUDE.md` to the `npx b6p` model; bumped to 0.9.0 with a `### Removed` CHANGELOG entry; flipped the `b6p-cli-distribution` ADR to fully superseded.
- See `.claude/specs/b6p-npx-migration/` for the full spec. Follow-up logged in `TODO.md`: the `~/.bluestep/push.js` snapshot conventions still conflict with the b6p CLI flow (own spec/bug, out of scope for A5).

## Done in 0.8.0

- [x] Published `@bluestep-systems/b6p-cli@0.1.0` to GitHub Packages (restricted) from the `Bluestep-Systems/vscode-extension` monorepo (PR #14 was already merged); verified self-contained (core bundled).
- [x] Renamed `@bluestep/bspecs` → `@bluestep-systems/bspecs`; added `@bluestep-systems/b6p-cli ^0.1.0` dependency; refreshed lockfile; added root `.npmrc`.
- [x] Documented consumer auth in `README.md`; updated `CLAUDE.md` Publishing; recorded the direct-publish + rename in the ADR.
- [x] Created `github.com/Bluestep-Systems/bspecs` (private), repointed `origin`, pushed `main` + tags, published `@bluestep-systems/bspecs@0.8.0`.
- See `.claude/specs/publish-chain/` for the full spec. Follow-ups deferred to the A5 fast-follow: `npx b6p` switch + shell-detection removal (a dependency's bin is **not** placed on the global PATH, so a global bspecs install does not expose `b6p` — A5 wires it via a project devDependency + `npx`).

## Done in 0.3.2

- [x] Shell-prefix detection: probe `<user-shell> -lc` then `-ic`, fall back to bash, then WSL on Windows. Handles nvm-in-.zshrc setups.
- [x] Persist detected prefix to `.claude/b6p-env.json`; skills read it instead of re-detecting per call.
- [x] New `/b6p-detect` skill to redo detection when the user re-installs b6p elsewhere.
- [x] Hook `require-wsl-for-b6p.sh` updated to accept any of bash/zsh/sh/fish with -lc or -ic, with or without a `wsl` prefix.
- [x] ADR `docs/decisions/b6p-cli-distribution.md` updated with a "Cleanup once b6p-cli is published" section listing exactly what to remove.

## Done in 0.3.1

- [x] Fix false-negative pre-flight checks for `prettier` and `b6p` when scaffolding from WSL.

## Done in 0.3.0

- [x] `--yes` flag on all `b6p` invocations to prevent interactive prompts hanging Claude.
- [x] `/b6p-audit` skill wrapping `b6p audit --json` for on-demand local-vs-platform comparison.
- [x] `auth set` reminder in scaffolder pre-flight and project README.
- [x] CLAUDE.md "Skill quick reference" with mandatory routing rule for spec-driven changes.

## Done in 0.2.1

- [x] Pre-flight check for missing `b6p` CLI with install instructions.
- [x] Decision record at `docs/decisions/b6p-cli-distribution.md`.
- [x] `TODO.md` established as living pending-work list.

## Done in 0.2.0

- [x] Remove `unitId` / `projectType` prompts (projects are folders; U-folders come from `b6p pull`).
- [x] Replace per-component `SPEC.md` with `<Component>/draft/README.md` lifecycle.
- [x] Remove `/new-module` skill.
- [x] Shell-detection in `/b6p-pull` and `/b6p-push`; hook accepts both `bash -lc` and `wsl bash -lc`.
- [x] `[PLATFORM]` / `[CODE]` task prefix convention with `/spec-execute` enforcement.
- [x] Session-start README directive in `CLAUDE.md`.
- [x] CLI flags `-v` / `-h`; clean Ctrl+C cancellation.
- [x] `git init` + tag `v0.2.0`; CHANGELOG.md established.
