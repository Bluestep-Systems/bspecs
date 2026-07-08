---
name: spec-execute
description: Execute one task from a feature spec. By default delegates implementation to the b6p-task-implementer subagent (isolated context); pass --inline to implement in the main session. Updates the task checkbox when done. Use after `/spec-create` has produced an approved tasks.md.
---

# /spec-execute — Execute one task from a spec

## Steps

1. **Parse `$ARGUMENTS`** for feature name, task number, and an optional `--inline` flag (e.g. `add-validation-on-intake 3` or `add-validation-on-intake 3 --inline`). The flag may appear anywhere; strip it before reading the feature/task. If feature or task is missing, ask.
   - **Default (no flag):** a `[CODE]` task is implemented by delegating to the `b6p-task-implementer` subagent, so the heavy declaration/source reads stay out of this session (see step 5).
   - **`--inline`:** implement the task directly in this session — for trivial one-liners where spinning a fresh context isn't worth the re-read.
2. **Load context:**
   - Read `.claude/specs/<feature>/requirements.md`
   - Read `.claude/specs/<feature>/design.md`
   - Read `.claude/specs/<feature>/tasks.md`
   - Identify the task at the given number

   - Read the `draft/README.md` of the component(s) this task touches, if not already in context. (Don't pre-load READMEs for unrelated components.)
3. **Check the task's prefix:**
   - **`[PLATFORM]`** — a platform authoring/wiring task, now **agent-executable when an org MCP is connected**. Follow the shared procedure at `${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/conventions/mcp-platform-authoring.md` (connection-check → approval echo → execute → declaration read-back). When not connected, that same procedure's path applies — offer `/bluestep-mcp-connect` (with the fresh-session caveat) or fall back to the human hand-back in the BlueStep UI. Do **not** restate its steps here. The **approval gate** and the mark-`[x]` bookkeeping (step 6) stay in this main session.
   - **`[CODE]`** — proceed to step 4.
   - **No prefix** — this is an older spec from before the convention. Warn the user once: "Task <N> has no `[PLATFORM]`/`[CODE]` prefix — treating as `[CODE]`. Consider updating the spec." Then proceed to step 4.
4. **Verify prerequisites are done.** Scan tasks.md for any earlier `[PLATFORM]` task that is still `[ ]` (not checked). If any unchecked `[PLATFORM]` task exists *before* the requested task, STOP and tell the user:
   > Task <N> may depend on `[PLATFORM]` task <earlier_N>: <description>. That platform work is not marked done yet. Confirm it's complete (I'll mark it `[x]`) or pick a different task.
5. **Implement exactly one task.** No scope creep — touch only the files the task references, do not start the next task, apply rules from `CLAUDE.md` (no `tsc`, no `.writable()`, no editing `declarations/`, no new components locally).

   **Default — delegate to the `b6p-task-implementer` subagent:**
   - Spawn the `b6p-task-implementer` subagent (via the Task/Agent tool) and give it the feature name and this task number. It reads the spec, the component's `declarations/`, and the relevant `bluestep-reference` skill files in its **own** context, implements the one task, and returns a structured summary — keeping that bulk out of this session.
   - When it returns, show the user its summary and the **git diff** of what changed (`git diff` / `git status` for the touched files) so the change is reviewable here.
   - The subagent does **not** mark the checkbox or chain other agents — the steps below (verify, mark, README sync, STOP) stay in this session.

   **`--inline` — implement here:** do the edits directly in this session (the prior behavior), then continue to 5.5.

5.5. **Verify IDE diagnostics.** Before marking the task done, check the most recent `ide_diagnostics` blocks injected by the `PostToolUse` hook after each `Edit`/`Write` (these fire on the subagent's edits too). Also weigh anything the subagent listed under **Flags for the human**.
   - If any entry has `severity: "Error"` in a file this task touched: **STOP.** Fix the error and re-verify before continuing. Do not mark the task done with pending errors.
   - `Warning` / `Information` entries (including spell-checker) can be ignored **unless** they point to a real problem — review before dismissing.
   - If an `Error` cannot be reproduced or looks like a false positive, report it explicitly: "The IDE reports `<error>` but I think it's a false positive because `<reason>` — should I continue?"
6. **Mark the task done:** update `.claude/specs/<feature>/tasks.md` — change `[ ]` to `[x]` for the completed task.
7. **Check the affected module's `draft/README.md`:**
   - If this task changed behavior that the README describes (Overview, Behavior, Fields used, External dependencies), update the README in the same change so the platform doc stays in sync.
   - If the change is internal-only (refactor, comment, log message) and doesn't alter documented behavior, leave the README alone.
   - When unsure, ask the user: "This task changed `<what>` — should I reflect it in `draft/README.md`?"
8. **STOP.** Tell the user the task is done and to review and approve before running the next one. Present the next command on its own line as a **fenced code block** — with `<feature>` and `<N+1>` filled in with the real values, e.g.

   ```
   /spec-execute add-validation-on-intake 4
   ```

   so the terminal UI renders a copy button. Do **not** bury the command in inline backticks inside a sentence (no copy button there). Do not auto-continue. In the same message, surface the implementer's summary + diff (default path) and offer the optional, user-invoked follow-ups — these never fire automatically:
   - `@b6p-commenter` — update the component's `draft/README.md` from the new code.
   - `@b6p-code-review` — a BlueStep-aware, report-only review of the change.

## When the user says a `[PLATFORM]` task is done

If the user comes back and says "I did task <N> on the platform", just edit `tasks.md` to mark it `[x]`. No code changes, no push. The task is closed. (When an org MCP is connected, such a task may instead have been completed in-session via the procedure above — mark it `[x]` the same way.)
