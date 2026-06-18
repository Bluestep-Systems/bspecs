# Tasks — Consolidate BlueStep rules into bspecs (atomic files + index)

**Status:** Drafting | Approved | In progress | Complete

Each task references specific file paths and is sized for one `/spec-execute` invocation. Order matters — dependent tasks come after the ones they rely on.

Source kits (read-only inputs):
- Brandon: `~/Downloads/BlueStep-Team-Knowledge-Kit/BlueStep-Team-Knowledge-Kit/{01-Platform-Reference,02-Workflow-Conventions,03-Agents}/`
- Brendan: `~/Downloads/Brendan Rules/BSJS_GOTCHAS.md`
- Brian: `~/Downloads/BrianBlueStepMarkdown/{agents.md,agents-support/*}`

## Tasks

### Code infrastructure (do first — foundational, low-risk, independently testable)

- [x] **1. Remove the GitHub Copilot mirror (Claude-only).** Delete `mirrorInstructionsToGithub` and its call site in `scaffold()`, plus any now-unused imports. Files: `src/scaffold.js` (fn at lines ~205–215, call at line 54). Verify `node cli.js -h` still runs and a scratch scaffold produces no `.github/` directory.

- [ ] **2. Generalize `SYNC_TARGETS` to walk the instructions tree (Claude-only).** Add a helper that walks `templates/claude/instructions/**` and returns `{ templateSrc, destRel }` per file (strip `.template`, preserve subfolders, `.claude/instructions/**` only — no `.github`). Replace the four hardcoded instruction lines (sync.js:27–32) with this dynamic list; keep the static skills/hooks/settings/spec-template entries. Files: `src/sync.js`, `src/utils.js` (helper may live here next to `copyTemplateTree`). Verify: scaffold a scratch project, confirm `.claude/bspecs.lock` lists the existing two instruction files; edit one locally and confirm `bspecs sync` reports it `skipped (locally modified)`.

### Content migration (the merge)

- [ ] **3. Migrate Brandon `01-Platform-Reference/*` → `reference/`.** 30 atomic files + `bluestep-knowledge/design-system.md` → `templates/claude/instructions/reference/<kebab>.md.template`. Per file: kebab-case name (strip `reference_`/`bluestep_`), convert `[[wikilinks]]` → relative markdown links (maintain old-stem→new-path map), strip generic prose (keep BlueStep-specific signal), add `## Contents` TOC if >100 lines, enforce English + consistent terminology (component/field/endpoint). Files: `templates/claude/instructions/reference/*.md.template`.

- [ ] **4. Migrate Brandon `02-Workflow-Conventions/*` → `conventions/`.** 13 `feedback_*` files → `templates/claude/instructions/conventions/<kebab>.md.template`. Same treatment as task 3, plus normalize to imperative voice (directives, not observations). Files: `templates/claude/instructions/conventions/*.md.template`.

- [ ] **5. Create `gotchas/`.** Brendan `BSJS_GOTCHAS.md` (split into one file per gotcha if it holds more than one) + Brandon `bluestep-knowledge/common-gotchas.md` → `templates/claude/instructions/gotchas/*.md.template`. Use the collapsible "old patterns" `<details>` block for superseded-version content. Files: `templates/claude/instructions/gotchas/*.md.template`.

- [ ] **6. Reconcile the four shared topic guides → `reference/`.** Diff Brian `agents-support/{api-patterns,code-patterns,component-library,file-execution}.md` against Brandon `bluestep-knowledge/` equivalents; produce one canonical file each under `reference/`. Merge Brian-unique deltas (`mergeTag()` L/F/I/H codes, `B.net.pageContent()` placements, SVG-icon endpoint requirement, component-library CSS anti-pattern, SweetAlert2 v8). Genuine conflicts → inline `<!-- CONFLICT: … -->` + index roll-up (task 8). Keep each file self-contained. Files: `templates/claude/instructions/reference/{api-patterns,code-patterns,component-library,file-execution}.md.template`.

