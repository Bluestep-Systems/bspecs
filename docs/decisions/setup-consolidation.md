# ADR: One setup skill, setup as a step, and the end of `block-tsc`

**Status:** Accepted (2026-09-22)

**Date:** 2026-09-22

## Context

Between 2026-09-09 and 09-22 the plugin gained three setup skills — `/b6p-init` (once per machine),
`/project-init` (once per project) and `/b6p-update` (bring old projects up to date) — across
releases 0.33.0 to 0.35.0. None of those releases was announced, so no user had learned the names
when this decision was taken. Three things were wrong with the shape:

- A user who wants to push a merge report had to know which of three commands applied, and that a
  fourth (`core-tools`' `/repo-setup`) belonged to another plugin. The split — machine vs project vs
  later — is a maintainer's distinction, not a user's.
- The three referenced each other in a loop (`/project-init` re-checked the machine and pointed at
  `/b6p-init`; `/b6p-init` ended by pointing at `/project-init`; `/project-init` found an old file
  and pointed at `/b6p-update`; `/b6p-update`'s settings migration read `/project-init` as its
  source of truth) and cost three always-on skill descriptions in every session on the machine.
- One layout was unsupported: a parent folder holding B6P workspaces next to other repos, opened as
  one session. Setup at that root either applied platform rules to non-B6P code or opted the whole
  tree out.

Separately, the `block-tsc` guardrail was measured over every Claude Code transcript on the
maintainer's machine since the hooks started working (2026-09-09, when the `jq` fail-open bug was
fixed): **15 matches in 14 days, 0 true positives** — no `tsc` was ever run against a component's
`draft/`. It blocked 3 real invocations in an off-platform bundle repo (two `tsc --noEmit`, one
`tsc -v`), 9 mentions of the word in commit-message heredocs, `ls` and `grep`, and 2 of its own
self-tests; 1 mention slipped through. This is the picture that removed `block-inline-frontend` in
0.32.0. That repo carries no `U######/` folder and no rules-file marker, so a "B6P workspace only"
gate would have spared the three — but a gate is not the argument: a hook with zero true positives
in two weeks of daily use is cost without a benefit to weigh it against.

## Decision

1. **One skill, `/b6p-setup`**, replaces the three. Step 1 is the machine (binary, login, plugin for
   the tool you are in, optional token — check first, act only on what is missing); step 2 is the
   folder (detect what it is, write the missing files, then run the migration catalogue); `--all`
   sweeps the machine. **No aliases**: the three folders are removed in the same release, because
   nobody had learned the names.
2. **Setup is a step the daily skills take, not a command a user must know.** `/b6p-pull`,
   `/b6p-push`, `/spec-create` and `/quick-task` detect a missing rules file, one from before the version marker, one on an older
   template, or rules left in `CLAUDE.md` — or a missing machine half — invoke `/b6p-setup` for the
   matching step and continue with the request. The `canary` SessionStart hook (Claude Code only;
   the other tools wire no session-start event) prints one line when a folder holds `U######/` and
   no rules file at all — a finite condition per project, unlike the permanent nag
   `per-project-migrations` rejected; a populated `CLAUDE.md` the user chose to keep silences it. The explicit
   command stays for whoever wants to look, and the README names it.
3. **The update is a mode of setup.** The migration catalogue and its assets stay data
   (`per-project-migrations` stands; only the procedure's home moved to `/b6p-setup`). A user learns
   their rules file is behind from the preflight's marker-version compare, at the moment the old file
   is costing something — not from a changelog.
4. **A parent of workspaces gets per-subfolder rules files**, never platform rules at the root; a
   non-B6P folder gets a three-way question (set up as B6P, opt out, or "not a BlueStep repo" →
   `core-tools`' `/repo-setup`).
5. **`block-tsc` is removed.** Rule 8 ("never run `tsc` locally; the b6p CLI runs the only build,
   during a publish push") stays as prose everywhere it appears; only the enforcement claim goes —
   and because templates 0.33.0–0.36.0 carried that claim in the always-on file, the rules template
   moves to marker 3 so existing projects detect the swap.
   `block-generated-files` and the canary stay. If a real case appears — an agent running `tsc` on a
   component draft and "fixing" types to satisfy missing declarations — the hook comes back with that
   transcript as its evidence and a path gate that spares off-platform bundles.
6. **The README opens with two prompts, not a procedure.** Prompt 1 is for a machine without the
   plugin (the agent installs what it can and hands back the install click, `b6p auth set` and the
   token); prompt 2 runs `/b6p-setup` without stopping except for credentials. Both go verbatim into
   the release newsletter; the headline is "the first time you pull, it sets itself up".

## Consequences

**Good.** One command to know, or none. Two always-on skill descriptions fewer in every session on
the machine. The migrations keep their additive, data-driven shape. Off-platform bundles inside B6P
workspaces can type-check again.

**Costs and risks.**

- **Codex users must re-trust hooks** after this release — `hooks.json` changed (the `Bash` matcher
  is gone). An untrusted hook fails silently; the changelog and the newsletter say so.
- **A teammate who clones a project gets no "plugin not installed" hint.** `/project-init` used to
  write `enabledPlugins: true`, which made Claude Code report the missing install; 0.36.0 dropped it
  (a project-level `true` with no user-scope install loads nothing while looking enabled) and this
  release keeps that. The project's `README.md` carries the install step instead.
- **A single broad skill may trigger less precisely than three specific ones.** Its description is
  written as situations. The three natural questions ("set up this project", "is this project up to
  date?", "install the b6p tools") are prove-out case (f) and had **not** been run when this shipped;
  if it misfires, the description is the lever, not a second skill.
- **A user prompt outranks skill text.** The README's second prompt is written to hand decisions to
  the skill, not to suppress its questions: a "do everything without asking me" prompt would make
  the agent skip the approvals the guardrails exist for (a rules file with the user's own lines, a
  populated `CLAUDE.md`).
- **Nothing here was tested with a user other than the maintainer.** The first user test decides
  whether the fused shape is intuitive or merely smaller; both prompts are the cheapest thing to
  change if it is not.
