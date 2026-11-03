---
name: task
description: "Short workflow for a small, clearly scoped change or bug fix. Keeps one living document at .claude/tasks/<slug>.md with goal, files, done-when check, decisions and state, so the next session (or another tool) can pick it up without the transcript. Also runs the tasks of an approved spec, one at a time or all remaining ones in a row (in parallel where file lists are disjoint). Use for work that does not need design; for a feature, use /plan."
---

# /task — one task, one living document

The lightweight workflow. One markdown file you can review while the work happens, and that a
fresh session can resume from. If the work turns out to need design decisions or touches many
parts of the repo, **STOP and suggest `/plan` instead.**

## Steps

1. **Gather context.** From `$ARGUMENTS` or by asking, get: what needs to change (or the bug),
   expected vs actual behaviour for a bug, and any file or symbol the user already knows about.
   Ask once if the request is ambiguous; do not start reading to guess.

2. **Read scoped, not whole-file.** Grep for the symbols, strings or behaviour named in the
   request; read only the functions around the hits with offset and limit. Over about 300 lines,
   never read a whole file. If a code-intelligence tool is available (go to definition, find
   references), prefer it to grep-then-read. For a broad "where does X happen" question across
   many files, delegate to a read-only search subagent if the tool has one (in Claude Code,
   `Explore`), so the file bulk never enters this context.

3. **Draft the task file.** Copy `${CLAUDE_PLUGIN_ROOT}/skills/task/task.template.md` to
   `.claude/tasks/<slug>.md` (create the folder if missing; `<slug>` is short kebab-case). Fill
   every header line. **Files** lists real paths. **Done when** is a check someone can run, not a
   feeling. **Run** is the exact command. **Can I edit directly?** is one of `yes`, `use a
   worktree`, `review first`; pick from how risky the change is, and say why in one clause.
   Under **State**, write the plan as a short checklist. Keep the whole file under 60 lines.

4. **STOP. Give the user the file path and ask them to approve the approach before you edit
   any code.** Wait for an explicit yes.

5. **Implement.** Touch only the files listed. Tick each checklist item as it lands. When you make
   a choice along the way, write it under **Decisions** with the reason, at the moment you make it.
   If reality diverges from the plan, change the file rather than drifting from it. Run the
   **Run** command; if it fails, say so with the output.

6. **Wrap up.** Update **State** to done / next / blocked. Propose a commit message (title and
   body) from the diff; do not run `git commit` unless the user says so. The task file stays in
   the repo as the record. If the user is about to start something unrelated, say so and offer
   `/clear`.

## With a spec: `/task <feature> <n>`

When `$ARGUMENTS` names a spec in `.claude/specs/<feature>/` and a task number, skip steps 1
and 3: the task is the one numbered `<n>` in that spec's `tasks.md`, and **no task file is
written**. The task line, the parts of `requirements.md` and `design.md` it needs, and the
spec's **Gate** line are the whole brief; `tasks.md` is the record. Read the spec scoped to that
task. Then:

1. **STOP.** Say in chat what you will change and in which files, and wait for an explicit yes.
2. Implement inline, touching only the task's listed files. If the task's reads would fill this
   session, hand it to a general-purpose subagent at the tier its marker names (see *Model tiers
   by marker* in the `core` rule set), with the task line, the spec paths, and the instruction to
   implement only that task and return a summary; then review its summary and diff. Where the
   tool has no subagents, do it inline in a fresh session.
3. Run the Gate. If it fails, say so with the output.
4. When the task is done and reviewed, tick its box in `tasks.md` and propose a commit (shape
   below); do not run `git commit` unless the user says so.

Keep going in this session while its context still fits the next task; start a fresh session
when it no longer does, or when switching to unrelated work. `/task <feature>` alone (below) runs
the rest without stopping between tasks.

## Running a spec: `/task <feature>`

With a spec name and no task number, `/task` offers to run the remaining tasks. Off by default:
`/task <feature> <n>` never asks and behaves exactly as above.

### Choosing a mode

Count the unticked tasks by marker, then ask one question and wait for the pick. Use the tool
that asks the user a multiple-choice question when one exists (in Claude Code, `AskUserQuestion`);
otherwise print the list and wait for a number.

> How should I run `<feature>`? (N tasks remain: a mechanical, b routine, c judgment)
> 1. One task — the next unticked, or name a number
> 2. Run the remaining tasks, stop at the first `[judgment]`
> 3. Run the remaining tasks in parallel (up to 3), stop at the first `[judgment]`
> 4. Run everything, judgment included (one at a time)
> 5. Run everything in parallel, judgment included

