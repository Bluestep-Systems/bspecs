---
name: spec-create
description: Start a new spec-driven feature. Creates requirements.md, then design.md, then tasks.md with explicit user approval between each phase. Use when the user wants to plan a new feature inside an existing component.
---

# /spec-create — Start a new feature spec

A spec lives at `.claude/specs/<feature-name>/` and consists of three files: `requirements.md`, `design.md`, `tasks.md`. Each phase requires explicit user approval before moving to the next.

## Prerequisite

Read the `draft/README.md` of each component this feature will touch (see `CLAUDE.md` → "Module context — read scoped to the task"). Read only the relevant components' READMEs, not the whole workspace. Those READMEs are your baseline for what each component does today — design decisions in Phase 2 should reference that knowledge, not re-derive it. If a relevant module's README is missing, ask the user to `/b6p-pull` it (or scaffold the README) before continuing.

## Steps

### Phase 0 — Setup

1. Ask for:
   - **Feature name** (kebab-case, e.g. `add-validation-on-intake`)
   - **One-line description**
2. Offer to **seed from a ClickUp ticket** if a ClickUp MCP is available — ask for the ticket URL or ID and fetch its description.
3. Create `.claude/specs/<feature-name>/` directory.

### Phase 1 — Requirements

1. Copy `${CLAUDE_PLUGIN_ROOT}/skills/spec-create/spec-templates/requirements.template.md` to `.claude/specs/<feature-name>/requirements.md`.
2. Fill it in based on the user's description (and ClickUp ticket if provided).
3. **STOP. Tell the user: "Requirements drafted at `.claude/specs/<feature-name>/requirements.md`. Review and approve before I proceed to design."**
4. Wait for explicit approval ("approved", "ok", "next", etc.) before moving on.

### Phase 2 — Design

1. Copy `${CLAUDE_PLUGIN_ROOT}/skills/spec-create/spec-templates/design.template.md` to `.claude/specs/<feature-name>/design.md`.
2. Fill it in. **MUST include:**
   - Which existing component(s) this touches
   - **The required field "Does this require modifying the component on the platform?"** with answer Yes/No and details
   - Approach summary
   - Alignment with existing patterns from the `bluestep-reference` skill's `bsjs-development.md` overview (`${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/bsjs-development.md`)
3. **STOP. Ask the user to approve design before tasks.**

### Phase 3 — Tasks

1. Copy `${CLAUDE_PLUGIN_ROOT}/skills/spec-create/spec-templates/tasks.template.md` to `.claude/specs/<feature-name>/tasks.md`.
2. Break the work into tasks. **Every task MUST start with a prefix:**
   - `[PLATFORM]` for work done in the BlueStep UI (creating fields, queries, components, permissions, formula configs).
   - `[CODE]` for work done in this workspace (TypeScript, static assets, README updates).
3. Derive `[PLATFORM]` tasks from the **Platform-side impact** field of `design.md`. If the design says "yes, X needs to be created on the platform," there should be a `[PLATFORM]` task for each X. If the design says "no platform-side changes," there are no `[PLATFORM]` tasks (all tasks are `[CODE]`).
4. **Order matters: `[PLATFORM]` tasks come before any `[CODE]` task that depends on them.** The ordering encodes the dependency — a `[CODE]` task that references a new field must come after the `[PLATFORM]` task that creates it.
5. Each task MUST:
   - Have the prefix `[PLATFORM]` or `[CODE]`
   - Have a checkbox `[ ]`
   - For `[CODE]`: reference specific file paths (e.g. `U######/IntakeForm/draft/scripts/validate.ts`)
   - For `[PLATFORM]`: describe the artifact (e.g. "Create field `end_time` on form `Appointment`")
   - NOT involve running `tsc`, editing `declarations/`, or creating B6P components locally
6. **Fill in the `## Deployment` section** at the bottom: list every component whose `[CODE]` tasks touched it. One push per component.
7. **STOP. Ask the user to approve tasks before implementation begins.**

## After approval

Tell the user to start implementing tasks one at a time. Present the first command on its own line as a **fenced code block** — with the real feature name and first task number filled in, e.g.

```
/spec-execute add-validation-on-intake 1
```

so the terminal UI renders a copy button. Do **not** bury the command in inline backticks inside a sentence (no copy button there).
