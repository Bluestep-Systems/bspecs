---
description: "BlueStep addSearch needs MM/DD/YYYY for date fields — YYYY/MM/DD passes validation but silently fails to filter; raw Java LocalDate objects also fail"
---

When building MEF queries with `addSearch(field, op, value)` against a date or date/time field, pass the value as a string in `MM/DD/YYYY` format (US-order, slash-separated) — what BlueStep's `parseDate` documents as its default at `B.d.ts:2660`.

**Why:** Two BlueStep date formats coexist and they are NOT interchangeable for search input:

- `B.time.B6P_LOCAL_DATE = ofPattern("uuuu/MM/dd")` — the serialization/display format. `YYYY/MM/DD` strings ARE accepted by `addSearch` validation as "well-formatted" (no error thrown), but the comparison silently fails to apply — the predicate is dropped and all rows pass through unfiltered. Learned the hard way (twice).
- `B.time.parseDate` default = `MM/dd/yyyy` — the actual parser BlueStep uses for date search values. This is the format `addSearch` wants.

ISO-8601 `YYYY-MM-DD` (with dashes, what HTML `<input type="date">` emits) throws the explicit error: *"Searching a date/time field requires a null, a date/time value or a String containing a well formatted date/time value."*

Passing a raw Java `LocalDate` object from `B.time.LocalDate` also fails — Graal.js's JS↔Java marshalling does not produce a usable string representation when the value flows into `addSearch`. (However, `B.time.ZonedDateTime` instances appear to work in practice.)

**How to apply:**

- Format a JS `Date` to BlueStep search format as `MM/DD/YYYY` with slashes: `${m}/${day}/${y}`, zero-padded.
- Convert ISO `YYYY-MM-DD` from HTML date inputs to `MM/DD/YYYY` before calling `addSearch`.
- Working precedent: a `toMDY = (iso) => "${m}/${d}/${y}"` helper applied before `addSearch`.
- Do NOT pass raw `LocalDate` / `LocalDateTime` Java objects to `addSearch` — always convert to BlueStep-format strings first.
- For datetime **field writes** specifically (a different code path from the `addSearch` values this file governs): the verified accepted form is `M/D/YYYY h:mmAM` — non-padded month/day/hour, no seconds, no space before the meridiem — observed live 2026-07; ISO 8601 is rejected by a validation regex. Whether padded or seconds-bearing variants (e.g. `MM/DD/YYYY hh:mm:ss a`) are *also* accepted remains unverified. See the "Dates" subsection of `bsjs-development.md` and `reference/datetime-field-write.md`.

**The trap that bit twice:**

1. Initial bug 2026-04-24: passed ISO `YYYY-MM-DD` → got the well-formatted-date error → fixed by switching to `YYYY/MM/DD`.
2. Regression 2026-04-26: `YYYY/MM/DD` made the error stop, but filters silently returned all rows. Real fix: switch to `MM/DD/YYYY`. Don't be fooled by the absence of an error — a date filter that's actually applied produces a *narrower* row count.
