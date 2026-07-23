---
name: quick-task
description: Short workflow for small tasks and bug fixes that don't warrant a full 3-phase spec. Keeps one living markdown doc for review during implementation. Use for clearly-scoped changes and bugs in a BlueStep component.
---

# /quick-task — Short workflow for small changes and bug fixes

The lightweight counterpart to `/spec-create`. Instead of three files (requirements / design / tasks), a quick task keeps **one** living markdown document you can review while it's being implemented. Use it for a clearly-scoped change or bug that doesn't need real design. If the work turns out to be larger than expected (touches many components, needs design decisions), **STOP and suggest `/spec-create` instead.**

## Steps

1. **Gather context.** Ask for (or extract from `$ARGUMENTS`):
   - What needs to change, or the bug description.
   - Affected component.
   - For a bug: expected vs actual behavior, and steps to reproduce if known.

2. **Read context — scoped, not whole-file:**
   - First `grep` the component's `draft/scripts/` for the symbols, error strings, or behavior named in the request. Use the hits to find the function(s) involved.
   - Read **only** the relevant functions, using `offset`/`limit` to target the lines around each hit. Do **not** load entire files in full — component source can run to thousands of lines, and a small change rarely needs more than a few functions. As a rule of thumb, never read more than ~400 lines of a file at once; if you think you need more, narrow the grep instead.
   - For broad "where does X happen across this component" questions, delegate to the Explore agent so the file bulk never enters this conversation's context.
   - Read the component's `draft/README.md` if it isn't already in context.

3. **Draft the quick-task doc.** Copy `${CLAUDE_PLUGIN_ROOT}/skills/quick-task/quick-task.template.md` to `.claude/quick-tasks/<slug>.md` (create the folder if it doesn't exist; `<slug>` is a short kebab-case name for the task). Fill in:
   - **Summary** — one line.
   - **Root cause** (bugs only) — one or two sentences; delete the section for a non-bug change.
   - **Approach** — a short checklist of the changes to make, each tagged `[PLATFORM]` (a platform authoring/wiring op — agent-executable via the shared procedure when the gateway MCP is live, else handled on the platform) or `[CODE]` (local source edit). For a `[PLATFORM]` **import** item (query/form/field), **state its scope** — "current record" (valid **only** if the component has a primary form / record type attached) or the exact named query/queries it is imported on — never a bare "add the X import," and have the paired `[CODE]` item **name which query/record it reads the field through** so the scope is verifiable against `declarations/`. See the `bluestep-reference` skill's `import-scope.md` (`${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/reference/import-scope.md`) for current-record-vs-named-query scoping and the every-reachable-query rule. This is the whole plan — keep it minimal.

4. **STOP. Tell the user the doc path and ask them to approve the approach before you edit any code.**

5. **Implement the `[CODE]` items.** Touch only the files in the approved approach. **Keep the doc current as you go** — tick each checklist item (`[x]`) when it's done so the doc stays an accurate record during implementation, and if reality diverges from the plan, update the doc rather than silently drifting. For each **`[PLATFORM]`** item (a platform authoring/wiring op), follow the shared procedure at `${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/conventions/mcp-platform-authoring.md`: when the gateway MCP tools are live it's agent-executable (connection-check → approval echo → execute → declaration read-back), so tick it `[x]` when done; when the tools are not live, the fix is to enable the `bluestep-tools` plugin, set `$B6PT_TOKEN`, and restart the session (the gateway is bundled with the plugin — there is no `/bluestep-mcp-connect`); otherwise hand back to the user on the BlueStep platform. Do **not** restate its steps here; its approval echo and detect-and-skip preserve the never-fabricate-imports rule.

6. **Wrap up / remind the user:**
   - Push via `/b6p-push <component>` — it drives the push-mode choice, with **snapshot recommended by default** (still your explicit selection, never automatic).
   - Verify behavior on the platform (no local compile to fall back on).
   - If the change alters documented behavior, update the component's `draft/README.md` in the same change so the platform doc stays in sync.
   - The `.claude/quick-tasks/<slug>.md` doc stays in the repo as the record of the change. Propose a commit message (title + body) based on the diff — do not run `git commit` unless the user says so.
