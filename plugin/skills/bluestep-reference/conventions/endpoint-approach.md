---
description: "Research-first approach for BlueStep endpoints — gather API docs, read type declarations, study existing examples before writing"
---

For any new BlueStep endpoint or integration, front-load research before writing code: read the external API docs, study the `B.d.ts` declarations for HTTP/request/response patterns, and look at existing endpoint examples in the org. Write with full context.

**Why:** This avoids trial-and-error iteration on BlueStep's GraalJS environment, where testing requires pushing to the server. The research-first pass has produced correct code on the first try.

**How to apply:** Gather API docs + type declarations + existing examples up front. When delegating to a `bluestep-dev` agent, pass comprehensive context including exact method signatures and patterns.
