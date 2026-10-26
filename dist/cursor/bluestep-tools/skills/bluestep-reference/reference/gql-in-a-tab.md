---
description: "Running a GraphQL query or mutation on an org: use the gateway's graphql_query / graphql_mutation when the org serves them (probe with describe_tool), otherwise POST to /gql from a browser tab signed in to that org — CSRF token from a HEAD, errors before status, start from an app page; with no browser tool, hand the step to the user"
---

# GraphQL on an org: gateway tool or a signed-in tab

Claude picks the route; the user never has to. The only thing the user may be asked to do is sign
in to the org in the browser.

## Pick the route, once per org per session

1. Call `describe_tool(org, "graphql_query")` on the gateway (`graphql_mutation` for a write).
2. **The org serves it** → run the query through `invoke_org_tool` as usual.
3. **`TOOL_NOT_FOUND`** → the org does not offer GraphQL to MCP clients. Use a tab (below).
4. **No browser tool in this session** (no tool that can open a page and run JavaScript in it) →
   there is no route. Say which step could not run and why, and hand it to the user. A read-back
   or check that could not run is reported as **not done**, never as passed.

Probe again in a later session: an org can stop serving the tools between two sessions.

`get_schema` and `get_full_schema` stay on the gateway on every org, so look up types, fields and
arguments there before writing the query, whichever route runs it.

## The call from a tab

Open the org's site in the browser tool and stay on an app page. Do not sit on `/gql` itself: it
is an error page, and a `fetch` from it fails. Run:

```js
const query = `{ user { id super } }`;
const variables = {};
const head = await fetch("/gql", { method: "HEAD", credentials: "same-origin" });
const res = await fetch("/gql", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json", "B6P-CSRF-TOKEN": head.headers.get("B6P-CSRF-TOKEN") },
  body: JSON.stringify({ query, variables }),
});
const body = await res.json();
JSON.stringify(body.errors ?? body.data);
```

- **Check who is signed in first** with the `{ user { id super } }` query above. `user: null`
  means no session: ask the user to sign in to that site in the browser, then run it again. The
  tab runs with the signed-in user's rights, not the gateway token's, so a read sees only what that
  user can see.
- **Read `errors` before the status.** A 403 with no `errors` array is a missing or stale CSRF
  token: do the `HEAD` again and send once more. Every answer carries a fresh token in the same
  header.
- **Return only what the task needs.** Browser tools cut long results, so map the answer to the
  ids and fields you need inside the script before returning it.

## Writes

A mutation through a tab is still a platform write: it gets the same approval echo as an
`invoke_org_tool` call (`conventions/mcp-platform-authoring.md`, step 5). Show the exact mutation
and the org, wait for a yes, then run it. Write the mutation out in full in the script; never
build it from pieces at run time, so what the user approved is what runs.
