---
description: "How a multi-entry form's [all entries] view sorts, how to pick a safe sort key when code reads the latest entry, and why grouping a report on a DateTime or Signature field silently produces nothing"
---

# Multi-Entry Form Sorting

## The default sort

The built-in **[all entries]** view sorts on the **first summary field only**. A custom MEFR does
not fix this just by existing — with no sort order configured, it falls back to the same
first-column-only behavior. Building a MEFR is not itself the fix — configuring its sort is. One
created and left unconfigured leaves the problem exactly where it was while looking addressed.

## Reading the "latest" entry in code

When code reads the latest entry (a formula, report, or merge — see [iterating entries in
api-patterns](api-patterns.md#iterating-single-vs-multi-entry-forms)), `entries[0]` is only
trustworthy if the sort is chronological **and** empties are accounted for — because a null sorts
above real data.

Three valid designs:

1. **A required date field first** — the value always exists, so nothing needs filtering.
2. **A signature field first, deliberately nullable** — for forms where only a *signed* entry
   governs (e.g. an unsigned draft assessment isn't the controlling document). This is sound
   *because* the reading formula filters out unsigned entries, not despite the nullability.
3. **A custom MEFR with an explicitly configured sort** — not merely a custom MEFR.

What's invalid: leaving a nullable field as the effective sort key while code treats `[0]` as the
latest with no filter. It fails silently — a wrong answer from the wrong entry, never an error.

## Date vs DateTime

This is about how many entries are expected per day, not precision for its own sake:

- **Date** — a day is a sufficient discriminator and within-day order doesn't matter.
- **DateTime** — multiple same-day entries are expected and their order matters. Note fields
  generally want DateTime; use it whenever *when* something happened is substantive information,
  not just a sort key.

## Never group a report on a DateTime or Signature field

This is absolute. Every value is effectively distinct, so each row becomes its own group and the
grouping produces nothing. Searching does work, but every such search has to widen a plain date to
day boundaries:

```typescript
startDT = toDateTime(dateStart, toTime("12:00am"));
endDT   = toDateTime(dateEnd,   toTime("11:59pm"));
```

A **hidden plain-date companion field** removes both frictions — grouping becomes possible at all,
and date searches become plain date searches. Add the companion at build time; retrofitting means
backfilling every existing entry. (For the write-side mechanics of the DateTime field itself, see
[writing date and datetime fields](api-patterns.md#writing-date-and-datetime-fields) and
[datetime-field-write](datetime-field-write.md).)

## Default order, and the exception

Outside the code-reads-latest case, a date field first is still the right default for anything
chronological, logs included — `defaultValue: "timeStamp"` makes requiring it costless.

The genuine exception is an entry list that isn't a timeline at all: a setup form backing a
relationship field, where entries are a fixed set of choices that should sort by index or
alphabetically.

## Not to be confused with

- [multi entry in multi entry](multi-entry-in-multi-entry.md) — a different problem: one form
  entry holding many sub-notes in a JSON memo field, not the ordering of the entries themselves.
