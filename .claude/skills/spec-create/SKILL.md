---
name: spec-create
description: Start a new spec-driven feature. Creates requirements.md, then design.md, then tasks.md with explicit user approval between each phase. Use when the user wants to plan a non-trivial change to this repo (the bspecs scaffolder).
---

# /spec-create — Start a new feature spec

A spec lives at `.claude/specs/<feature-name>/` and consists of three files: `requirements.md`, `design.md`, `tasks.md`. Each phase requires explicit user approval before moving to the next.

Use this for non-trivial work — a new behavior, a new CLI flag/subcommand, a template restructuring, anything touching several files. For a clearly-scoped fix or a small change, use `/quick-task` instead.

## Prerequisite

Skim the project's working-context files before drafting:

- `CLAUDE.md` — architecture, key behaviors, editing conventions.
- `TODO.md` — open `[ ]` items (the change may already be planned).
- The latest 3 `## [x.y.z]` blocks of `CHANGELOG.md` (it may already be shipped).
- `docs/decisions/` — an ADR may already cover the area.

Report any match — already planned, already shipped, or covered by an ADR — before starting.

## Steps

### Phase 0 — Setup

1. Ask for:
   - **Feature name** (kebab-case, e.g. `add-sync-subcommand`)
   - **One-line description**
2. Create `.claude/specs/<feature-name>/` directory.

### Phase 1 — Requirements

1. Copy `.claude/spec-templates/requirements.template.md` to `.claude/specs/<feature-name>/requirements.md`.
2. Fill it in based on the user's description.
3. **STOP. Tell the user: "Requirements drafted at `.claude/specs/<feature-name>/requirements.md`. Review and approve before I proceed to design."**
4. Wait for explicit approval ("approved", "ok", "next", etc.) before moving on.

### Phase 2 — Design

1. Copy `.claude/spec-templates/design.template.md` to `.claude/specs/<feature-name>/design.md`.
2. Fill it in. **MUST include:**
   - Which files/areas this touches (`cli.js`, `src/*`, `templates/*`, skills, docs).
   - Approach summary.
   - Alignment with existing patterns and conventions in `CLAUDE.md`.
   - Whether an ADR in `docs/decisions/` is warranted for any non-obvious choice.
3. **STOP. Ask the user to approve design before tasks.**

### Phase 3 — Tasks

1. Copy `.claude/spec-templates/tasks.template.md` to `.claude/specs/<feature-name>/tasks.md`.
2. Break the work into small tasks, each shippable as one coherent unit. Each task MUST:
   - Have a checkbox `[ ]`.
   - Reference specific file paths (e.g. `src/scaffold.js`, `templates/claude/skills/.../SKILL.md`).
   - Be small enough that one `/spec-execute` invocation covers exactly one.
3. **Order matters** — a task that depends on another must come after it.
4. Note in the tasks any docs that must stay in sync: `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `TODO.md`. Remember `mirrorInstructionsToGithub` — instruction templates have a mirrored copy in `.github/instructions/`.
5. **STOP. Ask the user to approve tasks before implementation begins.**

## After approval

Tell the user to run `/spec-execute <feature-name> <task#>` to start implementing tasks one at a time.
