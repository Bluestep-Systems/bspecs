---
name: spec-execute
description: Execute one task from a feature spec. Updates the task checkbox when done. Use after `/spec-create` has produced an approved tasks.md.
---

# /spec-execute — Execute one task from a spec

## Steps

1. **Parse `$ARGUMENTS`** for feature name and task number (e.g. `add-validation-on-intake 3`). If missing, ask.
2. **Load context:**
   - Read `.claude/specs/<feature>/requirements.md`
   - Read `.claude/specs/<feature>/design.md`
   - Read `.claude/specs/<feature>/tasks.md`
   - Identify the task at the given number

   (Module-level READMEs were read at session start — don't re-read them here.)
3. **Check the task's prefix:**
   - **`[PLATFORM]`** — STOP, do NOT touch code. Tell the user:
     > Task <N> is a `[PLATFORM]` task: <description>. It must be done in the BlueStep UI. When it's complete, tell me and I'll mark it `[x]`, or call `/spec-execute <feature> <N+1>` to skip to the next task.
   - **`[CODE]`** — proceed to step 4.
   - **No prefix** — this is an older spec from before the convention. Warn the user once: "Task <N> has no `[PLATFORM]`/`[CODE]` prefix — treating as `[CODE]`. Consider updating the spec." Then proceed to step 4.
4. **Verify prerequisites are done.** Scan tasks.md for any earlier `[PLATFORM]` task that is still `[ ]` (not checked). If any unchecked `[PLATFORM]` task exists *before* the requested task, STOP and tell the user:
   > Task <N> may depend on `[PLATFORM]` task <earlier_N>: <description>. That platform work is not marked done yet. Confirm it's complete (I'll mark it `[x]`) or pick a different task.
5. **Implement exactly one task.** No scope creep:
   - Touch only the files the task references
   - Do not start the next task
   - Apply rules from `CLAUDE.md` (no `tsc`, no `.writable()`, no editing `declarations/`, no new components locally)
6. **Mark the task done:** update `.claude/specs/<feature>/tasks.md` — change `[ ]` to `[x]` for the completed task.
7. **Check the affected module's `draft/README.md`:**
   - If this task changed behavior that the README describes (Overview, Behavior, Fields used, External dependencies), update the README in the same change so the platform doc stays in sync.
   - If the change is internal-only (refactor, comment, log message) and doesn't alter documented behavior, leave the README alone.
   - When unsure, ask the user: "This task changed `<what>` — should I reflect it in `draft/README.md`?"
8. **STOP. Tell the user: "Task <N> done. Review and approve before /spec-execute <feature> <N+1>."** Do not auto-continue.

## When the user says a `[PLATFORM]` task is done

If the user comes back and says "I did task <N> on the platform", just edit `tasks.md` to mark it `[x]`. No code changes, no push. The task is closed.
