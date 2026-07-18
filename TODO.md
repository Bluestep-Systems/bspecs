# TODO

Living list of pending work for `@bluestep/bspecs`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`. Completed work is archived in [`DONE.md`](DONE.md).

## Build / tooling

- [ ] **Convert the source to TypeScript.** Org policy: no raw JS in source. Convert `cli.js` and `src/*.js` (`prompts.js`, `scaffold.js`, `utils.js`, `sync.js`) to TypeScript. The mechanical rename is quick, but the wiring is the real work: add `tsconfig.json` + a `tsc` build step, emit to `dist/`, point `package.json` `bin`/`main` at the compiled output, update the published `files` list (currently `cli.js`, `src/`, `templates/` → likely `dist/`, `templates/`), and update the dev/run instructions in `CLAUDE.md` (`node cli.js`) plus `test-scaffold.mjs`'s import of `./src/scaffold.js`. **Out of scope:** the `templates/` tree — its `.js`/`.template` files are scaffolded *content* for generated projects, not bspecs source, so they stay as-is. (Requested by an engineer.)

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

## MCP tool-inventory audit (separate from Phase 4 of the platform-MCP authoring work — see [`DONE.md`](DONE.md))

- [ ] **Audit the full ~80-tool MCP surface for agent-usability.** For every tool the per-org MCP server advertises (`tools/list`), verify its **description is self-sufficient** — an agent can tell *how* to call it (args/shape) and *when* to use it (vs. a sibling tool) from the description alone. The primary deliverable is **feedback to whoever owns the platform MCP server** for the descriptions that fall short (the descriptions live on the server, not in bspecs); optionally a `bluestep-reference` page summarizing the surface. Distinct from Phase 4, which tests only the authoring/wiring tools it uses (`add_queries`/`add_forms`/`add_field_access` + `form`/`field`/`option_list`/`view`/`record_type`) end-to-end on a playground org. A blanket pass/fail smoke test of all ~80 tools is explicitly *not* the goal — description quality for agent use is. See `.claude/specs/mcp-platform-authoring/` and `docs/decisions/platform-mcp-integration.md` (tool inventory).

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.

## Rules consolidation follow-ups

- [ ] **Internal bspecs docs still name the removed `.b6p_metadata.json`.** The scaffolded templates were cleaned (skills + instruction tree no longer reference the file — the b6p CLI persists sync metadata internally, `ScriptMetaDataStore`), but bspecs' own working docs still mention it: `rule-audit.md` (R5, D3, R19) and `.claude/specs/consolidate-rules/tasks.md`. These don't ship to consumers and don't bind the agent, so it's low priority — fix opportunistically next time those docs are touched. (`CHANGELOG.md:395` is a historical entry — leave it.)

## Done

Completed work has been archived to [`DONE.md`](DONE.md) to keep this list focused on pending work.
