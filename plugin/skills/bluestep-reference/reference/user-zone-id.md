---
description: B.time.userZoneId() returns the user/system ZoneId; B.userZoneId() does NOT type-check
---

`userZoneId(): Java.Time.ZoneId` is defined on the `Bluestep.Time` class (i.e. `B.time`), NOT on `B` directly. Use `B.time.userZoneId()`.

The `DateTimeField.dateTimeVal` jsdoc says "Same as calling val(localDateTime.atZone(B.userZoneId()))" — that's a shorthand in the comment, not a real method on `B`. TypeScript rejects `B.userZoneId()` with `Property 'userZoneId' does not exist on type 'CurrentRecordB'`.

Use in formula post-save / endpoints that need to attach a zone to a parsed `LocalDateTime` or `Instant`:

```ts
B.time.LocalDateTime.parse('2026-05-15T14:30').atZone(B.time.userZoneId())
B.time.Instant.parse('2026-05-15T14:30:00.000Z').atZone(B.time.userZoneId())
```

Related: [datetime field write](datetime-field-write.md) (always pass `ZonedDateTime` to `.val()` — `dateTimeVal` overloads are Graal-ambiguous).
