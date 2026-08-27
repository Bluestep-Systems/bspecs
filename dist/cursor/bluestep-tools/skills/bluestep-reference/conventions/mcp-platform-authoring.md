---
description: "The single shared procedure for a [PLATFORM] authoring/wiring op via the bundled platform-gateway MCP — connection check, org resolution, tool mapping, approval echo, execute, declaration read-back — plus the supported tool set, create-time rules for queries/views, and the verified quirks list. Load when about to add an import (query/form/field/MEFR) to a script or create a form/field/option-list/view/record-type/MEFR/script object via the gateway MCP."
---

# MCP `[PLATFORM]` authoring / wiring procedure

This page **is** the flow. Every entry point points here and none restate it (no-duplication invariant).
It covers **authoring / wiring only** — adding an import (query / form / field) to a script, or creating
a form / field / option-list / view / record-type / MEFR / script object (`create_script`). It **never**
writes script source and **never** pushes or publishes: component **sync (pull / push / audit) stays on
the `b6p` CLI**, permanently. See
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

**How to read the dates in this page.** A `(verified YYYY-MM)` marker records when a behavior was last
confirmed live. Fixes ride platform versions, so an org on an older version may still show a behavior
marked fixed here — and vice versa. **An old date never licenses skipping a bullet**: the workarounds are
harmless when the underlying bug is fixed (an extra read-back, an explicit param, a solo UPDATE), so
follow them regardless. Only drop a UI hand-back when a **read-only** probe on the target org shows the
behavior changed — never re-verify with a mutation.

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
- **Connected, but an org's op fails with a `403` whose body says `AI tools are disabled for this organization`** →
  an **org-level setting**, not a credential fault (surfaces as a gateway `DOWNSTREAM_ERROR`: `The org at
  <host> answered HTTP 403: {"error":"AI tools are disabled for this organization"}`; verified live
  2026-08). The `b6pt_` token is global across every org, so **never rotate or re-issue it over this
  error** — a "fresh token" fixes nothing here and breaks every session using the old one. Ask BlueStep to
  enable AI tools for that org; until then fall back to the human hand-back, same as the `404` case.

### 3 — Resolve the target org (to a U-number)

The `org` param is a **U-number** orgKey (`U…`, e.g. `U142030`) or a bare number. Resolve in this order:

