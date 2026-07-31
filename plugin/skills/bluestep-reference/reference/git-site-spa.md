---
description: "Git sites serve a GitHub repo directly under /spa/ on the site's own domain — a separate SPA hosting model from the MergeReport static/ + deploy-lib path; five UI-only config fields, save-is-the-redeploy, and same-origin data/asset rules"
---

# Git-site SPA hosting (repo → `/spa/`)

> **Two SPA hosting models — don't conflate them.** This file covers a **Git site**: a site record
> that serves a GitHub repo directly under `/spa/` on the site's own domain — no MergeReport, no
> deploy-lib, no platform compile. For the other model (a Vite bundle deployed into a MergeReport's
> `static/` via deploy-lib), see [vite spa merge report](vite-spa-merge-report.md) and
> [deploy-lib workflow](../conventions/deploy-lib-workflow.md).

## What it is

A **Git Site** (Admin → Sites → New Git Site) points at a GitHub repo; the platform serves the
repo's files as-is under `/spa/` on the site's bound domain. **The repo IS the deploy artifact** —
there is no server-side build step, so pre-built output must be committed (a dedicated deploy
branch, or built files at the repo root). `github.com` URLs only (validated at save *and* deploy
time); a **private** repo needs a fine-grained GitHub token with read-only *Contents* on that repo.
As a full site object, domain binding, IP filters, and permissions apply as for any other site.

## The five git-deployment fields (UI-only)

| Field | Notes |
| --- | --- |
| **Repository URL** | `https://github.com/<owner>/<repo>` only — other hosts are rejected |
| **Git Ref** | branch / tag / full SHA; default `main`; resolved to a concrete SHA at deploy |
| **Index Path** | entry file, default `index.html`; the deploy is **rejected** if the repo lacks it |
| **GitHub token** | private repos only; **write-only** — never echoed back, blank-on-save keeps the stored value |
| **Webhook Secret** | optional; without it the `/spa/webhook` endpoint 404s (no auto-deploy) |

These fields are **not exposed on the `site` MCP tool** — deliberately, since two of them are
secrets — so creating/configuring a git site is a **platform-UI hand-back step**, not an MCP op.
The site's edit form shows live deploy state: `PENDING` / `DEPLOYED` / `FAILED` `@ <short-sha>`,
plus the last deploy error.

## Save is the redeploy

- **Saving the site record triggers the deploy** (async). There is no deploy button. A git push
  **alone leaves `/spa/` stale** unless the webhook is configured. Manual redeploy: re-save, or the
  site's **Pull** button.
- **Webhook auto-deploy:** a GitHub push webhook to `https://<site-domain>/spa/webhook`
  (content type JSON, push events, secret = the Webhook Secret field). Only a push **to the
  configured ref** deploys — pushes to any other branch are accepted and ignored, which reads as
  "my push didn't deploy" when CI publishes to a different branch than Git Ref points at.
- **No rollback UI** — set Git Ref to the previous SHA/tag and re-save. Corollary: never
  force-push the deploy branch; its history is your rollback path.
- **Allow ~5 minutes:** assets are served with `Cache-Control: public, max-age=300`, so a fresh
  deploy can take up to that long to show in a browser that has the old bundle cached.
- Size caps: repo zipball ≤ 64 MiB, unpacked ≤ 256 MiB — a deploy past either cap fails.

## Serving behavior

- **Deep links work:** extension-less paths under `/spa/` fall back to the index file (client-side
  routing is fine). Paths that *look* like assets (have a file extension) 404 when missing instead
  of falling back.
- **Build with a relative base** (Vite `base: './'`) — verified end-to-end. The hard constraint is
  that root-absolute asset URLs (`/assets/app.js`) 404, because the app lives under `/spa/`, not
  the domain root.

## Connecting to data (the part most often gotten wrong)

A git site is static — it cannot reach the DB. Pair it with a `/b/<alias>` endpoint **on the same
domain**; `/b/` resolves on the site's own domain, so an absolute-path fetch is same-origin:

```js
fetch("/b/myApi?action=list"); // absolute path — same-origin: no CORS, no token plumbing
fetch("./b/myApi");            // relative from /spa/ → resolves to /spa/b/myApi → 404
```

**Inverse embedding variant** (loading a git-site bundle **into** a page on another origin, e.g. a
merge report on an org domain): ES-module loads (`<script type="module">`, dynamic `import()`) are
fetched in CORS mode, and the git site sends no `Access-Control-Allow-Origin` header — the browser
blocks them (a platform CORS header was requested and declined). Verified fix: a thin **same-origin
`/b/` proxy endpoint** that `B.net.fetch`-streams the bundle through the consuming origin; with a
relative Vite base, hashed chunks and CSS resolve back through the proxy automatically via
`import.meta.url`. One trap inside the proxy: the git site serves gzip, and `B.net.fetch` yields
**decoded** bytes — serve them plain, do not forward the upstream `Content-Encoding` header.
