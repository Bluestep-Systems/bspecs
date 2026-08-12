---
description: "The single shared procedure for performing a [PLATFORM] authoring/wiring op via the bundled platform-gateway MCP — connection-check (are the gateway tools live? fix = enable the bluestep-tools plugin + set $B6PT_TOKEN + restart) → resolve the target org to a U-number (user-supplied U-number → available_tenants map → unlisted ≠ unreachable, ask/derive) → map op to an inner tool (optional op: hint), using list_org_tools for schemas → approval echo of the concrete invoke_org_tool call (org + inner tool + args) → execute via invoke_org_tool → declaration read-back via invoke_org_tool(tool:get_script_declarations) → idempotency detect-and-skip → destructive-tool discipline, plus the supported tool set. This flow is the source of truth: /spec-execute, /quick-task, and free conversation all follow steps 2–6; only the trigger (step 1) and bookkeeping (step 7) differ. Load when about to add an import (query/form/field/MEFR) to a script or create a form/field/option-list/view/record-type/MEFR (create_mefr) via the gateway MCP."
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
  **restart** (`/reload-plugins` in Claude Code; in Cursor/Codex, start a fresh session after enabling) — enabling now will **not** load the tools into *this* session, so the
  op cannot continue until the user restarts and re-asks. If the user wants to proceed immediately, fall
  back to the **human hand-back** (they add it in the BlueStep UI, then `/b6p-pull`). **Never** fail
  silently or half-apply.
- **Connected** → continue to step 3.
- **Connected, but a specific org's op fails with a `404` from its `/mcp` endpoint** → that org does
  **not** expose the platform MCP (commonly the case for customer / non-BlueStep-internal orgs). This is a
  per-org exposure gap, **not** a gateway-connection problem — do **not** retry. Request MCP enablement for
  that org from BlueStep; until then fall back to the human hand-back (author in the BlueStep UI, then
  `b6p pull`).

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

- The read-back is **mandatory after any schema or wiring op a `[CODE]` task will build on** — not
  optional polish. A successful `add_field_access` (or any wiring success response) is **not** proof
  the declarations are usable.
- **Confirm the expected accessor names appear** in the read-back — the specific property keys /
  const names the dependent `[CODE]` task will reference, not just "declarations changed."
