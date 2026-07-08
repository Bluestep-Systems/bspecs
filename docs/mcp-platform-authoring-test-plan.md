# MCP `[PLATFORM]` authoring/wiring — test plan (bkplayground)

**Status:** Ran 2026-07-08 against **bkplayground** (Task 9 live prove-out). Wiring trio + oracle: **PASS, clean**.
Schema authoring (`option_list`): **create/assert PASS; teardown has NO MCP path → 1 residue object** (see §3, deleted manually in UI).

This is a committed, human-runnable checklist for the **Phase-4 authoring/wiring tools** that the
`mcp-platform-authoring` feature calls. It is the artifact **Task 9** (the live prove-out) executes against
a disposable **bkplayground** org in a fresh connected session. It is **not** the full ~80-tool MCP
inventory — that is the separate "MCP tool-inventory audit" TODO. This plan feeds that audit its per-tool
description-sufficiency findings (see [Notes for the audit TODO](#notes-for-the-audit-todo)).

The flow under test is the single shared procedure in the `bluestep-reference` skill's
`conventions/mcp-platform-authoring.md`. This plan does not restate that flow; it exercises the tools it
names.

---

## 1. Purpose & prerequisites

### What this validates

Each authoring/wiring tool the feature uses actually performs its operation against a live org, the effect
is **observable** through a read-back oracle (`get_script_declarations` for wiring; `list_*` / `get_*` for
schema objects), and the operation can be **torn down** so the playground is left clean.

**In scope:** the wiring trio (`add_queries`, `add_forms`, `add_field_access`) with their inverses, the
`get_script_declarations` oracle, and the schema-authoring tools (`form`, `field`, `option_list` and its
siblings, `view`, `record_type`, `batch_fields`).

**Out of scope (do NOT test here):**
- Component **sync** — pull / push / audit / writing or publishing a script draft. That is the **b6p CLI's**
  job, permanently. This plan never pushes or pulls component source.
- **Data-entry** tools (`form_entry` / `stage_*`), **permissions** (`grant_permission` / `set_permissions`),
  and **users / sites / pages** — out of scope per the requirements.

### The general pattern

- **Read/inspect tools** (`get_script_declarations`, `list_*`, `get_*`) are asserted **directly** — call and
  confirm the expected shape.
- **Mutating tools** follow **create → assert → teardown**: run the tool, assert the effect via the reader,
  then run the inverse (delete / remove / rollback). If teardown leaves anything behind, **report the
  residue clearly** in the [cleanup ledger](#3-residue--cleanup-ledger) rather than silently moving on.

### Prerequisites (all required before you start)

- [x] **A FRESH connected session where the MCP tools actually register in-app.** **CONFIRMED** — all 88
      `mcp__bluestep-bkplayground__*` tools were live/callable in this session (in-app registration held, not
      merely a prior `claude mcp add`). The curl handshake was **not** relied on.
- [x] **Global `B6PT_TOKEN`** is set (the single global `b6pt_` token from `/bluestep-mcp-connect`). Note:
      this token is **global-super** — every mutation below runs as global admin, so run only against
      **bkplayground**, never a real org. **CONFIRMED** — all mutations targeted `mcp__bluestep-bkplayground__*`.
- [x] **A throwaway target script** on bkplayground for the wiring trio — `<scriptId>` =
      **`530024__FID_testMcp`** ("FC Test mcp", MERGE_REPORT). Schema test used a self-contained option list
      (no form/field parent needed).
- [x] The org is the sanctioned disposable playground (**bkplayground**). Only `mcp__bluestep-bkplayground__*`
      was targeted.

### Fill-in placeholders

Leave org-specific ids as placeholders here; fill in the **real bkplayground topIds** inline during Task 9:

| Placeholder | Meaning |
| --- | --- |
| `<scriptId>` | topId of the throwaway target script (the wiring subject) |
| `<queryId>` | CustomDBView topId of a query to wire (e.g. an `allStaff`-style query) |
| `<groupId>` | the formula variable name for a wired query group |
| `<formId>` / `<formOrReportId>` | topId of a form/report to wire or of a created form |
| `<formulaId>` | the formula variable name for a wired form |
| `<fieldId>` | topId of a field to grant access to / of a created field |
| `<optionListId>` | topId of a created option list |
| `<viewId>` | topId of a created view |
| `<recordTypeId>` | topId of a created / imported record type |

**Resolved values (Task 9 run, bkplayground, 2026-07-08):**

| Placeholder | Resolved value |
| --- | --- |
| `<scriptId>` | `530024__FID_testMcp` ("FC Test mcp", MERGE_REPORT) |
| `<queryId>` / `<groupId>` | `1000019__FID_allUsers` ("All Users") / `probeGroup` |
| `<formId>` / `<formulaId>` | `1000001__FID_name` ("Name and E-mail", current-record) / `probeForm` |
| `<fieldId>` (wiring) | `1000101__SID_PERSONALINFO-FIRST-NAME` (`firstName`, TextField) |
| `<optionListId>` | `1000012___532116` ("FC Test MCP Probe List"; items `1000013___1281144` Alpha, `1000013___1281145` Beta) — created, then **deleted manually in UI 2026-07-08** (see §3) |
| `<viewId>` / `<recordTypeId>` | not exercised (one schema tool sufficed per Step 4) |

---

## 2. Per-tool sections

Legend for each mutating tool: **Call** (the MCP invocation) → **Assert** (the reader that proves the
effect) → **Teardown** (the inverse) → checkboxes + a description-sufficiency line.

### 2.0 `get_script_declarations` — read-only oracle (asserted directly)

This is **both** the declaration read-back step of the procedure **and** the primary assertion oracle for
the entire wiring trio. Establish a baseline first, then diff against it after each wiring op.

```json
// mcp__bluestep-bkplayground__get_script_declarations
{ "scriptId": "<scriptId>" }
```

Returns the script's generated TS declarations — the `B` type plus wired query-group vars, form
`formulaId`s, and granted fields with their exact script types. Call it now to capture the **baseline**
(before any wiring), and again after each `add_*` below.

- [x] Baseline captured — declarations were exactly `declare const B: Bluestep.Relate.MergeReportB;` (no
      wired groups/forms/fields). Every `add_*` produced a clean, observable delta against this baseline, and
      all three `remove_*` returned it to this exact baseline byte-for-byte.
- [x] Returned declarations are well-formed TS and **sufficient to code against** — after the trio,
      `probeGroup` was a typed `RecordQuery`, `probeForm` a `FormEntry_CurrentRecord`, and
      `probeForm.fields.firstName` was typed `Bluestep.Relate.TextField<any>`. A dependent `[CODE]` task
      could code against these directly; no `/b6p-pull` needed. **Prove-out bar met.**
- **Description self-sufficient? (Y/N + note):** **Y** — description states exactly when to call it (after
      wiring, before writing draft code) and that identifiers must come from it, not display labels. Correct.

---

### 2.1 `add_queries` / `remove_queries` — wire a query-group dependency

Signatures **verified against the live server** (clean inverse — create → assert → teardown is exact).

**Call** — adds query-group deps. `queryId` = the query's CustomDBView topId; `groupId` = the formula
variable name the group will bind to.

```json
// mcp__bluestep-bkplayground__add_queries
{
  "scriptId": "<scriptId>",
  "queries": [
    { "queryId": "<queryId>", "groupId": "<groupId>" }
  ]
}
```

**Assert** — call `get_script_declarations(<scriptId>)`; the **group variable name** (`<groupId>`) must
appear in the declarations that it did not appear in at baseline.

```json
// mcp__bluestep-bkplayground__get_script_declarations
{ "scriptId": "<scriptId>" }
```

**Teardown** — remove the query group. Removing a query group also **drops form deps attached to it**, so
run this after the form teardown (2.2) if you wired a query-backed form.

```json
// mcp__bluestep-bkplayground__remove_queries
{ "scriptId": "<scriptId>", "queryIds": ["<queryId>"] }
```

- [x] `add_queries` succeeded (`queriesAdded: 1`) and `probeGroup` appeared as
      `declare const probeGroup: RecordQuery_probeGroup;` (keyed to `1000019__FID_allUsers` "All Users").
- [x] `remove_queries` succeeded (`queriesRemoved: 1`) and `probeGroup` is **gone** (matches baseline).
- [x] Teardown clean — no residual query group.
- **Description self-sufficient? (Y/N + note):** **Y** — clear that `queryId` is the CustomDBView topId and
      `groupId` is the formula variable name, and that forms attach to the same `groupId` afterward.

---

### 2.2 `add_forms` / `remove_forms` — wire a form/report dependency

Signatures **verified against the live server** (clean inverse).

**Call** — adds form/report deps.
- **Current-record form** (Formula / MergeReport only): **omit** `groupId`.
- **Query-backed form:** supply the `groupId` from `add_queries` (2.1).
- **EndPoints** always require a `groupId`.

```json
// mcp__bluestep-bkplayground__add_forms
{
  "scriptId": "<scriptId>",
  "forms": [
    {
      "formOrReportId": "<formOrReportId>",
      "formulaId": "<formulaId>",
      "groupId": "<groupId>",
      "writable": false
    }
  ]
}
```

> For a current-record form, drop the `groupId` key entirely (do not pass null).

**Assert** — call `get_script_declarations(<scriptId>)`; the form `formulaId` (`<formulaId>`) must appear.

**Teardown** — remove the form dep. (If it was query-backed, tearing down the query group in 2.1 also
removes it — teardown either way and confirm.)

```json
// mcp__bluestep-bkplayground__remove_forms
{
  "scriptId": "<scriptId>",
  "forms": [
    { "formOrReportId": "<formOrReportId>", "groupId": "<groupId>" }
  ]
}
```

- [x] `add_forms` succeeded (`formsAdded: 1`) with **`groupId` omitted** (current-record on a MergeReport)
      and `probeForm` appeared as `declare const probeForm: FormEntry_CurrentRecord_probeForm;` — the
      `CurrentRecord` in the type name confirms the no-`groupId` path resolved correctly.
- [x] `remove_forms` succeeded (`formsRemoved: 1`, `groupId` omitted to match) and `probeForm` is **gone**.
- [x] Teardown clean — no residual form dep.
- **Description self-sufficient? (Y/N + note):** **Y** — the omit-`groupId`-for-current-record rule, the
      query-backed / EndPoint `groupId` requirement, and the MEFR/multi-entry guidance are all spelled out.

---

### 2.3 `add_field_access` / `remove_field_access` — grant field read/write

Signatures **verified against the live server** (clean inverse). Idempotent per field; **read and write are
tracked independently** (`writable: false`/omit = read grant; `writable: true` = write grant).

**Call** — grant access to fields by field topId.

```json
// mcp__bluestep-bkplayground__add_field_access
{
  "scriptId": "<scriptId>",
  "fieldIds": ["<fieldId>"],
  "writable": false
}
```

**Assert** — call `get_script_declarations(<scriptId>)`; the granted `<fieldId>` field(s) must appear with
their script types.

**Teardown** — remove the same access grant (match the `writable` value you granted).

```json
// mcp__bluestep-bkplayground__remove_field_access
{
  "scriptId": "<scriptId>",
  "fieldIds": ["<fieldId>"],
  "writable": false
}
```

- [x] `add_field_access` succeeded (returned `{fieldId, fieldName:"First Name", writable:false}`) and
      `firstName` appeared under `Fields_CurrentRecord_probeForm` typed `Bluestep.Relate.TextField<any>`.
- [ ] Idempotency re-run — **not exercised** (single grant was sufficient for the prove-out).
- [ ] `writable: true` independence — **not exercised** (read grant only; description documents the
      independent read/write tracking).
- [x] `remove_field_access` succeeded (returned `fieldAccess: []`) and `firstName` access is **gone**
      (matches baseline). Only a read grant was made, so a single `writable:false` removal sufficed.
- [x] Teardown clean — no residual field access.
- **Description self-sufficient? (Y/N + note):** **Y** — states access is by field topId, `writable`
      semantics, that the field-access relationship is the source of truth, and that it is idempotent per field.

---

### 2.4 Schema authoring — `form` (create a form)

> **Args and teardown to be confirmed LIVE.** The exact argument list for `form` was **not** verified
> against the server for this plan — read the live tool description during Task 9 and record the real args
> below. Do **not** invent an arg list.

**Create (intent)** — create a form on bkplayground. Fill the real args from the live `form` tool
description:

```json
// mcp__bluestep-bkplayground__form
{ /* args TBD — copy from the live tool description during Task 9 */ }
```

**Assert** — the new form appears via the matching reader:

```json
// mcp__bluestep-bkplayground__list_forms      → the created form is listed
// mcp__bluestep-bkplayground__get_form         → { "formId": "<formId>" } returns it
```

**Teardown — CONFIRM LIVE; report residue if the object persists.** The platform has a **pending-change
model** (`list_pending_changes` / `discard_pending_change`), so teardown may be either a **delete** OR a
**discard-pending-change** — verify which applies to a freshly created form against the live tool set.
If neither cleanly removes it, **leave the object and report it as residue** in the ledger.

- [ ] `form` create succeeded and the form appears via `list_forms` / `get_form`.
- [ ] Teardown mechanism **confirmed live** (delete vs. discard-pending-change): ____________________
- [ ] Teardown clean — else report residue in the ledger.
- **Description self-sufficient? (Y/N + note):** ______________________________________________

---

### 2.5 Schema authoring — `field` / `batch_fields` (create field(s))

> **Args and teardown to be confirmed LIVE.** Exact args for `field` and `batch_fields` were **not**
> verified for this plan. Read the live descriptions during Task 9; do not invent args.

**Create (intent)** — create one field (`field`) or several at once (`batch_fields`):

```json
// mcp__bluestep-bkplayground__field         → { /* args TBD from live description */ }
// mcp__bluestep-bkplayground__batch_fields   → { /* args TBD — batched field creation */ }
```

**Assert** — the new field(s) appear via `get_form` on the parent form (fields are listed under their
form) and/or `list_applicable_fields` / `list_field_access` where appropriate.

**Teardown — CONFIRM LIVE; report residue if the object persists.** Likely a delete OR a
`discard_pending_change` against the pending-change queue — verify live. Report residue if the field(s)
persist.

- [ ] `field` / `batch_fields` create succeeded and the field(s) appear via the reader.
- [ ] Teardown mechanism **confirmed live**: ______________________________________________
- [ ] Teardown clean — else report residue in the ledger.
- **Description self-sufficient? (Y/N + note):** ______________________________________________

---

### 2.6 Schema authoring — `option_list` (+ `create_option_list` / `option_list_item` / `option_group`)

> **Args and teardown to be confirmed LIVE.** The relationship between `option_list`, `create_option_list`,
> `option_list_item`, and `option_group` — and which one actually creates the list vs. adds items/groups —
> was **not** verified for this plan. Read the live descriptions during Task 9; do not invent args.

**Create — ACTUAL args used (Task 9).** `create_option_list` is the dedicated creator: `name` + `items`
required (initial items mandatory), optional `description` + `folderId` (defaults to Relate Structure root).
The generic `option_list` tool overlaps it (`name`→create / `listId`→update). `option_list_item` /
`option_group` add items/groups to an existing list (not exercised — `create_option_list`'s `items` sufficed).

```json
// mcp__bluestep-bkplayground__create_option_list
{ "name": "FC Test MCP Probe List",
  "description": "Throwaway — Task 9 MCP prove-out. Safe to delete.",
  "items": ["Alpha", "Beta"] }
// → topId 1000012___532116; items 1000013___1281144 (Alpha), 1000013___1281145 (Beta)
// NOTE: `description` was SILENTLY DROPPED — the created list came back with description:null.
```

**Assert** — the list appears via `list_option_lists`; `get_option_list` returns it with its items/groups:

```json
// mcp__bluestep-bkplayground__list_option_lists
// mcp__bluestep-bkplayground__get_option_list   → { "optionListId": "<optionListId>" }
```

**Teardown — CONFIRMED LIVE: NO MCP PATH EXISTS → RESIDUE.** Findings:
- **No `delete_option_list` tool** in the bkplayground MCP set (only create / update / get / list, plus
  `option_list_item` / `option_group`, all of which are create-or-update — **none delete**).
- **`discard_pending_change` does NOT apply.** It errored `"list_pending_changes requires a chat session"`
  — the pending-change queue is the **`stage_form_entry` data-entry staging** mechanism (staged record/form
  field-writes awaiting user approval), *not* a schema-object rollback queue. `create_option_list` commits
  immediately; it is never staged, so there is nothing to discard.
- The only remaining avenue is a hand-authored `graphql_mutation` delete — **not attempted** (guessing an
  unverified destructive mutation as global-super admin violates the "never guess a mutation" rule).
- **Resolution:** option list `1000012___532116` was deleted **manually in the bkplayground UI** on
  2026-07-08; no MCP teardown exists.

- [x] Option list create succeeded and appears via `list_option_lists` (count 4→5) / `get_option_list`.
- [x] Teardown mechanism **confirmed live**: **none via MCP** — no delete tool; `discard_pending_change` is
      data-entry-only. Manual UI deletion required.
- [x] Teardown clean via **manual UI deletion** (2026-07-08) — option list `1000012___532116` (+ items
      Alpha/Beta) removed in the bkplayground UI; logged in §3. No MCP path exists.
- **Description self-sufficient? (Y/N + note):** **Y (create) / N (lifecycle).** `create_option_list`'s own
      args are clear and it worked, BUT: (a) the `description` arg was silently dropped, and (b) the tool set
      exposes no delete — the create half is documented, the teardown half is undiscoverable from the
      descriptions alone. Also the `create_option_list` vs generic `option_list` overlap is unexplained.

---

### 2.7 Schema authoring — `view` (create a view)

> **Args and teardown to be confirmed LIVE.** Exact args for `view` were **not** verified for this plan.
> Read the live description during Task 9; do not invent args.

**Create (intent):**

```json
// mcp__bluestep-bkplayground__view   → { /* args TBD from live description */ }
```

**Assert** — the view appears via `list_views`; `get_view` returns it:

```json
// mcp__bluestep-bkplayground__list_views
// mcp__bluestep-bkplayground__get_view   → { "viewId": "<viewId>" }
```

**Teardown — CONFIRM LIVE; report residue if the object persists.** Delete OR `discard_pending_change` —
verify live.

- [ ] `view` create succeeded and appears via `list_views` / `get_view`.
- [ ] Teardown mechanism **confirmed live**: ______________________________________________
- [ ] Teardown clean — else report residue in the ledger.
- **Description self-sufficient? (Y/N + note):** ______________________________________________

---

### 2.8 Schema authoring — `record_type` (create) + `add_record_types` / `remove_record_types` (import)

> **Args and teardown to be confirmed LIVE.** Exact args for `record_type` were **not** verified for this
> plan. Read the live description during Task 9; do not invent args. Note there are **two** related
> operations: `record_type` **creates/authors** a record type, whereas `add_record_types` /
> `remove_record_types` **wire (import) a record type into a script** — the latter pair is a clean
> create/inverse like the wiring trio and is the likely teardown for a record-type *import*.

**Create (intent):**

```json
// mcp__bluestep-bkplayground__record_type    → { /* args TBD from live description */ }
// (import into a script, if testing the wiring:)
// mcp__bluestep-bkplayground__add_record_types → { /* args TBD; likely scriptId + record type ids */ }
```

**Assert** — the record type appears via `list_record_types`; `get_record_type` returns it. If you tested
the **import**, `get_script_declarations(<scriptId>)` should reflect it.

```json
// mcp__bluestep-bkplayground__list_record_types
// mcp__bluestep-bkplayground__get_record_type   → { "recordTypeId": "<recordTypeId>" }
```

**Teardown — CONFIRM LIVE; report residue if the object persists.**
- For an **import**, `remove_record_types` is the inverse (verify args live).
- For an **authored** record type, teardown is a delete OR `discard_pending_change` — verify live.

- [ ] `record_type` create (and/or `add_record_types` import) succeeded and appears via the reader.
- [ ] Teardown mechanism **confirmed live** (`remove_record_types` for import vs. delete/discard for
      authoring): ______________________________________________
- [ ] Teardown clean — else report residue in the ledger.
- **Description self-sufficient? (Y/N + note):** ______________________________________________

---

## 3. Residue / cleanup ledger

Tick each row **only** after you have confirmed the object is gone from bkplayground. If anything could not
be torn down, set **Residue? = YES** and describe it — a dirty playground is a reportable result, not a
silent pass.

| # | Object created | Id | Teardown call run | Confirmed gone | Residue? (YES/NO + note) |
| --- | --- | --- | --- | --- | --- |
| 2.1 | query-group dep | `1000019__FID_allUsers`/`probeGroup` | `remove_queries` | [x] | NO — gone from declarations |
| 2.2 | form dep | `1000001__FID_name`/`probeForm` | `remove_forms` (no groupId) | [x] | NO — gone from declarations |
| 2.3 | field access grant | `1000101__SID_PERSONALINFO-FIRST-NAME` | `remove_field_access` | [x] | NO — `fieldAccess:[]`, gone |
| 2.4 | form | — | not exercised | n/a | n/a — one schema tool sufficed |
| 2.5 | field(s) | — | not exercised | n/a | n/a |
| 2.6 | option list (+items) | `1000012___532116` (Alpha `1000013___1281144`, Beta `1000013___1281145`) | manual UI deletion (no MCP delete path) | [x] | NO — deleted manually in bkplayground UI 2026-07-08. **Note:** no `delete_option_list` via MCP (`discard_pending_change` is data-entry-only) — captured as platform feedback |
| 2.7 | view | — | not exercised | n/a | n/a |
| 2.8 | record type (+ import) | — | not exercised | n/a | n/a |

**Final state:** [x] bkplayground **confirmed clean** (2026-07-08). The wiring subject `530024__FID_testMcp`
matches its baseline declarations exactly (`declare const B: Bluestep.Relate.MergeReportB;` — wiring trio 100%
torn down), and the one schema-authoring residue has been cleared:

- **Option list `1000012___532116` ("FC Test MCP Probe List")** + items Alpha/Beta — created by
  `create_option_list`, **not removable via any MCP tool**, so it was **deleted manually in the bkplayground
  UI on 2026-07-08**. (The no-MCP-teardown gap is captured as platform feedback in the audit TODO.)

---

## Notes for the audit TODO

Collect the per-tool **description self-sufficiency** findings here after the run. These feed the separate
**"MCP tool-inventory audit"** TODO (they are captured as platform feedback, **not** fixed in this repo).

| Tool | Self-sufficient? (Y/N) | Gap / note (what was missing to call it correctly) |
| --- | --- | --- |
| `get_script_declarations` | Y | Clear on when to call and that identifiers must come from it. |
| `add_queries` / `remove_queries` | Y | `queryId`=CustomDBView topId, `groupId`=formula var; clean inverse. |
| `add_forms` / `remove_forms` | Y | Omit-`groupId`-for-current-record + EndPoint/MEFR rules all documented. |
| `add_field_access` / `remove_field_access` | Y | topId + `writable` semantics + idempotency stated; read/write independent. |
| `form` | — | Not exercised this run. |
| `field` / `batch_fields` | — | Not exercised this run. |
| `option_list` / `create_option_list` / `option_list_item` / `option_group` | **Partial (Y create / N lifecycle)** | `create_option_list` args clear + worked, BUT: (1) `description` arg **silently dropped** (created with `description:null`); (2) **no delete tool exists** and `discard_pending_change` is data-entry-only, so the object cannot be torn down via MCP — undiscoverable from descriptions; (3) `create_option_list` vs generic `option_list` **overlap unexplained** (which to prefer?). |
| `view` | — | Not exercised this run. |
| `record_type` / `add_record_types` / `remove_record_types` | — | Not exercised this run. |

**Also record:**
- **Confirmed teardown mechanisms:**
  - Wiring trio (`add_queries`/`add_forms`/`add_field_access`) → dedicated `remove_*` inverse, **clean**,
    asserted via `get_script_declarations`. Verified.
  - `create_option_list` (schema authoring) → **NO MCP teardown.** No `delete_option_list`;
    `discard_pending_change` applies only to the `stage_form_entry` **data-entry** queue (it errors
    `"requires a chat session"`), not to committed schema objects. **Action for the audit TODO:** the
    §2.4–2.8 "delete vs. discard" uncertainty is resolved in the *negative* for option lists — there is no
    MCP delete path at all. Confirm whether `form`/`field`/`view`/`record_type` authoring share this gap,
    and feed it back to the platform team as MCP feedback (no delete tools for authored schema objects).
    The `bluestep-reference` procedure page should note that MCP-authored schema objects currently have no
    MCP teardown (UI cleanup required) so callers do not create disposable schema objects expecting rollback.
- **`get_script_declarations` sufficient to code against:** **YES** for all three wiring ops — the reduced
  declarations carried real types (`RecordQuery`, `FormEntry_CurrentRecord`, `TextField<any>`). No
  `/b6p-pull` fallback was needed. Prove-out bar met.

## See also

- `bluestep-reference` skill → `conventions/mcp-platform-authoring.md` — the single shared procedure these
  tools implement (connection-check → map op → approval echo → execute → declaration read-back).
- `docs/decisions/platform-mcp-integration.md` — the governing ADR (coexistence: CLI owns sync, MCP owns
  authoring).
