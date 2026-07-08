---
description: "The single shared procedure for performing a [PLATFORM] authoring/wiring op via the platform MCP — connection-check → offer-connect-with-fresh-session-caveat-else-hand-back → resolve org → map op to tool (optional op: hint) → approval echo (tool + target + args) → execute → declaration read-back via get_script_declarations → idempotency detect-and-skip → destructive-tool discipline, plus the supported tool set. This flow is the source of truth: /spec-execute, /quick-task, and free conversation all follow steps 2–6; only the trigger (step 1) and bookkeeping (step 7) differ. Load when about to add an import (query/form/field) to a script or create a form/field/option-list/view/record-type and an org MCP may be connected."
---

# MCP `[PLATFORM]` authoring / wiring procedure

This page **is** the flow. Every entry point points here and none restate it (no-duplication invariant).
It covers **authoring / wiring only** — adding an import (query / form / field) to a script, or creating
a form / field / option-list / view / record-type. It **never** writes a script draft and **never**
pushes or publishes: component **sync (pull / push / audit) stays on the `b6p` CLI**, permanently. See
[../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md).

## One procedure, three entry points

Steps 2–6 are identical everywhere. Only the ends differ:

| Entry point | Step 1 (trigger) | Step 7 (bookkeeping) |
| --- | --- | --- |
| `/spec-execute` | a `[PLATFORM]`-prefixed task | mark `[x]` in `tasks.md`, STOP |
| `/quick-task` | a small change needs a platform op | none (no checkbox) |
| Free conversation (no skill) | a plain request ("add the `allStaff` query to this component") | none |

**Mark `[x]` only when spec-driven.** Conversationally there is no checkbox — do not invent one.

## The steps

### 1 — Trigger (per entry point)

You are about to do a platform authoring/wiring op — from a `[PLATFORM]` task, a `/quick-task`, or a plain
request. That is what brings you here.

### 2 — Connection check

Ask: **are `mcp__bluestep-<subdomain>__*` tools live in this session?** Base this on *actual* tool
availability now, not a prior `claude mcp add` — a connection registered this session is **not** live
until a restart (the fresh-session gotcha).

- **Not connected** → **offer to connect**: defer to `/bluestep-mcp-connect` (it triggers from natural
  language and gathers the org URL). State the **fresh-session caveat**: connecting now will **not** load
  the tools into *this* session, so this op cannot continue until the user restarts and re-asks. If the
  user declines or wants to proceed immediately, fall back to today's **human hand-back** (they add it in
  the BlueStep UI, then `/b6p-pull`). **Never** fail silently or half-apply.
- **Connected** → continue to step 3.

### 3 — Resolve the target org

If **one** org is connected, use it. If **multiple** `bluestep-<subdomain>` servers are connected,
require the target org be named (from the spec / task) or **ask** — never guess which org to mutate.

### 4 — Map the op to a tool

Determine the tool(s) + args from:

- an optional inline **`op:` hint** — e.g. `op: add_queries(script=…, query=allStaff)` — if the task
  supplies one, or
- the free-text description otherwise.

Use **read-only discovery** to fill/validate args before mutating: `list_applicable_forms`,
`list_applicable_fields`, `list_field_access`, `describe_form`, `list_forms`, `list_option_lists`,
`list_views`, `list_record_types`, `lookup_script_by_name`, `list_script_scope`, and the `get_*` readers.

**If the mapping is ambiguous** (unsure which tool or which args) → **STOP and ask**. Never guess a
mutation.

### 5 — Approval echo (mandatory)

Print the **concrete call** — **tool + target (script / form) + args** — and **wait for an explicit yes**
in the main session. This is the safety net for a mis-mapped op; it is required at **every** entry point,
conversational included.

- Denial → leave the task `[ ]`, report, stop.
- A multi-op task may take **one** approval covering the batch; report each result.

### 6 — Execute + declaration read-back

Run the tool via MCP. Then, **if the op wired an import**, call **`get_script_declarations`** so the
script's `B` type reflects the new dependency, and surface it so a subsequent `[CODE]` task can code
against it immediately — no manual re-pull.

- Prove-out bar is **"declarations sufficient to code against," not byte-parity** with `/b6p-pull`.
- If the reduced declarations are insufficient, fall back to a CLI `/b6p-pull` for the full
  `declarations/` tree.

### 7 — Bookkeeping (per entry point)

Spec-driven only: **mark `[x]`** in `tasks.md`, noting the tool(s) run, and **STOP** for review before the
next task. Conversationally there is no checkbox — just report what ran.

## Idempotency

**Object already exists** (re-run, or added manually) → detect via the `list_*` / `get_*` readers and
**skip with a report**. Do not error and do not duplicate.

## Safety / destructive-tool discipline

- **Approval before every mutation** — no exceptions, no batch-approving destructive ops.
- The `b6pt_` token is **global-super**: every mutation runs as global admin. The approval echo is the
  guardrail.
- **Destructive tools** (`remove_*`, `record` delete, `user` deactivate) run **only** when the task
  explicitly requires them, with **extra** confirmation. Out of default scope.
- **Schema creation is not (currently) MCP-reversible.** The wiring trio (`add_*`) has clean `remove_*`
  inverses, but **schema-authoring** ops (`form` / `field` / `option_list` / `view` / `record_type`) do
  **not** — verified 2026-07-08 on bkplayground: an option list created via `create_option_list` has no
  `delete_option_list`, and `discard_pending_change` only rolls back the data-entry staging queue (it
  errors "requires a chat session"), **not** schema objects. Treat every schema-authoring op as
  **effectively irreversible via MCP** — removal is a manual step in the platform UI. This raises the bar
  on the approval echo for schema creation; **never** guess a `graphql_mutation` delete to clean up.
- **Approval denied / partial failure** → leave the task `[ ]`; report exactly what did and didn't apply;
  **never** mark done on partial success.

## Supported tool set

Tools are namespaced per org in-session as `mcp__bluestep-<subdomain>__<tool>`; the base names:

**Wiring / imports**
- `add_queries`, `add_forms`, `add_field_access`, `add_record_types`
- destructive siblings: `remove_queries`, `remove_forms`, `remove_field_access`, `remove_record_types`

**Schema authoring**
- `form`, `field`, `option_list`, `view`, `record_type`
- siblings: `create_option_list`, `option_list_item`, `option_group`, `batch_fields`

**Read-only discovery / validation**
- `list_applicable_forms`, `list_applicable_fields`, `list_field_access`, `describe_form`, `list_forms`,
  `list_option_lists`, `list_views`, `list_record_types`, `get_form`, `get_view`, `get_option_list`,
  `get_record_type`, `lookup_script_by_name`, `list_script_scope`

**Declaration read-back**
- `get_script_declarations`

## See also

- [/bluestep-mcp-connect](../../bluestep-mcp-connect/SKILL.md) — the connection this flow depends on
  (step 2's "offer to connect"), and the fresh-session caveat.
- [../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md) —
  the governing ADR: coexistence (CLI owns sync, MCP owns authoring) and the Manual→MCP mapping.