- A **`null` or blank property key** in the generated declarations means **STOP and hand back to the
  UI** (see the field-FID quirk in [Known authoring quirks](#known-authoring-quirks)).
- Prove-out bar is **"declarations sufficient to code against," not byte-parity** with `/b6p-pull`.
- If the reduced declarations are insufficient, fall back to a CLI `/b6p-pull` for the full
  `declarations/` tree.
- **`get_script_declarations` may be absent from a given org's toolset** (confirm via `list_org_tools`).
  When it is, the declaration read-back step is impossible — fall back to a `b6p pull` to refresh the
  script's `declarations/`. Treat `b6p pull` as the **norm** for declaration refresh wherever this tool is
  missing.

### 7 — Bookkeeping (per entry point)

Spec-driven only: **mark `[x]`** in `tasks.md`, noting the tool(s) run, and **STOP** for review before the
next task. Conversationally there is no checkbox — just report what ran.

## Idempotency

**Object already exists** (re-run, or added manually) → detect via the `list_*` / `get_*` readers and
**skip with a report**. Do not error and do not duplicate. **Caution — `list_views(formId:)` gives
false negatives**: the formId filter misses `primaryForm` relationships and omits EntityList/MEFR
views entirely (verified live 2026-07-31), so it cannot prove a view is absent — list **without**
the filter and match by name/type before concluding an object doesn't exist (details:
`gotchas/relate-query-over-mefr.md`).

## Safety / destructive-tool discipline

- **Approval before every mutation** — no exceptions, no batch-approving destructive ops.
- The `b6pt_` token is **global-super**: every mutation runs as global admin. The approval echo is the
  guardrail. One exception: endpoint ops are additionally gated by the **ENGINEER ENDPOINT** custom
  privilege, so "global-super" does **not** guarantee END_POINT authoring — see
  [Known authoring quirks](#known-authoring-quirks).
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
- **Against a BSJS endpoint these are privilege-gated, not unsupported.** `add_field_access` (and the
  `add_queries` / `add_forms` siblings) on an END_POINT script requires the **ENGINEER ENDPOINT** custom
  privilege on the token's subject; without it the call fails cleanly and applies nothing. That privilege
  is a **grantable one-time prerequisite** (a global account can grant it), not a permanent dead end —
  see [Known authoring quirks](#known-authoring-quirks).

> **MEFR imports — wire the MEFR as a query group** (verified live 2026-07-31). A multi-entry form
> report (MEFR) **is** a CustomDBView, so it is imported as the query group itself. The working recipe:
>
> 1. **`create_mefr`** (`formId` = the base form's topId, plus `folderId` / `mefrName`) — first check
>    `list_views` **without a formId filter** for an existing MEFR of the form and reuse it (the
>    formId filter omits MEFRs — see Idempotency above). `create_mefr` is a **schema op with no
>    MCP inverse** (cleanup is UI-only), so it gets the raised approval-echo bar from Safety above.
> 2. **`add_queries`** with the **MEFR's topId** as `queryId` plus a `groupId` variable name — the MEFR
>    is the query group.
> 3. **`add_forms`** with the **MEFR's topId** as `formOrReportId`, a `formulaId`, and the **same
>    `groupId`**.
> 4. **`add_field_access`** for each field the script reads — the MEFR import alone yields an **empty
>    `Fields` interface**.
> 5. Declaration read-back (step 6). The resulting binding is a **bare global const named after the
>    `groupId`**, not `B.queries.X`.
>
> Failure modes to recognize:
>
> - `add_forms` with the MEFR topId but **no `groupId`** → **silent no-op**: `formsAdded: 0`, no error,
>   declarations unchanged.
> - a plain "List" query view's topId → **loud rejection**, verbatim:
>   `Formula Id MUST be for a form or a multi-entry form report.`
> - the base form's own topId passed directly → **excluded from the script's typedoc** unless it is the
>   query's primary form (the original silent failure).
>
> Design pointer: import config is **per-org** — it does not travel with `b6p push` — so a code-only
> design often beats import expansion.

**Schema authoring**
- `form`, `field`, `option_list`, `view`, `record_type`
- siblings: `create_option_list`, `option_list_item`, `option_group`, `batch_fields`, `create_mefr`

> **`view` tool — column/filter/sort edits on an existing view fail.** Updating an **existing** view's
> `displayColumns` / `filterColumns` / sort configuration internally deletes and re-adds display
> components, so the call dies on the AI-tools DELETE guard, verbatim:
> `SecurityException: AI tools are not permitted to perform DELETE operations`.
> What **does** work: setting columns/filters/sort at **CREATE** time, and **scalar property** updates
> on an existing view. So: get the columns right when creating the view; **route column/filter/sort
> edits on existing views to the platform UI** (hand back, then continue).

**Read-only discovery / validation**
- `list_applicable_forms`, `list_applicable_fields`, `list_field_access`, `describe_form`, `list_forms`,
  `list_available_forms`, `list_option_lists`, `list_views`, `list_record_types`, `list_folders`,
  `get_form`, `get_view`, `get_option_list`, `get_record_type`, `lookup_script_by_name`,
  `list_script_scope`

**Declaration read-back**
- `get_script_declarations`

### Known authoring quirks

Observed live-platform behaviors (as of 2026-07) with their workarounds. These may be fixed
server-side later — verify against the org you're on if a bullet seems stale.

- **`form` CREATE mishandles `singleEntry` / `userUpdateable`** — the values are ignored or inverted,
  and the CREATE response echo **cannot be trusted**: it reports the flags it did *not* set.
  Workaround: CREATE, then a `form` **UPDATE** with the intended flags, then verify via
  **`list_available_forms`** — the authoritative entry-mode reader (`get_form` does not reliably
  return the entry-mode flag). (A server-side fix for the flag handling is in flight; the read-back
  habit below outlives it.)
- **Trust but verify every boolean you set at CREATE time.** A CREATE response echo is the tool's
  account of what it *was asked* to do, not a read of what was stored, so a boolean in that echo is
  **never authoritative**. Whenever a boolean flag is load-bearing (entry mode, updateability,
  visibility), **re-read it with an authoritative reader** after the create and **correct it with an
  UPDATE** if it disagrees — the same detect-and-correct shape as the declaration read-back in step 6.
- **TEXT and MEMO fields require an explicit format type on CREATE** (e.g. `textFormatType: "NONE"`)
  even though the tool schema marks it optional — omitting it fails with a missing-type-id error (it
  is a serialization discriminator server-side).
- **`record_type` CREATE produces an orphaned category, not a base record type** — base-record-type
  creation is effectively unsupported via MCP, and cleanup is UI-only (schema ops have no MCP
  inverse — do not experiment).
- **`form` / `field` / `batch_fields` CREATE cannot set a field's script-facing FID** (the field's
  script-addressable identifier) — the field is created without one, so the generated declarations
  emit a literal `readonly null:` property key, the field does **not** appear in
  `list_applicable_fields`, and a `field` **UPDATE** with a clean name does **not** repair the
  identifier. Workaround: create script-addressable fields in the **platform UI** with the Formula ID
  set at creation time — the MCP `field` tool alone is not sufficient for a field code will read.
- **END_POINT authoring is privilege-gated — a grantable prerequisite, not a dead end.** **Both**
  creating an END_POINT script (`create_script` with scriptType END_POINT) **and** wiring an existing
  endpoint's dependencies (`add_queries` / `add_forms` / `add_field_access` against an END_POINT script)
  fail with a `RemoteSecurityException` naming the **ENGINEER ENDPOINT** custom privilege when the
  `b6pt_` token's subject lacks it — verbatim on create:
  `You do not have Custom ENGINEER ENDPOINT privileges`. FORMULA and MERGE_REPORT authoring/wiring on
  the same token are unaffected. Read that message as a **missing endorsement on the calling user**,
  and treat these two facts as invariants:
  - **Nothing was created.** The privilege check fires **before** persistence and the tool's
    transaction rolls back, so the failure leaves no partial script behind. **Retrying the identical
    call without a grant fails identically** — do not retry, and do not go hunting for a duplicate you
    "might have" created.
  - **The fix is a grant, not a permanent UI hand-back.** The ENDPOINT endorsement is grantable on the
    token's subject via a global account. Route: surface the missing privilege to the user as a
    one-time setup step; if it will not be granted, hand **all** endpoint work (create + wire) to the
    platform UI for that session.

  (A pre-flight, honest "you lack ENGINEER ENDPOINT" error ahead of the attempt is being added
  server-side; the invariants above hold either way.)
- **`lookup_script_by_name` misses are name mismatches far more often than missing scripts.** The
  exact-name lane is **case-sensitive** and matches the script's **display name literally** — trailing
  spaces, casing, and punctuation all count — and BSJS endpoints *are* searched, so a miss is not
  evidence the script type is unsupported. A script whose creation half-failed can also appear as a
  **folder child** in the folder readers (`get_folder` / `list_folders`) while matching nothing by
  name. Rule: on a miss, **list the folder and compare exact display names** before concluding the
  script does not exist; only then create.
- **A SIGNATURE field with `signatureFormatType: SIMPLE` renders BLANK unless its Right Label is
  set** — and the `field`/`form` tools do not require it, so an MCP-created signature silently
  doesn't render until a Right Label is added in the UI. Workaround: **always pass `rightLabel`**
  when creating SIMPLE signature fields via MCP.

## See also

- **Connection** — the `bluestep-gateway` server is **bundled** in the plugin's `.mcp.json` and
  auto-registers once the `bluestep-tools` plugin is enabled and `$B6PT_TOKEN` is set (the global `b6pt_`
  token). There is no per-org connect step. Token creation / `$B6PT_TOKEN` setup is covered by
  [/bluestep-init](../../bluestep-init/SKILL.md); the fresh-session caveat is in step 2 above.
- [../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md) —
  the governing ADR: coexistence (CLI owns sync, MCP owns authoring) and the Manual→MCP mapping.
