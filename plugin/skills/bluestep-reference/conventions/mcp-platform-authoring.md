---
description: "The single shared procedure for performing a [PLATFORM] authoring/wiring op via the bundled platform-gateway MCP — connection-check (are the gateway tools live? fix = enable the bluestep-tools plugin + set $B6PT_TOKEN + restart) → resolve the target org to a U-number (user-supplied U-number → available_tenants map → unlisted ≠ unreachable, ask/derive) → map op to an inner tool (optional op: hint), using list_org_tools for schemas → approval echo of the concrete invoke_org_tool call (org + inner tool + args) → execute via invoke_org_tool → declaration read-back via invoke_org_tool(tool:get_script_declarations) → idempotency detect-and-skip → destructive-tool discipline, plus the supported tool set. This flow is the source of truth: /spec-execute, /quick-task, and free conversation all follow steps 2–6; only the trigger (step 1) and bookkeeping (step 7) differ. Load when about to add an import (query/form/field) to a script or create a form/field/option-list/view/record-type via the gateway MCP."
---

# MCP `[PLATFORM]` authoring / wiring procedure

This page **is** the flow. Every entry point points here and none restate it (no-duplication invariant).
It covers **authoring / wiring only** — adding an import (query / form / field) to a script, or creating
a form / field / option-list / view / record-type. It **never** writes a script draft and **never**
pushes or publishes: component **sync (pull / push / audit) stays on the `b6p` CLI**, permanently. See
[../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md).

