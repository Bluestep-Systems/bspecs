---
name: quick-task
description: Short workflow for small tasks and bug fixes that don't warrant a full 3-phase spec. Use for clearly-scoped changes and bugs in this repo.
---

# /quick-task — Short workflow for small changes and bug fixes

The lightweight counterpart to `/spec-create`. No requirements/design/tasks files — just gather context, agree on an approach, implement, verify. If the change turns out to be larger than expected (touches many files, needs design decisions), stop and suggest `/spec-create` instead.

## Steps

1. **Gather context.** Ask for (or extract from `$ARGUMENTS`):
   - What needs to change, or the bug description.
   - For a bug: expected vs actual behavior, and steps to reproduce if known.
   - Check `TODO.md` / recent `plugins/bluestep-tools/CHANGELOG.md` entries (`plugins/core-tools/CHANGELOG.md` for core-tools) / `docs/decisions/` — report if it's already planned, shipped, or covered by an ADR.
2. **Read context — scoped, not whole-repo:**
   - `grep` for the symbols, strings, or behavior named in the request to find the function(s) involved.
   - Read only the relevant functions/sections, targeting lines around each hit. Don't load entire files when a few functions suffice.
   - For broad "where does X happen across the repo" questions, delegate to the Explore agent so file bulk stays out of this conversation.
   - Remember: content is authored only under `plugins/<name>/`; `dist/` is generated (`npm run gen`), never hand-edited. The platform reference is `plugins/bluestep-tools/skills/bluestep-reference/` (overview files + its `SKILL.md` index + `reference/`/`conventions/`/`gotchas/`).
3. **Propose:**
   - For a bug: root-cause hypothesis (one or two sentences).
   - Minimal change (which files, what change).
4. **STOP. Ask the user to approve the approach before editing.**
5. **Implement the change.** Touch only the files in the approved approach. Apply `CLAUDE.md` conventions (author under `plugins/**` and run `npm run gen`, English-only committed files).
6. **Verify.** No test suite — verify manually:
   - Changes under `plugins/**` or `tools/gen-cross-tool/**`: run `npm run gen`, then `npm run gen:check` and read its stderr too (its `FAIL` lines go there).
   - Hook changes: run `npm run test:hooks`.
   - Skill/agent/doc edits: re-read the produced file.
   - Check recent `ide_diagnostics` for any `Error` in a touched file; fix before finishing.
7. **Wrap up.** Keep `CLAUDE.md`, the root `README.md` (the plugin catalog) and/or the plugin's own `plugins/<name>/README.md` in sync if behavior changed; tick the `TODO.md` item if one applies. Propose a commit message (title + body) based on the diff — do not run `git commit` unless the user says so.
