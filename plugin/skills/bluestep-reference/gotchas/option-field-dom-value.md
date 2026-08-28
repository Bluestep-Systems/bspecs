---
description: "A platform-rendered option field's DOM value is not the export value — observed live as the option's topId — so client code comparing DOM values against export codes silently never fires; read the live DOM before writing the comparison, and match export value, topId, or label"
---

# Option-field DOM values are not export values

When the platform renders a single-select option field as an editable widget, the DOM `value`
of the rendered control is **not reliably the option's export value**. Observed live: the
option's **topId** (`1000013___…`) where the export value (`1`) was expected. Client code that
compares the field's DOM value against export codes then never matches — **silently**: no
error, the logic simply never fires, and logic that never fires is indistinguishable from
logic that is correctly quiet. (One long-validated component carries a years-old comment about
the platform's "occasional habit of putting option IDs in `value` instead of the export
value" — with a label-text fallback around it — so the behavior is not new, and "occasional"
means you cannot assume either shape.)

## Rules

- Before writing client code that reads **any** platform-produced DOM property (`value`, `src`,
  `textContent`, `checked`), **read the live DOM first** — the platform's widget markup is not
  what the field type suggests.
- Match defensively: accept the export value **or** the option topId, with a label-text
  fallback, rather than assuming one shape.
- Verify the **positive** case on a live page. Absence of the effect (a rule that never fires,
  a marker that never appears) is not evidence the code is right.

## Related

To build the export-value ↔ topId mapping for a list, read the items over GraphQL —
[option-list-export-values](../reference/option-list-export-values.md) (`get_option_list` alone
won't do it: it omits export values).
