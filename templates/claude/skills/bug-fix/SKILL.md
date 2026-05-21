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
2. **Read context:**
   - Read the relevant source files in `<component>/draft/scripts/`

   (The module's `draft/README.md` was read at session start. If you somehow don't have it in context, read it now — but normally session-start coverage should be enough.)
3. **Propose:**
   - Root-cause hypothesis (one or two sentences)
   - Minimal fix (which files, what change)
4. **STOP. Ask the user to approve the approach before editing.**
5. **Implement the fix.** Touch only the files in the approved approach.
6. **Remind the user:**
   - Push via `/b6p-push <component>`
   - Verify behavior on the platform (no local compile to fall back on)
   - If the fix changes documented behavior, update the component's `draft/README.md` in the same change so the platform doc stays in sync