Connection is the **bundled gateway MCP** — a single global HTTP server (`bluestep-gateway`, shipped in the
plugin's `.mcp.json`, authed by `$B6PT_TOKEN`) that **relays** to every org the token is authorized for. It
is a **relay facade** exposing three meta-tools, not a flat aggregation of each org's native tools:

- `mcp__plugin_bluestep-tools_bluestep-gateway__available_tenants` — a curated directory of AI-enabled orgs
  (`orgKey` / `name` / `defaultHost`).
- `mcp__plugin_bluestep-tools_bluestep-gateway__list_org_tools` — the inner tool set (with schemas) for a
  given org.
- `mcp__plugin_bluestep-tools_bluestep-gateway__invoke_org_tool` — run one inner tool against one org:
  `invoke_org_tool(org, tool, arguments)`, where `org` is a **U-number** orgKey (e.g. `U142030`).

Every per-org authoring/discovery tool (`add_queries`, `list_forms`, `get_script_declarations`, …) is
reached **through** `invoke_org_tool` — the native `mcp__bluestep-<subdomain>__<tool>` per-org namespaces no
longer exist.

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

Ask: **are the gateway tools live in this session?** Key off *actual* tool availability now —
specifically `mcp__plugin_bluestep-tools_bluestep-gateway__available_tenants` and
`mcp__plugin_bluestep-tools_bluestep-gateway__invoke_org_tool`.

- **Not connected** → the fix is: **enable the `bluestep-tools` plugin and set `$B6PT_TOKEN`, then
  restart.** A missing/unexpanded `$B6PT_TOKEN` at startup is the most likely cause (the bundled server
  can't authenticate). **Fresh-session caveat:** a just-enabled plugin's MCP tools register only after a
  **restart / `/reload-plugins`** — enabling now will **not** load the tools into *this* session, so the
  op cannot continue until the user restarts and re-asks. If the user wants to proceed immediately, fall
  back to the **human hand-back** (they add it in the BlueStep UI, then `/b6p-pull`). **Never** fail
  silently or half-apply.
- **Connected** → continue to step 3.

### 3 — Resolve the target org (to a U-number)

The `org` param is a **U-number** orgKey (`U…`, e.g. `U142030`) or a bare number. Resolve in this order:

1. **Task/user supplies a U-number** (or bare number) → use it directly.
2. **Else call `available_tenants`** and map the named subdomain / display name to its `orgKey`.
3. **`available_tenants` is a curated directory, NOT the reachable set** (proven 2026-07-20: LDS `U129161`
   and playground `U141832` are unlisted yet fully reachable). So if the org is **not** listed, do **not**
   conclude it's unreachable — **ask the user for its U-number** (or derive it, e.g. from
   `read_organization_log`'s `schema=U…` line), then relay. Only a `defaultHost: null` on a **listed**
   tenant means genuinely unreachable — report, don't `invoke_org_tool`.

If ambiguous or multiple candidates → **ask**; never guess which org to mutate.

### 4 — Map the op to an inner tool

Every op runs as an **inner tool** through the facade:
`invoke_org_tool(org, tool, arguments)`. Determine the inner `tool` + `arguments` from:

- an optional inline **`op:` hint** — e.g. `op: add_queries(script=…, query=allStaff)` — if the task
  supplies one, or
- the free-text description otherwise.

Inner-tool **schemas are no longer surfaced natively** (the harness sees only the 3 meta-tools). When you
need an inner tool's input schema, call **`list_org_tools(org)`** and read it from there. **Per-org tool
sets vary** (a personal playground exposed 76 tools vs bkplayground's 80) — always `list_org_tools` for the
resolved org rather than assume a fixed catalogue.

Use **read-only discovery** to fill/validate args before mutating — each via `invoke_org_tool`, e.g.
`invoke_org_tool(org, tool:"list_applicable_forms", arguments:{…})`. Read-only inner tools:
`list_applicable_forms`, `list_applicable_fields`, `list_field_access`, `describe_form`, `list_forms`,
`list_option_lists`, `list_views`, `list_record_types`, `lookup_script_by_name`, `list_script_scope`, and
the `get_*` readers.

**If the mapping is ambiguous** (unsure which inner tool or which args) → **STOP and ask**. Never guess a
mutation.

### 5 — Approval echo (mandatory)

Print the **concrete inner call** and **wait for an explicit yes** in the main session — e.g.:

```
invoke_org_tool → org=U142030 (bkplayground), tool=add_queries, arguments={ script: "…", query: "allStaff" }
```

This is the **key mitigation** for losing the native per-tool approval surface: behind `invoke_org_tool`
the harness sees one generic tool, so the echo is the only place the human sees exactly what will mutate
which org. Required at **every** entry point, conversational included.

- Denial → leave the task `[ ]`, report, stop.
- A multi-op task may take **one** approval covering the batch; report each result.

### 6 — Execute + declaration read-back

Run the op via `invoke_org_tool(org, tool, arguments)`; the org authorizes on its own authority. Then, **if
the op wired an import**, call **`invoke_org_tool(org, tool:"get_script_declarations", …)`** so the script's
`B` type reflects the new dependency, and surface it so a subsequent `[CODE]` task can code against it
immediately — no manual re-pull.

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

The **gateway** exposes only **3 meta-tools** in-session:
`mcp__plugin_bluestep-tools_bluestep-gateway__available_tenants`,
`…__list_org_tools`, and `…__invoke_org_tool`. The **~80 per-org tools below are reached _through_
`invoke_org_tool`** (`invoke_org_tool(org, tool:"<base name>", arguments:{…})`) and enumerated live via
`list_org_tools(org)` — the exact set **varies per org**, so treat this as a reference catalogue of inner
tools, not a fixed inventory.

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

- **Connection** — the `bluestep-gateway` server is **bundled** in the plugin's `.mcp.json` and
  auto-registers once the `bluestep-tools` plugin is enabled and `$B6PT_TOKEN` is set (the global `b6pt_`
  token). There is no per-org connect step. Token creation / `$B6PT_TOKEN` setup is covered by
  [/bluestep-init](../../bluestep-init/SKILL.md); the fresh-session caveat is in step 2 above.
- [../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md) —
  the governing ADR: coexistence (CLI owns sync, MCP owns authoring) and the Manual→MCP mapping.
