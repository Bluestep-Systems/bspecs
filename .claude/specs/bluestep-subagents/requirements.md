# Requirements — BlueStep subagents (implementer, commenter, reviewer) + delegated spec-execute

**Status:** Drafting

## Context

This is the **B4 follow-up** to the `consolidate-rules` spec (0.6.0). That spec ingested the *content* of Brandon's `03-Agents/bluestep-knowledge/` into `templates/claude/instructions/` but explicitly left his three **agent role files** out of scope: `bluestep-dev`, `bluestep-commenter`, `bluestep-code-review`. See `TODO.md` ("Convert Brandon's `03-Agents/` role files into bspecs skills (B4)") and `.claude/specs/consolidate-rules/requirements.md` (Out of scope).

Brandon's three files are **Claude Code subagents** (frontmatter is `name`/`description`/`tools`), not skills. Analysis of each:

- **`bluestep-dev.md` (914 lines)** — ~95% is platform knowledge that consolidate-rules *already* moved into `templates/claude/instructions/` (api-patterns, code-patterns, file-execution, component-library, design-system, common-gotchas, SweetAlert2, TS patterns, etc.). Re-creating that as an artifact would duplicate the instruction tree and violate consolidate-rules' "no duplicated rules" criterion. Its only non-duplicated value is a **workflow layer**: "read `declarations/index.d.ts` and grep `B.d.ts` before writing code," apply conventions, hand off to commenter + reviewer.
- **`bluestep-commenter.md`** — writes/updates a component's `draft/README.md` from the code. No current skill does this (`task-comment` targets ClickUp; `bug-fix` only *reminds* to update the README). Genuine gap.
- **`bluestep-code-review.md`** — BlueStep-aware review (try/catch coverage, Optional `.get()` safety, server/client boundary, component-library usage, a11y). The built-in `/code-review` is not BlueStep-aware. Genuine gap.

**Context-isolation problem this also solves.** Today nothing makes `/spec-execute` run task implementation in a separate context. On a large feature, each task drags more component source (often thousands of lines) into the main session and context grows too fast. Official guidance recommends subagents precisely for "isolating operations that produce large amounts of output… verbose output stays in the subagent's context while only the relevant summary returns." The reframed, non-duplicative value of `bluestep-dev` is therefore an **isolated task-implementer subagent**: its workflow layer becomes the subagent's system prompt, while its knowledge layer stays on demand in the instructions tree.

**Decisions already made with the user (this session):**

- Build **three** subagents: a task-implementer, a commenter, a code-reviewer. Do **not** create a `bluestep-dev` knowledge artifact.
- Primitive = **subagents** in `.claude/agents/` (new directory in the scaffold), not skills. Subagents give context isolation and tool scoping; skills would run in the main context.
- Commenter and reviewer run **on-demand**, suggested at the end of a `/spec-execute` task (the existing human-in-the-loop STOP). Not auto-fired by hooks.
- The code-reviewer is **report-only by default** (structured Critical / Warning / Suggestion report; no surprise edits).
- `/spec-execute` **delegates each task to the implementer subagent by default**, with an `--inline` escape hatch for trivial tasks. Supervision is unchanged: the user reviews the git diff at the STOP and approves before the next task.

## Goals

- As a **builder**, I want a BlueStep-aware task-implementer subagent that `/spec-execute` delegates to, so that a task's heavy component-source reads and edits happen in an isolated context and my main session stays lean across a large feature.
- As a **builder**, I want a commenter subagent that fills in a component's `draft/README.md` from the code, so that component documentation stays current without me hand-writing it.
- As a **builder**, I want a BlueStep-aware code-reviewer subagent that returns a structured, severity-grouped report, so that I catch BlueStep-specific footguns (Optional safety, server/client boundary, missing try/catch) before pushing.
- As **Claude in a scaffolded project**, I want these subagents to read the existing `instructions/` tree on demand rather than carry duplicated knowledge, so that the single-source-of-truth guarantee from consolidate-rules holds.
- As a **builder**, I want supervision preserved — I approve the diff at each STOP and explicitly invoke commenter/reviewer — so that delegation never means losing control of what ships.

## Acceptance criteria

### Scaffolding

- [ ] Scaffolding a project produces a `.claude/agents/` directory containing three subagent definitions: `b6p-task-implementer.md`, `b6p-commenter.md`, `b6p-code-review.md` (the `b6p-` prefix matches the existing `b6p-*` skills).
- [ ] Each subagent file has valid frontmatter (`name`, `description`, `tools`) and is in **English** (project rule).
- [ ] `tools` is scoped per role: implementer gets read/edit/write/search/Bash (Bash for read-only shell only — grepping the large `B.d.ts`, `git status` — **never** `tsc`, which is hook-blocked); commenter and reviewer get read/edit/write/search only (no Bash). The reviewer's edit access exists but is unused in the default report-only mode.
- [ ] None of the three files duplicate platform knowledge already in `templates/claude/instructions/`. Where they need platform facts, they point Claude to read the relevant `instructions/` file on demand (via `index.md`), not inline copies.
- [ ] `src/sync.js` `SYNC_TARGETS` (derived by walking `templates/claude/**`) automatically picks up the three new `.claude/agents/*.md` files; `bspecs sync` and `bspecs.lock` track them with no hardcoded additions.

