---
name: bug-fix
description: Short workflow for bug fixes that don't warrant a full 3-phase spec. Use for clearly-scoped fixes.
---

# /bug-fix — Short bug-fix workflow

## Steps

1. **Gather context.** Ask for (or extract from `$ARGUMENTS`):
   - Bug description
   - Affected component
   - Expected vs actual behavior
   - Steps to reproduce (if known)
2. **Read context — scoped, not whole-file:**
   - First `grep` the component's `draft/scripts/` for the symbols, error strings, or behavior named in the bug. Use the hits to find the function(s) involved.
   - Read **only** the relevant functions, using `offset`/`limit` to target the lines around each hit. Do **not** load entire files in full — component source can run to thousands of lines, and a small fix rarely needs more than a few functions. As a rule of thumb, never read more than ~400 lines of a file at once; if you think you need more, narrow the grep instead.
   - For broad "where does X happen across this component" questions, delegate to the Explore agent so the file bulk never enters this conversation's context.
   - Read the component's `draft/README.md` for this component if it isn't already in context.
3. **Propose:**
   - Root-cause hypothesis (one or two sentences)
   - Minimal fix (which files, what change)
4. **STOP. Ask the user to approve the approach before editing.**
5. **Implement the fix.** Touch only the files in the approved approach.
6. **Remind the user:**
   - Push via `/b6p-push <component>`
   - Verify behavior on the platform (no local compile to fall back on)
   - If the fix changes documented behavior, update the component's `draft/README.md` in the same change so the platform doc stays in sync
