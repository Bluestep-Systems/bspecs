---
description: Java.Time.LocalDate is a TypeScript namespace only; for runtime LocalDate.parse() / now() / etc. use B.time.LocalDate
---
For runtime LocalDate operations, use `B.time.LocalDate`:

```ts
const d = B.time.LocalDate.parse("2025-01-01");
const today = B.time.LocalDate.now();
if (d.isAfter(today)) { ... }
```

`Java.Time.LocalDate` exists in the .d.ts as a namespace for type annotations, but `Java.Time` is NOT a runtime symbol — calling `Java.Time.LocalDate.parse(...)` throws `Java is not defined` (or returns undefined). Same applies to `Java.Time.ZonedDateTime`, `Java.Time.LocalDateTime`, etc.

**Use `Java.Time.X` only as type annotation; use `B.time.X` at runtime.**

Confirmed on a live endpoint.
