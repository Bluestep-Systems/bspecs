# Changelog

## 0.5.0 — 2026-11-03

**core-tools now lives in the `bluestep` marketplace repo, under `plugins/core-tools/`.** Same
skills, same rule set, same measurement script; the install line (`core-tools@bluestep`) does not
change. Nothing to do but update. The `bluestep-ai` repo stops being the source and becomes a
pointer to the new home in phase 2 of the move. Claude Code-only for now: Cursor and Codex do not
get core-tools yet.

## 0.4.2 — 2026-10-21

**Every skill description is now a quoted string, so `/repo-setup` loads with its description again.**
Its `description:` held an unquoted `: ` ("builds, tests and deploys: a command CI runs"), which
YAML reads as a second key. The frontmatter failed to parse (`claude --debug` logged `Failed to
parse YAML frontmatter`), Claude Code loaded the skill with no description, and the model was never
offered it. `/plan` and `/task` parsed fine but are quoted too, so the next edit cannot break
them the same way. The `SKILL.md` template `/repo-setup` writes into other repos now quotes the
description as well, and step 5 says why. Nothing to do but update.

## 0.4.1 — 2026-09-22

**`/repo-setup` points at `/b6p-setup`.** bluestep-tools 0.37.0 folded `/b6p-init`, `/project-init` and
`/b6p-update` into one skill, `/b6p-setup`; the "stop if this is a BlueStep workspace" step names it.
No other change.

## 0.4.0 — 2026-09-17

**Every task in a spec now carries a marker: `[mechanical]`, `[routine]` or `[judgment]`.** 0.3.0
had one optional `[mechanical]` tag that nothing read. Now `/plan` requires one of three on every
task line and gives the planner a test to apply, in order, first yes wins: a design choice, UI
behaviour or a new pattern is `[judgment]`; a known shape with new content is `[routine]`; a repeat
of a pattern an earlier task in the same spec already proved is `[mechanical]`, and a first instance
never is. Doubt rates up. Two more things on a task line feed the runner: an optional `after: <n>`
clause for a dependency the file lists do not show, and the rule that **file lists must be
complete**, because the runner treats two tasks with no shared file as safe to run at once. The
header gains a **Gate** line, the exact command that must pass after every task, or `none`.

**`/task <feature>` with no task number now offers to run the rest of the spec.** It asks one
question, with the modes as options: one task; the remaining tasks in a row; the remaining tasks
in parallel across disjoint file lists (cap 3); either of those with `[judgment]` tasks included.
Flags (`--run`, `all`, `--parallel [N]`, `--include-judgment`) skip the question. In run mode
`/task` implements each task, runs the Gate, ticks the box and commits, one commit per task, and
stops only for a Gate that still fails after one fix, a done-when it cannot verify, a diff outside
the task's files, a `[judgment]` task it was not told to include, or a decision the spec did not
make. Parallel mode delegates one subagent per ready task and merges in task order, so the history
reads the same as a sequential run. `/task <feature> <n>` is unchanged: it still stops for approval
before editing and proposes the commit at the end.

**Markers pick the model tier.** `lane/core.md` gains *Model tiers by marker*: mechanical goes to
the cheapest available model, routine to the mid tier, judgment to the strongest or to the main
session itself. The tiers are roles, not vendor names; Claude Code's haiku / sonnet / the session's
model are named once in passing, the way 0.3.0 names `Explore`. On a tool with one model the
marker still sets how much review a result gets before its box is ticked. Rule 9 loosens from "do
not fan out coding work" to "do not fan out coding work **by hand**": the runner may, only across
tasks with disjoint file lists, and that clause is marked *verify* until the first parallel runs
show whether merge plus Gate catch what one implementer would have.

**Two corrections to 0.1.0 wording.** Spec-driven tasks no longer write a `.claude/tasks/` file;
the task line, the design and the commit already hold everything it held, so it cost a write and an
approval round per task for nothing. The standalone `/task <slug>` path keeps its file, because it
has no spec to lean on. And both skills stop telling you to start a fresh session for every task.
Rule 11 is about not carrying two *unrelated* tasks; the skills had hardened it into one session
per spec task, which is the expensive way round when the tasks share context. They now say:
continue while the context still fits the next task, start fresh when it does not.

