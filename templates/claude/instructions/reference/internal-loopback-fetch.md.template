---
description: "Endpoint-to-endpoint loopback within an org must use B.net.fetch on a relative path + credentials:true, NOT the external httpRequester"
---

For a BlueStep endpoint to call another endpoint in the SAME org (e.g. `/b/caller` → `/b/target`), use `B.net.fetch(relativePath, {...})` — NOT `B.net.httpRequester(absoluteUrl)`.

`httpRequester` dials the server's own public hostname over the network; the server can't hairpin back to itself (NAT/firewall), so `doRequest()` never connects: `responseCode()` returns null and `getContent()` throws `Cannot invoke "java.io.InputStream.read(...)" because "this.in" is null`.

`B.net.fetch` on a RELATIVE path (`"/b/target"`) routes through BlueStep's internal dispatcher — no public round-trip — and `credentials: true` carries the caller's session so a login-required target doesn't 403. Read the result via `res.code()` (FetchedResource HTTP status) and `B.io.fromInputStream(res, "UTF-8")` for the body.

```js
const res = B.net.fetch("/b/target", {
  method: "POST", credentials: true, followRedirects: false, enableErrorStream: true,
  connectionTimeout: 10000, readTimeout: 15000,
  headers: { "Content-Type": "application/json", "Accept": "application/json" },
  body: JSON.stringify({ action: "check" })
});
const code = res.code();                          // HTTP status
const text = B.io.fromInputStream(res, "UTF-8");  // body
```

`followRedirects:false` makes an auth bounce show as a non-2xx code instead of a login-page 200; `enableErrorStream:true` lets you still read the body on a non-2xx. FetchParams uses `connectionTimeout`/`readTimeout` (note the names). Confirmed working on a loopback where one endpoint calls a second endpoint's `check` gate and `log` write — both succeed and the caller's session is preserved.

Complements [session cookie forwarding](session-cookie-forwarding.md) (the cookie-via-raw-header trick was for httpRequester loopbacks; prefer B.net.fetch + credentials instead). Related: [endpoint output channel](endpoint-output-channel.md), [http requester](http-requester.md) (httpRequester is still correct for EXTERNAL calls like api.openai.com).
