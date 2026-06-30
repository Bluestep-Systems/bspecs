---
description: "The \"multi entry in a multi entry\" pattern — letting users add many notes/updates against a single BlueStep multi-entry form, stored as JSON in one memo field"
---

**"Multi entry in a multi entry"** — a reusable pattern. A BlueStep form is itself a multi-entry form (one record has many entries of it); this pattern lets each entry hold **multiple sub-notes/updates** without a real child form. It's a concrete application of the [merge report memo json](merge-report-memo-json.md) hack.

**What the user sees:** A custom section on the form with a **table** of entries (e.g. Notes · Author · Date · Actions) and a **"New Entry"** button. Clicking it opens a modal to add a note; rows can be edited/deleted (pencil/trash icons). Newest-first sort. Empty state ("No updates yet.").

**Data model:** One hidden memo field holds the whole list as JSON:
```json
{ "schemaVersion": 1, "entries": [
  { "id": "...", "notes": "...", "author": "Full Name", "authorId": "1000201___N", "timestamp": "ISO-8601 UTC" }
] }
```
Each entry auto-captures **author + authorId + timestamp** at create time (author identity comes from the server's `currentUser`, durable even if the staff record changes). Extend the entry shape per use case (e.g. one variant added a `category` field from a SingleSelect of active categories).

**How it's built:** exactly the server-thin/client-fat split in [merge report memo json](merge-report-memo-json.md). Client builds DOM with a tiny `el()` hyperscript helper, single `mutate(fn)` mutation cycle (mutate state → `syncToField()` → `render()`), modal shared by Add + Edit mounted on `document.body`.

**Permissions** are commonly layered on via [staff query permission gating](staff-query-permission-gating.md) (Reader/Author/Editor capability flags from the server gate the table / New Entry button / edit-delete actions).

**Variants:** a notes-only, permission-gated variant (memo field holds an array of update notes); and one that adds a SingleSelect category + record lock.
