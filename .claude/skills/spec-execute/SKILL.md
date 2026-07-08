---
name: spec-execute
description: Execute one task from a feature spec. By default delegates implementation to the spec-task-implementer subagent (isolated context); pass --inline to implement in the main session. Updates the task checkbox when done. Use after `/spec-create` has produced an approved tasks.md.
---

# /spec-execute — Execute one task from a spec

## Steps

1. **Parse `$ARGUMENTS`** for feature name, task number, and an optional `--inline` flag (e.g. `add-sync-subcommand 3` or `add-sync-subcommand 3 --inline`). The flag may appear anywhere; strip it before reading the feature/task. If feature or task is missing, ask.
   - **Default (no flag):** the task is implemented by delegating to the `spec-task-implementer` subagent, so scoped source reads stay out of this session (see step 4).
   - **`--inline`:** implement the task directly in this session — for trivial one-liners where spinning a fresh context isn't worth the re-read.
2. **Load context:**
   - Read `.claude/specs/<feature>/requirements.md`
   - Read `.claude/specs/<feature>/design.md`
   - Read `.claude/specs/<feature>/tasks.md`
   - Identify the task at the given number.
   - Read only the files this task touches — don't pre-load unrelated areas.
3. **Verify prerequisites are done.** Scan tasks.md for any earlier task the requested task depends on that is still `[ ]`. If one exists, STOP and tell the user which earlier task should be done first.
4. **Implement exactly one task.** No scope creep — touch only the files the task references, do not start the next task, apply the conventions in `CLAUDE.md` (template variables, `.template` stripping, English-only committed files, single source of truth / `index.md` sync).

   **Default — delegate to the `spec-task-implementer` subagent:**
   - Spawn the `spec-task-implementer` subagent (via the Task/Agent tool) and give it the feature name and this task number. It reads the spec and only the files the task references in its **own** context, implements the one task, and returns a structured summary — keeping that bulk out of this session.
   - When it returns, show the user its summary and the **git diff** of what changed (`git diff` / `git status` for the touched files) so the change is reviewable here.
   - The subagent does **not** mark the checkbox or chain other agents — the steps below (verify, mark, docs sync, STOP) stay in this session.

   **`--inline` — implement here:** do the edits directly in this session (the prior behavior), then continue to step 5.
5. **Verify the change.** This repo has no test suite — verify manually per `CLAUDE.md`. On the default path, also weigh anything the subagent listed under **Flags for the human** (its edits trigger the same `ide_diagnostics` you check below):
   - For CLI/scaffold logic: run `node cli.js -v`, `node cli.js -h`, or a scaffold into a scratch dir and inspect the generated tree.
   - For template/skill/doc edits: re-read the produced file and confirm it's well-formed.
   - Check the most recent `ide_diagnostics` blocks for any `Error` in a file this task touched. If present, **STOP**, fix, and re-verify before marking done. `Warning`/`Information` can be ignored unless they point to a real problem.
6. **Mark the task done:** update `.claude/specs/<feature>/tasks.md` — change `[ ]` to `[x]` for the completed task.
7. **Keep docs in sync.** If this task changed behavior described in `CLAUDE.md` or `README.md`, or completed a `TODO.md` item, update them in the same change. If an instruction file was added under `templates/claude/instructions/`, confirm it has a matching `index.md` entry.
8. **STOP.** Tell the user the task is done and to review and approve before running the next one. Present the next command on its own line as a **fenced code block** — with `<feature>` and `<N+1>` filled in with the real values, e.g.

   ```
   /spec-execute add-validation-on-intake 4
   ```

   so the terminal UI renders a copy button. Do **not** bury the command in inline backticks inside a sentence (no copy button there). Do not auto-continue.

## When all tasks are done

Once every task is `[x]`, remind the user: propose a commit message (title + body) based on the diff per `CLAUDE.md`, and note any `CHANGELOG.md` / `TODO.md` updates that should accompany it. Do not run `git commit` unless the user says so.
