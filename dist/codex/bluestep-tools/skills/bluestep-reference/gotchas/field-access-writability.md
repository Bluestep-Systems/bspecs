---
description: "Field-access writability is TWO independent flags — the form-level row ('add_forms writable') and a per-field grant stamped at grant time ('add_field_access writable') that is never recalculated; fix = remove and re-issue the grant; verify with list_field_access, never the UI checkboxes"
---

# Field-access writability is two independent flags

## The two flags

Whether a script can write a field is decided by **two separate flags** (verified 2026-08):

1. **Form-level** — the per-form row "Writable" checkbox on the script setup page: may the script
   write back to this form at all. This is the `writable` param on the MCP `add_forms` tool.
2. **Field-level** — a per-field writable flag **stamped onto the grant record at the moment the
   field is granted**, inheriting the row's setting *at that time*. This is the `writable` param
   on `add_field_access`.

## The trap

The field-level flag is **captured at grant time and never recalculated**. Unchecking the form
row afterward does **not** retroactively clear it: a field granted while the row was writable
stays writable. Observed live: row unchecked, saved, reloaded, checkbox visually clear — and
`list_field_access` still reported `writable: true` for the field. **The UI can display the
intended state while the stored grant disagrees.**

## The fix — re-issue the grant

Changing a field's writability means **removing and re-adding the grant**: uncheck the field →
Save → set the row correctly → re-check the field → Save (or `remove_field_access` +
`add_field_access` with the intended `writable`). Then verify.

## Rules

- **Always verify writability with `list_field_access`**, never by reading the UI checkboxes.
- When wiring via MCP, pass the intended `writable` explicitly on **both** `add_forms` and
  `add_field_access` — don't rely on inheritance you can't see.

## Related: MCP reads aren't privilege-gated on endpoints

On an END_POINT script, MCP **reads** (`get_script_declarations`, `list_field_access`) are **not**
gated by the ENGINEER ENDPOINT privilege, even though every endpoint **write** is. An agent
without that privilege can still verify a human's UI wiring — which is exactly what makes this
gotcha diagnosable. The wiring procedure and privilege gate live in
[conventions/mcp-platform-authoring.md](../conventions/mcp-platform-authoring.md).
