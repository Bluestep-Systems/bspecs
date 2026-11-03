---
name: plan
description: "Start a spec for work that needs design. Writes requirements.md, then design.md, then tasks.md under .claude/specs/<feature>/, with explicit approval between each. Use when the user wants to plan a feature or a change that touches several parts of a repo; for a small scoped change, use /task."
---

# /plan — requirements, design, tasks

A spec lives at `.claude/specs/<feature>/` as three files. Each phase needs explicit approval
before the next. The point is a self-contained spec: it names the files and interfaces involved,
says what is out of scope, and ends with a check that proves the whole thing works. Once it is
approved, implementation runs from the spec alone, so a session can stop and a later one pick up.

## Phase 0 — setup

1. Ask for the **feature name** (kebab-case) and a **one-line description**.
2. If a ticket system MCP is available and the user has a ticket, offer to seed from it. Fetch
   only the description, not the whole thread.
3. Create `.claude/specs/<feature>/`.

## Phase 1 — requirements

1. Copy `${CLAUDE_PLUGIN_ROOT}/skills/plan/templates/requirements.template.md` to
   `.claude/specs/<feature>/requirements.md` and fill it in.
2. **STOP.** Say: "Requirements drafted at `.claude/specs/<feature>/requirements.md`. Review and
   approve before I go on to design." Wait for an explicit yes.

## Phase 2 — design

1. Read the parts of the repo the feature touches, scoped: grep for the symbols and read the
   functions around the hits. For a wide survey, delegate to a read-only search subagent if the
   tool has one (in Claude Code, `Explore`) and use its summary; if it has none, grep and read
   bounded ranges yourself. Either way, do not load whole directories into this context.
2. Copy `templates/design.template.md` to `.claude/specs/<feature>/design.md` and fill it in.
   It must name the files and interfaces that change, the approach, how data moves, edge cases,
   and how to roll back.
3. **STOP.** Ask for approval before tasks.

## Phase 3 — tasks

1. Copy `templates/tasks.template.md` to `.claude/specs/<feature>/tasks.md`.
2. Fill the **Gate** line in the header: the exact command that must pass after every task (the
   test suite, a type check, a lint). Write `none` if the repo has no such command; then each
   task's done-when is the only check.
3. Break the work into tasks. Each task: a checkbox, a marker, the file paths it touches, and is
   small enough to finish in one session. Order them so a task never depends on a later one.
   **File lists must be complete.** The runner (`/task <feature> --run --parallel`) treats two
   tasks with no shared file as safe to run at the same time, so a path left off a list is a
   merge conflict later.
4. Mark every task. Answer these in order; the first yes wins, so doubt rates up:
   - **`[judgment]`** — is there a design choice left, UI behaviour, a new pattern, or anything
     the spec did not decide?
   - **`[routine]`** — is the shape known (a typed contract, a template, an existing example in
     the repo) but the content new? For example: adding a field through a typed contract and its
     fixtures.
   - **`[mechanical]`** — does it repeat a pattern an earlier task *in this spec* has already
     proved, with no new decision and nothing new added? The first instance of any pattern is
     never mechanical.
   A task with no marker is not a valid task line; the runner refuses a spec that has one.
5. Add `after: <n>, <m>` to a task line only when it depends on an earlier task that its file
   list does not reveal. Without the clause, a task depends only on earlier tasks whose file lists
   overlap its own. `after:` may never point at a later task or at one that does not exist.
6. Fill **Verification** at the bottom: the end-to-end check for the whole feature.
7. **STOP.** Ask for approval before any implementation.

## After approval

Tell the user to implement the tasks in order, one at a time. Keep going in the current session
while its context still fits the next task; start a fresh session when it no longer does, or when
switching to unrelated work. The spec is what makes the cold start work. Give the first task as a
copyable line:

```
/task <feature> 1
```

`/task` with a spec name and task number reads that task from `tasks.md` and runs it as one
living document. When a task's reads would otherwise fill the main session, delegate it to a
general-purpose subagent with the spec name, the task number, and the instruction to implement
only that task and return a summary — then the main session reviews the diff and ticks the box.
Where the tool has no subagents, run it in a fresh session instead; the task file is what makes
that work. `/task <feature>` with no task number offers the run modes instead: the remaining
tasks in one go, in parallel where file lists are disjoint, stopping at the first `[judgment]`
task unless told to include them.
