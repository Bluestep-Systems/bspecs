---
description: "A relationship field that a formula's source never names can still show a 'Formula write' edge in the dependency inspector, because writing one side of a relationship field necessarily writes the connected side too — it is not a stale edge and it is not evidence the formula references that field"
---

# Connected relationship fields show up as writes in the dependency inspector

## Symptom

Reading a dependency graph — the Relate inspector, or the gateway MCP inspector tool — a
relationship field shows a `Formula write` edge from a formula whose source never names that
field. The field has no `formulaId` of its own, and nothing in the formula's code touches it
directly.

## Cause

A relationship field joins two fields, one on each side of the relationship. Setting a value on
one side necessarily writes the other side too, because they are two views of the same
relationship. The connected side gets the write edge by virtue of being the other half of a
relationship the formula does write — not because the formula's code references it (observed
2026-09 on a live org).

## Rule

- It is **not a stale edge**. Re-saving the formula does not clear it; there is nothing stale to
  clear. The edge is correct — it is just easy to misread as leftover.
- Source text alone **under-describes** what a write touches wherever relationship fields are
  involved. Before trusting a formula's blast radius to match what its code names, check the graph
  for a connected field on the other side of any relationship the formula does write.
- The reverse also holds: do not treat a `Formula write` edge on a relationship field as proof the
  formula's code references that field. It may only be the connected half of a relationship the
  code writes elsewhere.
- Unverified: whether this edge is gated by the field's Propagate setting. Turning Propagate off on
  one side left the edge in place, which is consistent with the bidirectional-write mechanism above
  — but the test only touched one side, so this is one data point, not a settled rule. Confirm
  before relying on it either way.

## Related

Both this gotcha and [relationship field set](../reference/relationship-field-set.md) trace back to
the same fact — a relationship field is two-sided — but they hit different failure modes: this one
is a read-side surprise in the dependency graph, that one is a write-side silent abort from
`.set()`.
