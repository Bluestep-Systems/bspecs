# Tasks — [Feature]

**Status:** Drafting | Approved | In progress | Complete
**Gate:** `npm test` — the exact command that must pass after every task, or `none`

Each task carries a marker, names **every** file it touches, and is small enough to finish in one
session. Tasks are ordered so none depends on a later one. File lists must be complete: the runner
treats two tasks with no shared file as safe to run at the same time.

## Tasks

- [ ] **1. [judgment]** [Short description; a design choice, UI behaviour or a new pattern] — files: `path/to/a.ts`
- [ ] **2. [routine]** [Known shape, new content, e.g. a field through a typed contract and its fixtures] — files: `path/to/b.ts`, `README.md`
- [ ] **3. [mechanical]** [Repeat of a pattern task 2 already proved, no new decisions] — files: `path/to/c.ts` — after: 2

## Verification

How to confirm the feature works end to end once every task is done: the command to run, the flow
to exercise, the output to expect.
