---
description: "The client-side form API available to JS embedded in Relate merges and form pages — _SR_.onLoad(fn) is the init hook (not DOM-ready), getElementObj(fieldName) reads the form element registry, .setRequired(bool) and showHide(selector) drive validation and visibility — and the collapsed-section trap where setRequired silently does nothing"
---

# Client-side form API for JS embedded in Relate pages

Client code on a Relate merge or form page has no `B` (see [file execution](file-execution.md)),
but it is not bare DOM either. The page exposes a small form API. These four calls are the ones
confirmed in use (2026-09); the surface is larger, and anything not listed here is unverified.

| Call | What it does |
| --- | --- |
| `_SR_.onLoad(fn)` | Runs `fn` once the page's form element registry is built. **This is the init hook** for embedded client code. |
| `getElementObj(fieldName)` | Returns the form element object for a field by name, from that registry. |
| `<elementObj>.setRequired(bool)` | Marks the field required (or not) for the save-time validation pass. |
| `showHide(selector)` | Toggles visibility of the matched section or element. |

## Initialise in `_SR_.onLoad`, not on DOM-ready

`getElementObj` reads a registry that the platform builds after the DOM exists. Client code that
binds on `DOMContentLoaded` or jQuery ready can run before the registry is populated and get nothing
back. Put the wiring inside `_SR_.onLoad`:

```js
_SR_.onLoad(function () {
  var note = getElementObj('noteField');
  if (note) { note.setRequired(true); }
});
```

## Trap: `setRequired(true)` is a no-op inside a collapsed section

A field inside a collapsed panel is not evaluated by the validation pass. `setRequired(true)`
returns as if it worked, no indicator appears, and the record **saves without the value**. Expanding
the section is what activates enforcement and surfaces the required marker. So client code that
makes a field required must also expand any collapsed panel containing it — for example with
`showHide` on the panel — or the requirement silently does nothing.

The failure direction is the dangerous one: you believe the save is gated, and it is not. Observed
once (2026-09) on a custom display page whose note field sat in a default-collapsed panel; it looks
like a property of the platform validation pass rather than of that page, but it is a single
observation — confirm the scope before treating it as universal.

## Related

- Conditional-required logic usually compares a radio or option field's value against an option
  id — exactly the comparison [option field DOM value](../gotchas/option-field-dom-value.md) warns
  about. The two are hit together in practice, and each fails silently on its own.
- Server-side emission of the required indicator via `mergeTag()`'s `I` code is in
  [api patterns](api-patterns.md); this file is the client-side half.
