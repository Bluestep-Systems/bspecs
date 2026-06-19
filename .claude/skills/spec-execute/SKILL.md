---
name: spec-execute
description: Execute one task from a feature spec. Updates the task checkbox when done. Use after `/spec-create` has produced an approved tasks.md.
---

# /spec-execute — Execute one task from a spec

## Steps

1. **Parse `$ARGUMENTS`** for feature name and task number (e.g. `add-sync-subcommand 3`). If missing, ask.
2. **Load context:**
   - Read `.claude/specs/<feature>/requirements.md`
   - Read `.claude/specs/<feature>/design.md`
   - Read `.claude/specs/<feature>/tasks.md`
   - Identify the task at the given number.
   - Read only the files this task touches — don't pre-load unrelated areas.
3. **Verify prerequisites are done.** Scan tasks.md for any earlier task the requested task depends on that is still `[ ]`. If one exists, STOP and tell the user which earlier task should be done first.
4. **Implement exactly one task.** No scope creep:
   - Touch only the files the task references.
   - Do not start the next task.
   - Apply the conventions in `CLAUDE.md` (template variables, `.template` stripping, English-only committed files).
5. **Verify the change.** This repo has no test suite — verify manually per `CLAUDE.md`:
   - For CLI/scaffold logic: run `node cli.js -v`, `node cli.js -h`, or a scaffold into a scratch dir and inspect the generated tree.
   - For template/skill/doc edits: re-read the produced file and confirm it's well-formed.
   - Check the most recent `ide_diagnostics` blocks for any `Error` in a file this task touched. If present, **STOP**, fix, and re-verify before marking done. `Warning`/`Information` can be ignored unless they point to a real problem.
6. **Mark the task done:** update `.claude/specs/<feature>/tasks.md` — change `[ ]` to `[x]` for the completed task.
7. **Keep docs in sync.** If this task changed behavior described in `CLAUDE.md` or `README.md`, or completed a `TODO.md` item, update them in the same change. If an instruction file was added under `templates/claude/instructions/`, confirm it has a matching `index.md` entry.
8. **STOP. Tell the user: "Task <N> done. Review and approve before /spec-execute <feature> <N+1>."** Do not auto-continue.

## When all tasks are done

Once every task is `[x]`, remind the user: propose a commit message (title + body) based on the diff per `CLAUDE.md`, and note any `CHANGELOG.md` / `TODO.md` updates that should accompany it. Do not run `git commit` unless the user says so.
