# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Blocking publication / cross-machine use

- [x] **GitHub Actions publish workflow.** ✅ Done — `.github/workflows/publish.yml` (tag-triggered, public npm, provenance) + `.github/workflows/ci.yml` (PR + push smoke checks). See the `public-npm-publishing` spec.
- [x] **Reduce install friction — registry decision.** ✅ Done — Option 2 (publish to public npm) accepted. Both `bspecs` and `b6p-cli` are on the public npm registry; the PAT, `~/.npmrc` scope mapping, and `${GITHUB_TOKEN}` are no longer required. ADR flipped to Accepted: [`docs/decisions/install-friction-and-registry.md`](docs/decisions/install-friction-and-registry.md).
- [ ] **`bspecs doctor` / `bspecs init` command.** Deprioritised — Option 2 removes most of its reason to exist (no PAT, no `~/.npmrc` to validate). The remaining value is checking the Node version and the one-time `b6p auth set` platform credential. Revisit if first-run auth issues become common. See [`docs/decisions/install-friction-and-registry.md`](docs/decisions/install-friction-and-registry.md).

## Build / tooling

- [ ] **Convert the source to TypeScript.** Org policy: no raw JS in source. Convert `cli.js` and `src/*.js` (`prompts.js`, `scaffold.js`, `utils.js`, `sync.js`) to TypeScript. The mechanical rename is quick, but the wiring is the real work: add `tsconfig.json` + a `tsc` build step, emit to `dist/`, point `package.json` `bin`/`main` at the compiled output, update the published `files` list (currently `cli.js`, `src/`, `templates/` → likely `dist/`, `templates/`), and update the dev/run instructions in `CLAUDE.md` (`node cli.js`) plus `test-scaffold.mjs`'s import of `./src/scaffold.js`. **Out of scope:** the `templates/` tree — its `.js`/`.template` files are scaffolded *content* for generated projects, not bspecs source, so they stay as-is. (Requested by an engineer.)

## Template staleness

- [ ] **`bspecs sync` command.** Add a `bspecs sync` subcommand that updates infrastructure files (skills, hooks, settings, instructions, spec-templates) in an existing project. Uses a `.claude/bspecs.lock` file (written at scaffold time) with SHA-256 hashes of each file to detect user edits — files the user modified locally are skipped. The `SessionStart` hook in generated projects runs `bspecs sync --silent` automatically on every workspace open, resume, and compaction, so projects stay up to date without manual intervention.

## Flow improvements

- [x] **b6p-cli onboarding in scaffolds — first-run auth (Concern C).** ✅ Done — the three b6p skills (`b6p-pull`, `b6p-push`, `b6p-audit`) now run an auth preflight (`test -f ~/.b6p/secrets.enc`) and STOP with a "run `npx b6p auth set` first" message instead of hanging on the interactive credentials prompt; the one-time `auth set` step is surfaced in the scaffolded `CLAUDE.md` Sync-workflow section, not just README prose. The b6p CLI has no non-interactive `auth status`, so file-existence is the check. Discussion in [`docs/decisions/b6p-cli-onboarding-in-scaffolds.md`](docs/decisions/b6p-cli-onboarding-in-scaffolds.md) (Concern C). _Concern A (per-project download duplication) remains deferred — it's an A5 re-litigation, not a bug._
- [ ] **`/spec-status` should split `[PLATFORM]` vs `[CODE]` task counts.** Today it just counts `[x]` vs `[ ]`. A spec at 3/5 means very different things if the 2 pending tasks are `[PLATFORM]` (blocking) vs `[CODE]` (just unimplemented).
- [ ] **Spec consistency validation.** If `design.md` says "no platform-side changes" but `tasks.md` has `[PLATFORM]` tasks, nothing catches it. Could be a `/spec-validate` skill or a check inside `/spec-execute`.
- [ ] **Specs are too verbose — enforce simpler drafts.** Spec outputs (`requirements.md`, `design.md`, `tasks.md`) tend to come out over-long. Push the agent toward leaner first drafts. Open questions to resolve before implementing: (a) do we want less verbosity *across the board*, (b) should verbosity be *adjustable* (e.g. a flag or prompt setting), or (c) do we *enforce simple first, then augment on demand*? Applies to **both** the shipped template skills (`templates/claude/skills/spec-*`) **and** this workspace's adapted skills (`.claude/skills/spec-*`) — keep the two in sync.

