---
description: Correct method names on B.net.httpRequester for non-GET calls — uses overloaded getter/setter style (.method(), .responseCode()), not Java-bean style (.setMethod, .getResponseCode)
---
`B.net.httpRequester(url)` returns an object whose mutators and accessors share the same name (overloaded). The Java-bean-style `setX`/`getX` names do **NOT** exist and are a TypeScript error.

```typescript
// Correct
const req = B.net.httpRequester(url);
req.method('POST');                         // setter (string arg)
req.setHeader('Authorization', API_KEY);    // setHeader IS the right name (no overload)
req.setHeader('Accept', 'application/json');
req.doRequest();
const status = req.responseCode();          // getter (no args) — returns number | null
const body = req.getContent('UTF-8');       // getContent IS the right name
```

```typescript
// Wrong — these do NOT exist
req.setMethod('POST');
req.getResponseCode();
```

**Methods that follow the bean naming**: `setHeader`, `getContent`, `doRequest`. **Methods that use the overloaded style**: `method`, `responseCode`. The split is inconsistent — when in doubt, look at `B.d.ts` declarations.

## Reading POST body in an endpoint

```typescript
const bodyText = B.net.request.content() || '';   // returns string
const body = JSON.parse(bodyText);
```

`request.content()` is the canonical accessor — confirmed in declarations, used by the existing Sprint Maestro endpoint.

**How to apply:**
- For DELETE / POST / PUT calls (e.g., ClickUp tag reconciliation, REST writes), use `req.method('POST')` not `req.setMethod('POST')`.
- For checking response status to handle 404-as-success (idempotent deletes), use `req.responseCode()` not `req.getResponseCode()`.
- If a TypeScript error says `Property 'setMethod' does not exist`, this memory is why.
