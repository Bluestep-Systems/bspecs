---
description: Read the most recent PRIOR committed version of a form entry with entry.versionStream().findFirst().orElse(null) to diff current-vs-previous field values, with no stored "old value" fields
---
# Diffing a Field Against Its Previous Committed Version

To detect whether a field changed on save without storing a separate "old value" field, read the most recent **prior** committed version of the entry off its version stream and compare field-by-field.

## Canonical read

```typescript
// Previous committed version, or null on first create:
const prev = entry.versionStream().findFirst().orElse(null);
```

`versionStream()` yields the committed versions most-recent-first; `findFirst()` is the previous version (a Java `Optional`), and `.orElse(null)` collapses the empty case to `null`.

## Normalize-and-compare helper

Compare `cur.fields[name].val()` against `prev.fields[name].val()`, normalizing so equivalent values don't read as changed. Use `JSON.stringify` for array-valued fields (e.g. multi-select) and a trimmed `String()` otherwise:

```typescript
function norm(v: unknown): string {
  return Array.isArray(v) ? JSON.stringify(v) : String(v ?? "").trim();
}

function changed(cur: FormEntry, prev: FormEntry, name: string): boolean {
  return norm(cur.fields[name].val()) !== norm(prev.fields[name].val());
}
```

## First-create null guard

On a brand-new entry there is no prior version, so `prev` is `null`. Skip the comparison entirely rather than treating "no previous" as a change:

```typescript
if (prev == null) {
  // First create — nothing to diff against.
  return;
}
```

## Pre-save vs post-save timing caveat

**Where you run this matters.** In a **pre-save** formula the current save has not committed yet, so `findFirst()` reliably returns the truly-previous version. In a **post-save** the current save may already be committed, in which case `findFirst()` can return the *just-committed* state instead of the prior one. Before relying on the result in a post-save, verify that the version you read back is genuinely the prior version and not the state you just wrote.

## Example (generic)

A pre-save that stamps a "modified" timestamp only when a tracked set of fields changed vs. the previous version:

```typescript
const prev = entry.versionStream().findFirst().orElse(null);
if (prev != null) {
  const tracked = ["fieldA", "fieldB", "fieldC"]; // generic FIDs
  const anyChanged = tracked.some((name) => changed(entry, prev, name));
  if (anyChanged) {
    entry.fields.modifiedAt.val(B.time.ZonedDateTime.now(B.time.userZoneId()));
  }
}
```
