---
description: "Running a GraphQL query or mutation on an org: use the gateway's graphql_query / graphql_mutation when the org serves them (probe with describe_tool), otherwise POST to /gql from a browser tab signed in to that org — Claude opens the sign-in page, CSRF token from a HEAD, errors before status, re-check who is signed in; with no route, tell the user in plain words what was not done"
---

# GraphQL on an org: gateway tool or a signed-in tab

Claude picks the route; the user never has to, and never hears about it. Do not tell the user which
tool an org serves, why a route is missing, or how `/gql` works. The only thing the user may be
asked to do is sign in, on a page Claude opened for them.

## Pick the route, once per org per session

1. Call `describe_tool(org, "graphql_query")` on the gateway (`graphql_mutation` for a write).
2. **The org serves it** → run the query through `invoke_org_tool` as usual.
3. **`TOOL_NOT_FOUND`** → use a tab (below). The same goes for a `TOOL_NOT_FOUND` from the call
   itself, even after a probe that found the tool.
4. **No route** → no browser tool in this session (no tool that can open a page and run JavaScript
   in it), or the user did not sign in. See *When nothing can run it*.

Probe again in a later session: an org can stop serving the tools between two sessions.

`get_schema` and `get_full_schema` stay on the gateway on every org, so look up types, fields and
arguments there before writing the query, whichever route runs it.

## The call from a tab

Open the org's site in the browser tool: `https://<defaultHost>`, with the `defaultHost` that
`available_tenants` returns for the org. In the Claude desktop app use its own browser pane, not
Chrome. Stay on an app page. Do not sit on `/gql` itself: it is an error page, and a `fetch` from
it fails. Run:

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

- **Check who is signed in first** with the `{ user { id super } }` query above, and note the id.
  `user: null` means no session: the page you opened is the sign-in page, so ask in one line, naming
  the org by its display name and nothing more technical: "Please sign in to <org name> on the page
  I opened in the browser." Then run the check again.
- **Check again before every write, and after the user signs in again.** A *Temporary Login*
  switches every tab of that site to another user. If the id changed, stop and tell the user who
  the tab is now signed in as; go on only once it is back to the user who started.
- **An empty answer is not proof.** The tab runs with the signed-in user's rights, not the gateway
  token's, so a read sees only what that user can see. When the user is not `super` and an answer
  is empty or `null` where you expected something, report the check as **not done** ("I couldn't
  see the query's categories, so I couldn't check them"), never as passed and never as "the
  platform dropped it".
- **Read `errors` before the status.** A 403 with no `errors` array is a missing or stale CSRF
  token: do the `HEAD` again and send once more. Every answer carries a fresh token in the same
  header.
- **Return only what the task needs.** Browser tools cut long results, so map the answer to the
  ids and fields you need inside the script before returning it.

## Writes

A mutation through a tab is still a platform write, and it needs the user's yes first, as an
`invoke_org_tool` call does (`conventions/mcp-platform-authoring.md`, step 5). Say it in one plain
sentence: what changes, on which org by its display name, and why ("I'll add the two missing
categories to the staff lookup query on <org name>, so it stops matching everyone."). Show the
mutation itself when the user asks for it. Start the script with the same sentence as a comment: on
Claude Code the plugin's `tab-guard` hook stops any script that holds a mutation and asks again,
showing the script, so the comment is what the user reads there.

Write the mutation out in full in the script; never build it from pieces at run time, so what the
user approved is what runs.

## When nothing can run it

Tell the user what was not done and what it means for their work, in plain words. Never ask them to
run a query, and never explain the cause in platform or tool terms.

- **A check or read-back** → report it as **not done**, never as passed: "I couldn't confirm the
  query's categories were saved, so I can't say yet that it only matches the right people." When
  you know where the platform UI shows the same thing, say where to look; do not guess a path.
- **A write** → say what still has to change and where to make it in the platform UI. The task
  stays open.
- **No browser tool** → add one line on how to let Claude do it next time, in the words of the tool
  the user is in (for example, the browser pane of the Claude desktop app).