**If you have a spec from 0.3.0:** add a **Gate** line to its `tasks.md` header and put a marker on
every unticked task; `[mechanical]`-or-nothing is gone, and run mode refuses a spec with an unmarked
line and names it. Single-task `/task <feature> <n>` still works on an unmarked spec.

No hooks, no new subagents. Always-on cost rises by one clause in the `/task` description.

## 0.3.0 — 2026-09-10

**`/harness` is now `/repo-setup`.** The old name said the wrong thing: "harness" reads as *test
harness* to most developers, and this skill runs nothing — it writes markdown. Worse, `lane/core.md`
already uses "the harness" to mean the tool you are running inside, so one word meant two things in
one plugin. If you had 0.2.0, `/harness` is gone; there is no alias, because a day-old skill with one
install is the cheapest possible moment to rename.

**Its description now says when to call it, not how it works.** That line is the only part loaded in
every session, and it decides whether the skill is ever picked — so it leads with the situations that
should reach for it (a command CI runs that the rules never mention, a stale command, rules that live
only in `CLAUDE.md` so Cursor and Codex see nothing, a repo with no `AGENTS.md`) instead of with the
files it writes. `SKILL.md` opens with **When to run this** and a two-row table of the modes, rather
than two paragraphs of rationale.

**Audited against the [agents.md](https://agents.md) convention, which found two real gaps.** The
template now has droppable **Commit and PR** and **Security** sections — both are recommended there
and neither had a slot. And the skill now sorts rules into **four** destinations instead of three:
anything true of one directory only goes in a nested `AGENTS.md` *in that directory*, because agents
read the nearest file and the closest one wins. In a monorepo that is the difference between a short
root file and a long one, and it costs nothing in sessions that never enter the directory. The skill
also now states plainly that `CLAUDE.md` is a Claude Code bridge and **not** part of that convention.

**The `explorer` and `implementer` subagents are removed.** Claude Code ships `Explore`, `Plan` and
`general-purpose`, which cover the same two jobs, so ours were charging ~145 tokens of listing in
every session to duplicate built-ins. `/task` and `/plan` now ask for a read-only search subagent or
a general-purpose one **by role**, name Claude Code's equivalent in passing, and say what to do where
the tool has no subagents at all — run it in a fresh session, which is what the task file is for.
That keeps the delegation rules in `lane/core.md` working on Codex and Cursor, where they never had
our agents anyway.

Always-on cost of the plugin drops from ~405 to ~260 tokens.

## 0.2.0 — 2026-09-10

Adds `/harness`. Run it in a repo with no agent setup and it reads the repo — package scripts,
build files, CI workflows, `.gitignore` — then writes a short `AGENTS.md` that **names** the `core`
rule set instead of copying it, a one-line `CLAUDE.md` bridge, and one skill per workflow that only
matters sometimes (build, release, a debugging recipe).

It is additive and there is no `--force`: a file that exists is never touched, because these files
are meant to be hand-edited afterwards. `/harness --check` writes nothing and reports drift — a
command CI runs that the rules file never mentions, a command in the file that no longer exists, a
missing `AGENTS.md` that leaves Cursor and Codex with no rules at all.

Two cases it deliberately refuses: a populated `CLAUDE.md` with no `AGENTS.md` beside it (writing
one would give the repo two rules files and each tool would read a different one — it offers the
migration instead and only with an explicit yes), and a repo with no build, no tests and no release,
where a generated file would cost every session and teach nothing.

## 0.1.0 — 2026-09-10

First cut. Ships the `core` rule set (`lane/core.md`), the person-facing `docs/working-habits.md`,
`/task` and `/plan`, the `explorer` and `implementer` subagents, and `tools/measure.py`.
No hooks. `/harness` and `/handoff` are not in this version.
