# ADR: Cross-tool plugin output — generated per-tool native trees for Cursor and Codex

**Status:** Accepted

**Date:** 2026-08-12

**Extends:** [`plugin-distribution.md`](plugin-distribution.md) — its "single delivery path,
marketplace-shaped" decision now applies per tool: this repo doubles as **three** marketplaces
(Claude Code `.claude-plugin/`, Cursor `.cursor-plugin/`, Codex `.agents/plugins/`), all serving
the same `plugin/` source. Supersedes nothing; also relates to
[`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) and
[`b6p-cli-distribution.md`](b6p-cli-distribution.md) (the `b6p` runtime dependency is unchanged).

## Context

The `bluestep-tools` plugin was Claude Code-only: team members on Cursor or OpenAI Codex got no
skills, reference tree, subagents, hooks, or gateway MCP config. Research (2026-08-11) showed the
heavy part no longer needs translating — `SKILL.md` is an open standard both tools consume
natively — leaving a real but bounded translation surface: packaging manifests,
`${CLAUDE_PLUGIN_ROOT}` paths, `allowed-tools` frontmatter, hook wiring, MCP config syntax, and
subagent format. A live prove-out on real Cursor and Codex installs
(`.claude/specs/cross-tool-plugin-output/prove-out.md`) settled every layout and wiring question
before the emitters were written — several documented behaviors turned out wrong or incomplete
(see the emitter-rules section below).

The result: a dependency-free generator (`tools/gen-cross-tool/`) reads `plugin/**` and emits
`dist/cursor/`, `dist/codex/`, and the two root marketplace manifests. This ADR records the seven
decisions that shape it.

## Decisions

### 1. Per-tool native outputs, not (yet) one Agent Plugins bundle

Our Claude Code distribution leans on native marketplace features — versioned updates and
managed-settings enforcement. Cursor's team marketplaces (git-repo import, refresh-on-push) and
Codex's custom marketplaces (`git-subdir` sources, versioned plugin cache) mirror those; the
Agent Plugins open standard (agent-plugins.org, mid-2026) is only months old and its
marketplace/enforcement story is unproven. So the generator emits one native tree per tool.
The door stays open: it is structured as one emitter module per target
(`emit-cursor.mjs`, `emit-codex.mjs` over a shared plugin-tree reader), so an
`emit-agent-plugin.mjs` consolidation later is additive, not a rewrite.

### 2. Generated output is committed

`dist/`, the root `.cursor-plugin/marketplace.json`, and `.agents/plugins/marketplace.json` are
committed — the first build artifacts this repo has ever checked in. Forced by the distribution
model: Cursor and Codex marketplace imports pull from a git repo (Cursor resolves even a local
marketplace via git), so the output must exist in the tree, not in a release pipeline.
Hand-edits and staleness cannot land: the `cross-tool-drift` CI job regenerates (`npm run gen`),
fails on `git diff` against the generated paths, fails on untracked generated files (new files
never show in a diff), and runs `npm run gen:check` (structural self-test + a Claude-ism denylist
lint that keeps the source's de-Claude-ing enforced, not a one-time cleanup). Output is a pure
function of `plugin/**` — no timestamps, no environment leakage — so diffs stay meaningful and
the sanitization invariant holds trivially: no content exists in `dist/` that isn't in `plugin/`.

### 3. No external translator dependency

ruler, rulesync, and acplugin (whole-plugin converter) were surveyed and their emitters read for
corner cases — **consulted, not depended on**. Rejected as dependencies because: their model
inverts our source of truth (they translate *rules files*; our source is a full plugin tree with
hooks, MCP, and marketplace manifests); their sweet spot is prose rules, not wiring; and taking
one on couples our release pipeline to a small third-party project iterating as fast as the
vendors it tracks. The emitters we own are small modules written to the live-proven layout.

### 4. `AGENTS.md` is the scaffolded rules file; `CLAUDE.md` becomes a one-line bridge

`/bluestep-init` now scaffolds the always-on project rules into `AGENTS.md` — read natively by
Cursor, Codex, and dozens of other tools — plus a one-line `CLAUDE.md` containing `@AGENTS.md`,
the documented import mechanism, because Claude Code is the odd one out that does *not* read
`AGENTS.md` natively (anthropics/claude-code#6235). Idempotency protects existing projects: a
populated `CLAUDE.md` is never overwritten; the skill *offers* the migration (move content to
`AGENTS.md`, shrink `CLAUDE.md` to the import line) instead of doing it silently.

### 5. One shared version stream

Every generated manifest mirrors the single version in `plugin/.claude-plugin/plugin.json`. Any
change that alters shipped bytes — plugin content **or** emitter behavior — bumps it: the
`plugin-version-bump` CI gate fires on `plugin/**` *and* `tools/gen-cross-tool/**`, because an
emitter-only fix that doesn't bump the version never reaches installed users (all three tools
skip an unchanged version on update). Tools whose output didn't change receive a harmless no-op
update. **Rejected:** per-tool version streams — three release invariants to keep straight buys
nothing over one accepted no-op cost.

### 6. Tag-on-merge release automation

Merging a version-bumped PR to `main` **is** the release: `release-tag.yml` reads the manifest
version and, if the `plugin-vX.Y.Z` tag doesn't exist, creates and pushes it — idempotent
(tag exists → clean no-op), race-safe, never `--force`, and the only bspecs workflow with
top-level `contents: write`. **As built:** the workflow also creates the GitHub Release itself,
because tags pushed with the default `GITHUB_TOKEN` never trigger other workflows (GitHub's
recursive-workflow guard) — `publish.yml`'s `on: push: tags` cannot fire from the automation.
`publish.yml` stays untouched serving the manual path (a human-pushed tag pre-empts the
automation cleanly), and both paths produce the same Release shape.

### 7. Per-tool content extension point — deliberately not built

`dist/` stays a pure function of the one shared `plugin/` tree; there is no mechanism for a
Codex-only skill or a Cursor-only gotcha. The one genuine per-tool need the content audit found —
`/bluestep-init` enablement steps — is handled with per-tool subsections inside the one skill
file. When a concrete need appears, the designated extension point is a `targets:` frontmatter
filter or a per-tool overlay directory — recorded here so the next person extends deliberately
instead of forking `dist/`.

## Live-proven emitter rules (prove-out findings worth keeping)

Locked by the task-1 live prove-out (`prove-out.md` has the full failure ladders):

- **Codex hook trust gate**: plugin hooks are silently skipped until the user reviews/trusts
  them, and every hook-touching release requires **re-trust** — enablement docs and the release
  checklist must say so, or the guardrails silently don't run.
- **Script resolution via `PLUGIN_ROOT`**: Codex runs hook commands from the session cwd, so
  scripts are referenced via the `PLUGIN_ROOT` env var (`CLAUDE_PLUGIN_ROOT` is set too, for
  compat) — never manifest-relative paths.
- **Blocking on Windows Codex is JSON-deny, not exit codes**: the Windows harness collapses hook
  exit codes to 0/1 (exit 2 is unreachable), and extra top-level JSON keys are rejected — the
  wrappers emit exactly the `hookSpecificOutput` permission-deny with exit 0. Hooks **fail open**
  on error, so shipped scripts must be defensive.
- **Codex agents ship via enablement, not the plugin**: bundled agent files are cached but never
  registered, so the TOML agents are delivered by the enablement step; Codex agent names allow
  only lowercase/digits/underscores (`b6p_task_implementer`, …).
- **Cursor edit hooks are post-hoc advisories**: Cursor has no blocking pre-edit event carrying
  the new content, so `block-generated-files` and `block-inline-frontend` run on `afterFileEdit`
  as documented degradation — they warn, they don't block (`dist/cursor/.../hooks/README.md`).
- **MCP env syntax differs per tool**: Cursor interpolates `${env:B6PT_TOKEN}` in a bundled
  `mcp.json`; Codex does **not** interpolate `${VAR}` in headers — its config uses
  `bearer_token_env_var: "B6PT_TOKEN"`.

## Consequences

- Cursor and Codex users install from this repo's marketplaces and get the skills, reference
  tree, hooks, MCP, and (via enablement) agents — no Claude Code required.
- Authors keep editing only `plugin/**`; a forgotten `npm run gen` is a failed PR, not drift.
- Release cadence is unchanged and now zero-terminal-step: one version bump ships all three
  surfaces plus the tag and GitHub Release.
- Committed generated output adds diff noise on plugin changes — accepted; the `GENERATED.md`
  headers and drift gate keep it honest.
- Format churn at the vendors surfaces as a failed regen or a failed release smoke test, not
  silent rot; the emitters are small and ours.

## References

- Spec: `.claude/specs/cross-tool-plugin-output/{requirements,design,tasks}.md`
- Evidence record: `.claude/specs/cross-tool-plugin-output/prove-out.md` (assumption register,
  failure ladders, the nine probe releases)
- Generator: `tools/gen-cross-tool/`; output: `dist/cursor/`, `dist/codex/`,
  `.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`
- CI / release: `.github/workflows/ci.yml` (`cross-tool-drift`, widened `plugin-version-bump`),
  `.github/workflows/release-tag.yml`
- Related ADRs: [`plugin-distribution.md`](plugin-distribution.md) (extended),
  [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md),
  [`b6p-cli-distribution.md`](b6p-cli-distribution.md)
