---
description: "B.net.request.cookies() filters HttpOnly cookies; use optHeader(\"Cookie\") to grab JSESSIONID for authenticated loopback calls"
---

To make an authenticated server-to-server HTTP call from one BlueStep endpoint to another on the same org (e.g., `/b/foo` calling `/b/bar`), forward the inbound request's **raw Cookie header**, not the parsed cookies map.

```ts
// WRONG — parsed cookies omits JSESSIONID (HttpOnly is filtered out)
const cookies = B.net.request.cookies();
const header = Object.keys(cookies).map(k => `${k}=${cookies[k]}`).join("; ");

// RIGHT — raw header includes JSESSIONID
let header = "";
const opt = B.net.request.optHeader("Cookie");
if (opt.isPresent()) header = opt.get();

const req = B.net.httpRequester(url);
req.method("GET");
req.setHeader("Cookie", header);
req.doRequest();
```

**Why:** `B.net.request.cookies()` defensively filters HttpOnly cookies (verified empirically). JSESSIONID is HttpOnly, so it's invisible to the parsed map but present in the raw `Cookie:` header.

**Symptom if you get this wrong:** `httpRequester.doRequest()` returns false and `req.error()` reports `"Cannot invoke java.io.InputStream.read(byte[], int, int) because this.in is null"` — the loopback hits BlueStep's auth gate, gets a 401/redirect, and the HTTP client's response stream collapses.

**Diagnostic shortcut:** dump `B.net.request.optHeader("Cookie")` and iterate `B.net.request.headerNames()` to see what's actually in the inbound request. Sets the baseline before chasing a phantom auth design.

**Endpoint perms:** the target endpoint should have "Request HTTP authentication (Use only for robots)" selected for the unauthenticated-fallback behavior, so unauthenticated callers get a clean 401 rather than a 302 login redirect (which breaks JSON responses).

**Caveat — session re-entrancy:** Tomcat by default serializes per-session HTTP access. The inbound request holds the user's session; the loopback enters with the same session. If it hangs ~30s and times out, this is the cause — won't show up as auth failure. Fix is to either redesign without loopback or set `<Manager pathname=""/>` / equivalent session-concurrency config (not Claude-accessible — BlueStep platform config).