Flags skip the question and map onto the same outcomes: `--run` (also `all`) is option 2;
`--parallel` or `--parallel N` on top of `--run` is option 3 with a cap (default 3);
`--include-judgment` turns 2 into 4 and 3 into 5. Option 1 is the single-task path above.

### Preconditions

Before the first task, check and stop with the fix if any fails: `tasks.md` **Status** is
Approved or In progress; the working tree is clean (per-task commits need it); the header has a
**Gate** line (`none` is allowed and passes trivially); every task line has a marker, one of
`[mechanical]`, `[routine]`, `[judgment]`. A spec written before markers existed fails the last
check; name the lines, tell the user to tag them, and stop. `after:` may only point at earlier
tasks that exist; anything else is an ambiguity, stop.

### Run mode (options 2 and 4)

Until nothing remains or a stop fires:

1. Take the lowest-numbered unticked task whose dependencies are ticked. A task depends on every
   earlier task whose file list shares a path with its own, plus anything in its `after:` clause.
2. If it is `[judgment]` and judgment is not included, stop.
3. Implement it. The user chose run mode; that is the approval, so do not ask. Use the marker's
   tier: delegate to a general-purpose subagent at that tier when the tool has one, stating the
   objective (the task line and the design section it needs), the output format (a summary:
   files changed, done-when evidence, open questions), the tools and sources (the spec files and
   the listed files only), and the boundaries (only these files, only this task, stop and report
   rather than guess, do not tick or commit). Otherwise do it inline. A `[judgment]` task, when
   included, runs in the main session.
4. Check the diff touches only the task's listed files. Run the Gate. If it fails, make one fix
   attempt and run it again; if it still fails, stop.
5. Verify the task's done-when. If it cannot be verified, stop.
6. Tick the box in `tasks.md`. Commit, staging only the task's files and `tasks.md`:

   ```
   feat(<feature>): task <n> — <short description>

   Marker: <marker>
   Spec: .claude/specs/<feature>/tasks.md
   ```

**Stop on any of:** a Gate that still fails after one fix attempt; a done-when that cannot be
verified; a diff touching a file outside the task's list; a `[judgment]` task without
`--include-judgment`; an ambiguity that would need a decision the spec did not make. Never guess
past one.

**On stop,** write one indented line under the task in `tasks.md`, `stopped <date>: <reason>`,
then report: which task stopped and why; the tasks done this run with their commit hashes; the
tasks that remain with their markers; and the copyable line to continue, `/task <feature> <n>`.
When the run finishes with nothing left, set **Status** to Complete and report the commits.

### Parallel mode (options 3 and 5)

Only on top of run mode, and only where the tool has subagents. Where it has none, say once
"no subagents here, running one at a time" and use run mode. Otherwise, until nothing remains or
a stop fires:

1. Build the ready set: unticked tasks whose dependencies are all ticked and whose file lists
   share no path with any task currently running. Leave out `[judgment]` unless included. Take
   up to N in task order.
2. Start one subagent per ready task, each on its own copy of the tree where the tool offers one
   (in Claude Code, a worktree), with the same four things as run mode step 3, and "do not tick or
   commit" in the boundaries.
3. As results return, hold them. Merge in task order, lowest number first, never out of order
   even when a later task finished sooner. After each merge do run mode steps 4 to 6: file-list
   check, Gate, done-when, tick, commit. Ticking and committing happen only here, in the main
   session, so `tasks.md` and the git history have one writer.
4. A stop condition in any task stops the whole run once the merges already in progress finish.
   Report unmerged results as "finished, not merged" with where their diff lives.
5. When the next ready task is `[judgment]` and judgment is included, let the running set finish
   and merge, then do that task alone in the main session.
6. Refill the ready set and repeat.

### Where the tool has no subagents and no model choice

Every mode still works: run mode is sequential and inline, `--parallel` degrades as above, and
the marker sets how much review each result gets before its box is ticked (see *Model tiers by
marker* in the `core` rule set). The ticks in `tasks.md` and the one-commit-per-task history are
the handoff if the session ends mid-run; a fresh session continues with `/task <feature>`.

## Resuming

If `.claude/tasks/<slug>.md` already exists for the slug, read it first and continue from
**State**. Do not reopen the previous transcript. For a spec, the ticks in `tasks.md` and any
`stopped` notes are the state; start from the first unticked task.
