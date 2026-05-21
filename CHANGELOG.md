<!-- markdownlint-disable MD024 -- repeated subsection headings are intentional in a per-version changelog -->

# Changelog

All notable changes to `@bluestep/init` are documented here.

This project follows [Semantic Versioning](https://semver.org/). While the major version is `0.x`, every minor bump (`0.1.x` → `0.2.0`) may contain breaking changes — that is the SemVer convention for pre-1.0 packages.

## [0.3.2] — 2026-05-21

Shell-aware `b6p` detection: handles zsh-with-nvm-in-.zshrc setups (which were silently broken before), persists the detected invocation prefix per project, and lets users redo detection without re-running the scaffolder.

### Added

- **`.claude/b6p-env.json` persistence.** Scaffolder writes the detected shell prefix (e.g. `"/usr/bin/zsh -ic"`) to this file. Skills read it once and skip re-detection on every invocation.
- **`/b6p-detect` skill.** Re-runs detection and rewrites `.claude/b6p-env.json`. Use after re-installing b6p in a different location.

### Changed

- **Shell-prefix detection now tries `<user-shell> -lc`, then `-ic`, then bash variants, then WSL variants on Windows hosts.** Previously hardcoded `bash -lc`, which never found nvm-installed binaries on zsh systems because nvm typically lives in `.zshrc` (loaded only by interactive shells, `-ic`). The new probe order picks the cleanest shell + flag combo that actually works.
- **`require-wsl-for-b6p.sh` regex broadened** to accept any of bash/zsh/sh/fish with `-lc` or `-ic`, with or without an absolute-path prefix or `wsl` prefix. The old regex only accepted `bash -lc`; with the broader detection, valid invocations were getting blocked.
- **All `/b6p-*` skills now read `.claude/b6p-env.json`** for the prefix instead of running `uname -s` at the start of every invocation. Auto-detect with persist as fallback when the file is missing.

### Why this is technical debt

`docs/decisions/b6p-cli-distribution.md` now has a "Cleanup once b6p-cli is published" section listing exactly what to remove when upstream publishes `@bluestep-systems/b6p-cli`. The whole shell-detection apparatus disappears when we can use `npx` (the Node.js standard for CLI distribution). Recording this so future maintainers don't mistake the workaround for an intentional design choice.

## [0.3.1] — 2026-05-21

### Fixed

- **Pre-flight `prettier` and `b6p` checks no longer give false negatives when scaffolding from inside WSL.** The previous implementation always called `wsl bash -lc "command -v X"`, which fails when Node is already running in Linux/WSL (either `wsl` is not present in Linux, or Windows-interop evaluates against the wrong PATH). The check now branches on `process.platform`: `'linux'` → `bash -lc` directly; everything else → `wsl bash -lc`. Mirrors the shell-detection logic the `/b6p-*` skills already use at runtime. Install-command hints in the warning messages are also adjusted per platform so the user can copy-paste them as-is.

## [0.3.0] — 2026-05-21

Tightened our integration with `b6p` after auditing the full CLI surface. The previous version used only `b6p pull` and `b6p push`, missing several commands that map directly to friction points in the workflow.

### Added

- **`/b6p-audit` skill.** Wraps `b6p audit --json` to compare local vs. platform state and list divergent files. Read-only — does not auto-pull or auto-push. Intended for on-demand use ("did something change on the platform?"), explicitly NOT auto-chained as a pre-flight to push, because most sessions push multiple times and the user knows the context (whether others are working on the same module). The CLI's own server-side conflict detection covers the rare worst case.
- **`auth set` reminder in scaffolder pre-flight and project README.** Without configured credentials, the first `b6p pull` prompts interactively, which Claude cannot answer (the call hangs). The scaffolder now reminds the user to run `b6p auth set` once when it detects b6p is installed; the project README documents it as a one-time setup step.
- **CLAUDE.md "Skill quick reference" section.** Table of all available skills with intent-to-skill mapping, plus a mandatory routing rule for spec-driven changes (must `/spec-create` or `/bug-fix` before editing module code, except trivial changes the user explicitly opts out of) and soft routing for sync/status/audit operations. Closes the gap where Claude had no central guidance on when to invoke which skill.

### Changed

- **`/b6p-pull` and `/b6p-push` now pass `--yes` to b6p.** Without this flag, the CLI may show interactive confirmation prompts that Claude cannot answer — the call would hang silently. Required for any Claude-driven invocation. Same change applied to the documented commands in CLAUDE.md and the project README.

### Why this is a minor bump (0.3.0, not 0.2.2)

The `--yes` change is technically a bug fix (latent hang), but a new skill (`/b6p-audit`) is additive functionality. Minor bump is the right call: existing users are not broken, but a new capability ships.

## [0.2.1] — 2026-05-21

Added an interim solution for the `b6p` CLI dependency, since `@bluestep-systems/b6p-cli` is not yet published to any npm registry and most BlueStep devs do not have it installed.

### Added

- **Pre-flight check for `b6p` CLI in `scaffold.js`.** After generating files, the CLI now checks whether `b6p` is reachable via `wsl bash -lc "command -v b6p"`. If not, it prints the six commands the user needs to install it from source (clone, install, compile, link) plus a hint about the SSH access requirement to the `Bluestep-Systems` GitHub org.
- **"Install the b6p CLI" section in the generated project's `README.md`.** Same install commands, surfaced where a developer onboarding to the scaffolded project will look first.
- **Distinct handling of "command not found" in `/b6p-pull` and `/b6p-push`.** When the skills encounter that specific error (CLI missing), they now redirect the user to the README install section instead of suggesting fallbacks or retrying. Other errors (network, auth, conflict) still point at the VS Code extension as fallback.
- **`TODO.md`** and **`docs/decisions/b6p-cli-distribution.md`** at the repository root. The decision record explains why we chose the detect-and-guide approach today and the path to replacing it with a `peerDependencies` declaration once the upstream package is published.

### Why this is an interim solution

The correct long-term shape is to declare `@bluestep-systems/b6p-cli` as a `peerDependencies` entry in our `package.json`. That requires the upstream team at `Bluestep-Systems/vscode-extension` to first publish both `b6p-core` and `b6p-cli` to a registry (most likely GitHub Packages). That work is acknowledged in the upstream README's "Follow-ups" section as out of scope for the initial monorepo split. We will revisit when it ships.

## [0.2.0] — 2026-05-21

This is the first iteration after real-world use. The flow was end-to-end tested against the `Appointment Scheduler` project; several incorrect assumptions in the original design were corrected.

### Breaking changes

- **Removed prompts `unitId` and `projectType`.** A project has no unit or type of its own — Unit folders (`U######/`) are created by `b6p pull` when a component from a new unit is first pulled. A single project commonly spans multiple Unit folders, each mixing component types. Projects generated by `0.1.0` had a hand-created U-folder that is no longer expected.
- **Removed per-component `SPEC.md`.** The "permanent contract" concept conflated description (stable) with planning (volatile). Replaced with two artifacts separated by lifecycle:
  - `<Component>/draft/README.md` — what the module does today; lives inside `draft/` so it ships to the platform on push.
  - `.claude/specs/<feature>/` — what we're about to change; per feature, not per component.
- **Removed `/new-module` skill.** Its only durable value (a SPEC.md stub) is now folded into `/b6p-pull`, which can read the freshly-pulled `metadata.json` and prefill a README accurately.
- **Changed `b6p` invocation shape.** The required form is now `wsl bash -lc 'b6p ...'` (or `bash -lc 'b6p ...'` when Claude already runs in WSL). Plain `wsl b6p ...` fails with `command not found` because it skips the login shell, so nvm/PATH never load. The `require-wsl-for-b6p` hook now enforces the new shape.

### Added

- **`draft/README.md` auto-scaffolding in `/b6p-pull`.** When a pulled module lacks a substantive `README.md`, the skill identifies component type from `metadata.json` + `config.json` + entry script, infers Overview/Behavior/Fields/Dependencies from the code, and asks the user if it cannot infer the purpose with confidence. Existing substantive READMEs are preserved.
- **Shell detection in skills.** `/b6p-pull` and `/b6p-push` run `uname -s` first and choose between `bash -lc` (inside WSL) and `wsl bash -lc` (from Windows). The hook accepts both forms.
- **`[PLATFORM]` / `[CODE]` task prefix convention.** Every task in `tasks.md` is prefixed by where the work happens. `/spec-execute` rejects `[PLATFORM]` tasks (they're done in the BlueStep UI) and checks for unchecked `[PLATFORM]` prerequisites before running a `[CODE]` task. Tasks template includes a `## Deployment` section listing components to push.
- **Session-start README directive in `CLAUDE.md`.** Claude reads every `draft/README.md` once per session, not per skill invocation. `/spec-create`, `/spec-execute`, and `/bug-fix` rely on that session-start coverage and don't re-read.
- **README update reminders.** `/bug-fix` and `/spec-execute` remind the user to update `draft/README.md` when documented behavior changes.
- **CLI flags `-v` / `--version` and `-h` / `--help`.** Version is read from `package.json` for single source of truth.
- **Clean cancellation.** Ctrl+C at any prompt now exits with `"Cancelled."` instead of falling through to subsequent prompts. (`@clack/prompts` `group()` had a quiet bug here; replaced with individual `bail()` checks.)
- **Pre-flight prettier check.** Scaffold prints a warning if `prettier` is not on the WSL PATH, since the `prettier-on-save` hook would silently no-op.

### Changed

- **`/b6p-push` uses `--file`** instead of trying to push by name. `--file` lets the b6p CLI derive the destination DAV URL from the local `.b6p_metadata.json`.
- **Hook messages.** `block-generated-files` and `require-wsl-for-b6p` now print the correct corrective invocation (`wsl bash -lc 'b6p pull "<DAV URL>"'`) rather than the old `wsl b6p pull <component>` shape.

### Documentation

- **`rule-audit.md`** now contains rules R18a (project shape), R18b (README vs. spec lifecycle), and R18c (task prefix convention) — all derived from real-session feedback, not from the original template.
- **`bsjs-development.md`** and **`b6p-platform.md`** instruction templates rewritten with the new invocation shape and the module structure that matches what `b6p pull` actually produces.

## [0.1.0] — Initial scaffold

First working version. Generated a project with `CLAUDE.md`, `.claude/{hooks,skills,instructions,spec-templates}`, `.vscode/mcp.json`, mirrored Copilot instructions in `.github/instructions/`, and a per-component `SPEC.md` template. Six prompts including `unitId` and `projectType` (both later removed). Seven skills including `/new-module` (later removed).

Not published to GitHub Packages — used only via local symlink during development.
