---
description: "BlueStep endpoints don't route the DELETE (or likely other non-GET/POST/PUT) HTTP method — use a PUT/POST action discriminator instead"
---

BlueStep `/b/<alias>` endpoints do **not** dispatch the `DELETE` HTTP method to the script. A `fetch(url, {method:'DELETE'})` never reaches the handler — the platform returns a non-JSON error page, so client-side `r.json()` throws and you see a generic "Network error" (NOT your handler's JSON error). Symptom: delete fails with "Network error — please try again" while POST/PUT/GET actions on the same endpoint work fine.

Fix: route mutations through `PUT` (or `POST`) with an `action` discriminator in the JSON body — e.g. `{action:'delete', entryId}` handled by `else if (action === 'delete')` in the `method === 'PUT'` branch. This is the same proven path as other action discriminators (e.g. complete/reassign) on a single endpoint. Confirmed GET/POST/PUT route; DELETE does not. (Likely PATCH/OPTIONS/etc. also don't — stick to GET/POST/PUT.)

Relates to [endpoint method call](endpoint-method-call.md) (request.method() must be called with parens).
