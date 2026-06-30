---
description: "/b/ endpoints write their body via B.net.response.out(string), NOT B.out — B.out is the merge-report channel and yields a blank 'Error' page on an endpoint"
---

A BlueStep **`/b/<alias>` endpoint** must write its response body with **`B.net.response.out(stringBody)`** — a method on the Response object. Assigning **`B.out = ...`** does NOT work for an endpoint: `B.out` is the **merge-report** output channel, and using it on a `/b/` endpoint produces BlueStep's generic blank **"Error"** page (the script runs fine, but no endpoint output is ever emitted, so the framework reports failure). The same script type compiles either way — this is a runtime/routing distinction, not a type error.

**Endpoint output pattern (confirmed working on `/b/<alias>` endpoints):**
```js
function writeJson(res, status, body) {
  try { res.status(status); } catch (_e) {}            // may throw if already committed
  try { res.contentType("application/json; charset=UTF-8"); } catch (_e) {}
  res.out(JSON.stringify(body));                        // <-- the body channel
}
// entry:
const res = B.net.response;
const method = String(B.net.request.method() || "GET").toUpperCase();  // method() is a function — see endpoint method call
// ...dispatch on B.net.request.optParameter('x').orElse('')...
writeJson(res, 200, envelope);
```

Wrap `status()`/`contentType()` in try/catch (they throw `IllegalStateException` once the response is committed). `res.out()` takes the full string body. Read request via `B.net.request` (`.method()`, `.optParameter(name).orElse(...)`, `.parameter(name)`). Endpoints route GET/POST/PUT but not DELETE ([endpoint no delete method](endpoint-no-delete-method.md)); the friendly `/b/<alias>` is configured per-endpoint, not derivable from the script name ([endpoint urls](endpoint-urls.md)).

Contrast: a **merge report** renders via `B.out = htmlString`. So: merge report → `B.out`; `/b/` endpoint → `B.net.response.out(...)`.
