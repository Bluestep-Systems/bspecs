---
description: "A MergeReport has no per-field writability — one component-level setting, 'Allow this merge report to be used to edit data' under Advanced Usage Options, controls whether mergeTag(\"F\") renders an editable control for every field in the report at once; do not ask for a field to be made writable, and never infer editability from the readonly TypeScript declaration"
---

# MergeReport editability is a component-level setting

## Symptom

A task adds an editable field to a MergeReport (for example a checkbox rendered with
`mergeTag("F")`), and the natural move is to ask for the field to be made "writable" — the way a
formula component's `require({ fields: [...], writable: true })` works. The request does not map
to anything on a MergeReport's setup page, and confuses whoever is asked to act on it.

## Cause

MergeReports have no per-field writability at all (observed 2026-09 on a live org). A single **component-level** setting —
**"Allow this merge report to be used to edit data"**, under **Advanced Usage Options** on the
component's setup page — decides whether `mergeTag("F")` renders an editable control, and it
applies to **every** field in the report at once. There is no per-field equivalent to a formula
import's `writable: true`; that analogy from formula components does not carry over.

The TypeScript declaration cannot settle it either. A writable field and a read-only field both
appear the same way, `readonly foo: Bluestep.Relate.SomeField` — `readonly` there is the
TypeScript property modifier on the declaration, not a statement about the field's actual
writability. Never infer editability from the declaration file.

## Fix

- To render an editable control in a MergeReport, the import only needs the field **present** so
  it reaches `declarations/index.d.ts`. Do not ask for the field to be made writable — there is no
  such per-field option.
- Before relying on `mergeTag("F")` producing an editable control, confirm the component's "Allow
  this merge report to be used to edit data" box is checked. That single yes/no is the real
  precondition for the whole report.
- Field-level platform permissions still apply on top of that box — but those are permissions on
  the field itself, not something the formula or the import configuration controls.
- This is separate from the always-on rule that code must never call `.writable()`; that rule is
  about not requesting writability in code and holds for every component type. This gotcha is
  about how a MergeReport's editability is actually turned on, which is UI-only.

## Related

- [reference/api-patterns.md](../reference/api-patterns.md) documents `mergeTag()`'s option codes,
  including `"F"` for an editable field.
- [gotchas/field-access-writability.md](field-access-writability.md) covers the real per-field
  writability model — grant rows on formula/endpoint scripts — which is the model this gotcha
  warns you NOT to reach for on a MergeReport.
