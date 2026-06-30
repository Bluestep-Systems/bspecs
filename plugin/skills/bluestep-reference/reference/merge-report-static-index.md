---
description: BlueStep merge report with a static/ bundle — B.out (server content) and static/index.html (client markup) BOTH render but are completely disjoint (B.out is injected as a tag that runs AFTER index.html), and static/styles.css + .build/script.js load automatically. Put the mount/config/markup/CSS in static/, use B.out only for final server-rendered markup; never fetch/inline your own styles.css and never use a B.out config island as a data channel to the index.html client script.
---

In a BlueStep merge report that ships a `static/` bundle (`static/index.html` +
`static/.build/script.js` + `static/styles.css`), **both entry points render into
the page together** (see [file execution](file-execution.md)):

- `scripts/app.ts` writes **server content** to `B.out` — this **does** render.
- `static/index.html` supplies the **client markup**; its `<link rel="stylesheet"
  href="styles.css">` and `<script src=".build/script.js">` load **automatically**.

But the two are **completely disjoint**: `B.out` is injected as a tag on the page
that runs **after** `static/index.html` has been put on the page. They share no DOM
context you can bridge — a node emitted from `B.out` is **not** something the
index.html client script can reliably reach, and ordering tricks like
`DOMContentLoaded` won't fix it (B.out arrives later, in a separate region).

The platform serves `static/styles.css` (and `static/.build/script.js`) for you
while `B.out` renders the page body. So you do **not** need to read or fetch your
own stylesheet — `B.net.fetch("static/styles.css")` + inlining it into a `<style>`
block in `app.ts` is pointless work. CSS stays in `static/styles.css` per
[separate files](../conventions/separate-files.md).

**Where each piece goes:**
- Root mount (`<div id="…-root">`) and static config islands (`<script id="…-config"
  type="application/json">…</script>`) → put in `static/index.html`, before the
  `<script src=".build/script.js">` tag. (E.g. a `<div id="…-widget"></div>` mount
  lives in index.html, not in `B.out`.)
- CSS → `static/styles.css`. Client JS → `static/script.ts` (→ `.build/script.js`).
- `B.out` (from `app.ts`) → **final server-rendered markup only**: HTML with
  server-computed values baked straight in, e.g. record-scoped section URLs (see
  [merge report urls](merge-report-urls.md)), current-user values, or query results
  rendered as the visible content. Because B.out is disjoint from index.html, do
  **not** emit a mount or a `<script type="application/json">` config island from
  `B.out` and expect the index.html client script to read it — that's the trap below.

**Getting server data to the client widget:** when a client-side widget (booted by
the index.html script) needs server context, don't route it through `B.out` — fetch
it from the component's **endpoint** (server-thin/client-fat), or use **index.html
merge tokens**. Reserve `B.out` for content it renders directly.

Symptom seen in practice: client JS ran but
`document.getElementById('…-root')` and the `#…-config` blob were both null —
because the mount + config island were emitted from `B.out`, a separate region that
is injected *after* index.html and disjoint from the index.html client script. It's
easy to *wrongly* conclude `B.out` wasn't injected — it is. The fix is to put the
mount + config island in `static/index.html` (the client-markup file), and fetch any
dynamic data from the endpoint.

Builds on [merge report memo json](merge-report-memo-json.md) and
[separate files](../conventions/separate-files.md).
