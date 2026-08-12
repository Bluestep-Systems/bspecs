---
description: "Sharp edges of the off-platform Vite/Preact SPA merge report. base: './' is mandatory (Vite defaults to '/', baking site-root /assets/... URLs that 404 on-platform → the app silently doesn't render); the <head> is stripped but the body <script>/<link>/mount-<div> survive; the mount id must match the built index.html; Node 20+ is required (crypto is not defined on 18); deploy-lib's deployUrl config key is camelCase (issue #30); BlueStep site CSS / global Swal are absent in local dev; and the default tsc -b && vite build script does NOT trip the block-tsc hook — don't 'fix' it. Load when debugging a blank/unstyled Vite merge report or a failed deploy."
---

Failure modes of the off-platform Vite/Preact SPA merge report. For the pattern itself see
[vite spa merge report](../reference/vite-spa-merge-report.md); for the deploy mechanics see
[deploy-lib workflow](../conventions/deploy-lib-workflow.md). Each entry is symptom → cause → fix.

## `base: './'` is mandatory (the headline trap)

- **Symptom:** the report renders blank on-platform — "it's not showing up" — while the same build works
  fine in local dev. The browser network tab shows `/assets/index-*.js` and `/assets/index-*.css` 404ing.
- **Cause:** Vite defaults `base` to `/`, so it bakes **site-root** `/assets/...` URLs into the built
  `index.html`. On-platform the bundle lives under the report's `static/` folder, not the site root, so
  those absolute paths resolve to nothing and the module script never loads. The app fails silently.
- **Fix:** set `base: './'` in `vite.config.ts` so asset references are **relative** (`./assets/...`) and
  resolve under the report's `static/`. Verify: the built `dist/index.html` references `./assets/...`, not
  `/assets/...`.

```typescript
// vite.config.ts
export default defineConfig({
  base: "./",
  // ...
});
```

## `<head>` is stripped, but the body survives

- **Symptom:** something you put in `<head>` (a meta tag, a `<title>`, an inline `<style>`) has no effect
  on-platform, even though it worked in local dev.
- **Cause:** the report containerizes the served `index.html` down to **body content only** — everything in
  `<head>` is discarded. What survives is the body: the `<script type="module">`, the
  `<link rel="stylesheet">`, and the mount `<div>`. The CSS `<link>` **does** apply on-platform.
- **Fix:** don't rely on anything in `<head>`. Vite already emits the module `<script>` and the stylesheet
  `<link>` in the body of the built HTML, so the app and its bundled CSS work; anything head-only will not.

## Mount id must match the built `index.html`

- **Symptom:** the report loads (assets 200, no console error) but renders blank.
- **Cause:** `main.tsx` mounts to one id and the built `index.html` has a `<div>` with a different id. The
  `preact-ts` template mounts to `#app` and ships `<div id="app">`; if either side drifts, the app mounts
  into nothing.
- **Fix:** keep the mount id in `main.tsx` and the `<div id="...">` in `index.html` in sync (`#app` for the
  `preact-ts` default). A custom app can pick any id as long as both sides agree.

## Node 20+ (`crypto is not defined` on 18)

- **Symptom:** the deploy (or a `b6p` call in the same project) throws `crypto is not defined`.
- **Cause:** deploy-lib / b6p-cli use Web Crypto, which is not a global until Node 20 (it is absent on
  Node 18). `create-vite` and Vite 7 also expect Node 20+.
- **Fix:** run every build/deploy step under Node 20+ (e.g. via `nvm`). Confirm with `node -v` before
  deploying.

## deploy-lib config-key casing (`deployUrl` is camelCase)

- **Symptom:** the deploy runs but uploads nowhere / has no target, despite a `config.deployurl` in
  `package.json` copied from the README.
- **Cause:** deploy-lib reads `npm_package_config_deployUrl` (**camelCase**); npm preserves key case, so the
  README's lowercase `deployurl` never populates it and **silently fails**. Filed upstream:
  [deploy-lib issue #30](https://github.com/BlueStep-Platform/deploy-lib/issues/30).
- **Fix:** use `config.deployUrl` (camelCase). Full config-block detail — including the lowercase
  `deploypathsuffix` / `builddir` keys — is owned by
  [deploy-lib workflow](../conventions/deploy-lib-workflow.md).

## BlueStep site CSS / `Swal` absent in local dev

- **Symptom:** in local dev the app looks unstyled compared to the deployed report, and any call to `Swal`
  (SweetAlert2) throws `Swal is not defined` or fails to type-check.
- **Cause:** BlueStep's Bootstrap / site CSS and the global `Swal` are provided **by the platform at
  runtime**; they are not present at `localhost`. This is expected — the deployed report picks up the site
  CSS, and `Swal` exists on-platform.
- **Fix:** treat cosmetic CSS differences in dev as expected (verify styling on the deployed report). If the
  app calls `Swal`, declare it so TypeScript accepts the platform-provided global:

```typescript
declare const Swal: any;
```

## Don't "fix" the `build` script

- **Symptom:** the `preact-ts` scaffold's `build: "tsc -b && vite build"` looks like it should trip the
  repo's block-tsc hook, tempting a "fix."
- **Cause:** the block-tsc hook only matches a **literal top-level `tsc`** in a Bash command string.
  `npm run build` is a wrapper, and deploy-lib / npm spawn `tsc` as a **child process** — neither is a
  top-level `tsc`, so the hook never fires.
- **Fix:** leave the `build` script alone. Keep the scaffold default (type-check + build); do not strip the
  `tsc -b`.

## See also

- [vite spa merge report](../reference/vite-spa-merge-report.md) — the pattern, architecture, and when to
  use the off-platform bundle vs. the platform-compiled `static/script.ts` path.
- [deploy-lib workflow](../conventions/deploy-lib-workflow.md) — installing deploy-lib, the `package.json`
  `config` keys (owns the casing detail), and running `npm run deploy -- --build --clean`.