### Task-implementer subagent + spec-execute delegation

- [ ] The implementer subagent's prompt distills `bluestep-dev`'s **workflow** only: read the component's per-component `declarations/index.d.ts` first, grep `B.d.ts` for APIs, consult `instructions/index.md` on demand, honor the scaffolded "Critical rules" (never edit `declarations/`, no `.writable()`, **no local `tsc`**, no new components locally), implement exactly one task, verify via the `PostToolUse` `ide_diagnostics` (no local compile — hook-blocked; the platform compiles on push), and return a structured summary (files changed, what/why, diagnostics result, anything flagged).
- [ ] `/spec-execute` (the `templates/claude/skills/spec-execute/SKILL.md` shipped to projects) delegates task implementation to the implementer subagent **by default**.
- [ ] `/spec-execute --inline <feature> <task#>` runs implementation in the main session (today's behavior) as an escape hatch for trivial tasks.
- [ ] After the subagent returns, the **main session** keeps the supervisory steps it has today: verify, surface the git diff, mark the task checkbox `[x]`, keep docs in sync, then STOP for user approval. Delegation does not move the approval gate into the subagent.
- [ ] The implementer never auto-continues to the next task and never invokes the commenter/reviewer itself — chaining is the user's call at the STOP.

### Commenter subagent

- [ ] Writes/updates `draft/README.md` for the component(s) in scope using the `templates/claude/templates/` module README shape; reads `info/metadata.json`/`config.json` and the source to fill Purpose / Data & Queries / How It Works / Gotchas.
- [ ] Does **not** add inline comments or JSDoc, and does not change logic — README only.
- [ ] Preserves meaningful existing README content (augments rather than overwrites).

### Code-reviewer subagent

- [ ] Produces a structured report grouped **Critical / Warnings / Suggestions**, each finding tagged with file + line + issue.
- [ ] **Report-only by default** — makes no edits unless the user explicitly asks it to apply fixes.
- [ ] Checklist covers the BlueStep-specific items from Brandon's file (try/catch coverage, bare `.get()` on Optionals, server/client boundary, `console.*` left in, `mergeTag`/field-name usage, component-library vs hand-rolled UI, a11y) but defers the *rule definitions* to the `instructions/` tree rather than restating them.

### Flow integration & docs

- [ ] `/spec-execute`'s "task done" STOP message suggests the optional next steps: run the commenter, then the reviewer (user-invoked, not automatic).
- [ ] `CLAUDE.md` (this repo) documents the new `.claude/agents/` part of the scaffold and the delegated-by-default execution model.
- [ ] `README.md`, `CHANGELOG.md`, and `TODO.md` (B4 item checked off) are kept in sync.
- [ ] If the design introduces a non-obvious convention (e.g. the delegate-by-default decision, or subagents-over-skills), an ADR is added under `docs/decisions/`.

## Out of scope

- A `bluestep-dev` **knowledge** artifact of any kind — its content already lives in `templates/claude/instructions/` and must not be duplicated.
- Auto-firing the commenter or reviewer via hooks. Triggering is on-demand only (PostToolUse hooks are advisory and clash with the approve-every-task flow).
- Auto-fix in the reviewer as a default behavior (Brandon's mechanical auto-fix). The reviewer is report-only; an opt-in "apply fixes" mode may be noted as a future option but is not built here.
- Changing `/bug-fix` to delegate to the implementer subagent (possible follow-up; this spec scopes delegation to `/spec-execute`).
- Heuristic auto-delegation (delegate based on file count / feature size). We chose delegate-by-default with `--inline`; a heuristic is explicitly not pursued.
- Migrating the `task-comment` skill (ClickUp comments) — unrelated to Brandon's README commenter.

## Open questions

- **Subagent invocation mechanics across surfaces.** Confirm during design how the shipped `/spec-execute` skill instructs the main agent to spawn the implementer (Task/Agent tool) and how `--inline` is parsed from `$ARGUMENTS`. Verify the pattern works the same in the CLI and IDE surfaces.
- **Where the checkbox/doc-sync bookkeeping lives.** Main session (recommended — keeps the approval gate and git-diff review in one place) vs. inside the implementer subagent. Resolve in design.
- **ADR scope.** One ADR covering both "subagents over skills for these roles" and "spec-execute delegates by default," or two separate ADRs? Decide in design.
- ~~**Naming.**~~ Resolved: the three subagents use the `b6p-` prefix (`b6p-task-implementer`, `b6p-commenter`, `b6p-code-review`) to match the existing `b6p-*` skills.
