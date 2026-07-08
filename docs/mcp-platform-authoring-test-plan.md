# MCP `[PLATFORM]` authoring/wiring — test plan (bkplayground)

**Status:** Ready to run (human-runnable; not automated — needs a live playground org)

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

- [ ] **A FRESH connected session where the MCP tools actually register in-app.** The
      `mcp__bluestep-bkplayground__*` tools must be **live in this session** — i.e. callable from the
      agent, not merely added via `claude mcp add` in a prior session. **The curl `initialize` handshake
      alone is NOT sufficient** (it proves the server answers, not that the tools registered in the host).
      This is the open fresh-session prereq/gate; confirm it first by listing the available
      `mcp__bluestep-bkplayground__*` tools in this session before running anything below.
- [ ] **Global `B6PT_TOKEN`** is set (the single global `b6pt_` token from `/bluestep-mcp-connect`). Note:
      this token is **global-super** — every mutation below runs as global admin, so run only against
      **bkplayground**, never a real org.
- [ ] **A throwaway target script** on bkplayground for the wiring trio — record its topId as `<scriptId>`
      below. A throwaway **target form / field parent** as needed for schema tests.
- [ ] The org is the sanctioned disposable playground (**bkplayground**). If multiple orgs are connected,
      confirm you are targeting `mcp__bluestep-bkplayground__*` specifically.

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

- [ ] Baseline captured (record which groups / forms / fields are present *before* wiring).
- [ ] Returned declarations are well-formed TS and sufficient to code against (the prove-out bar is
      **"sufficient to code against," not byte-parity** with `/b6p-pull`).
- **Description self-sufficient? (Y/N + note):** ______________________________________________

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

- [ ] `add_queries` succeeded and `<groupId>` appears in declarations.
- [ ] `remove_queries` succeeded and `<groupId>` is **gone** from declarations (matches baseline).
- [ ] Teardown clean — no residual query group (else log in the ledger).
- **Description self-sufficient? (Y/N + note):** ______________________________________________

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

- [ ] `add_forms` succeeded and `<formulaId>` appears in declarations.
- [ ] `remove_forms` succeeded and `<formulaId>` is **gone** from declarations.
- [ ] Teardown clean — no residual form dep (else log in the ledger).
- **Description self-sufficient? (Y/N + note):** ______________________________________________

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

- [ ] `add_field_access` succeeded and `<fieldId>` appears in declarations with a type.
- [ ] Optionally re-run `add_field_access` to confirm **idempotency** (no duplicate, no error).
- [ ] Optionally grant `writable: true` and confirm read vs. write track **independently**.
- [ ] `remove_field_access` succeeded and `<fieldId>` access is **gone** (matches baseline). If you granted
      both read and write, remove **both** (one call per `writable` value).
- [ ] Teardown clean — no residual field access (else log in the ledger).
- **Description self-sufficient? (Y/N + note):** ______________________________________________

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

**Create (intent)** — create an option list, then (if separate tools) add an item / group:

```json
// mcp__bluestep-bkplayground__create_option_list  → { /* args TBD */ }   (or option_list)
// mcp__bluestep-bkplayground__option_list_item     → { /* args TBD */ }
// mcp__bluestep-bkplayground__option_group          → { /* args TBD */ }
```

**Assert** — the list appears via `list_option_lists`; `get_option_list` returns it with its items/groups:

```json
// mcp__bluestep-bkplayground__list_option_lists
// mcp__bluestep-bkplayground__get_option_list   → { "optionListId": "<optionListId>" }
```

**Teardown — CONFIRM LIVE; report residue if the object persists.** Delete OR `discard_pending_change` —
verify live. Report residue for the list and any items/groups if they persist.

- [ ] Option list (+ item/group) create succeeded and appears via `list_option_lists` / `get_option_list`.
- [ ] Teardown mechanism **confirmed live**: ______________________________________________
- [ ] Teardown clean (list + items + groups) — else report residue in the ledger.
- **Description self-sufficient? (Y/N + note):** ______________________________________________

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

| # | Object created | Id (fill in) | Teardown call run | Confirmed gone | Residue? (YES/NO + note) |
| --- | --- | --- | --- | --- | --- |
| 2.1 | query-group dep | `<queryId>`/`<groupId>` | `remove_queries` | [ ] | |
| 2.2 | form dep | `<formOrReportId>`/`<formulaId>` | `remove_forms` | [ ] | |
| 2.3 | field access grant | `<fieldId>` | `remove_field_access` | [ ] | |
| 2.4 | form | `<formId>` | delete / discard (TBD) | [ ] | |
| 2.5 | field(s) | `<fieldId>` | delete / discard (TBD) | [ ] | |
| 2.6 | option list (+items/groups) | `<optionListId>` | delete / discard (TBD) | [ ] | |
| 2.7 | view | `<viewId>` | delete / discard (TBD) | [ ] | |
| 2.8 | record type (+ import) | `<recordTypeId>` | `remove_record_types` / delete / discard (TBD) | [ ] | |

**Final state:** [ ] bkplayground confirmed clean — the target `<scriptId>` matches its baseline
declarations and no test-created schema object remains. If unticked, list outstanding residue here:

_____________________________________________________________________________________________

---

## Notes for the audit TODO

Collect the per-tool **description self-sufficiency** findings here after the run. These feed the separate
**"MCP tool-inventory audit"** TODO (they are captured as platform feedback, **not** fixed in this repo).

| Tool | Self-sufficient? (Y/N) | Gap / note (what was missing to call it correctly) |
| --- | --- | --- |
| `get_script_declarations` | | |
| `add_queries` / `remove_queries` | | |
| `add_forms` / `remove_forms` | | |
| `add_field_access` / `remove_field_access` | | |
| `form` | | |
| `field` / `batch_fields` | | |
| `option_list` / `create_option_list` / `option_list_item` / `option_group` | | |
| `view` | | |
| `record_type` / `add_record_types` / `remove_record_types` | | |

**Also record:**
- The confirmed **teardown mechanism** for each schema tool (delete vs. `discard_pending_change` vs. a
  dedicated `remove_*`) — this resolves the uncertainty flagged in §2.4–2.8 and should be folded back into
  the `bluestep-reference` procedure page if it changes the destructive-tool discipline.
- Whether `get_script_declarations` was **sufficient to code against** for each wiring op (the prove-out
  bar), or whether a CLI `/b6p-pull` was needed for the full `declarations/` tree.

## See also

- `bluestep-reference` skill → `conventions/mcp-platform-authoring.md` — the single shared procedure these
  tools implement (connection-check → map op → approval echo → execute → declaration read-back).
- `docs/decisions/platform-mcp-integration.md` — the governing ADR (coexistence: CLI owns sync, MCP owns
  authoring).
