---
description: "zonedDateTimeParts works on DateTimeField (ZonedDateTime). For TimeField (LocalTime), use a separate HH:mm extractor — the regex looks for a T-separator that LocalTime stringifies without"
---

A `zonedDateTimeParts(field)` helper parses `String(field)` looking for `YYYY-MM-DDTHH:MM` — that's the ZonedDateTime stringification used by `DateTimeField`.

`TimeField` is backed by `LocalTime`, which stringifies as `"HH:mm:ss"` with **no T-separator and no date**. Feeding a TimeField through `zonedDateTimeParts` silently returns `{ date: null, time: null }` — no error, just dropped time-of-day.

When the declarations show `startTime: Bluestep.Relate.TimeField` or `endTime: Bluestep.Relate.TimeField` on a form, reach for a TimeField-specific helper instead — e.g. `timeFieldString(field)` that returns `"HH:mm"` directly from `String(field.opt().get())`.

DateTimeField vs TimeField is easy to confuse at a glance — both look like "time" semantics. Check the declaration type before reaching for `zonedDateTimeParts`.

Related: [datetime field write](datetime-field-write.md) (DateTimeField writes use `field.val(zonedDateTime)`, not `.dateTimeVal(...)`).
