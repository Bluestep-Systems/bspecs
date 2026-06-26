# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Blocking publication / cross-machine use

- [ ] **`bspecs doctor` command.** Deprioritised — Option 2 removes most of its reason to exist (no PAT, no `~/.npmrc` to validate). The remaining value is checking the Node version and the one-time `b6p auth set` platform credential. Revisit if first-run auth issues become common. (The `init` name is now taken by `bspecs init` — install-into-current-directory, see the `init-current-directory` spec — so this env-validation idea must use `doctor` or another name.) See [`docs/decisions/install-friction-and-registry.md`](docs/decisions/install-friction-and-registry.md).

## Build / tooling

- [ ] **Convert the source to TypeScript.** Org policy: no raw JS in source. Convert `cli.js` and `src/*.js` (`prompts.js`, `scaffold.js`, `utils.js`, `sync.js`) to TypeScript. The mechanical rename is quick, but the wiring is the real work: add `tsconfig.json` + a `tsc` build step, emit to `dist/`, point `package.json` `bin`/`main` at the compiled output, update the published `files` list (currently `cli.js`, `src/`, `templates/` → likely `dist/`, `templates/`), and update the dev/run instructions in `CLAUDE.md` (`node cli.js`) plus `test-scaffold.mjs`'s import of `./src/scaffold.js`. **Out of scope:** the `templates/` tree — its `.js`/`.template` files are scaffolded *content* for generated projects, not bspecs source, so they stay as-is. (Requested by an engineer.)

- [ ] **GitHub Releases aren't created on publish.** `.github/workflows/publish.yml` fires on a `vX.Y.Z` tag and runs `npm publish`, but it never creates a GitHub **Release** object — so the repo's Releases page is stale (stuck at the last manually-created release, `v0.9.0`) even though tags + npm are current through `v0.11.1`. Tags ≠ Releases. **Fix:** add a release-creation step to `publish.yml` (e.g. `gh release create "$GITHUB_REF_NAME" --generate-notes`, or `softprops/action-gh-release`, needs `permissions: contents: write`) so each published tag also gets a Release. **Backfill:** the existing tags `v0.10.0`, `v0.11.0`, `v0.11.1` have no Release — create them with `gh release create <tag> --verify-tag --notes "…"` (notes from `CHANGELOG.md`); mark `v0.11.1` `--latest`. _Related CI hygiene (same workflow files): the publish/CI runs warn that `actions/checkout@v4` + `actions/setup-node@v4` are forced onto Node 24 (GitHub deprecating the Node 20 runner) — bump those action versions when convenient._

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

- [ ] **`--snapshot` + `--message` in push — restore a snapshot path.** Today the scaffolded `/b6p-push` skill runs a **plain** `npx b6p --yes push --file ...` only; it never passes `--snapshot`/`--message`, so the scaffolded flow records **no** server-side history. (The old `~/.bluestep`-based snapshot conventions that used to cover this were dropped — see the resolved "Scaffolded snapshot conventions conflict" item under *Rules consolidation follow-ups* — but they pointed at non-existent tooling and never gave consumers a working path either, so this is a real gap, not a regression.) The b6p CLI **does** support `b6p push --file <path> --snapshot --message "..."`. Split the decision in two:
  - **On-demand snapshot (uncontroversial, do this first).** Add an opt-in path to `/b6p-push`: when the user explicitly asks to save a version / checkpoint, or supplies a commit-style message, push with `--snapshot --message "<summary>"` instead of the plain push. Plain push stays the default. This just surfaces a documented CLI capability and conflicts with nothing (still `npx b6p`, no local `tsc`).
  - **Auto-snapshot (still undecided).** Whether a push should *automatically* become a snapshot — e.g. tied to `/spec-execute` task completion ("push task N as snapshot with message `feat(spec/FEATURE): task N done`"). This is the part that needs a convention decision: when does a push become a snapshot vs. a plain draft push? Keep deferred until there's a concrete use case.
- [ ] **`/b6p-deploy <feature>` skill.** Wrap `b6p deploy <config>` for multi-target deployment using the `## Deployment` section of a spec's `tasks.md`. Useful when a feature touches multiple components that all need to ship together to one or more environments. Defer until the multi-environment story for B6P is clearer.

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.
- [ ] **`/bug-fix` could use the `[PLATFORM]/[CODE]` distinction too.** Today it doesn't generate a structured task list, but for bugs that need both a platform change and a code change, the lack of structure makes the handoff vague.

## Rules consolidation follow-ups

- [ ] **Internal bspecs docs still name the removed `.b6p_metadata.json`.** The scaffolded templates were cleaned (skills + instruction tree no longer reference the file — the b6p CLI persists sync metadata internally, `ScriptMetaDataStore`), but bspecs' own working docs still mention it: `rule-audit.md` (R5, D3, R19) and `.claude/specs/consolidate-rules/tasks.md`. These don't ship to consumers and don't bind the agent, so it's low priority — fix opportunistically next time those docs are touched. (`CHANGELOG.md:395` is a historical entry — leave it.)

- [ ] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` now delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` does **not** delegate — it has no BlueStep components, so the BlueStep implementer doesn't fit. Consider a *generic* implementer subagent (read spec + scoped files in an isolated context, implement one task, return a summary) that this repo's `/spec-execute` delegates to, for the same context-isolation benefit on large bspecs specs. Mirror the `--inline` escape hatch. See `docs/decisions/subagents-and-delegated-execution.md`.

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
