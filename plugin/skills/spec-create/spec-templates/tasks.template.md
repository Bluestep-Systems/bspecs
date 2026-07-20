# Tasks — [Feature Name]

**Status:** Drafting | Approved | In progress | Complete

Each task must reference specific file paths or platform artifacts and be small enough to ship as one coherent unit. Tasks must NOT involve:

- Running `tsc` locally
- Editing `declarations/` or any `.d.ts` file
- Creating new B6P components locally (those go on the platform first)

## Task prefix convention

Every task starts with one of two prefixes that says **where** the work happens:

- `[PLATFORM]` — done in the BlueStep UI **or** via the bundled **gateway** MCP (in-session, approval-gated; live once the `bluestep-tools` plugin is enabled and `$B6PT_TOKEN` is set): creating a field, query, formula, component-level config, permissions, etc. **Agent-executable by `/spec-execute` when the gateway MCP is live** (else the user does it manually / it's handed back). See the `bluestep-reference` skill's `conventions/mcp-platform-authoring.md` for the flow. Must be listed before any `[CODE]` task that depends on them, so the ordering encodes the dependency.
  - **Optional `op:` hint.** A `[PLATFORM]` task MAY carry an inline `op:` hint naming the MCP tool + key args to make the agent's tool-mapping unambiguous, e.g. `op: add_queries(script=…, query=allStaff)`. It's optional — when absent the agent proposes a mapping and the approval echo catches a wrong guess.
- `[CODE]` — done in this workspace (TypeScript, static assets, README updates). **Executable by `/spec-execute`**.

If the design says "no platform-side changes needed," every task is `[CODE]` and the prefix is still required (no implicit type).

## Tasks

- [ ] **1. [PLATFORM]** [Short description, e.g. "Create field `appointment_end_time` on form `Appointment`"] [optional `op:` hint, e.g. `op: add_queries(script=…, query=allStaff)`]
- [ ] **2. [CODE]** [Short description] — files: `U######/Component/draft/scripts/foo.ts`
- [ ] **3. [CODE]** [Short description] — files: `U######/Component/draft/scripts/bar.ts`, `U######/Component/draft/README.md`

(Repeat as needed. Keep tasks small enough that one `/spec-execute` invocation covers exactly one.)

## Deployment

Once all `[CODE]` tasks above are checked, push the affected components back to the platform. Use `/b6p-push` or run manually:

- `U######/<ComponentName>` — `b6p push --file "U######/<ComponentName>/draft/scripts/app.ts"`
- (List every component touched by `[CODE]` tasks. One push per component.)

## Verification

How to confirm the feature works once deployed (UI flow to exercise, expected log output, query to run on the platform, etc.).
