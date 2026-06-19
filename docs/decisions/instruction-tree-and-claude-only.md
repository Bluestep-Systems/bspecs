# ADR: Dynamic `SYNC_TARGETS` enumeration and Claude-only scaffolding

**Status:** Accepted

**Date:** 2026-06-19

## Context

Two core mechanisms changed while consolidating the team's BlueStep rules into a single `templates/claude/instructions/` tree (spec `consolidate-rules`). Both touch machinery that future contributors will edit, so they are recorded here.

1. **`SYNC_TARGETS` was a hardcoded array.** `src/sync.js` listed every synced file by hand — skills, hooks, `settings.json`, spec-templates, and the two instruction files — plus two `.github/instructions/*` mirror entries. `bspecs sync` and `bspecs.lock` iterate this list. The rule consolidation adds ~50 atomic files under `instructions/{reference,conventions,gotchas}/`; hand-adding each (and never forgetting one) is exactly the drift this list already suffered — the array had silently fallen out of step with the templates on disk.

2. **Every instruction file was mirrored to `.github/instructions/`.** `scaffold.js` ran `mirrorInstructionsToGithub()` after copying the `.claude/` tree, writing each `instructions/*.md` a second time as `.github/instructions/*.instructions.md` so the same rules drove both Claude Code and GitHub Copilot. This was the documented "single source of truth for both" guarantee.

## Decision

### (a) Derive `SYNC_TARGETS` by walking `templates/claude/**`

Replace the entire hardcoded array with a runtime walk of the template tree. `enumerateClaudeTargets(exclude)` (in `src/utils.js`) recurses `templates/claude/`, emitting one `{ templateSrc, destRel }` per file, where `destRel` applies the **same transform `copyTemplateTree` already uses**: leading `claude/` → `.claude/`, a trailing `.template` stripped, subfolders preserved. `src/sync.js` then sets:

```js
export const SYNC_TARGETS = enumerateClaudeTargets(SYNC_EXCLUDE);
```

- The `templates/claude/**` boundary is what made the old list implicitly correct: `templates/root/` (user-owned `CLAUDE.md`/`README`) and `templates/module/` (scaffold-once) live outside it and are excluded by construction — they are *not* synced infrastructure.
- `SYNC_EXCLUDE` is a documented escape hatch (empty today): add a `templateSrc` path to opt a future scaffold-once file under `claude/` out of sync.
- The transform reproduces the formerly-hardcoded skill/hook/`settings.json`/spec-template destinations **exactly**, and picks up the new instructions tree automatically. (It also surfaced one file the old array had dropped — `skills/task-comment/SKILL.md`, which `copyTemplateTree` was already scaffolding — so syncing it is now consistent.)

Add a skill, hook, or `reference/` file and it flows into `bspecs sync` and `bspecs.lock` with no edit to `sync.js`.

### (b) Claude-only — remove the GitHub Copilot mirror

Delete `mirrorInstructionsToGithub()` and its call site in `scaffold()`. Scaffolding produces **no** `.github/` tree. The two `.github/instructions/*` entries are gone from the sync list (they never appear in the walk, since `.github` is not under `templates/claude/`). The single remaining source of truth is the template tree → `.claude/` only.

## Options considered

**For (a):** keep extending the hardcoded array (rejected — the drift it already exhibited is the whole problem, and ~50 new files make it worse); a hybrid where only `instructions/` is walked but the rest stays static (rejected — two code paths for one concept, and the static half keeps drifting). A full walk is one rule for the whole tree.

**For (b):** keep mirroring to Copilot (rejected — no team member uses Copilot for these projects; the mirror doubled the file count, the sync surface, and the "keep both in sync" maintenance load for zero consumers); make the mirror opt-in (rejected — adds a config flag and branch for a feature nobody asked for). Dropping it is a simplification, retiring the dual-target machinery rather than maintaining it.

## Consequences

- **`bspecs sync` regression is the main risk.** The walk feeds the live lock/sync mechanism every scaffolded project runs at `SessionStart`. Mitigation is the manual verification in this spec's tasks: scaffold a scratch project, confirm `bspecs.lock` lists every instruction file, edit one locally and confirm it reports `skipped (locally modified)`.
- **Stale `.github/instructions/` in older projects.** `bspecs sync` never deletes files, so a project scaffolded by an older `bspecs` keeps its now-orphaned Copilot mirror. It is harmless; the `CHANGELOG` notes that users may delete `.github/instructions/` by hand. Out of scope to clean up automatically.
- This repo's own docs (`CLAUDE.md`) no longer claim dual Claude Code + Copilot support.

## References

- Spec: `.claude/specs/consolidate-rules/{requirements,design,tasks}.md` (tasks 1 and 2 implement these decisions).
- Code: `src/utils.js` (`enumerateClaudeTargets`, `walkClaude`), `src/sync.js` (`SYNC_TARGETS`, `SYNC_EXCLUDE`).
