---
description: "In RelateScript, indexing an empty relationship field is safe -- relField.selected[0] resolves null-ish rather than throwing, so an unguarded .name/.id read is not a latent null-dereference bug"
---

# Relationship-field emptiness in RelateScript

In RelateScript, indexing an empty relationship field does not throw. `relField.selected[0]` on a
field with nothing selected resolves to a null-ish stand-in, and reading `.id` or `.name` off it
returns `null` rather than raising an error.

## What happens

A line like `someTxt = relField.selected[0].name` runs fine even when `relField` has no selection.
It does not throw, it does not abort the save, and it does not need a length check on
`relField.selected` first. The result is simply `null` (verified 2026-09 on a live form formula that read `someRel.selected[0].name` on every save after an earlier line had deselected `someRel`; platform engineering confirmed it benign and supplied the idiom below).

## The idiomatic check

When the code needs to branch on whether the relationship is empty, check the resolved value, not
the array length:

```
if (relField.selected[0].id == null) {
    // relField is empty
}
```

## Review consequence

An unguarded `relField.selected[0].name` on a possibly-empty relationship field is **not** a
latent null-dereference bug. Reviewers coming from JS/TS instincts will tend to flag it as one --
in RelateScript it is fine, and the idiom above is the normal way to test emptiness, not a
workaround for a bug.

## Not to be confused with

This is a RelateScript read-path behavior. [reference/relationship-field-set.md](relationship-field-set.md)
covers a different, BsJs-side hazard: `RelationshipField.set()` silently aborting the whole
formula when passed the wrong kind of id.
