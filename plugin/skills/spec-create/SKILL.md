---
name: spec-create
description: Start a new spec-driven feature. Creates requirements.md, then design.md, then tasks.md with explicit user approval between each phase. Use when the user wants to plan a new feature inside an existing component.
---

# /spec-create — Start a new feature spec

A spec lives at `.claude/specs/<feature-name>/` and consists of three files: `requirements.md`, `design.md`, `tasks.md`. Each phase requires explicit user approval before moving to the next.

## Prerequisite

Read the `draft/README.md` of each component this feature will touch (see `AGENTS.md` → "Module context — read scoped to the task"). Read only the relevant components' READMEs, not the whole workspace. Those READMEs are your baseline for what each component does today — design decisions in Phase 2 should reference that knowledge, not re-derive it. If a relevant module's README is missing, ask the user to `/b6p-pull` it (or scaffold the README) before continuing.

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
   - For `[CODE]`: reference specific file paths (e.g. `U######/IntakeForm/draft/scripts/validate.ts`). When a `[CODE]` task reads an imported field, **name which query/record it reads the field through** (e.g. "read `end_time` via `appointments` (`Record_appointments`)"), so the scope is verifiable against `declarations/`.
   - For `[PLATFORM]`: describe the artifact (e.g. "Create field `end_time` on form `Appointment`"). For an **import** item (query/form/field), **state its scope explicitly** — either "current record" (valid **only** if the component has a primary form / record type attached) or the exact named query/queries it is imported on. Never write a bare "add the X import." See the `bluestep-reference` skill's `import-scope.md` (`${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/reference/import-scope.md`) for current-record-vs-named-query scoping and the every-reachable-query rule.
   - NOT involve running `tsc`, editing `declarations/`, or creating B6P components locally
6. **Tag a `[CODE]` task `[mechanical]` only when it qualifies.** The tag goes right after the `[CODE]` prefix (e.g. `**7. [CODE] [mechanical]** Wire component #4 the same way as task 3 — files: …`). A task qualifies **only when all of these hold:**
   - It repeats a pattern already proven by an **earlier task in the same spec** (or an explicitly named pilot) — the first instance of any pattern is never tagged.
   - It makes **no new design decisions** and adds **no new imports or schema** — pure copy-adapt-verify.
   - It is `[CODE]`-only. `[PLATFORM]` tasks run in the main session, so the tag never applies to them.

   `/spec-execute` maps the tag to a cheaper model tier when delegating, so the user's tasks-phase review is the approval gate for that cheaper tier — adding or removing `[mechanical]` tags is part of reviewing tasks.md. When in doubt, leave the tag off; an untagged task just runs on the session model.
7. **Fill in the `## Deployment` section** at the bottom: list every component whose `[CODE]` tasks touched it. One push per component.
8. **STOP. Ask the user to approve tasks before implementation begins.**

## After approval

Tell the user to start implementing tasks one at a time. Present the first command on its own line as a **fenced code block** — with the real feature name and first task number filled in, e.g.

```
/spec-execute add-validation-on-intake 1
```

so the terminal UI renders a copy button. Do **not** bury the command in inline backticks inside a sentence (no copy button there).
