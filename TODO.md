# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Blocking publication / cross-machine use

- [x] **Pre-flight check for `b6p` CLI.** ~~Detect at scaffold time whether `b6p` is reachable…~~ Superseded by the A5 migration (0.9.0): scaffold-time `b6p` detection was **removed by design** (the `npx b6p` model needs none). The scaffolder prints an `npm install` step (`scaffold.js:reportInstallStep`), the scaffolded `README.md` documents it, and `/b6p-pull`/`/b6p-push`/`/b6p-audit` redirect "command not found" to `npm install`.
- [x] **Upstream issue for `b6p-cli` publish.** ~~Open an issue…~~ Resolved without an issue: `@bluestep-systems/b6p-cli@0.1.0` was **published directly** to GitHub Packages from the monorepo (2026-06-19, via the `publish-chain` spec). `b6p-core` stays unpublished (cli bundles it). See `.claude/specs/publish-chain/` and `docs/decisions/b6p-cli-distribution.md`.
- [x] **`b6p` `npx` migration + shell-detection removal (the "A5" fast-follow).** ~~Now that `b6p-cli` is published…~~ Done in **0.9.0** (`.claude/specs/b6p-npx-migration/`): scaffolded projects get `b6p-cli` as a devDependency + scope-mapped `.npmrc`; `/b6p-pull`/`/b6p-push`/`/b6p-audit` invoke `npx b6p`; removed `detectEnvironmentFor`/`probeCommand`/`shellPrefixCandidates`, `.claude/b6p-env.json`, the `/b6p-detect` skill, and the `require-wsl-for-b6p` hook. See `CHANGELOG.md` `[0.9.0]` and the ADR.
- [ ] **GitHub Actions publish workflow.** Create `.github/workflows/publish.yml` that publishes `@bluestep-systems/bspecs` to GitHub Packages on `v*` tags. (First publish was a manual `npm publish`; automate the next.)
- [x] **Upstream: `b6p --version` bug filed.** `@bluestep-systems/b6p-cli@0.1.0` reports `--version` as `0.0.1` (stale hardcoded string; `package.json` is `0.1.0`). Discovered during the `publish-chain` spec; issue filed on `Bluestep-Systems/vscode-extension`. CLI version should be read from `package.json`. See `.claude/specs/publish-chain/tasks.md` task 12.
- [x] **Push to GitHub.** ~~Create `github.com/bluestep/bspecs`…~~ Done (2026-06-19): created `github.com/Bluestep-Systems/bspecs` (private, default `main`), repointed `origin` off `fchazarreta-bs`, pushed `main` + tags (incl. `v0.8.0`). Published `@bluestep-systems/bspecs@0.8.0`.
- [x] **Consumer auth docs.** Documented in `README.md` "Installation" (0.8.0): the `~/.npmrc` scope mapping + `${GITHUB_TOKEN}` placeholder and a `read:packages` PAT a dev needs to install from GitHub Packages.

## Scaffold setup (`bspecs` wizard)

- [x] **Make git initialization non-optional (or warn loudly).** Kept the "Initialize a git repository?" confirm but the message now warns that skipping degrades the implementer agent; skipping logs a loud follow-up warning. Added `isInsideGitRepo()` (`src/scaffold.js`) so the scaffolder detects an enclosing repo via `git rev-parse --is-inside-work-tree` and skips init (with a warning) rather than nesting a repo.
- [x] **Make project description optional or remove it.** Made optional — the `src/prompts.js` prompt no longer enforces a 20-char minimum and accepts an empty value (defaults to `''`). `PROJECT_DESCRIPTION` is retained because it feeds the generated `CLAUDE.md` (project context for Claude), `README.md`, and `package.json` description.
- [x] **Remove the Context7 dependency entirely.** Dropped the API-key prompt, the `CONTEXT7_API_KEY` variable, the whole `templates/vscode/` tree, and its `copyTemplateTree` call. Scrubbed Context7/`.vscode/mcp.json` references from the root `CLAUDE.md`/`README.md` templates, the module README template, the `b6p-commenter` agent, `.gitignore.template`, this repo's `CLAUDE.md`/`README.md`, and `test-scaffold.mjs` (now asserts the absence of any Context7 reference).

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

- [x] **Convert Brandon's `03-Agents/` role files into bspecs skills (B4).** Shipped in 0.7.0 as **subagents**, not skills: `b6p-commenter` and `b6p-code-review` (report-only) under `templates/claude/agents/`, plus `b6p-task-implementer` (the reframed workflow layer of `bluestep-dev` — its knowledge was already in `instructions/` from 0.6.0). `/spec-execute` delegates to the implementer by default (`--inline` escape hatch). See `.claude/specs/bluestep-subagents/` and `docs/decisions/subagents-and-delegated-execution.md`.

- [ ] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` now delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` does **not** delegate — it has no BlueStep components, so the BlueStep implementer doesn't fit. Consider a *generic* implementer subagent (read spec + scoped files in an isolated context, implement one task, return a summary) that this repo's `/spec-execute` delegates to, for the same context-isolation benefit on large bspecs specs. Mirror the `--inline` escape hatch. See `docs/decisions/subagents-and-delegated-execution.md`.

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
