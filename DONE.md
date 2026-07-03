# Done

Completed work for `@bluestep-systems/bspecs`, archived from `TODO.md` to keep the active list short. The authoritative, prose release notes live in `CHANGELOG.md`; this file is the lightweight per-version checklist history.

## Unreleased

### vite-merge-report-tooling (in progress)

Spec: `.claude/specs/vite-merge-report-tooling/` (kept local — gitignored, not pushed). Documents and tools the **off-platform Vite/Preact SPA merge-report build model** (build off-platform, deploy `dist/` into the report's `static/` via deploy-lib — the platform compiler is bypassed). Branch `feature/vite-merge-report-tooling`.

- [x] **ADR: off-platform bundler build model.** New decision record ([`docs/decisions/off-platform-bundler-build-model.md`](docs/decisions/off-platform-bundler-build-model.md)) — keep both merge-report build models (platform-compiled `static/script.ts` vs. off-platform Vite/Preact bundle), the load-bearing constraints (`base: './'`, Node 20, deploy-lib config-key casing, GitHub-hosted history), and when to pick which. (Task 1 of 9.)
- [x] **Pattern reference file.** New `bluestep-reference` file ([`plugin/skills/bluestep-reference/reference/vite-spa-merge-report.md`](plugin/skills/bluestep-reference/reference/vite-spa-merge-report.md)) — architecture (SPA in `static/`, report serves `index.html`, `app.ts` no-op or `B.out` bootstrap), the two data models (endpoint fetch vs. server bootstrap), history-in-GitHub, Preact-default/React-alternative, and when-to-use vs. the platform-compiled path. Owns architecture only; routes deploy/gotchas to siblings. (Task 2 of 9.)
- [x] **deploy-lib workflow conventions file.** New `bluestep-reference` file ([`plugin/skills/bluestep-reference/conventions/deploy-lib-workflow.md`](plugin/skills/bluestep-reference/conventions/deploy-lib-workflow.md)) — install-from-git, the `package.json` `config` block (`deployUrl` **camelCase** vs. lowercase `deploypathsuffix`/`builddir`, the silent-failure trap), the `deploy` script, `npm run deploy -- --build --clean` (draft+snapshot upload), auth resolution order (`--token-file`→`BLUESTEP_TOKEN`→`.env-local`→interactive, Bearer), Node 20+. Owns the deploy-lib issue #30 link. (Task 3 of 9.)
- [x] **Gotchas file.** New `bluestep-reference` file ([`plugin/skills/bluestep-reference/gotchas/vite-merge-report-gotchas.md`](plugin/skills/bluestep-reference/gotchas/vite-merge-report-gotchas.md)) — seven sharp edges as symptom→cause→fix: `base: './'` (headline trap), `<head>` stripped/body survives, mount-id match, Node 20+ (`crypto is not defined`), deploy-lib config-key casing (points to the conventions owner + issue #30), site-CSS/`Swal` absent in local dev (`declare const Swal`), and don't-"fix"-the-build-script (block-tsc hook only matches literal top-level `tsc`). Completes the three reference files. (Task 4 of 9.)
- [x] **Manifest entries for the three files.** Added three one-line "load when" entries to [`plugin/skills/bluestep-reference/SKILL.md`](plugin/skills/bluestep-reference/SKILL.md) (in the `reference/`, `conventions/`, `gotchas/` sections), making the new files discoverable via on-demand lookup. (Task 5 of 9.)
- [x] **Cross-linked the six platform-compiled docs.** Additive blockquote disambiguators (no rule reworded) on `merge-report-static-index.md`, `conventions/single-script.md` (scoped to the platform-compiled path — "does not apply to a Vite bundle"), `conventions/separate-files.md`, `file-execution.md`, `crm-dashboard-inspo.md`, and `dpn-dashboard-framework.md`, each routing readers to the off-platform Vite/Preact pattern file. (Task 6 of 9.)
- [x] **`/bluestep-vite-report` scaffold skill.** New skill ([`plugin/skills/bluestep-vite-report/SKILL.md`](plugin/skills/bluestep-vite-report/SKILL.md)), modeled on `/bluestep-init`: Node-20 precheck (STOP, don't install) → `AskUserQuestion` target/name prompts (Preact fixed, deploy URL deferred) → live `create-vite --template preact-ts` + edits `vite.config.ts` (`base: "./"`) and `package.json` (deploy-lib `config` with camelCase `deployUrl`, `repository`, `deploy` script; keeps default `build`) → **prints** (doesn't run) the `[PLATFORM]`/GitHub/deploy checklist → links the three reference files. Also added `/bluestep-vite-report` to the `CLAUDE.md` plugin skills inventory (docs sync). (Task 7 of 9.)
- [x] **Plugin version bump + CHANGELOG.** `plugin/.claude-plugin/plugin.json` `version` `0.3.0` → `0.4.0`; added the `## [plugin 0.4.0] — 2026-07-03` block to [`CHANGELOG.md`](CHANGELOG.md) (Added: the three reference files, the `/bluestep-vite-report` skill, the ADR; Changed: the six cross-linked docs + the `CLAUDE.md` inventory). Satisfies the CI `plugin-version-bump` gate. (Task 8 of 9.)
- [x] **Sanitization + consistency sweep.** Verified: no spike tokens (`bkplayground`/`configassisted`/`configplatformhome`/file IDs/`b6pt`/test-repo name) anywhere in the shipped content (`plugin/`, the ADR, `CHANGELOG.md`, `CLAUDE.md`); all three new reference files have manifest entries and exist; all internal markdown links in the three new files resolve; `plugin.json` version and the CHANGELOG heading both `0.4.0`. **Feature complete (9/9).** (Task 9 of 9.)

- [x] **Evaluated path-scoped rules (`.claude/rules/*.md` with `paths:` frontmatter) vs. the on-demand instruction tree — rejected for now.** Intent-keyed knowledge (the ~50 atomic files trigger on *what the task does*) doesn't map to path globs (B6P files are undifferentiated `*.ts`/`*.js`); rules don't fire on Write/Edit (the dominant B6P workflow); plus reliability + subagent-inheritance gaps. Sync and the Claude-only invariant were *not* blockers. Gated revisit trigger + thin "augment" sketch recorded. Doc-only (ADR, no code/version change). ADR: [`docs/decisions/path-scoped-rules-evaluation.md`](docs/decisions/path-scoped-rules-evaluation.md).
- [x] **Tightened the scaffolded `CLAUDE.md.template` (167 → 131 lines).** Collapsed the README-vs-spec lifecycle (previously stated 4×) into one "Module context" section, replaced the `B`-object table with a pointer to `bsjs-development.md` (kept the `B.time`/`B.user` gotchas inline), demoted "Sync workflow" to a short pointer (skills own the `npx b6p` commands; one-time `auth set` preserved), and trimmed the Deep-reference footer. Self-improvement section untouched. Fixed the `spec-create` skill's cross-reference to the renamed heading. See CHANGELOG `[0.15.0]`.
- [x] **`/bspecs-feedback` skill — route tooling-change requests to the canonical bspecs repo.** Skill (`templates/claude/skills/bspecs-feedback/SKILL.md`) + issue form (`.github/ISSUE_TEMPLATE/feedback.yml`) + repo `feedback` label + scaffolded `CLAUDE.md` Self-improvement hand-off + ADR `docs/decisions/bspecs-feedback-mechanism.md`. Prefilled GitHub issue deep link, no token/backend. See the `bspecs-feedback` spec and CHANGELOG `[0.15.0]`.

## Released (0.10.0–0.14.1)

- [x] **GitHub Actions publish workflow.** `.github/workflows/publish.yml` (tag-triggered `v*.*.*`, version guard, `npm publish --provenance --access public` via `NPM_TOKEN`) + `.github/workflows/ci.yml` (PR + push, Node 18/20/22 matrix, smoke checks). Both trimmed from the `b6p-cli` workflows. See `.claude/specs/public-npm-publishing/`.
- [x] **Registry decision: Option 2 — public npm.** `publishConfig` → `access: public` (default registry); removed `@bluestep-systems/b6p-cli` from bspecs's own dependencies; deleted the scaffolded `.npmrc.template`; rewrote the repo-local `.npmrc` to pin the scope to `registry.npmjs.org`; regenerated lockfile. Install is now `npm install -g @bluestep-systems/bspecs` with no PAT or `~/.npmrc`. ADR flipped to Accepted. See `.claude/specs/public-npm-publishing/`.
- [x] **Best-effort auto `npm install` in the scaffolded project.** `scaffold.js` now attempts `npm install` (renamed `reportInstallStep` → `installDependencies`) so the b6p devDependency is present without a manual step, and falls back to the manual-install reminder on failure. It does **not** assume success: the project `.npmrc` reads the token from `${GITHUB_TOKEN}`, whose presence at scaffold time is not guaranteed (unset in a fresh shell — notably Windows/PowerShell — expired token, or offline). Corrected the earlier "the token is already configured by scaffold time" framing in the install-friction ADR. See [`docs/decisions/install-friction-and-registry.md`](docs/decisions/install-friction-and-registry.md).
- [x] **Wizard: warn-loud git init.** Kept the "Initialize a git repository?" confirm but the message now warns that skipping degrades the implementer agent; skipping logs a loud follow-up warning. Added `isInsideGitRepo()` (`src/scaffold.js`) so the scaffolder detects an enclosing repo via `git rev-parse --is-inside-work-tree` and skips init rather than nesting a repo.
- [x] **Wizard: project description optional.** Dropped the 20-char minimum; the prompt now accepts an empty value (defaults to `''`). `PROJECT_DESCRIPTION` is retained because it feeds the generated `CLAUDE.md`, `README.md`, and `package.json` description.
- [x] **Removed the Context7 dependency entirely.** Dropped the API-key prompt, the `CONTEXT7_API_KEY` variable, the whole `templates/vscode/` tree + its `copyTemplateTree` call, and all Context7/`.vscode/mcp.json` references across templates, docs, and `test-scaffold.mjs` (now asserts their absence). `copyTemplateTree` runs 3× and the wizard is 4 questions.
- [x] **First-run auth onboarding — Concern C (0.11.0).** The `/b6p-pull`, `/b6p-push`, `/b6p-audit` skills preflight `test -f ~/.b6p/secrets.enc` and STOP with a "run `npx b6p auth set` first" message instead of hanging on the interactive credentials prompt; the one-time `auth set` step is surfaced in the scaffolded `CLAUDE.md` + a post-scaffold reminder. See `docs/decisions/b6p-cli-onboarding-in-scaffolds.md` and CHANGELOG `[0.11.0]`/`[0.11.1]`. (Concern A — per-project download duplication — remains deferred.)
- [x] **Snapshot conventions conflict resolved — Option (a) (0.13.0).** Dropped the four `~/.bluestep`-tooling convention files (`always-snapshot.md`, `snapshot-integrity.md`, `push-inner-draft.md`, `tsc-rootdir.md`) from the scaffolded tree and cleared every dangling reference (`index.md.template` links, the `bsjs-development.md` pointer, the `merge-report-memo-json.md`/`csv-parsing.md` links). They described a machine-local `~/.bluestep/push.js` snapshot flow that contradicted the `npx b6p` flow, the `block-tsc` hook, and `CLAUDE.md`. See CHANGELOG `[0.13.0]`.

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
- [x] Filed an upstream bug on `Bluestep-Systems/vscode-extension`: `@bluestep-systems/b6p-cli@0.1.0` reports `--version` as `0.0.1` (stale hardcoded string; should read from `package.json`). Discovered during the `publish-chain` spec (task 12).
- See `.claude/specs/publish-chain/` for the full spec. Follow-ups deferred to the A5 fast-follow: `npx b6p` switch + shell-detection removal (a dependency's bin is **not** placed on the global PATH, so a global bspecs install does not expose `b6p` — A5 wires it via a project devDependency + `npx`).

## Done in 0.7.0

- [x] Converted Brandon's `03-Agents/` role files into BlueStep **subagents** (B4), not skills: `b6p-commenter` and `b6p-code-review` (report-only) under `templates/claude/agents/`, plus `b6p-task-implementer` (the reframed workflow layer of `bluestep-dev`; its knowledge was already in `instructions/` from 0.6.0). `/spec-execute` delegates to the implementer by default, with an `--inline` escape hatch.
- See `.claude/specs/bluestep-subagents/` and `docs/decisions/subagents-and-delegated-execution.md`.

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
