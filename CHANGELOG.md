<!-- markdownlint-disable MD024 -- repeated subsection headings are intentional in a per-version changelog -->

# Changelog

All notable changes to `@bluestep-systems/bspecs` are documented here.

This project follows [Semantic Versioning](https://semver.org/). While the major version is `0.x`, every minor bump (`0.1.x` → `0.2.0`) may contain breaking changes — that is the SemVer convention for pre-1.0 packages.

## [0.11.1] — 2026-06-24

### Fixed

- **The one-time auth command 404'd when run as documented.** README and the post-scaffold reminder
  told users to run `npx b6p auth set` for the once-per-machine credential step, but `b6p` is a
  *project-local* devDependency — bare `npx b6p` only resolves inside a scaffolded project that has
  run `npm install`. Run from anywhere else (e.g. `~`, right after `npm install -g`), npx tried to
  download a nonexistent package named `b6p` and failed with `404 b6p not found`. The standalone auth
  step is now documented as `npx -p @bluestep-systems/b6p-cli b6p auth set`, which fetches the real
  scoped package on the fly and works from any directory. Inside a scaffolded project, plain
  `npx b6p …` still works as before. Fixes the install flow shipped in 0.11.0
  (`README.md`, `src/scaffold.js`).

## [0.11.0] — 2026-06-24

Fixes the first-run auth foot-gun: on a machine that never ran `npx b6p auth set`, the first
`/b6p-pull` (or push/audit) hit an interactive credentials prompt Claude can't answer and hung
silently — `--yes` guards only the *confirmation* prompt, not the *missing-credentials* one. Auth is
now surfaced at every point the agent looks: a run-time preflight in the skills, a scaffold-time
reminder, and the scaffolded `CLAUDE.md`. Resolves Concern C of
`docs/decisions/b6p-cli-onboarding-in-scaffolds.md`.

### Added

- **Auth preflight in the `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills.** Before any `b6p` call,
  each skill runs `test -f ~/.b6p/secrets.enc`; if the encrypted credential store is absent it STOPs
  with a "run `npx b6p auth set` first" message instead of hanging. File-existence is the check
  because the b6p CLI exposes no non-interactive `auth status` command. Each skill's `allowed-tools`
  gains `Bash(test -f *)`.
- **Post-scaffold `auth set` reminder (`scaffold.js`).** After generating files, the scaffolder prints
  the one-time `npx b6p auth set` next step (credentials are global in `~/.b6p`, once per machine).

### Changed

- **Scaffolded `CLAUDE.md`** now states the one-time `npx b6p auth set` prerequisite in the
  Sync-workflow section, where the agent reads it before acting — not just in the README prose.
- **README** install flow promotes the platform-credential step to its own
  `### Set your platform credentials` section.

### Note for existing projects

`bspecs sync` propagates the updated skills and `CLAUDE.md` to projects scaffolded by an older
`bspecs` (unless those files were edited locally).

## [0.10.0] — 2026-06-24

### Changed

- **Switched to the public npm registry (`access: public`, no PAT).** `publishConfig` targets the
  default npm registry; the GitHub Packages mapping, `${GITHUB_TOKEN}`, and `access: restricted` are
  gone. Install is now a single `npm install -g @bluestep-systems/bspecs` — no `~/.npmrc` or token.
- **Removed `@bluestep-systems/b6p-cli` from bspecs's own `dependencies`.** It was never used by
  bspecs source — it is a devDependency of *scaffolded* projects only. Removing it prevents the
  stray dep from pulling `b6p-cli` (and formerly requiring a PAT) at global-install time.
- **Repo-local `.npmrc` rewritten.** Single line `@bluestep-systems:registry=https://registry.npmjs.org`
  (defensive override against stale GitHub-Packages mappings in `~/.npmrc`); the `${GITHUB_TOKEN}` +
  `always-auth` lines are gone.
- **Scaffolder runs `npm install` best-effort (`scaffold.js`, `reportInstallStep` →
  `installDependencies`).** After generating files it now attempts the install so the `b6p-cli`
  devDependency is present without a manual step, instead of only printing a reminder. The install
  is **not** assumed to succeed (network failure, offline). On any failure it falls back to the
  manual `npm install` reminder and never fails the scaffold.
- **`installDependencies` fallback message rewritten.** No longer mentions `~/.npmrc` or
  `GITHUB_TOKEN` — the only likely failure is being offline.

### Added

- **`.github/workflows/ci.yml`.** PR + push-to-default-branch validation: Node 18/20/22 matrix,
  `npm ci` with retry, smoke checks (`node cli.js -v`, `node cli.js -h`, `node test-scaffold.mjs`).
  No secrets. Trimmed from the `b6p-cli` CI workflow.
- **`.github/workflows/publish.yml`.** Tag-triggered (`v*.*.*`) publish to public npm: version guard
  (tag must match `package.json`), same smoke checks as CI, then
  `npm publish --provenance --access public` via `NPM_TOKEN`. Trimmed from the `b6p-cli` publish
  workflow.

### Removed

- **Scaffolded `.npmrc.template`** (`templates/root/.npmrc.template`). Generated projects no longer
  ship an `.npmrc` — `@bluestep-systems/b6p-cli` resolves anonymously from public npm.

### Docs

- **README** rewritten: "Installation" → single `npm install` command, no PAT; migration note for
  users with the old GitHub-Packages scope in `~/.npmrc`; "Publishing" → tag-triggered workflow;
  "Generated structure" → `.npmrc` line removed. The one-time `npx b6p auth set` platform-credential
  step is kept clearly separate.
- **CLAUDE.md** — "Publishing" and "b6p invocation" paragraphs updated to the public-registry,
  no-PAT reality; scaffolded-files list corrected (no `.npmrc`).
- **ADR `install-friction-and-registry.md`** flipped from *Proposed* to *Accepted* (Option 2, engineer
  sign-off, `b6p-cli` already public).
- **ADR `b6p-cli-distribution.md`** — registry-update note added (public npm supersedes the
  GitHub-Packages setup it described).

## [0.9.0] — 2026-06-19

Completes the "A5" fast-follow staged in 0.8.0: scaffolded projects now reach `b6p` via `npx b6p`
(resolving the project's own `node_modules/.bin/b6p`), and the ~200-line shell-detection workaround
is deleted. `b6p-cli` becomes a **devDependency of each scaffolded project** rather than something
the builder installs from source — because a dependency's bin is never placed on the global PATH, so
`bspecs` depending on `b6p-cli` did not, by itself, give a scaffolded project a usable `b6p`. `npx`
resolves the local bin cross-platform with no shells, login profiles, or PATH probing involved.

### Removed

- **Shell-detection scaffolding in `src/scaffold.js`.** `detectEnvironmentFor`, `probeCommand`,
  `shellPrefixCandidates`, `userShell`, `classifyPrefix`, `detectB6pEnvironment`, `reportB6pStatus`,
  and `writeB6pEnvFile` are gone. The scaffolder no longer probes for `b6p` or writes
  `.claude/b6p-env.json`.
- **`.claude/b6p-env.json`.** No longer written or read; the `npx b6p` invocation needs no persisted
  shell prefix.
- **`/b6p-detect` skill.** `templates/claude/skills/b6p-detect/` is deleted (it re-detected and
  rewrote `b6p-env.json`). It drops out of the dynamic `SYNC_TARGETS` automatically.
- **`require-wsl-for-b6p` hook.** `templates/claude/hooks/require-wsl-for-b6p.sh` is deleted and its
  `PreToolUse(Bash)` registration removed from `settings.json.template`. Its sole job was enforcing a
  shell-prefix shape so nvm-installed `b6p` was found on PATH — vestigial under `npx b6p`.

### Added

- **`templates/root/package.json.template`.** Scaffolded projects now ship a `private` `package.json`
  declaring `@bluestep-systems/b6p-cli` (`^0.1.0`) as a `devDependency`, so `npm install` populates
  `node_modules/.bin/b6p` for `npx b6p` to resolve.
- **`templates/root/.npmrc.template`.** Maps the `@bluestep-systems` scope to GitHub Packages (token
  via `${GITHUB_TOKEN}`), so `npm install` / `npx b6p` resolve `b6p-cli` in the scaffolded project.
  Mirrors the repo-root `.npmrc` pattern from 0.8.0.
- **Install-step instruction (`scaffold.js:reportInstallStep`).** After generating files, the
  scaffolder tells the user to `cd <project> && npm install`. It deliberately does **not** auto-run
  `npm install` — that would need the consumer's GitHub Packages PAT at scaffold time and fails poorly
  on a first run.

### Changed

- **`/b6p-pull`, `/b6p-push`, `/b6p-audit` invoke `npx b6p …`** instead of `<shellPrefix> 'b6p …'`.
  Each skill's `allowed-tools` is `Bash(npx b6p *)`; the `.claude/b6p-env.json` reading, auto-detect
  procedure, and `/b6p-detect` references are removed. "command not found" now points at
  `npm install` rather than an "install the b6p CLI from source" flow.
- **Scaffolded prose switched to the `npx b6p` model** — `templates/root/CLAUDE.md.template` (critical
  rule 5, the sync-workflow section, the skill table minus `/b6p-detect`),
  `templates/root/README.md.template` (the build-from-source and WSL-invoke sections replaced with an
  "Install dependencies" + `npx b6p auth set` flow), and
  `templates/claude/instructions/b6p-platform.md.template` (the `bash -lc`/nvm rationale dropped).
- **Prettier pre-flight is now self-contained** (`scaffold.js:checkPrettierOnPath`). It kept its
  WSL-aware probe and warning but no longer depends on the removed `detectEnvironmentFor` machinery.
- **This repo's `CLAUDE.md`** — the "b6p detection" / "Shell prefix list" key-behaviors paragraphs are
  replaced with the `npx b6p` model; "What gets scaffolded" now lists `package.json` + `.npmrc`, drops
  `/b6p-detect` and `require-wsl-for-b6p`, and notes three hooks (was four).

### Note for existing projects

`bspecs sync` updates tracked files but never deletes user files it no longer manages. A project
scaffolded by an older `bspecs` keeps an orphaned `.claude/b6p-env.json` and `.claude/skills/b6p-detect/`
— both harmless and no longer used; delete them by hand if you want them gone. To adopt the new flow,
add `@bluestep-systems/b6p-cli` as a devDependency plus a scope-mapped `.npmrc`, then `npm install` so
`npx b6p` resolves.

### Note

- The `~/.bluestep/push.js` snapshot conventions in `instructions/conventions/` still describe a
  separate (personal) workflow that conflicts with the `b6p` CLI flow; tracked as a follow-up in
  `TODO.md` ("Scaffolded snapshot conventions conflict with the `b6p` CLI flow"), out of scope for A5.

---

## [0.8.0] — 2026-06-19

Makes `bspecs` the single tool BlueStep builders install: it now depends on the freshly-published
`@bluestep-systems/b6p-cli`, so a global install brings the `b6p` binary transitively. The package
is renamed and moved to the `Bluestep-Systems` org for consistency with the rest of the toolchain.

### Changed

- **Package renamed** `@bluestep/bspecs` → `@bluestep-systems/bspecs`, matching the
  `@bluestep-systems` scope used by `b6p-cli` and `b6p-core`. Uninstall the old global before
  installing the new one: `npm rm -g @bluestep/bspecs && npm i -g @bluestep-systems/bspecs`.
- **Repository moved** to `github.com/Bluestep-Systems/bspecs` (off the personal account); the
  `repository.url` field is corrected to match.

### Added

- **Runtime dependency on `@bluestep-systems/b6p-cli` `^0.1.0`.** Installing `bspecs` now installs
  `b6p` automatically — no separate source checkout. Requires a `~/.npmrc` mapping
  `@bluestep-systems` → GitHub Packages and a PAT (`read:packages` to install). See the README
  "Installation" section.
- **Repo-root `.npmrc`** mapping the `@bluestep-systems` scope to GitHub Packages (token via the
  `${GITHUB_TOKEN}` env placeholder — no secret committed).

### Note

- The detect-and-guide shell-detection workaround (`detectEnvironmentFor`, `.claude/b6p-env.json`,
  `/b6p-detect`, the `require-wsl-for-b6p` regex) is **not** removed in this release. Switching skills
  to `npx b6p` and deleting that ~200 lines is staged as a separate fast-follow (the "A5" spec) to
  keep this publish small and reversible. See `docs/decisions/b6p-cli-distribution.md` and
  `.claude/specs/publish-chain/`.

---

## [0.7.0] — 2026-06-19

Adds three BlueStep subagents and makes `/spec-execute` delegate task implementation to one of them by default, so a large feature's heavy declaration/source reads stay out of the main session. Resolves the B4 follow-up from the rules consolidation.

### Added

- **`.claude/agents/` subagents.** Every scaffolded project now ships three BlueStep-aware subagents: `b6p-task-implementer` (implements exactly one approved spec task in an isolated context and returns a structured summary), `b6p-commenter` (fills in a component's `draft/README.md` from the code), and `b6p-code-review` (BlueStep-aware review grouped Critical/Warnings/Suggestions, **report-only by default**). Each references the `instructions/` tree on demand rather than restating platform rules. They ride the existing `templates/claude/**` walk, so `copyTemplateTree` and `SYNC_TARGETS`/`bspecs.lock` pick them up with no `src/` change.

### Changed

- **`/spec-execute` delegates by default.** A `[CODE]` task is implemented by spawning `b6p-task-implementer` in its own context; the main session surfaces the git diff and keeps the approval gate (review, mark `[x]`, README sync, STOP). A new `--inline` flag implements in-session for trivial tasks. The "task done" STOP now offers the optional, user-invoked `@b6p-commenter` and `@b6p-code-review` — never auto-fired. See `docs/decisions/subagents-and-delegated-execution.md`.

### Note

- `bluestep-dev` was **not** ported as an artifact — its platform knowledge already lives in `instructions/` (0.6.0); only its workflow became the implementer's prompt. The implementer never runs `tsc` (hook-blocked; the platform compiles on push) — it verifies via `ide_diagnostics`.

---

## [0.6.0] — 2026-06-19

Consolidates four team members' separate BlueStep rule kits into one canonical, deduplicated instruction tree that ships with every scaffolded project, and makes scaffolding Claude-only (the GitHub Copilot mirror is removed).

### Added

- **`.claude/instructions/` rule tree.** Every scaffolded project now ships an `index.md` manifest plus atomic single-topic files under `reference/`, `conventions/`, and `gotchas/`, alongside the existing Tier-2 overviews (`b6p-platform.md`, `bsjs-development.md`). All read on demand (not `@`-imported); the `index.md` manifest lists every file with a "load when…" trigger and links one hop to each. Sources merged: Brandon's `01-Platform-Reference`/`02-Workflow-Conventions`/`bluestep-knowledge`, Brendan's `BSJS_GOTCHAS.md`, and Brian's `agents-support/*` (the shared docs were reconciled, not duplicated).
- **`index.md` "Unresolved conflicts" roll-up.** Genuine cross-source disagreements are flagged inline with `<!-- CONFLICT: … -->` comments and rolled up in `index.md` for human resolution, rather than silently picked.

### Changed

- **`SYNC_TARGETS` is now derived dynamically** by walking `templates/claude/**` (`enumerateClaudeTargets(SYNC_EXCLUDE)` in `src/utils.js`), replacing the hand-maintained array in `src/sync.js`. New skills, hooks, and instruction files flow into `bspecs sync` and `bspecs.lock` automatically — no list to keep in step. A documented (empty) `SYNC_EXCLUDE` is the escape hatch for future scaffold-once files. See `docs/decisions/instruction-tree-and-claude-only.md`.
- **`b6p-platform.md` / `bsjs-development.md` overviews** gained a `## Contents` TOC and folded-in deltas from the reconciled `platform-overview` / `typescript-guide`; they summarize and link to the atomic files instead of restating them.

### Removed

- **GitHub Copilot mirror.** `mirrorInstructionsToGithub` and its call site are deleted; scaffolding no longer writes a `.github/instructions/` tree, and the `.github` entries are gone from the sync list. Scaffolded projects are Claude-only. This repo's docs no longer claim dual Claude Code + Copilot support.

### Note for existing projects

`bspecs sync` never deletes files, so a project scaffolded by an older `bspecs` keeps its now-orphaned `.github/instructions/` mirror. It is harmless and no longer updated; delete `.github/instructions/` by hand if you want it gone.

---

## [0.5.0] — 2026-05-26

Adds `bspecs sync` to keep scaffolded projects up to date when `bspecs` templates change, without requiring a re-scaffold.

### Added

- **`bspecs sync` subcommand.** Updates infrastructure files (skills, hooks, settings, instructions, spec-templates) in an existing project. Files the user edited locally are detected via SHA-256 hash comparison against a lock file and skipped — local edits are never overwritten.
- **`.claude/bspecs.lock`.** Written by the scaffolder at project creation time. Contains the `bspecs` version, scaffold date, project vars (excluding `CONTEXT7_API_KEY`), and a hash of every infrastructure file at scaffold time. `bspecs sync` reads and updates this file on each run.
- **`SessionStart` hook in generated projects.** The scaffolded `.claude/settings.json` now includes a `SessionStart` hook that runs `bspecs sync --silent` automatically on every workspace open, resume, and compaction — no manual intervention needed.
- **`--silent` flag for `bspecs sync`.** Suppresses all output and swallows errors with exit 0, so the hook never blocks Claude Code startup.

### Changed

- **`bsjs-development.md` instruction template** — new section "TS narrowing pitfalls (Graal/Java types)" documenting patterns that collapse to `never` in closures with Java types, with three solutions ordered by preference.
- **`/spec-execute` skill** — new step 5.5 requires verifying IDE diagnostics before marking a task done. Errors in touched files must be fixed; warnings can be dismissed with justification.

---

## [0.4.0] — 2026-05-21

**Breaking change:** package renamed from `@bluestep/init` (command `bluestep-init`) to `@bluestep/bspecs` (command `bspecs`). Uninstall the old global before installing the new one:

```sh
npm uninstall -g @bluestep/init
npm install -g @bluestep/bspecs   # once published, or: npm install -g .
```

### Changed

- **Package renamed** from `@bluestep/init` to `@bluestep/bspecs`. The CLI command is now `bspecs` instead of `bluestep-init`. All internal references and generated project files updated.
- **Scaffolded projects** now reference `bspecs` in their generated `CLAUDE.md` and `README.md` (no functional change to the generated workspace structure).

### Why

The original name `bluestep-init` implied the tool's only job is project initialisation. The real purpose is spec-driven development with normalised rules for AI agents — scaffolding is just the entry point. `bspecs` (BlueStep + specs) names the actual goal.

---

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
