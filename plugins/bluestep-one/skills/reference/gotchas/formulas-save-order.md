# Gotchas — formulas and save order

Prefix `G`.

---

### G-223 — A PRE_EDIT formula runs on the stored entry before the sent values land, so what it clears survives only when sent in the same write

What looks right: save an entry in steps, one field first and a signature later. What happens: a
PRE_EDIT formula runs on the entry as it is stored, before the values the write sends are applied.
Take a formula that clears a select while the entry is unsigned:

```
if (cur.sig.timestamp == null) {
  for (i, op in cur.choice.options) { if (op.selected == true) op.selected = false }
}
```

A write that sends *Choice* alone on an unsigned entry keeps it: the formula ran on the stored
entry, which had no choice yet, and then the value landed. The next write, with the signature only,
clears it: the formula ran on the stored entry, still unsigned and now holding the choice. A write
that sends *Choice* and the signature together keeps it. So one write per entry carries every
changed field, the signature included.

When a later write cannot carry everything (a note added after the first save, say), send the
stored value of every field the formula would clear with any change to an entry still in that
state, so the write does not lose it. The carried value alone is never a reason to write, and a
conflict check does not compare it.

**How to tell.** 1. On a test org, give a form a PRE_EDIT formula like the one above. 2. On an
unsigned test entry, send *Choice* alone in an `updateFormRow`: read back, it is kept. 3. Send a
second write with the signature only: read back, *Choice* is empty. 4. Send both in one write on a
fresh entry: read back, both are kept.

**Applies to:** any BlueStep One component
