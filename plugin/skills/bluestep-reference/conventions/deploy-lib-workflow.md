---
description: "deploy-lib workflow for an off-platform Vite/Preact SPA merge report — install deploy-lib from git, wire the package.json config block (config.deployUrl is camelCase, config.deploypathsuffix/config.builddir are lowercase), add the deploy script, and run npm run deploy -- --build --clean to upload the built dist/ to the report's draft/static/ and snapshot/static/. Covers the auth resolution order (--token-file → BLUESTEP_TOKEN → .env-local → interactive, Authorization: Bearer) and the Node 20+ requirement. Owns the config-casing issue link (deploy-lib issue #30)."
---

This is the deploy half of the off-platform Vite/Preact SPA merge-report pattern — see
[vite spa merge report](../reference/vite-spa-merge-report.md) for the architecture and when to use it.
**deploy-lib** takes the built `dist/` and uploads it into the report's `static/` folder, so the platform
compiler is never involved.

## Install deploy-lib from git

deploy-lib is not on npm — install it straight from the upstream git repo:

```bash
npm install git+https://github.com/BlueStep-Platform/deploy-lib.git
```

Upstream: [github.com/BlueStep-Platform/deploy-lib](https://github.com/BlueStep-Platform/deploy-lib).

## package.json config block — CRITICAL casing

deploy-lib reads its settings from npm's `config` env vars. There is **one non-obvious trap**:

- **`config.deployUrl` is camelCase.** deploy-lib reads `npm_package_config_deployUrl`, so the key **must**
  be `deployUrl`. The deploy-lib README shows lowercase `config.deployurl`, which **silently fails** — npm
  preserves the key's case, so a lowercase `deployurl` never populates `npm_package_config_deployUrl` and
  the deploy has no target. This is filed upstream:
  [deploy-lib issue #30](https://github.com/BlueStep-Platform/deploy-lib/issues/30).
- **`config.deploypathsuffix` and `config.builddir` are lowercase** — in both the code and the README. Use
  `"deploypathsuffix": "static"` (uploads land under the report's `static/` folder) and `"builddir": "dist"`
  (Vite's default build output).

A correct `package.json` (placeholders — fill in your report's WebDAV folder and your git remote):

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/<repo>.git"
  },
  "config": {
    "deployUrl": "https://<org>.bluestep.net/files/<id>/",
    "deploypathsuffix": "static",
    "builddir": "dist"
  },
  "scripts": {
    "build": "tsc -b && vite build",
    "deploy": "deploy-lib"
  }
}
```

The `deployUrl` is the report's WebDAV folder (its `.../files/<id>/` root). Keep the default `build` script
that the `preact-ts` template ships (`tsc -b && vite build`) — deploy-lib runs it for you when you pass
`--build`.

## Running the deploy

```bash
npm run deploy -- --build --clean
```

- **`--build`** runs the `build` script first, producing a fresh `dist/`.
- **`--clean`** removes remote files that are not in the new build, so stale content-hashed assets from a
  previous deploy don't accumulate under `static/`.

deploy-lib uploads to **both** `draft/static/` and `snapshot/static/` in one run — the draft copy for
working/testing and the snapshot copy for the served report.

## Auth resolution order

deploy-lib resolves its credential in this order and stops at the first one it finds:

1. `--token-file <path>` — read the token from a file.
2. `BLUESTEP_TOKEN` environment variable.
3. `.env-local` — a local dotenv file (git-ignore it).
4. Otherwise, an **interactive prompt**.

Whichever it resolves, deploy-lib sends it as `Authorization: Bearer <token>`. The BlueStep platform token
works as the bearer token. **Never commit a token or echo its value** — put it in a git-ignored `.env-local`
or pass `--token-file` pointing outside the repo.

## Node 20+ required

deploy-lib is ESM and uses Web Crypto, which is not a global until Node 20. On Node 18 the deploy fails with
`crypto is not defined`. Run all `npm`/build/deploy steps under Node 20+ (e.g. via `nvm`). See
[vite merge report gotchas](../gotchas/vite-merge-report-gotchas.md) for this and the other sharp edges.

## See also

- [vite spa merge report](../reference/vite-spa-merge-report.md) — the pattern and architecture this deploy
  workflow serves.
- [vite merge report gotchas](../gotchas/vite-merge-report-gotchas.md) — `base: './'`, `<head>` stripping,
  mount-id match, Node 20+, and the config-key casing recap.