### Resolved by 0.3.0 (audit skill)

- ~~`/b6p-pull` should handle re-pulls of existing modules~~ — `/b6p-audit` covers the "what changed on the platform" need on demand. Subsequent pulls still work; if the user wants the diff first, they run `/b6p-audit` then `/b6p-pull`.
- ~~`/b6p-push` should warn if the user is pushing against stale local state~~ — kept as on-demand `/b6p-audit` instead of automatic pre-flight, per design decision: most sessions push multiple times and the user knows whether parallel work is likely; b6p's server-side conflict detection covers the worst case. Reopen if real-world use shows lost work.

## b6p CLI integration — wave 2 (defer)

The full b6p CLI audit (see git history for the conversation) surfaced two more capabilities worth considering, both deferred until we have a concrete use case:

- [ ] **`--snapshot` + `--message` in push.** b6p supports pushing as a snapshot with a commit-style message for server-side history. Could be tied to `/spec-execute` task completion: "push task N as snapshot with message `feat(spec/FEATURE): task N done`". Needs a convention decision first — when does a push become a snapshot vs. a plain draft push?
- [ ] **`/b6p-deploy <feature>` skill.** Wrap `b6p deploy <config>` for multi-target deployment using the `## Deployment` section of a spec's `tasks.md`. Useful when a feature touches multiple components that all need to ship together to one or more environments. Defer until the multi-environment story for B6P is clearer.

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.
- [ ] **`/bug-fix` could use the `[PLATFORM]/[CODE]` distinction too.** Today it doesn't generate a structured task list, but for bugs that need both a platform change and a code change, the lack of structure makes the handoff vague.

## Rules consolidation follow-ups

- [ ] **Scaffolded snapshot conventions conflict with the `b6p` CLI flow.** The `templates/claude/instructions/conventions/` files `always-snapshot.md`, `snapshot-integrity.md`, `push-inner-draft.md`, and `tsc-rootdir.md` describe Brandon's personal `node ~/.bluestep/push.js` / `pull.js` snapshot workflow (tracking via `.b6p_url.json`, credentials in `~/.bluestep/config.json`). They are scaffolded into every project and listed in `index.md.template`, where they directly contradict the actual scaffolded sync flow on three axes:
  - **Tool.** The `/b6p-*` skills + scaffolded `CLAUDE.md` use `npx b6p` (the `b6p-cli` devDependency, tracking via `.b6p_metadata.json`, auth via `b6p auth set`). The conventions point at `~/.bluestep/*.js`, which do not exist in a consumer's environment — they are machine-local tooling. `always-snapshot.md` even says "never use the Write tool … always use the CLI scripts," competing head-on with the b6p skills.
  - **tsc.** Scaffolded `CLAUDE.md` rule 3 "NEVER run `tsc` locally" is hook-enforced by `block-tsc.sh`, but `snapshot-integrity.md` says "ALWAYS run `tsc` locally … BEFORE `push.js --snapshot`" — the hook would actively block that workflow.
  - **Snapshot step.** `always-snapshot.md` says "always snapshot after every code change," but the b6p flow has no snapshot step, and `b6p --snapshot` is still an undecided idea (see the "b6p CLI integration — wave 2" item above).
  The maintainers already scoped this away for the subagent (`.claude/specs/bluestep-subagents/design.md:78` — the snapshot-integrity tsc rule "is **not** the scaffolded flow"), but the files still ship to every project and bind the main agent. Predates the A5 `npx` migration (the old `wsl bash -lc 'b6p push'` flow conflicted the same way). **Decide:** (a) drop these `~/.bluestep` snapshot files from the scaffolded tree, (b) rewrite them to the b6p-CLI model once `b6p --snapshot` is decided, or (c) guard them as "only applies if you use the `~/.bluestep` scripts, not the b6p CLI." Needs its own spec/bug — out of scope for A5.

- [ ] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` now delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` does **not** delegate — it has no BlueStep components, so the BlueStep implementer doesn't fit. Consider a *generic* implementer subagent (read spec + scoped files in an isolated context, implement one task, return a summary) that this repo's `/spec-execute` delegates to, for the same context-isolation benefit on large bspecs specs. Mirror the `--inline` escape hatch. See `docs/decisions/subagents-and-delegated-execution.md`.

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
