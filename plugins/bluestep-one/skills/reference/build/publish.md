# Build and publish a custom component

Load before building or publishing, and when a build fails.

A push to `draft` serves nobody. A commit is served only once it is **built** and **published**;
publishing fast-forwards the protected `master` to the built commit, and that is what the tenant
serves.

## From a signed-in tab (no Build tab needed)

Since release 26.10.21.02 the gateway has no GraphQL tools and no build or publish tool. So the
calls are POSTs to `/gql` from a tab of the desktop app's built-in browser pane, signed in to the
BlueStep One host that serves the component (`one.host`), as a user with edit on the component.
Get the `B6P-CSRF-TOKEN` header with `HEAD /gql` first; the call itself is in the bluestep-tools
reference (`/bluestep-tools:bluestep-reference` › `reference/gql-in-a-tab.md` › *The call from a
tab*). Check who is signed in first (a
*Temporary Login* left on makes a staff user publish, and fail). Each call is one lone field, on an
id in the project's `components[]`, written out in the script:

- `mutation { buildCustomComponent(id: "<id>") { <plain fields> } }`. It queues a build of `draft`,
  pinned to its commit, idempotent per commit. Its `sha` must be the pushed one.
- `{ customComponentBuild(id: "<id>", sha: "<sha>") { state diagnostics { severity message file
  line } log } }` reads its state (`QUEUED`, `SUCCEEDED`, `FAILED`). Poll it, a few seconds apart.
- `mutation { publishCustomComponent(id: "<id>") { <plain fields> } }`. It publishes the draft once
  a `SUCCEEDED` build of exactly that commit exists. Publish never builds.

Nothing else may share the mutation: no second field, no fragments with arguments, no aliases with
arguments. Write the id out in the text, one component per call, never from a loop: the tab guard
reads the script, and an id it cannot read makes it ask the user.
`hooks/tab-guard.mjs` lets exactly this through to the normal prompt and puts any other mutation to
the user. When there is no signed-in tab, or the browser tool or the permission check refuses the
POST, do not look for another way to send it: ask the user to press *Rebuild draft*, then
*Publish*, in the component's *Build* tab, and read `customComponentBuild` from a tab or wait for
their word.

**On an org not yet on 26.10.21.02**, the gateway's `graphql_mutation` and `graphql_query` still
take the same calls, on a `components[]` id only. That path goes away when the org moves; the tab
works on both.

## When

- Tasks that change only rules or data stop at the type check and tests.
- **A screen gets one publish** when its tasks are all in, one live check of every artboard it
  draws, then one fix-up publish. A fix a reviewer is waiting on is published alone, at once.
- Every publish request names the commit (`draft@<sha>`).
- **Publish only a sha that built green**, and only when it differs from the served one: read
  `publishedSha` first (`remoteObjects(ids: ["<id>"]) { ... on CustomComponent { publishedSha } }`,
  from the same tab).
- Publishing stays the user's choice for each push, unless the project's `AGENTS.md` says
  otherwise. A publish reaches every user of the tenant, and every publish breaks tabs left open.

## Known failures

- **`QUEUED` for minutes, then `FAILED` with "source fetch answered 404"** (twice in its `log`).
  Build the same commit again: the second try has succeeded within seconds every time seen. Two
  failures in a row: try a third time, then stop and report.
- **A push the Build tab does not show.** The tab cannot tell whether a push is waiting; read
  `customComponentBuild` for the pushed sha instead.
- **"Tool not found" from the gateway's `graphql_mutation` or `graphql_query`.** The org already
  runs a release without those tools. Use the tab.
