---
description: "meetsCriteria() on a UNIT-SCOPED RecordQuery returns false in formula run context (on-demand/trigger) even for records that match — gate on the record's own form entries there; reserve meetsCriteria for endpoint/request contexts"
---

# `meetsCriteria()` on unit-scoped queries fails in formula run context

## Symptom

In **formula run context** (an on-demand or trigger formula), `meetsCriteria()` on a
**unit-scoped** RecordQuery returns `false` for records that genuinely match the query
(verified 2026-08):

- calling `query.currentUnit(record.unit().id())` + `clearSearchAndSort()` first does not help;
- passing a record object vs. an id string makes no difference — both return `false`;
- the **same records iterate fine under the same query** when the code runs in endpoint context.

**Top-level / org-wide queries are unaffected** — their `meetsCriteria()` works in the same
formula context. The failure is specific to the unit-scoped + formula-run combination.

## Why this is dangerous

The false negative is **silent** — no error, no log, just a gate that never passes. In a live
incident, a cache-refresh formula gated its write on `query.meetsCriteria(curRecord)`; the gate
never passed in trigger context, so every tracked-field save silently wrote a null cache section,
corrupting **41.7% of the org's cached records** before the pattern was found.

## Rule

- **In formula run context, gate on the record's own form entries**, not on query membership:
  read the current-record import for the form(s) that define membership, and wrap the access in
  `try/catch` — a missing entry throws, which doubles as a guard against records still mid-creation.
- **Reserve `meetsCriteria()` for endpoint/request contexts**, where it is proven — e.g. the
  user-to-staff match in [staff-query-permission-gating](../reference/staff-query-permission-gating.md).

## Diagnostic that proves it

Log `query.meetsCriteria(recordObject)` and `query.meetsCriteria(idString)` side by side from real
save traffic. Both come back `false` in formula context while the same query iterates those records
normally in endpoint context — that contrast is the confirmation, and rules out a bad criteria set.
