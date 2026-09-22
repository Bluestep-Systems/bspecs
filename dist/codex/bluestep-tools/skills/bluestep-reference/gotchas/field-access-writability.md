---
description: "Field access is independent grant ROWS — read and write are separate rows on the same field, add_field_access(writable:true) grants write only, and the form-level 'writable' row is a third, separate flag; change a level by adding the new row BEFORE removing the old one (remove-first drops the field to zero access); verify with list_field_access, never the UI checkboxes or list_applicable_fields"
---

# Field-access writability is independent grant rows, not one flag

## The three things that decide whether a script can write a field

1. **Form-level row** — the per-form "Writable" checkbox on the script setup page: may the script
   write back to this form at all. This is the `writable` param on the MCP `add_forms` tool.
2. **Per-field read row** — a grant relationship saying the script may read the field. This is
   `add_field_access` with `writable: false` (or omitted).
3. **Per-field write row** — a second, separate grant relationship saying the script may write the
   field. This is `add_field_access` with `writable: true`.

Rows 2 and 3 are **independent records on the same field**. `add_field_access(writable: true)`
grants **write only** — it does not imply read. A field the script both reads and writes needs
**both** rows, so `list_field_access` lists it **twice**, once `writable: false` and once
`writable: true` (verified 2026-09-22 on a scratch formula: granting write next to an existing read
produced a third entry rather than changing the read one).

## Trap 1 — the form-level row does not recalculate the field rows

A field-level row is **captured at grant time and never recalculated**. Unchecking the form row
afterward does **not** retroactively clear it: a field granted while the row was writable stays
writable. Observed live: row unchecked, saved, reloaded, checkbox visually clear — and
`list_field_access` still reported `writable: true` for the field. **The UI can display the
intended state while the stored grant disagrees.**

## Trap 2 — a write-only field looks complete and vanishes when you "downgrade" it

Because write does not imply read, a field granted only `writable: true` has **one** row. It renders
as a normal writable field everywhere — `list_field_access` shows one entry, `list_applicable_fields`
collapses the pair into a single `access` value and reports `write` — so nothing says "there is no
read row underneath". Two consequences, both seen on live orgs:

- A script that later **reads** such a field fails at runtime with a permission error, long after
  the wiring looked verified and the declaration read-back looked clean.
- `remove_field_access(writable: true)`, meant as "drop to read-only", removes the **only** row, and
  the field **disappears from the script's access entirely**. On a published component that gap is a
  live failure on the next render.

## The fix — add the new level first, then remove the old one

Never remove first. `add_field_access` is idempotent per field, so adding a level the field already
has is a no-op, and the field is never left with zero access:

```text
# make a writable field read-only
add_field_access(scriptId, [fieldId], writable: false)   # ensure the read row exists
remove_field_access(scriptId, [fieldId], writable: true) # then drop the write row
list_field_access(scriptId)                              # one entry, writable: false

# make a read-only field writable (keep reading it)
add_field_access(scriptId, [fieldId], writable: true)    # adds the write row; read row survives
list_field_access(scriptId)                              # two entries for the field
```

Verified 2026-09-22 (scratch formula, bkplayground): remove-write on a read+write field left the
read row intact; remove-read then remove-write on the same field emptied it; re-adding read restored
it. The old prescription — remove the grant, then re-add it with the intended `writable` — opens
exactly that zero-access window and is superseded.

The UI path (uncheck the field → Save → set the row → re-check → Save) has the same shape and,
presumably, the same gap. Only the MCP order above has been exercised.

## Rules

- **Always verify writability with `list_field_access`**, never by reading the UI checkboxes and
  never from `list_applicable_fields`' single `access` value — only `list_field_access` shows both
  rows.
- A field the script **reads and writes** needs **two** `add_field_access` calls, `writable: false`
  and `writable: true`.
- Changing a level is **add-then-remove**, never remove-then-add.
- When wiring via MCP, pass the intended `writable` explicitly on **both** `add_forms` and
  `add_field_access` — don't rely on inheritance you can't see.

## Related: MCP reads aren't privilege-gated on endpoints

On an END_POINT script, MCP **reads** (`get_script_declarations`, `list_field_access`) are **not**
gated by the ENGINEER ENDPOINT privilege, even though every endpoint **write** is. An agent
without that privilege can still verify a human's UI wiring — which is exactly what makes this
gotcha diagnosable. The wiring procedure and privilege gate live in
[conventions/mcp-platform-authoring.md](../conventions/mcp-platform-authoring.md).
