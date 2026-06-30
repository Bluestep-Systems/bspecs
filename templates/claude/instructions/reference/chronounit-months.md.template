---
description: "ChronoUnit.MONTHS.between counts complete elapsed months (day-aware), NOT calendar-month boundaries — use (year-year)*12 + (month-month) when porting SQL DATEDIFF(MONTH) semantics"
---

`B.time.ChronoUnit.MONTHS.between(a, b)` and SQL `DATEDIFF(MONTH, a, b)`
compute *different* numbers whenever `day(b) < day(a)`:

- **ChronoUnit.MONTHS.between** — counts *complete elapsed* months, day-aware.
  `between(2024-06-07, 2026-05-05)` = 22 (because 23 complete months would
  end on 2026-05-07).
- **SQL DATEDIFF(MONTH)** — counts calendar-month boundary crossings, day-blind.
  Same input = 23 (`(2026-2024)*12 + (5-6)`).

For "Nth-month ordinal" / "Nth-month bucket" math (where month 1
starts on a reference date and month 2 begins on the next same-day-of-month),
you want the SQL semantic. Implement with a plain calendar diff:

```ts
const calMonths = (Number(later.getYear()) - Number(start.getYear())) * 12
                + (Number(later.getMonthValue()) - Number(start.getMonthValue()));
const adj = later.getDayOfMonth() >= start.getDayOfMonth() ? calMonths : (calMonths - 1);
const monthOrdinal = adj + 1; // 1-indexed
```

`ChronoUnit.WEEKS / DAYS / YEARS .between` have the same elapsed-count
semantics. DAYS happens to match SQL DATEDIFF(DAY) because both ignore
sub-day resolution, but WEEKS and YEARS will drift the same way MONTHS
does. When porting SQL date math, port the SQL formula faithfully — don't
substitute ChronoUnit conveniences.

**Discovered:** a report shipped with `ChronoUnit.MONTHS.between` and was
off-by-one on a month-ordinal column for a fraction of rows in the
verification diff — the kind of error that only shows up when `day(b) < day(a)`.

Related: [localdate parse](localdate-parse.md) (LocalDate.parse — use B.time).
