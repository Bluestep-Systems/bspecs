---
description: "A multi-entry form offers two current-record bindings, [all entries] (a collection) and [current entry] (a single entry) — which one is available, which one to use, and when a custom MEFR is actually warranted"
---

# Current-record bindings on a multi-entry form

## The built-in [all entries] binding

Relate auto-creates an `[all entries]` MEFR (an unnamed EntityList view) for every
multi-entry form — it always exists, no setup needed. Wiring a multi-entry form into a
script can pass this built-in view's topId to `add_queries`/`add_forms` directly. **No MEFR
needs to be created merely to wire a script.**

To find it: call `list_views(formId)` and look for the `queryType: EntityList` entry with a
**null `displayName`**. Confirm with `get_view` that its `primaryForm` matches the form and
`maxRows` is `-1`. Live 2026-09-18: `list_views` on a test org returned 30+ such EntityList
views with a null displayName — one per multi-entry form, matching this description.

A multi-entry form wired by its FORM topId instead (rather than this view's topId) is
excluded from the script's typedoc unless it is also the query's primary form.

## Two bindings, two TypeScript shapes

- **`[all entries]`** declares as `MEFRS_... extends EList<...>, MultiFormRecord<...>` — a
  **collection**. Use it to iterate or aggregate across every entry.
- **`[current entry]`** declares as `FormEntry_CurrentRecord_... extends FormEntry` — a
  **single entry**. Use it to act on the one entry in context (`cur.fields.someField`).

Where `[current entry]` is available it is almost always the right choice — binding
`[all entries]` instead forces an `optCurrent()`-style narrowing step by hand that the
platform would otherwise do for you.

## When [current entry] is available

Any component whose **primary form is a multi-entry form** — not just post-save formulas.
That includes merge reports, and formulas of every non-scheduled type: `PRE_EDIT`,
`PRE_SAVE`, `POST_SAVE`, `PRE_DELETE`, `ON_DEMAND`. Only the scheduled types
(`SCHEDULED_QUERY`, `SCHEDULED_ALL_RELATE`) are excluded — they have no primary form at all.

The binding only appears once Primary Form is set **and** the form is multi-entry:

- **Formulas** — `create_script` accepts `primaryFormId` (requires an explicit
  non-scheduled `formulaType`), so the binding is available immediately at creation.
- **Merge reports** — `primaryFormId` is FORMULA-only; a merge report's Primary Form has to
  be set in the platform UI before its `[current entry]` binding exists. Same sequencing
  trap, one script type later.

Either way, a component created without a Primary Form only offers `[all entries]` — silently
binding the collection and leading to narrowing code that was never necessary.

`list_views` surfaces only the `[all entries]` EntityList. Tool output alone never reveals
that `[current entry]` exists for a given component — check the component's Primary Form
setting instead.

## When a custom MEFR is actually warranted

Otherwise `[all entries]` is the right choice — build a custom MEFR only for one of these:

1. **Display/sort control.** `[all entries]` shows the form's summary fields, caps at 8
   fields total, and sorts on the first field only (as observed 2026-09). A custom MEFR can sort on multiple
   fields, show more than 8, and display connected merge reports instead of raw fields —
   but only if configured that way. Creating one with no sort order specified inherits the
   same first-column-only sort and fixes nothing.
2. **Looping one entry set while cleanly referencing another** — a separate MEFR gives a
   clean second handle.
3. **Search.** A custom MEFR can carry search components; the built-in `[all entries]` ships
   `allowSearch: false` with no search components.

A custom MEFR adds schema with **no MCP inverse** — removal is UI-only.

## See also

- [gotchas/relate-query-over-mefr.md](../gotchas/relate-query-over-mefr.md) — reading entry
  data through a query (a different job from wiring a script import).
