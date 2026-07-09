# Done

Completed work for `@bluestep-systems/bspecs`, archived from `TODO.md` to keep the active list short. The authoritative, prose release notes live in `CHANGELOG.md`; this file is the lightweight per-version checklist history.

## Unreleased

### quick-task (plugin 0.5.0)

Branch `feature/quick-task-skill` (PR #11). Renames and broadens `/bug-fix` into `/quick-task` — a short workflow for small changes **and** bug fixes that don't warrant a full 3-phase spec, now with light structure.

- [x] **`/bug-fix` → `/quick-task`.** ([`plugin/skills/quick-task/SKILL.md`](plugin/skills/quick-task/SKILL.md), renamed via `git mv` from `plugin/skills/bug-fix/`.) Now covers small clearly-scoped changes as well as bugs; keeps **one living doc** at `.claude/quick-tasks/<slug>.md` that stays open for review and gets ticked off during implementation. Retains the scoped-read discipline and the platform-push / README-sync reminders from the old flow. Added the bundled `quick-task.template.md` (Summary, Root cause, Approach checklist, Notes).
- [x] **Folded in the `[PLATFORM]` / `[CODE]` task distinction** (previously a standalone TODO). The quick-task doc's approach checklist tags each item, so a change that needs both a platform edit and a code edit has an explicit, reviewable handoff.
- [x] **Docs + templates updated to match.** `bluestep-init` root templates (`CLAUDE.md.template` routing rule + skill table, `README.md.template`), plus `README.md`, `plugin/README.md`, `CLAUDE.md` inventories, and `docs/bspecs-builder/requirements.md` now reference `/quick-task`. Version `0.4.0` → `0.5.0`; CHANGELOG `## [plugin 0.5.0]` block added.

### push-snapshot (plugin 0.6.0)

Branch `feature/b6p-push-snapshot`. Restores the snapshot path the scaffolded flow never had: the b6p CLI has always supported `push --snapshot --message` (a restorable server-side version entry), but the skill only ever ran a plain push, so pushes recorded **no** platform history.

- [x] **On-demand snapshot in `/b6p-push`.** ([`plugin/skills/b6p-push/SKILL.md`](plugin/skills/b6p-push/SKILL.md), steps 3–5.) The skill now **always** presents a neutral plain-vs-snapshot choice via `AskUserQuestion` on every push (no default); the selection doubles as the push confirmation. On **Snapshot** it drafts a concise commit-style message from the diff for the user to accept/edit, then runs `b6p --yes push --file "…" --snapshot --message "<summary>"`; **Plain push** is unchanged. Step 5 reports whether a versioned history entry was recorded. Guardrail: the skill never snapshots (or plain-pushes) silently or automatically — always the user's explicit choice for that push. Landed slightly stronger than the original "opt-in only when asked" framing (it prompts every time).
- [x] **Plain-vs-snapshot promoted to a project-level rule.** ([`plugin/skills/bluestep-init/templates/CLAUDE.md.template`](plugin/skills/bluestep-init/templates/CLAUDE.md.template).) The choice previously bound only when `/b6p-push` was the entry point — a bare `b6p push` run by hand would plain-push silently. Now carried as **Critical rule 9** (always present the choice, never snapshot/plain-push silently, never auto-snapshot) and reinforced in the "Sync workflow (b6p CLI)" section, so the rule holds regardless of how the push is triggered.
- [x] **Version bump + CHANGELOG.** `plugin/.claude-plugin/plugin.json` `0.5.0` → `0.6.0`; added the `## [plugin 0.6.0] — 2026-07-03` block to [`CHANGELOG.md`](CHANGELOG.md). Satisfies the CI `plugin-version-bump` gate. The **auto-snapshot** half (tie a push to `/spec-execute` completion) remains deferred in [`TODO.md`](TODO.md).

### vite-merge-report-tooling (complete)

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

### GitHub Releases + npm-free plugin delivery

- [x] **GitHub Releases now created on publish.** `.github/workflows/publish.yml` no longer runs `npm publish`; on every `vX.Y.Z` tag it now creates a GitHub **Release** (`gh release create "$TAG" --verify-tag --generate-notes`, with `permissions: contents: write`), so tags and Releases stay in step. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md). _(Remaining backfill of old release-less tags and the `actions/checkout@v4`/`setup-node@v4` Node-runner bump are minor CI hygiene — do opportunistically.)_
- [x] **npm-free delivery, via a Claude Code plugin (not the VSCode extension).** Resolved by distributing the tooling as a Claude Code plugin via the public `bluestep` marketplace (no npm, no binary, no PATH setup), with `/bluestep-init` as the in-session project bootstrap. This supersedes the VSCode-extension route (and the standalone-binary route) for the no-npm audience. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md); the VSCode-extension feasibility analysis in [`docs/decisions/npm-free-scaffolding-via-vscode-extension.md`](docs/decisions/npm-free-scaffolding-via-vscode-extension.md) is amended to point at it.

