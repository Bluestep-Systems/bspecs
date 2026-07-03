---
description: "Off-platform Vite/Preact SPA merge report — build a full single-page app with Node + npm off-platform, deploy the minified dist/ into the report's static/ folder via deploy-lib (the platform compiler is bypassed). Covers when to use this vs the platform-compiled static/script.ts path, the architecture (SPA in static/, report serves index.html, app.ts is a no-op or a B.out window-bootstrap), the two data models (endpoint fetch carrying the session vs. server bootstrap needing an objects/imports.ts round-trip), history in GitHub via package.json repository, and Preact-default/React-alternative."
---

A BlueStep merge report can ship its `static/` bundle two different ways. This file describes the
**off-platform Vite/Preact SPA** model: you build a full single-page app off-platform (Node 20 + npm, any
package), producing a minified `dist/`, and deploy that `dist/` into the report's `static/` folder with
**deploy-lib**. The platform compiler is bypassed entirely. See
[`docs/decisions/off-platform-bundler-build-model.md`](../../../../docs/decisions/off-platform-bundler-build-model.md)
for the "why two models" rationale.

## When to use this vs. the platform-compiled path

- **Off-platform Vite/Preact bundle (this file)** — the report is a real SPA that needs npm packages
  (Preact, a charting library, etc.), hot-reload local dev, or source history in git. Build/deploy/history
  all live off-platform.
- **Platform-compiled `static/script.ts` (the existing docs)** — a simple report with hand-written client
  JS and no npm dependency. BlueStep compiles root `static/script.ts` → `.build/script.js` on the platform;
  nothing to install, no off-platform toolchain. See
  [merge report static index](merge-report-static-index.md) and
  [single script](../conventions/single-script.md).

The two are distinct architectures with different toolchains and failure modes — pick one, don't mix.
`single-script.md`'s rule (only root `static/script.ts` compiles) does **not** apply to a Vite bundle,
because Vite does the bundling off-platform and the platform compiler never runs.

## Architecture

- **The SPA lives in `static/`.** You develop it as an ordinary Vite project; the built `dist/` (a
  minified `index.html` + content-hashed `assets/`) is deployed into the report's `static/` folder via
  deploy-lib (see [deploy-lib workflow](../conventions/deploy-lib-workflow.md)).
- **The report serves `static/index.html` as the page body.** `scripts/app.ts` does **not** render the
  SPA — it is either:
  - a **no-op** (`const a = 1;` then `B.out = "";`), or
  - a **`B.out` window-bootstrap** `<script>` that assigns `window[...]` globals the SPA reads on load
    (e.g. the current record id) — see [Data models](#data-models) below.
- **`<head>` is stripped, but the body survives.** The report containerizes the served `index.html` down
  to body content — the `<script type="module">`, the `<link rel="stylesheet">`, and the mount `<div>` are
  all preserved (the CSS `<link>` does apply on-platform). This fits the server/client split in
  [file execution](file-execution.md): `app.ts` is the server side, `static/index.html` is the client side.
- **The mount id in `index.html` must match `main.tsx`.** The `preact-ts` template mounts to `#app` and
  its `index.html` has `<div id="app">` — keep them in sync. A different app may pick a different id (as
  long as both sides agree). The failure modes (mount-id mismatch, `base: './'`, etc.) are in
  [vite merge report gotchas](../gotchas/vite-merge-report-gotchas.md).

## Data models

Two ways to get server data to the SPA:

1. **Endpoint fetch (mock / self-contained).** The SPA fetches a companion endpoint at `/b/<alias>`. The
   fetch carries the logged-in session automatically — you are already authenticated while viewing the
   report — so no token plumbing is needed. `app.ts` stays a no-op. This is the simplest model and needs
   no platform form-import round-trip.

2. **Server bootstrap.** `app.ts` sets `B.out` to a `<script>` that assigns `window[...]` globals which
   the SPA reads on load — typically the current record id, so the app knows which record it is on before
   fetching more:

   ```typescript
   // scripts/app.ts (server bootstrap)
   B.out = `<script>
     window["recordId"] = "${someRecord.id()}";
   </script>`;
   ```

   This requires an `objects/imports.ts` form-import round-trip on the platform so the referenced
   form/field (e.g. `someRecord.id()`) resolves — the imports are configured on the platform, then pulled
   into `declarations/index.d.ts`. Use this when the SPA needs server context available synchronously on
   first paint. It can still fetch its `/b/<alias>` endpoint for everything else.

Both models are commonly combined: bootstrap the record id via `B.out`, then fetch the rest from the
endpoint. For a related-but-different build model (a `B.out` JSON island + endpoint on a
**platform-compiled** bundle, not an off-platform one), see [crm dashboard inspo](crm-dashboard-inspo.md).

## History in GitHub

deploy-lib does not preserve BlueStep's per-snapshot history — the **source of truth is git, not BlueStep
snapshots**. Link the report back to its source via the `package.json` `repository` field so anyone who
sees the deployed bundle can find where the code is maintained:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/<repo>.git"
  }
}
```

## Framework: Preact default, React alternative

**Preact is the default** for this pattern (it matches the reference apps and the `/bluestep-vite-report`
scaffold, which uses the `preact-ts` template). **React is a valid alternative** — the architecture is
identical (SPA in `static/`, `base: './'`, deploy via deploy-lib, same two data models); only the
framework and the `create-vite` template differ. Nothing in the off-platform model is Preact-specific.

## See also

- [deploy-lib workflow](../conventions/deploy-lib-workflow.md) — how to install deploy-lib, the
  `package.json` `config` keys, and running `npm run deploy -- --build --clean`.
- [vite merge report gotchas](../gotchas/vite-merge-report-gotchas.md) — the sharp edges (`base: './'`,
  `<head>` stripping, mount-id match, Node 20+, deploy-lib config-key casing, `Swal`/site-CSS absent in
  local dev).
- [merge report static index](merge-report-static-index.md) and
  [single script](../conventions/single-script.md) — the platform-compiled `static/script.ts` path.
