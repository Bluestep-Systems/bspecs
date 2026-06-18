# Requirements — Consolidate BlueStep rules into bspecs (atomic files + index)

**Status:** Approved

## Context

This is **Track B** of the "make `bspecs` the builder entry point + consolidate BlueStep rules" effort (full requirements: [docs/bspecs-builder/requirements.md](../../../docs/bspecs-builder/requirements.md)). Track A (publishing `b6p-cli` and wiring it as a bspecs dependency) is independent and tracked separately.

Today each team member keeps their own BlueStep rules:

- **Brandon** — a 42-file kit (`~/Downloads/BlueStep-Team-Knowledge-Kit`): atomic topic files (`01-Platform-Reference/`, 31 files), workflow conventions (`02-Workflow-Conventions/`, 13 files), and agent/knowledge-base files (`03-Agents/`, incl. `bluestep-knowledge/` of 8 files).
- **Brendan** — a single `BSJS_GOTCHAS.md` (`~/Downloads/Brendan Rules`): one gotcha (`FetchedResource.code()` returns 0 on success).
- **Brian** — an 8-file kit (`~/Downloads/BrianBlueStepMarkdown`): `CLAUDE.md` (landing) + `agents.md` (main guide) + `agents-support/` (`api-patterns`, `code-patterns`, `component-library`, `file-execution`, `platform-overview`, `typescript-guide`).
- **Fernando** — this repo's `templates/claude/instructions/{bsjs-development,b6p-platform}.md.template`, skills, hooks, CLAUDE.md.

The goal is to fold the consolidated rules into bspecs' instruction templates so every scaffolded project ships one canonical, deduplicated rule set. Deadline: **June 19, 2026**.

**Key dedup insight:** Brian's `agents-support/*` and Brandon's `03-Agents/bluestep-knowledge/*` are the **same six docs** (identical filenames, common ancestor). For those, the merge is *reconcile two divergent versions*, not combine distinct content. Brian already uses the exact target pattern: a short `CLAUDE.md` landing page + reference table → support files loaded on demand.

## Goals

- As a **builder**, I want every scaffolded project to ship one canonical, deduplicated set of BlueStep rules, so that I'm not reconciling four people's personal rule kits by hand.
- As a **builder**, I want detailed reference material available *on demand* (not force-loaded every session), so that context stays lean — preserving the regression fix from commit `a1adf55`.
- As **Claude in a scaffolded project**, I want an `index.md` manifest with "load this when X" trigger hints, so that I can pick the right reference file for a task without scanning the whole tree.
- As a **maintainer**, I want the GitHub Copilot mirror (`.github/instructions/`) to stay a faithful copy of the whole instructions tree, so that the single-source-of-truth guarantee holds for the new subfolders too.

## Acceptance criteria

- [ ] The shared six-doc knowledge base (Brian `agents-support/*` ≈ Brandon `bluestep-knowledge/*`) is reconciled into **one canonical file per topic**, with Brian-unique deltas merged in (`mergeTag()` L/F/I/H codes, `B.net.pageContent()` placements, SweetAlert2 v8 quirks, SVG-icon endpoint requirement, component-library CSS anti-pattern).
- [ ] New directories exist under `templates/claude/instructions/`: `reference/` (Brandon `01-Platform-Reference/*`), `conventions/` (Brandon `02-Workflow-Conventions/*`), `gotchas/` (Brendan `BSJS_GOTCHAS.md` + Brandon gotcha files).
- [ ] An `index.md.template` manifest lists every topic file with a one-line "load when…" trigger hint.
- [ ] The two existing instruction files (`b6p-platform`, `bsjs-development`) are kept as **overviews** (Tier 2); their high-frequency content is *not* duplicated into the atomic files.
- [ ] Cross-author topic overlaps (date format/handling, endpoint output channel vs. fetched-resource code, merge-report patterns, Java collections vs JS array methods, SweetAlert2 version) resolve to one canonical file per topic with cross-links; genuine *conflicts* are flagged for human resolution, not silently picked.
- [ ] All Brandon `[[wikilink]]` cross-references are converted to relative markdown links (`[text](path.md)`).
- [ ] All migrated content is in **English** (project rule).
- [ ] `CLAUDE.md.template` is updated so its "Deep reference" section points to `index.md` (Read-on-demand wording kept). **No `@`-imports** of any Tier 2/3 file anywhere in the rendered `CLAUDE.md`.
- [ ] Tier 1 critical rules (the existing 8 numbered rules) stay inline in `CLAUDE.md.template` — never moved into reference files.
- [ ] **Claude-only:** the GitHub Copilot mirror is removed. `mirrorInstructionsToGithub` is deleted from `src/scaffold.js`, the `.github/instructions/` entries are dropped from `SYNC_TARGETS`, and scaffolding produces **no** `.github/instructions/` tree. This repo's docs no longer claim dual Claude Code + Copilot support.
- [ ] `SYNC_TARGETS` (in `src/sync.js`) covers the whole `.claude/instructions/` tree dynamically, so `bspecs sync` and `bspecs.lock` track every new reference/conventions/gotchas file.
- [ ] Scaffolding a throwaway project produces `.claude/instructions/{index.md, reference/, conventions/, gotchas/}` and **no** `.github/` mirror.
- [ ] **No duplicated rules across files:** a final review confirms no rule/topic is repeated verbatim or near-verbatim in more than one file (overviews vs. atomic files, or across atomic files). Overlaps are resolved to one canonical file + cross-link before the spec is considered done.
- [ ] `CHANGELOG.md`, `TODO.md`, and `CLAUDE.md` (this repo's own architecture docs) are kept in sync with the change.

## Out of scope

- **Track A** entirely (publishing `b6p-cli`, `.npmrc`, org move, bspecs publish, shell-detection cleanup).
- **GitHub Copilot support.** Scaffolded projects are Claude-only; the `.github/instructions/` mirror is removed, not maintained.
- Converting Brandon's `03-Agents/` agent role files (`bluestep-code-review`, `bluestep-commenter`, `bluestep-dev`) into bspecs **skills** — only the `bluestep-knowledge/` *content* is ingested as reference material. Agent-role-to-skill conversion is deferred and noted as a follow-up in `TODO.md` (B4).
- Adding any new always-on (force-loaded) content beyond the existing Tier 1 rules and the new `index.md` manifest.

## Open questions

- **Folder granularity vs. file count.** Brandon's `01-Platform-Reference/` has 31 atomic files. Do we import all 31 verbatim, or consolidate near-duplicates first? (Affects index.md length and the always-on manifest cost.)
- **Conflict surfacing mechanism.** When a genuine conflict is found (e.g. SweetAlert2 v8 vs another version), where do we record the flag — inline `<!-- CONFLICT: ... -->` comments, a `gotchas/UNRESOLVED.md`, or a section in this spec? Needs a convention.
- **Source access.** The three input kits live under `~/Downloads/` on this Windows machine. Confirm exact current paths before B1 (they may have moved since the research snapshot).
- **`index.md` maintenance.** Is the manifest hand-maintained, or should a future `bspecs` check warn when a `reference/` file has no index entry? (Likely a follow-up, not this spec.)
