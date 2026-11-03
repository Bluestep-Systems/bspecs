---
description: Correct runtime API to delete a multi-entry-form entry — entry.entry().delete(), NOT entry.delete() — the typed declaration on the outer interface lies
---
When you have a typed multi-entry-form record entry (e.g. `MEFR_sprints`, `MEFR_tasks`), the typed `B.d.ts` claims `delete(): boolean` exists directly on the outer interface (around line 207-210 in current B.d.ts). **It doesn't, at runtime.** Calling it throws:

```
TypeError: invokeMember (delete) on myassn.script.relate.FormRecordEntryScript failed due to: Unknown identifier: delete
```

The actual API is to first unwrap to the underlying `FormEntry` via `.entry()`, then call `.delete()`:

```typescript
// Correct
(entry as any).entry().delete();
B.commit();

// Wrong — runtime "Unknown identifier: delete"
entry.delete();
B.commit();
```

`(entry as any)` is needed because the typed interface doesn't expose `.entry()` consistently across MEF entry types — but it exists at runtime on every form-entry-script object.

## Existing usage to confirm pattern

The `entry.entry().delete()` pattern recurs across BlueStep scripts in practice — e.g. `entry.entry().delete()`, `newNote.entry().delete()`, `entryOpt.get().entry().delete()`. Apparently universal — the typed `entry.delete()` may be aspirational or deprecated.

## How to apply

- For any "delete this MEF entry" code, write `(entry as any).entry().delete()` (or `entry.entry().delete()` if your entry variable already has FormEntry typing). Call `B.commit()` afterward to persist.
- Don't trust the `delete(): boolean` signature in `B.d.ts` line ~210 — it lies.
- The error "Unknown identifier: delete" is the diagnostic sign you've hit this trap.
- This is for **deleting individual entries** of a multi-entry form. To delete a whole record, use `record.deleteRecord()` (line ~18490 in B.d.ts) — that one IS available at runtime.
