---
description: "Git sites serve a GitHub repo directly under /spa/ on the site's own domain — a separate SPA hosting model from the MergeReport static/ + deploy-lib path; two purposes with different Vite bases (mounted bundle vs standalone routed SPA), config fields, save-is-the-redeploy, same-origin data (the /gql GraphQL surface; /b/ endpoints for the four exceptions), reserved prefixes"
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

## Two mounts: files under `/spa/`, routes at the root

A deployed git site answers on **two mounts, and they are not equivalent**:

- **`/spa/**`** serves any file in the deployed commit. `https://<domain>/spa/assets/app.js`
  returns the file if the commit has it, a 404 if not.
- **The domain root** is a funnel attached to the 404 branch. It adopts a request only when it is
  a GET/HEAD **navigation** whose path has **no file extension**, and answers it with the index
  file. Anything else — an asset path, anything with an extension — stays a clean 404 rather than
  a 200 full of HTML.

So `/records/42` gets the index (an extension-less navigation), while `/assets/app.js` gets a 404
(an asset asked for at the wrong mount). Every base decision below follows from this model.

## Which kind of site are you building?

Pick the purpose first — the right Vite `base` depends on it:

| Purpose | Vite `base` | Why |
| --- | --- | --- |
| **Mounted bundle** — the SPA is loaded *into* another page, possibly on another host | `'./'` | assets must resolve relative to wherever the entry was loaded from — see **Mounted bundle** below |
| **Standalone routed SPA** — the site *is* the app, served at its own domain root | `command === 'build' ? '/spa/' : '/'` | assets must resolve the same no matter how deep the client-side route is — see **Standalone routed SPA** below |

## Mounted bundle: keep `base: './'`

When the bundle is loaded **into another page** — a page on some other domain pulling the entry
script from the git site, directly or through the `/b/` proxy described under "Connecting to data"
— build **host-agnostic**: a relative base (`base: './'`) makes every asset/chunk/CSS URL resolve
relative to wherever the entry was loaded from — the git-site domain today, any other host
tomorrow. Never hardcode a domain or an absolute prefix: the entry's final URL is not yours to
know at build time, and an absolute base would pin every consuming page to one origin. This is a
production pattern — don't "correct" it to an absolute base.

In this purpose the host page owns the URL, so there are no deep path routes on the SPA's side:
the relative base has exactly one depth to resolve from, and it always resolves correctly.

## Standalone routed SPA: conditional base

When the site **is** the app — users land on the domain root and the app owns client-side paths
like `/records/42` — set the base conditionally:

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/spa/' : '/',
}));
```

Build-time `'/spa/'`, dev-time `'/'`. The dev server serves from the root, so a flat
`base: '/spa/'` breaks local dev — always the conditional form.

**Why the build base must be absolute `/spa/`:** a deep route like `/records/42` is answered by
the root funnel with the index file. With `base: '/spa/'` the shell's assets resolve to
`/spa/assets/app.js` — the file mount — no matter how deep the route is. Both alternatives fail:

- `base: '/'` → assets resolve to `/assets/app.js`; the root funnel refuses asset paths, so every
  asset 404s.
- `base: './'` → assets resolve relative to the current route. At `/records/42` the browser
  requests `/records/assets/app.js` — also a 404. A relative base only resolves correctly at one
  route depth.

**The failure is silent:** a wrong base typechecks, builds, and deploys clean, then the site
renders a **blank page** — the index arrives, its assets 404, and nothing reports an error. If a
standalone git site deploys fine and shows nothing, check the base first.

**Deep links:** the root funnel serves the index for extension-less GET/HEAD navigations at any
depth — that is what makes client-side routing work. Extension-less paths *under `/spa/`* may also
fall back to the index, but that half is **unverified** — don't design routing around it; let the
root funnel own it.

**Guard the base in CI.** Nothing else catches this failure class, and the check is a few lines:
read the built `index.html`, assert every asset `src`/`href` is addressed from `/spa/`, and fail
the build if any root-addressed asset appears.

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

## Connecting to data (the part most often gotten wrong)

The bundle is static, but the **platform's data surface is on the same domain**: a
session-authenticated GraphQL API at `/gql` (cookie auth; mutations carry a CSRF token fetched from
`/csrf-token` — both prefixes are in the reserved list below). Ordinary CRUD for an SPA goes
straight to `/gql` — no bespoke data layer, no per-entity server code. A git site serves files and
persists nothing, so there is no "app-managed store" to design behind it.

**Reach for a `/b/` endpoint for exactly four things:** a credential that must not reach the
bundle; an invariant that must hold regardless of client; a domain the schema does not map; an
aggregate too large for a browser to fetch.

Schema behavior observed during a live SPA port (not independently re-verified):

- **`createRecord` requires `parents`** set to the unit's Entities container (plus `entityType` —
  the record type's topId — and `displayName`). Omitting `parents` yields an orphan that reads back
  fine and then fails every form-entry write (`Entity <id> has no unit/org parent`).
- **Read-scope arguments are caller-supplied filters, not guards** — the session's Relate
  permissions are the guard. Consequence for any row-scoped design: make the scoping axis a
  **unit**, not a field the client promises to filter by.
- The schema has **no user mutations** — role and unit assignment stays a platform-UI/MCP job,
  never an app feature.
- Some domains are **unmapped** (alerts and conversations return empty) — messaging has no native
  `/gql` path.

When one of the four endpoint reasons applies, pair the site with a `/b/<alias>` endpoint **on the
same domain**; `/b/` resolves on the site's own domain, so an absolute-path fetch is same-origin:

```js
fetch("/b/myApi?action=list"); // absolute path — same-origin: no CORS, no token plumbing
fetch("./b/myApi");            // relative from /spa/ → resolves to /spa/b/myApi → 404
```

**Inverse embedding via a `/b/` proxy** (a sub-case of the **mounted-bundle** purpose: loading a
git-site bundle **into** a page on another origin, e.g. a merge report on an org domain):
ES-module loads (`<script type="module">`, dynamic `import()`) are fetched in CORS mode, and the
git site sends no `Access-Control-Allow-Origin` header — the browser blocks them (a platform CORS
header was requested and declined). Verified fix: a thin **same-origin `/b/` proxy endpoint** that
`B.net.fetch`-streams the bundle through the consuming origin; with a relative Vite base, hashed
chunks and CSS resolve back through the proxy automatically via `import.meta.url`. One trap inside
the proxy: the git site serves gzip, and `B.net.fetch` yields **decoded** bytes — serve them
plain, do not forward the upstream `Content-Encoding` header.

## Reserved platform prefixes

The platform answers these path prefixes on the site's domain before any request reaches the SPA —
a client-side route defined under one of them never loads:

`/gql`, `/csrf-token`, `/shared`, `/oauth2`, `/b`, `/data`, `/files`, `/downloadFolder`,
`/appinfo`, `/spa`

This is the known-reserved set, not necessarily an exhaustive one. If a route works everywhere
except one prefix, suspect a server-side handler owning that prefix.
