---
description: Id.toString() returns ClassID___ShortID (full id); shortId() returns just the trailing number. optById needs the full form when round-tripping freshly-created entries.
---

`entry.id().toString()` returns the **full system id** in `ClassID___ShortID` form (e.g. `1000201__21584230_2178970123`). `entry.id().shortId()` returns just the trailing record number (`2178970123`).

Declared at `B.d.ts:14373-14379`: *"Returns the standard System ID. That is ClassID___ShortID."*

`query.optById(s)` accepts the full form reliably. Feeding it just a `shortId()` can produce a malformed reconstructed key with an empty ClassID segment (e.g. `1000201___1153030` — three underscores), and `FinderException: Could not load Model for key: ...` is thrown.

**Why this matters for endpoint round-trips:** when an endpoint creates a new entry and returns its id to the client for a follow-up call (e.g. document upload after student creation), return `id().toString()`, not `id().shortId()`. If the UI also needs the short form for display, return both.

Related: [new entry id](new-entry-id.md) (commit before reading shortId).

**How to apply:** any time an id is going to be passed back to a server for `optById` lookup, use the full id. Reserve `shortId()` for human-readable display only.