### Platform MCP integration — wave 3 (plugin 0.7.0–0.8.0)

The `/bluestep-mcp-connect` skill + the [`platform-mcp-integration.md`](docs/decisions/platform-mcp-integration.md) ADR shipped the **connection** (plugin `0.7.0`). **Scope decision (2026-07-08):** component **pull/push/audit run exclusively on the b6p CLI** — MCP's job is the **non-overlapping** piece: automating the `[PLATFORM]` authoring/wiring tasks the CLI fundamentally cannot do (previously a human UI round-trip that stalled `/spec-execute`). Two credential systems coexist **by design, not transitionally**.

- [x] **Phase 2 — read-parity gate (DESCOPED, nothing shipped).** Presupposed replacing `/b6p-pull` with an MCP read; the exclusive-CLI decision removes the reason, so **no MCP read/pull skill ships** (an early `/b6p-pull-mcp` skill was prototyped, then removed). An MCP read was exercised once only to measure parity (bkplayground, "Teacher Header" MERGE_REPORT, live session): **source byte-identical** to the CLI; **declarations structurally reduced** — `get_script_declarations` returns only the script-type line (`declare const B: …MergeReportB;` + wired deps), omitting the CLI's `index.d.ts` preamble and 7 ambient typedef files. Recorded in the ADR addendum; not a parity pass, closed by the descope. The one useful bit — reading declarations back after wiring — folds into Phase 4 as a plain `get_script_declarations` call, not a skill.
- [x] **Phase 3 — MCP push (DESCOPED).** `write_script_draft` push-to-draft is dropped: push runs on the CLI (see the scope decision above).
- [x] **Phase 4 — automate `[PLATFORM]` tasks (the actual payoff).** Taught `/spec-execute`, `/quick-task`, and the scaffolded `CLAUDE.md` to run `add_queries` / `add_forms` / `add_field_access` + the schema-authoring tools for `[PLATFORM]` work, approval-gated, turning the human hand-back into an in-session action; reads declarations back via `get_script_declarations` afterward. **Implementation shipped in plugin `0.8.0`** via `.claude/specs/mcp-platform-authoring/` (Tasks 1–8): the shared procedure page + all three entry points + the tasks/`CLAUDE.md` templates + the test plan. **Live prove-out PASSED 2026-07-08** in a fresh bkplayground session (Task 9, recorded in `docs/mcp-platform-authoring-test-plan.md`): in-app tool registration held; the wiring trio + `get_script_declarations` oracle round-tripped fully clean and were sufficient to code against; `create_option_list` create/assert passed but has **no MCP teardown** — see the finding logged in `TODO.md`'s MCP tool-inventory audit section.
- [x] **Updated the out-of-repo global `~/.claude/CLAUDE.md` rule to match.** The global B6P rule ("new imports require a platform round-trip → hand back to a human") predated Phase 4; reworded 2026-07-08 to "MCP in-session when connected, else a platform round-trip" (keeping never-fabricate), pointing at the `bluestep-reference` procedure page. Done directly on the machine's home file (outside this repo, so not tracked here).
- [x] **Phase 5 — folded into skills + `bluestep-reference` + the scaffolded `CLAUDE.md`, then released.** Folding shipped in `0.8.0` (Tasks 1–8); released as tag **`plugin-v0.8.0`** (2026-07-08, `publish.yml` cut the GitHub Release). Scope was the Phase-4 `[PLATFORM]` authoring flow only (not a sync migration).

**Release-tag note (resolved 2026-07-08).** The deferred-tag question is moot: Phase 4 landed and `plugin-v0.8.0` is tagged/released. The connection-only `0.7.0` (and `0.5.0`) were merged without a tag — backfilling those release-less tags is optional record-keeping.

### spec-execute subagent delegation (bspecs repo's own skills)

- [x] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` already delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` had no equivalent — it has no BlueStep components, so the BlueStep implementer doesn't fit. Added a *generic* implementer subagent ([`.claude/agents/spec-task-implementer.md`](.claude/agents/spec-task-implementer.md)) that reads the spec + scoped files in an isolated context, implements one task, and returns a summary; wired `.claude/skills/spec-execute` to delegate by default, mirroring the `--inline` escape hatch. See [`docs/decisions/subagents-and-delegated-execution.md`](docs/decisions/subagents-and-delegated-execution.md).

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
