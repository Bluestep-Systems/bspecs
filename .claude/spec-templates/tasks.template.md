# Tasks — [Feature Name]

**Status:** Drafting | Approved | In progress | Complete

Each task must reference specific file paths and be small enough to ship as one coherent unit — one `/spec-execute` invocation per task.

## Tasks

- [ ] **1.** [Short description] — files: `tools/gen-cross-tool/emit-codex.mjs`
- [ ] **2.** [Short description] — files: `plugins/<plugin>/skills/<name>/SKILL.md`
- [ ] **3.** [Short description] — files: `CLAUDE.md`, `plugins/<plugin>/CHANGELOG.md`
- [ ] **4. [mechanical]** [Repeat of a pattern a task above already proved, e.g. "Wire skill #2 the same way as task 2" — never on a pattern's first instance] — files: `plugins/<plugin>/skills/<name2>/SKILL.md`

(Repeat as needed. Order tasks so a dependent task comes after the one it depends on.)

## Verification

No test suite — how to confirm this works manually:

- `npm run gen`, then `npm run gen:check` (read stderr too) for changes under `plugins/**` or the generator.
- `npm run test:hooks` if a hook changed.
- Re-read produced skill/agent/doc files.

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync if behavior changed.
- Tick the relevant `TODO.md` item.
- Note the change in `CHANGELOG.md` if applicable.
- If a topic file was added under `plugins/bluestep-tools/skills/bluestep-reference/`, confirm it has a matching entry in its `SKILL.md`.
