# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Blocking publication / cross-machine use

- [ ] **Pre-flight check for `b6p` CLI.** Detect at scaffold time whether `b6p` is reachable; if not, print install instructions from the upstream README plus a note about SSH access requirements. Also surface the same info in the scaffolded project's `README.md` and add guidance to `/b6p-pull` and `/b6p-push` skills for "command not found" errors. See `docs/decisions/b6p-cli-distribution.md`.
- [ ] **Upstream issue for `b6p-cli` publish.** Open an issue in `Bluestep-Systems/vscode-extension` requesting that `@bluestep-systems/b6p-core` and `@bluestep-systems/b6p-cli` be published to GitHub Packages (or npm public). This unblocks moving from detect-and-guide to a proper `peerDependencies` declaration. Cite our CLI as a concrete consumer. See `docs/decisions/b6p-cli-distribution.md`.
- [ ] **`b6p` peer-dependency migration (depends on upstream publish).** Once `b6p-cli` is published, remove the pre-flight check code and add `"@bluestep-systems/b6p-cli": "^X.Y.Z"` under `peerDependencies` in our `package.json`. Note the change in `CHANGELOG.md`.
- [ ] **GitHub Actions publish workflow.** Create `.github/workflows/publish.yml` that publishes `@bluestep/bspecs` to GitHub Packages on `v*` tags. Same pattern as we'll need for the upstream b6p publish.
- [ ] **Push to GitHub.** Create `github.com/bluestep/bspecs` (private) and push `main` + tags.
- [ ] **Consumer auth docs.** Document the `npm login --scope=@bluestep --registry=https://npm.pkg.github.com` flow and the `~/.npmrc` config a dev needs to install our CLI from GitHub Packages. Probably goes in our top-level `README.md` (which we don't have yet for the CLI repo).

## Scaffold setup (`bspecs` wizard)

- [ ] **Make git initialization non-optional (or warn loudly).** The implementer agent relies on `git diff` to produce its summary, so a project without a repo breaks that flow. Either drop the "Initialize a git repository?" confirm in `src/prompts.js` and always init, or keep the prompt but warn clearly that skipping degrades the implementer agent. Also check whether the target directory (or a parent) already contains a `.git` repo and surface that to the user before initializing — avoid nesting a new repo inside an existing one. See `src/prompts.js:62` and `src/scaffold.js` git init.
- [ ] **Make project description optional or remove it.** The "Project description (min 20 chars)" prompt in `src/prompts.js:44` is currently required. Decide whether `PROJECT_DESCRIPTION` is actually used anywhere meaningful (it's a template var) — if not, remove the prompt and the variable; if marginally useful, make it optional (allow empty, drop the 20-char minimum).
- [ ] **Remove the Context7 dependency entirely.** bspecs targets BlueStep items and doesn't need external library docs. Drop the Context7 API key prompt (`src/prompts.js:55`), the `CONTEXT7_API_KEY` template variable, the `.vscode/mcp.json` Context7 MCP scaffolding (`templates/vscode/`), and the `copyTemplateTree` call for the vscode tree in `src/scaffold.js`. Update `CLAUDE.md` (architecture + "what gets scaffolded") and any docs that mention Context7.

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

- [x] **Convert Brandon's `03-Agents/` role files into bspecs skills (B4).** Shipped in 0.7.0 as **subagents**, not skills: `b6p-commenter` and `b6p-code-review` (report-only) under `templates/claude/agents/`, plus `b6p-task-implementer` (the reframed workflow layer of `bluestep-dev` — its knowledge was already in `instructions/` from 0.6.0). `/spec-execute` delegates to the implementer by default (`--inline` escape hatch). See `.claude/specs/bluestep-subagents/` and `docs/decisions/subagents-and-delegated-execution.md`.

- [ ] **Delegate-to-subagent for this repo's own `/spec-execute`.** The scaffolded `/spec-execute` now delegates BlueStep task implementation to `b6p-task-implementer` to keep context lean on large features (0.7.0). This repo's own `.claude/skills/spec-execute` does **not** delegate — it has no BlueStep components, so the BlueStep implementer doesn't fit. Consider a *generic* implementer subagent (read spec + scoped files in an isolated context, implement one task, return a summary) that this repo's `/spec-execute` delegates to, for the same context-isolation benefit on large bspecs specs. Mirror the `--inline` escape hatch. See `docs/decisions/subagents-and-delegated-execution.md`.

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
