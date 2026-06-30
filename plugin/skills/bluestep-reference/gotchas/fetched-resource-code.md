---
description: "Bluestep.Net.FetchedResource.code() returns 0 on success, not the upstream HTTP status — only code >= 400 reliably indicates failure"
---

`Bluestep.Net.FetchedResource.code()` is documented in `declarations/B.d.ts` as "the response code," but in practice it returns `0` on successful API calls rather than the upstream HTTP status (200, etc.).

- **Rule:** only `code >= 400` reliably indicates failure. Treat anything else (0, 200, 2xx) as "trust the body."
- **Why:** detecting non-2xx with `code < 200 || code >= 300` synthesized a fake QBO `Fault` envelope on a valid 200 response, surfacing a bogus 422 "HandledError" to the caller.
- **How to apply:** branch on `code >= 400` only; for success/validation detection, inspect the parsed body (e.g. QBO returns `{ Fault: ... }` on HTTP 200 for validation errors), not the status code.
