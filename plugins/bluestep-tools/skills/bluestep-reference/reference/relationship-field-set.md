---
description: "RelationshipField.set() needs the form-entry id of the field's target form — passing a Record id silently aborts the formula (no JS-catchable error). Watch for `as any` casts hiding the bug."
---

`RelationshipField.set(id)` requires an id that points at the **form the field targets**, not the underlying Record.

If `logs.fields.clientRel` is a relationship to each client's `Hidden Client Data` form, then:

- ✅ `entry.fields.clientRel.set(client.forms.hidden.id())`
- ❌ `entry.fields.clientRel.set(client.id())` — silent abort
- ❌ `entry.fields.clientRel.set(B.util.toId(client.id().shortId()))` — silent abort

The failure mode is brutal: **the formula terminates without throwing**. The JS `try/catch` does NOT fire. `B.io.printStackTrace` does NOT run. The scheduled-formula log just stops after the last line emitted before the bad `.set()` call. The only way to localize the failure is to add a `console.log` immediately before every `.set()` and see which one becomes the last line.

## How to know what form a relationship targets

Read the pulled declarations. Each `Record_<query>` type declares the forms accessible through `.forms.<name>`. The relationship field's target is one of those form-entry types. Field labels in the BlueStep UI sometimes hint at it ("Hidden Client Data", "Hidden Staff Data") but the declarations are authoritative.

## Static vs dynamic

`RelationshipField.selected()` returns `EList<RelationshipFormEntry>`, where `RelationshipFormEntry extends FormEntry`. So `setting.fields.whoStatic.selected()[0]` IS a FormEntry already — pass it directly to `.set()`. No `.id()` unwrap, no `.shortId()` round-trip.

## The cast-to-`any` smell

If `.set(...)` only type-checks with an `as any` cast, that's a red flag — the declared signature is `set(id: Id<Entry>|Entry|Id<FormEntry>|FormEntry)`. If your value doesn't fit one of those, the cast is masking the runtime bug, not fixing it. Fix the value, drop the cast.

## Cross-log relationships (log → log)

For fields like `parentLog` on the `logs` MEF that link one log entry to another, pass the **committed parent log entry** directly: `child.fields.parentLog.set(parentLogEntry)`. The shortId-string round-trip via `B.util.toId(shortId)` is the same hazard class.

Companion pattern: separately populate the sibling `parentLogId` TextField with `parentLogEntry.id().shortId()` — that one IS a string field and is correct.

## Related

- See [new entry id](new-entry-id.md) — must `B.commit()` before reading a new entry's `shortId()`, including before using it as a relationship target.
- See [datetime field write](datetime-field-write.md) — different field, same Graal-overload-ambiguity failure mode (silent abort, no JS catch).
- See [top level const tdz](../conventions/top-level-const-tdz.md) — another class of silent-termination bug (TDZ on top-level const).
