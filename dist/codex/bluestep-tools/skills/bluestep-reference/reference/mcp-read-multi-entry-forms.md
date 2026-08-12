---
description: "Reading multi-entry form entries through the gateway MCP — form_entry READ is broken for multi-entry (NEW_MULTI), formRows ignores limit/offset and times out on huge forms, fieldData is one-field-one-entry (batch via GraphQL aliases); prefer relateQuery over a stored List query, the only paged, filterable path"
---

# Reading multi-entry form entries via the gateway MCP

The read-path decision tree for multi-entry form data, as observed live (2026-07, plugin 0.14.0 —
the underlying platform gaps are tracked separately and may be fixed server-side later). Without
this map, discovering it costs a fresh session ~15 calls.

## The paths, worst to best

1. **`form_entry` READ — broken for multi-entry.** On a multi-entry form it resolves to a
   `NEW_MULTI` empty template and cannot enumerate rows (a read of existing multi-entry rows throws
   server-side). Do not spend calls on it.
2. **GraphQL `formRows(id, recordId)` — works for topIds, with three sharp edges:**
   - it **ignores `limit` and `offset` entirely** — every call returns the full set;
   - each row carries a heavy **XMLEncoder `xml` blob** (parseable: a `values` map keyed by the
     column C-codes) rather than clean field values;
   - it **times out on large forms** (observed on a form in the ~100k+ row range).
   Usable for small forms when you only need topIds; wrong tool for values at scale.
3. **`fieldData(field, formEntry)` — one field of one entry per call.** For more than a couple of
   reads, **batch via GraphQL query aliases** (one request, many `fieldData` selections).
4. **`relateQuery` over a stored `List` query — PREFER THIS.** It is the **only** read path that
   honors `start`/`count` and accepts runtime `filter`/`sort` (filters take **`fieldId`**, not
   `field`). If no stored query covers the data, **create one** — for any form that needs
   recurring triage, a platform query pays for itself immediately. Creating that view via the
   `view` tool has four traps of its own (zero-row `maxRows` default, base-type `recordTypes`,
   `list_views` false negatives, List-not-EntityList) — see
   [relate query over mefr](../gotchas/relate-query-over-mefr.md); this file deliberately does not
   restate them.

## Argument-name gotchas (cost real calls)

Sibling tools disagree on argument names — read the schema (`describe_tool`) instead of assuming:

- the `field` tool takes **`field`** (not `fieldId`);
- `get_option_list` takes **`listId`** (not `optionListId`).
