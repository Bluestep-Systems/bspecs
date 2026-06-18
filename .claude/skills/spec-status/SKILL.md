---
name: spec-status
description: Show progress of all feature specs in `.claude/specs/`. Use when the user wants a summary of what's in flight.
---

# /spec-status — Show progress across all active specs

## Steps

1. List directories under `.claude/specs/`.
2. For each feature, read `.claude/specs/<feature>/tasks.md`.
3. Count `[x]` (done) and `[ ]` (pending) checkboxes.
4. Print a summary, e.g.:

```
add-sync-subcommand     3 / 7 tasks done
refactor-prompts         1 / 5 tasks done
```

5. If a spec has no `tasks.md` yet, mark it as "in design".
