# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Blocking publication / cross-machine use

- [ ] **`bspecs doctor` command.** Deprioritised — Option 2 removes most of its reason to exist (no PAT, no `~/.npmrc` to validate). The remaining value is checking the Node version and the one-time `b6p auth set` platform credential. Revisit if first-run auth issues become common. (The `init` name is now taken by `bspecs init` — install-into-current-directory, see the `init-current-directory` spec — so this env-validation idea must use `doctor` or another name.) See [`docs/decisions/install-friction-and-registry.md`](docs/decisions/install-friction-and-registry.md).

## Build / tooling

- [ ] **Convert the source to TypeScript.** Org policy: no raw JS in source. Convert `cli.js` and `src/*.js` (`prompts.js`, `scaffold.js`, `utils.js`, `sync.js`) to TypeScript. The mechanical rename is quick, but the wiring is the real work: add `tsconfig.json` + a `tsc` build step, emit to `dist/`, point `package.json` `bin`/`main` at the compiled output, update the published `files` list (currently `cli.js`, `src/`, `templates/` → likely `dist/`, `templates/`), and update the dev/run instructions in `CLAUDE.md` (`node cli.js`) plus `test-scaffold.mjs`'s import of `./src/scaffold.js`. **Out of scope:** the `templates/` tree — its `.js`/`.template` files are scaffolded *content* for generated projects, not bspecs source, so they stay as-is. (Requested by an engineer.)

- [x] ~~**GitHub Releases aren't created on publish.**~~ — **Resolved by the plugin-distribution change.** `.github/workflows/publish.yml` no longer runs `npm publish`; on every `vX.Y.Z` tag it now creates a GitHub **Release** (`gh release create "$TAG" --verify-tag --generate-notes`, with `permissions: contents: write`), so tags and Releases stay in step. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md). _(Remaining backfill of old release-less tags and the `actions/checkout@v4`/`setup-node@v4` Node-runner bump are minor CI hygiene — do opportunistically.)_

- [x] ~~**npm-free delivery via the VSCode extension (explore).**~~ — **Resolved by distributing the tooling as a Claude Code plugin** via the public `bluestep` marketplace (no npm, no binary, no PATH setup), with `/bluestep-init` as the in-session project bootstrap. This supersedes the VSCode-extension route (and the standalone-binary route) for the no-npm audience. See [`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md); the VSCode-extension feasibility analysis in [`docs/decisions/npm-free-scaffolding-via-vscode-extension.md`](docs/decisions/npm-free-scaffolding-via-vscode-extension.md) is amended to point at it.

## Template staleness

- [ ] **`bspecs sync` command.** Add a `bspecs sync` subcommand that updates infrastructure files (skills, hooks, settings, instructions, spec-templates) in an existing project. Uses a `.claude/bspecs.lock` file (written at scaffold time) with SHA-256 hashes of each file to detect user edits — files the user modified locally are skipped. The `SessionStart` hook in generated projects runs `bspecs sync --silent` automatically on every workspace open, resume, and compaction, so projects stay up to date without manual intervention.

## Flow improvements

- [ ] **`/spec-status` should split `[PLATFORM]` vs `[CODE]` task counts.** Today it just counts `[x]` vs `[ ]`. A spec at 3/5 means very different things if the 2 pending tasks are `[PLATFORM]` (blocking) vs `[CODE]` (just unimplemented).
- [ ] **Spec consistency validation.** If `design.md` says "no platform-side changes" but `tasks.md` has `[PLATFORM]` tasks, nothing catches it. Could be a `/spec-validate` skill or a check inside `/spec-execute`.
- [ ] **Specs are too verbose — enforce simpler drafts.** Spec outputs (`requirements.md`, `design.md`, `tasks.md`) tend to come out over-long. Push the agent toward leaner first drafts. Open questions to resolve before implementing: (a) do we want less verbosity *across the board*, (b) should verbosity be *adjustable* (e.g. a flag or prompt setting), or (c) do we *enforce simple first, then augment on demand*? Applies to **both** the shipped template skills (`templates/claude/skills/spec-*`) **and** this workspace's adapted skills (`.claude/skills/spec-*`) — keep the two in sync.

### Resolved by 0.3.0 (audit skill)

- ~~`/b6p-pull` should handle re-pulls of existing modules~~ — `/b6p-audit` covers the "what changed on the platform" need on demand. Subsequent pulls still work; if the user wants the diff first, they run `/b6p-audit` then `/b6p-pull`.
- ~~`/b6p-push` should warn if the user is pushing against stale local state~~ — kept as on-demand `/b6p-audit` instead of automatic pre-flight, per design decision: most sessions push multiple times and the user knows whether parallel work is likely; b6p's server-side conflict detection covers the worst case. Reopen if real-world use shows lost work.

## b6p CLI integration — wave 2 (defer)

The full b6p CLI audit (see git history for the conversation) surfaced two more capabilities worth considering, both deferred until we have a concrete use case:

- [ ] **Auto-snapshot in push (still undecided).** Whether a push should *automatically* become a snapshot — e.g. tied to `/spec-execute` task completion ("push task N as snapshot with message `feat(spec/FEATURE): task N done`"). This is the part that needs a convention decision: when does a push become a snapshot vs. a plain draft push? Keep deferred until there's a concrete use case. The `/b6p-push` skill explicitly does **not** auto-snapshot today. (The **on-demand** snapshot half shipped in plugin 0.6.0 — `/b6p-push` always offers a plain-vs-snapshot choice, promoted to a project-level rule in the scaffolded `CLAUDE.md`. See [`DONE.md`](DONE.md).)
- [ ] **`/b6p-deploy <feature>` skill.** Wrap `b6p deploy <config>` for multi-target deployment using the `## Deployment` section of a spec's `tasks.md`. Useful when a feature touches multiple components that all need to ship together to one or more environments. Defer until the multi-environment story for B6P is clearer.

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.
- [x] ~~**`/bug-fix` could use the `[PLATFORM]/[CODE]` distinction too.**~~ — **Resolved in plugin 0.5.0.** `/bug-fix` was renamed and broadened into `/quick-task`, which drafts a single living doc (`.claude/quick-tasks/<slug>.md`) whose approach checklist tags each item `[PLATFORM]`/`[CODE]`, giving the mixed-change handoff explicit structure. See `CHANGELOG.md` (plugin 0.5.0).

## Rules consolidation follow-ups

- [ ] **Internal bspecs docs still name the removed `.b6p_metadata.json`.** The scaffolded templates were cleaned (skills + instruction tree no longer reference the file — the b6p CLI persists sync metadata internally, `ScriptMetaDataStore`), but bspecs' own working docs still mention it: `rule-audit.md` (R5, D3, R19) and `.claude/specs/consolidate-rules/tasks.md`. These don't ship to consumers and don't bind the agent, so it's low priority — fix opportunistically next time those docs are touched. (`CHANGELOG.md:395` is a historical entry — leave it.)

- [x] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` now delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` does **not** delegate — it has no BlueStep components, so the BlueStep implementer doesn't fit. Consider a *generic* implementer subagent (read spec + scoped files in an isolated context, implement one task, return a summary) that this repo's `/spec-execute` delegates to, for the same context-isolation benefit on large bspecs specs. Mirror the `--inline` escape hatch. See `docs/decisions/subagents-and-delegated-execution.md`. **Done:** added `.claude/agents/spec-task-implementer.md` (generic, repo-local) and wired `.claude/skills/spec-execute` to delegate by default with `--inline`.

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
