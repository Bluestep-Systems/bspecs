# Tasks — [Feature Name]

**Status:** Drafting | Approved | In progress | Complete

Each task must reference specific file paths and be small enough to ship as one coherent unit — one `/spec-execute` invocation per task.

## Tasks

- [ ] **1.** [Short description] — files: `src/scaffold.js`
- [ ] **2.** [Short description] — files: `templates/claude/skills/<name>/SKILL.md`
- [ ] **3.** [Short description] — files: `CLAUDE.md`, `CHANGELOG.md`

(Repeat as needed. Order tasks so a dependent task comes after the one it depends on.)

## Verification

No test suite — how to confirm this works manually:

- `node cli.js -v` / `node cli.js -h`
- Scaffold into a scratch directory and inspect the generated tree.
- Re-read produced template/skill/doc files.

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync if behavior changed.
- Tick the relevant `TODO.md` item.
- Note the change in `CHANGELOG.md` if applicable.
- If an instruction file was added under `templates/claude/instructions/`, confirm it has a matching `index.md` entry.