- [ ] **7. Fold the two overview-level shared docs into the Tier-2 overviews.** Reconcile Brian/Brandon `platform-overview` → fold unique deltas into `b6p-platform.md.template`; `typescript-guide` → fold into `bsjs-development.md.template`. Do **not** create separate files for these. Add a `## Contents` TOC to each overview (both will exceed 100 lines). Ensure folded content does not duplicate the atomic files (link to them instead). Files: `templates/claude/instructions/b6p-platform.md.template`, `templates/claude/instructions/bsjs-development.md.template`.

### Indexing & wiring

- [ ] **8. Author `index.md.template`.** One entry per file under `reference/`/`conventions/`/`gotchas/` in the form `path — <what it covers>. Load when <trigger>.` with BlueStep keywords; links directly (one hop) to every file. Add a `grep -ri "<term>" .claude/instructions/` discovery hint and an "Unresolved conflicts" roll-up section listing every inline `CONFLICT` flag. Third person, no `@`-imports. Files: `templates/claude/instructions/index.md.template`.

- [ ] **9. Wire `CLAUDE.md.template` to the tree.** In "Deep reference", add a pointer instructing Claude to consult `.claude/instructions/index.md` first for platform/BsJs detail (read-on-demand wording kept, no `@`-imports). Update "Self-improvement" to mention the index/atomic files. Leave the 8 Tier-1 rules untouched. Files: `templates/root/CLAUDE.md.template`.

### Review & docs

- [ ] **10. No-duplication + link-integrity review.** Mechanical pass: grep for repeated headings/code blocks/distinctive sentences across `templates/claude/instructions/**`; `grep -r '\[\[' templates/claude/instructions` must return nothing; spot-check converted links resolve. Semantic pass (optionally delegate to a subagent reading the whole tree): catch paraphrased duplicates, including overview-vs-atomic overlap. Collapse each duplicate to one canonical file + link (one level deep). Files: across `templates/claude/instructions/**` (edits as needed).

- [ ] **11. ADR for the structural decisions.** Record (a) dynamic `SYNC_TARGETS` enumeration replacing the hardcoded list and (b) Claude-only (Copilot mirror removed). Files: `docs/decisions/instruction-tree-and-claude-only.md`.

- [ ] **12. Sync this repo's docs.** `CLAUDE.md` — update "Architecture" (drop `mirrorInstructionsToGithub`), "What gets scaffolded" (new `instructions/` tree, no `.github` mirror), "Editing templates" (instruction subfolders); remove the "single source of truth for Claude Code and GitHub Copilot" claim. `CHANGELOG.md` — new version entry (rules consolidation, Copilot mirror removed, stale `.github/instructions/` cleanup note for existing projects). `TODO.md` — add the B4 follow-up (convert Brandon `03-Agents/` roles into skills — deferred). Files: `CLAUDE.md`, `CHANGELOG.md`, `TODO.md`.

### Verification

- [ ] **13. End-to-end scaffold verification.** Scaffold a throwaway project; confirm `.claude/instructions/{index.md, reference/, conventions/, gotchas/}` all land, **no** `.github/` tree exists, `bspecs.lock` covers every instruction file, and `bspecs sync` skip-on-local-edit works. `grep -ri "copilot\|mirrorInstructions\|github/instructions" .` (outside `.claude/specs/`) returns nothing live. Spot-check migrated files for resolved links and English.

## Verification

No test suite — confirm manually:

- `node cli.js -v` / `node cli.js -h` still work after the code changes (tasks 1–2).
- Scaffold into a scratch directory; inspect the generated `.claude/instructions/` tree and confirm the absence of `.github/`.
- Re-read a sample of migrated reference/conventions/gotchas files for resolved wikilinks, English, consistent terminology, and TOCs on long files.
- `bspecs sync` against the scratch project: new files added, locally-edited files skipped.

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync with the new tree and Claude-only stance (task 12).
- Note the change in `CHANGELOG.md`, including the stale-`.github` cleanup callout (task 12).
- `mirrorInstructionsToGithub` is **removed**, so there is no longer a `.github/instructions/` mirror to keep in sync — verify nothing still references it (task 13).
- Record the B4 follow-up (agent roles → skills) in `TODO.md` (task 12).