1. **Task/user supplies a U-number** (or bare number) → use it directly.
2. **Else call `available_tenants`** and map the named subdomain / display name to its `orgKey`.
3. **`available_tenants` is a curated directory, NOT the reachable set** — whether an org is reachable
   is decided per-token by that org itself, and orgs your token is authorized for stay reachable by
   U-number even when unlisted. So if the org is **not** listed, do
   **not** conclude it's unreachable — **ask the user for its U-number** (or derive it, e.g. from
   `read_organization_log`'s `schema=U…` line), then relay. Only a `defaultHost: null` on a **listed**
   tenant means genuinely unreachable — don't `invoke_org_tool`; request MCP enablement for that org from
   BlueStep, and until then fall back to the human hand-back (author in the BlueStep UI, then `b6p pull`),
   same as the 404 case in step 2.

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
- A multi-op task may take **one** approval covering the batch — except destructive ops and
  no-MCP-inverse schema ops (`create_mefr`, `record_type`, …), which get individual echoes; report each
  result.

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
- A **`null` or blank property key** in the generated declarations means the field has **no
  `formulaId`** — typically a pre-existing field. Repair per the `formulaId` bullet in
  [Known authoring quirks](#known-authoring-quirks), then re-run the read-back.
- Prove-out bar is **"declarations sufficient to code against," not byte-parity** with `/b6p-pull`.
- If the reduced declarations are insufficient, fall back to a CLI `/b6p-pull` for the full
  `declarations/` tree.
- **If the op created a query or view**, the same "success ≠ done" rule applies to the object itself:
  run the
  [create-time rules and completeness read-back](#create-time-rules-and-completeness-read-back-queries-and-views)
  before reporting the task complete.
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
views entirely (verified 2026-07), so it cannot prove a view is absent — list **without**
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
  **not** — an option list created via `create_option_list` has no `delete_option_list`, and
  `discard_pending_change` only rolls back the data-entry staging queue (it errors "requires a chat
  session"), **not** schema objects (verified 2026-07). Treat every schema-authoring op as
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
- **Writability is two independent flags** — the form-level `writable` on `add_forms` and the
  per-field `writable` on `add_field_access`, stamped at grant time and never recalculated. Pass
  the intended value explicitly on both, and verify with `list_field_access`, never the UI
  checkboxes: [gotchas/field-access-writability.md](../gotchas/field-access-writability.md).
- **Against a BSJS endpoint these are privilege-gated, not unsupported.** `add_field_access` (and the
  `add_queries` / `add_forms` siblings) on an END_POINT script requires the **ENGINEER ENDPOINT** custom
  privilege on the token's subject; without it the call fails cleanly and applies nothing. That privilege
  is a **grantable one-time prerequisite** (a global account can grant it), not a permanent dead end —
  see [Known authoring quirks](#known-authoring-quirks).

> **MEFR imports — wire the MEFR as a query group** (verified 2026-07). A multi-entry form
> report (MEFR) **is** a CustomDBView, so it is imported as the query group itself.
>
> Before step 1, decide: will the script **loop records**? If yes, the query group must be a
> record-holding `List` view, not the MEFR — see the Limitation below. `create_mefr` is irreversible;
> don't create one the design can't use.
>
> The working recipe:
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
> **Limitation:** the read-back above verifies declaration wiring and field access — it does **not**
> make the group iterable. A MEFR wired this way was observed to yield a query group the script
> cannot loop over the way a List-view-backed group can: the import "succeeds" and declarations
> generate, but record iteration does not work. When the script must **loop records**, import a real
> record-holding query (a `List` view) as the query group instead, keeping the MEFR wiring for field
> access / declarations; reading MEFR entry data through a proper `List` view:
> [gotchas/relate-query-over-mefr.md](../gotchas/relate-query-over-mefr.md). (verified 2026-08)
>
> Design pointer: import config is **per-org** — it does not travel with `b6p push` — so a code-only
> design often beats import expansion.

**Schema authoring**
- `form`, `field`, `option_list`, `view`, `record_type`
- siblings: `create_option_list`, `option_list_item`, `option_group`, `batch_fields`, `create_mefr`
- Base-record-type creation works on current platform versions: `record_type` with the Relate app's ID
  as `parentId` and `baseType: true` creates the base type together with its base form. On orgs behind
  that fix it instead produces an **orphaned category** with UI-only cleanup — so read the created type
  back (`get_record_type`) and confirm `baseType: true` and a `baseForm` exist before building on it.

> **Queries/views have create-time-only properties** (display columns, filters, sort, search criteria —
> the DELETE guard blocks fixing them later): see
> [Create-time rules and completeness read-back](#create-time-rules-and-completeness-read-back-queries-and-views).

**Read-only discovery / validation**
- `list_applicable_forms`, `list_applicable_fields`, `list_field_access`, `describe_form`, `list_forms`,
  `list_available_forms`, `list_option_lists`, `list_views`, `list_record_types`, `list_folders`,
  `get_form`, `get_view`, `get_option_list`, `get_record_type`, `lookup_script_by_name`,
  `list_script_scope`

**Declaration read-back**
- `get_script_declarations`

### Known authoring quirks

Observed live-platform behaviors with their workarounds; each bullet carries the month it was last
verified — the dating key at the top of this page says how to read the markers.

**Forms & fields**

- **`form` UPDATE can silently drop a `singleEntry` change when other properties ride in the same
  call** — the flag is not applied **and** the response echo reports the intended value as if it
  were set; a solo UPDATE carrying only the flag applies cleanly. Rule: send flag-bearing `form`
  UPDATEs **one property per call**, and verify via **`list_available_forms`** — the authoritative
  entry-mode reader (`get_form` does not reliably return it). On orgs still on a platform version
  predating the CREATE-time flag fix, a multi-entry form that was created single-entry and flipped
  by UPDATE may have a broken `form_entry` data-entry path (a stuck `..._0_` entry key) — data
  entry into such a form is a UI hand-back. (verified 2026-08)
- **Trust but verify every boolean you set — CREATE or UPDATE.** A response echo — create or
  update — is the tool's account of what it *was asked* to do, not a read of what was stored, so a
  boolean in that echo is **never authoritative** (the `singleEntry` bullet above is an UPDATE echo
  doing exactly this). Whenever a boolean flag is load-bearing (entry mode, updateability,
  visibility), **re-read it with an authoritative reader** after the call and **correct it with a
  solo UPDATE** if it disagrees — the same detect-and-correct shape as the declaration read-back in
  step 6. When *reading* booleans, remember an untouched one comes back `null`, not `false` — see
  the nullable-booleans entry in [gotchas/common-gotchas.md](../gotchas/common-gotchas.md).
- **TEXT and MEMO fields require an explicit format type on CREATE** (e.g. `textFormatType: "NONE"`)
  even though the tool schema marks it optional — omitting it fails with a missing-type-id error (it
  is a serialization discriminator server-side). (verified 2026-07)
- **Set `formulaId` at field CREATE** — it is what makes the field appear in the generated BSJS
  declarations. An `altIds FID=` entry is **not** `formulaId`: a field created with only altIds gets
  `formulaId: null`, does not appear in declarations, and the tool warns about it. Repair: a `field`
  **UPDATE** setting `formulaId`. (verified 2026-08)
- **`altIds` is not a general field-setter.** It writes key/value alternate-id entries and nothing
  else: a plausible-looking key (e.g. `uniqueId`) "succeeds" by appending an alt-id entry while the
  platform field it resembles stays unset — a success response proves no specific platform field
  was set. Concrete case: an ON_DEMAND formula's required **Identifier** (`uniqueId`) has no
  `create_script`/`update_script` parameter and cannot be set via altIds — setting it is a UI step.
  (For the FID-specific case see the `formulaId` bullet above.) (verified 2026-08)
- **A SIGNATURE field with `signatureFormatType: SIMPLE` renders BLANK unless its Right Label is
  set** — and the `field`/`form` tools do not require it, so an MCP-created signature silently
  doesn't render until a Right Label is added in the UI. Workaround: **always pass `rightLabel`**
  when creating SIMPLE signature fields via MCP. (verified 2026-07)

**Scripts**

- **END_POINT authoring is privilege-gated — a grantable prerequisite, not a dead end.** **Both**
  creating an END_POINT script (`create_script` with scriptType END_POINT) **and** wiring an existing
  endpoint's dependencies (`add_queries` / `add_forms` / `add_field_access` against an END_POINT script)
  fail with a `RemoteSecurityException` naming the **ENGINEER ENDPOINT** custom privilege when the
  `b6pt_` token's subject lacks it — verbatim on create:
  `You do not have Custom ENGINEER ENDPOINT privileges`. FORMULA and MERGE_REPORT authoring/wiring on
  the same token are unaffected (verified 2026-07). Read that message as a **missing endorsement on
  the calling user**, and treat these two facts as invariants:
  - **Nothing was created.** The privilege check fires **before** persistence and the tool's
    transaction rolls back, so the failure leaves no partial script behind. **Retrying the identical
    call without a grant fails identically** — do not retry, and do not go hunting for a duplicate you
    "might have" created.
  - **The fix is a grant, not a permanent UI hand-back.** The ENDPOINT endorsement is grantable on the
    token's subject via a global account. Route: surface the missing privilege to the user as a
    one-time setup step; if it will not be granted, hand **all** endpoint work (create + wire) to the
    platform UI for that session.

  (A pre-flight error is being added server-side as of 2026-07; the invariants hold either way.)
- **`lookup_script_by_name` misses are name mismatches far more often than missing scripts.** The
  exact-name lane is **case-sensitive** and matches the script's **display name literally** — trailing
  spaces, casing, and punctuation all count — and BSJS endpoints *are* searched, so a miss is not
  evidence the script type is unsupported. A script whose creation half-failed can appear as a
  **folder child** in the folder readers (`get_folder` / `list_folders`) while matching nothing by
  name (this is the non-privilege failure mode; a `RemoteSecurityException` create rolls back clean —
  see the END_POINT bullet). Rule: on a miss, **list the folder and compare exact display names**
  before concluding the script does not exist; only then create. (verified 2026-08)
- **`update_script` `formulaType` changes are not self-contained.** The call echoes the new
  formulaType back, but no parameter exists for the companion configuration the target type
  requires (schedule timing for `SCHEDULED_*`, the required Identifier for `ON_DEMAND`), so the
  switch can land the formula in a non-functional state with no warning. When the MCP change rides a
  batch, prefer completing the companion config in the UI right after; otherwise treat a formulaType
  change on an existing formula as a UI hand-back for the whole change. (verified 2026-08)

**Units & records**

- **Unit creation is a UI hand-back.** There is no dedicated unit tool; the only MCP path is
  `graphql_mutation createUnit`, and units it creates are structurally incomplete — the unit reads
  back fine but its Entities container is not linked, so any later record placement into it fails.
  `deleteRemoteObject` on such a unit also fails (opaque `INTERNAL`), so cleanup is UI-only. Create
  units in the platform UI; if one was already created, report it to the user for manual UI
  deletion. (verified 2026-08)
- **MCP cannot seed a record.** Both creation paths fail: the `record` tool CREATE returns
  `Cannot create an Entity w/o any form entries.` (it has no way to pass initial base-form field
  data), and `graphql_mutation createRecord` fails with an opaque `INTERNAL`. Mint records in the
  platform UI (or an app/SPA session); once a record exists, `form_entry` CREATE/UPDATE work
  against it. `record` UPDATE and DELETE exist — the gap is CREATE only. (verified 2026-08)

### Create-time rules and completeness read-back (queries and views)

**Display columns are part of CREATE, on every query/view creation path that accepts them.** A query
or view created without display columns is **incomplete**: it matches records but renders **blank**
for a human — rows with no columns to show. Always pass `displayColumns` on **every** path that takes
the parameter — the `view` inner tool and a raw `createRelateQuery` / `graphql_mutation` alike. There
is no cheap second chance: **create time is the only cheap moment.**

**Exception — `create_mefr` has no `displayColumns` parameter** (its schema takes only `formId` /
`folderId` / `mefrName` / `description`; verified 2026-08). It seeds **one** display column itself,
from the base form's **first field** — so the order fields were created in silently decides the
MEFR's display column. Changing that column afterwards is a **UI hand-back** (the DELETE guard below
blocks column edits via MCP), so when the column matters, create the intended first field before the
MEFR — or plan the UI edit up front.

The reason is the DELETE guard. Updating an **existing** view's `displayColumns` / `filterColumns` /
sort configuration internally deletes and re-adds display components, so the call dies, verbatim:
`SecurityException: AI tools are not permitted to perform DELETE operations`. Nothing in the MCP tool
set can repair it — the **only** recovery is manual work in the platform UI.

`searchCriteria` is under the same guard. Passing `searchCriteria` to an update (e.g.
`updateRelateQuery`) on a query that **already has** a search component resets — deletes and re-adds —
its child components, so the call dies on the same
`SecurityException: AI tools are not permitted to perform DELETE operations`. Replacing or normalizing
an existing criterion via MCP is impossible — UI hand-back. Adding criteria to a query that has
**none** is safe to attempt (no delete occurs); if it still fails, hand back. So set `searchCriteria`
at CREATE too — create time is the only cheap moment, same as columns. (verified 2026-08)

Option-list criteria carry an extra trap: the `view` CREATE tool accepts and persists a
SINGLE_OPTION_LIST search criterion given as an option-item topId, reports success, and `get_view`
reads it back — but query **execution** then fails with an opaque `INTERNAL` server error, and MCP
cannot repair the criterion (the DELETE guard above). Until the accepted stored value format is
documented, treat an option-list criterion as **unproven until the query has been executed**: after
creating an option-filtered query, run it (a `relateQuery` fetch or `graphql_query relateQuery` with a
small count) — a read-back of the definition is not enough. Flag this risk in the approval echo — the
user may prefer to add the criterion in the UI. Repairing a broken criterion is a UI hand-back (remove
and re-add the criterion there). (verified 2026-08)

What **does** still work on an existing view: **scalar property** updates. So set columns / filters /
sort at CREATE, and **route column/filter/sort edits on existing views to the platform UI** (hand
back, then continue). General rule: any update that replaces **child components or collections** on an
existing object triggers the internal delete-and-re-add and dies on the guard — assume that for any
non-scalar property not listed here; only scalar updates are safe to attempt.

The shape, copy-pasteable:

```
displayColumns: [{ formId: "<form topId>", fieldId: "<field topId>", sortOrder: 1 }]
```

Full `DisplayColumnInput` field list: `formId`, `fieldId`, `sortOrder`, `width`, `wordWrap`,
`sortDirection`, `detailReportId`. Resolve `formId` / `fieldId` **by name** through the read-only
discovery tools — topIds are **per-org** and never portable between orgs. For a permission/security
query the column set is fixed and one column wide:
[reference/staff-query-permission-gating.md](../reference/staff-query-permission-gating.md).

The declaration read-back of step 6 has a twin for **query / view creation**, and it is **equally
mandatory**: a create call's **success response is not proof the object is complete**. Several inputs are
accepted, reported as success, and then **silently stored as empty**. After creating a query or view —
on any path (`view`, `create_mefr`, `createRelateQuery`, `graphql_mutation`) — **read the object back**
and assert all four:

| Read back | Assert | Why it can be silently empty |
| --- | --- | --- |
| `displayFields` | non-empty — and for a MEFR, that the **seeded column is the intended field** | display columns are dropped unless passed at CREATE (above); a query with none renders **blank**. `create_mefr` always seeds one column (never empty), so its check is *which* field got seeded — the base form's first field, per the exemption above |
| `searchComponents` | non-empty | an empty criteria set **fails open** — the backing DSG matches **every** record that passes the category filter |
| `recordTypes` | expected type(s) | categories are categories **of** a base record type; without it the filter has nothing to hang on |
| `mustHaveCategories` / `mustNotHaveCategories` | expected sets | accepted on create, **stored neither** |

Repairing dropped categories: a follow-up `updateRelateQuery` **also** drops them **unless
`recordTypes` is sent in the same mutation** — the repair call must carry the record types alongside
the categories, not the categories alone.

The `searchComponents` one is a **security** failure, not a cosmetic one: an empty criteria set on a
permission query does not deny, it **admits everyone** who clears the category filter. Never conclude a
permission query works because the create returned success — assert the read-back, exactly as step 6
requires for declarations.

## See also

- **Connection** — the `bluestep-gateway` server is **bundled** in the plugin's `.mcp.json` and
  auto-registers once the `bluestep-tools` plugin is enabled and `$B6PT_TOKEN` is set (the global `b6pt_`
  token). There is no per-org connect step. Token creation / `$B6PT_TOKEN` setup is covered by
  [/bluestep-init](../../bluestep-init/SKILL.md); the fresh-session caveat is in step 2 above.
- [../../../../docs/decisions/platform-mcp-integration.md](../../../../docs/decisions/platform-mcp-integration.md) —
  the governing ADR: coexistence (CLI owns sync, MCP owns authoring) and the Manual→MCP mapping.
