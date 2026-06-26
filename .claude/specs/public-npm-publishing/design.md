# Design — Public npm publishing (remove the PAT requirement)

**Status:** Drafting

## Overview

Move `@bluestep-systems/bspecs` from GitHub Packages (restricted) to the **public npm registry**, drop the
stray `b6p-cli` runtime dependency, and automate releases with a tag-triggered `publish.yml` + a PR/push
`ci.yml` — both modeled on the proven workflows already live in the `b6p-cli` repo. The dependency that
made this hard (`@bluestep-systems/b6p-cli`) is already public, so there is no sequencing risk.

This is a **packaging + CI + docs** change. No scaffolder *logic* (`cli.js`, `src/*`) changes — the only
source-adjacent edits are `package.json`, `.npmrc`, the scaffolded `.npmrc.template`, and docs.

### Open questions — resolved for this design

1. **`.npmrc` strategy** — *repo-local* `.npmrc`: **keep**, pinned to `https://registry.npmjs.org`
   (defensive override against a stale GitHub-Packages mapping in `~/.npmrc`; matches what
   `b6p-cli`/`b6p-core`/`b6p-vscode` committed). *Scaffolded* `.npmrc.template`: **delete** — generated
   projects need no scope config once `@bluestep-systems/*` is public, and fewer files is cleaner.
2. **Existing `~/.npmrc`** — add a one-line migration note to the README (remove the old GitHub-Packages
   scope line); the committed repo-local `.npmrc` neutralizes it for the bspecs repo and fresh scaffolds.
3. **CI depth** — smoke run only (`node cli.js -v`, `node cli.js -h`, `node test-scaffold.mjs`). No
   `tsc`/eslint — bspecs is plain ESM JS. Expand when a real test suite lands (TS conversion is separate).

## Files / areas affected

### Packaging (bspecs repo root)

- `package.json`:
  - `publishConfig` → `{ "access": "public" }` (drop `registry: npm.pkg.github.com` so it defaults to
    `registry.npmjs.org`; drop `access: "restricted"`).
  - **Remove** `dependencies["@bluestep-systems/b6p-cli"]` entirely (unused by bspecs source — see
    requirements). `@clack/prompts` stays.
  - Bump `version` (0.9.0 → next; the registry switch + publish automation is a minor bump).
- `package-lock.json` — regenerate (`npm install`) so the `b6p-cli` tree and its `npm.pkg.github.com`
  `resolved` URLs are gone.
- `.npmrc` (repo-local) — replace the GitHub-Packages mapping + `${GITHUB_TOKEN}` + `always-auth=true`
  with a single line: `@bluestep-systems:registry=https://registry.npmjs.org`. No token committed (CI
  injects `NODE_AUTH_TOKEN`; local publish uses `npm login`).

### CI / publish workflows (new)

- `.github/workflows/ci.yml` — trigger on `pull_request` + push to default branch; `permissions: contents:
  read`; `concurrency` cancel-in-progress; `actions/setup-node@v4` (matrix `node: ['18','20','22']`,
  `cache: npm`); `npm ci` (with the same retry loop as b6p-cli); then the smoke steps: `node cli.js -v`,
  `node cli.js -h`, `node test-scaffold.mjs`. No secrets. Trimmed copy of
  `b6p-cli/.github/workflows/ci.yml` (drop `check-types`/`lint`/`compile`/`dist` steps).
- `.github/workflows/publish.yml` — trigger on `v[0-9]+.[0-9]+.[0-9]+*` tags; `permissions: { contents:
  read, id-token: write }`; `concurrency` with `cancel-in-progress: false`; `setup-node` with
  `registry-url: https://registry.npmjs.org`; `npm ci`; **tag-vs-package.json version guard** (verbatim
  from b6p-cli); the same smoke steps as ci.yml; then `npm publish --provenance --access public` with
  `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. Near-verbatim copy of `b6p-cli/.github/workflows/publish.yml`
  with the build/smoke steps swapped for bspecs's.

### Scaffolded templates

- `templates/root/.npmrc.template` — **delete**. Generated projects resolve `@bluestep-systems/b6p-cli`
  from public npm with no config.
- `src/scaffold.js` — `copyTemplateTree` walks `templates/root/`, so deleting the template removes it from
  output automatically. **Verify** no code references `.npmrc` by name (the best-effort install in
  `installDependencies` doesn't; its failure-reminder prose mentions `~/.npmrc`/`GITHUB_TOKEN` and must be
  updated — see below).
- `templates/root/package.json.template` — unchanged (already devDependency, `^0.1.0`, public-resolvable).

### Scaffolder user-facing prose (no logic change)

- `src/scaffold.js:installDependencies` fallback message ([scaffold.js:139-154](../../../src/scaffold.js))
  — currently tells the user the install needs a `~/.npmrc` + `GITHUB_TOKEN` PAT. Rewrite: `npm install`
  now resolves `@bluestep-systems/b6p-cli` from public npm with no token; the only likely failure is being
  offline. Keep it best-effort.

### Docs

- `README.md` — rewrite "Installation" (single `npm install -g @bluestep-systems/bspecs`, no PAT),
  "Prerequisites" (drop PAT; **keep** the `b6p` devDependency note), "Publishing" (public npm + tag→release
  workflow, not manual `npm publish`), and "Generated structure" (the `.npmrc` line is gone). Add a short
  **migration note**: users with `@bluestep-systems:registry=https://npm.pkg.github.com` in `~/.npmrc`
  should remove that line. **Guard (per requirements):** keep the one-time `npx b6p auth set` platform-
  credential step clearly separate from the (now-removed) npm PAT — do not imply "zero setup."
- `CLAUDE.md` — update the "Publishing" paragraph (public npm, `access: public`, no PAT) and the
  b6p-invocation paragraph (drop the GitHub-Packages `.npmrc`/PAT references; the scaffolded `.npmrc` is
  gone).
- `docs/decisions/install-friction-and-registry.md` — status *Proposed* → *Accepted*; record Option 2,
  the engineer sign-off, and that `b6p-cli` is already public (answering its open question).
- `docs/decisions/b6p-cli-distribution.md` — note the registry change supersedes the GitHub-Packages
  distribution it described (light touch; it's already historical).
- `TODO.md` — tick [TODO.md:9](../../../TODO.md) (publish workflow) and [TODO.md:10](../../../TODO.md)
  (registry decision); move both to `DONE.md`.
- `CHANGELOG.md` — entry for the registry switch + publish automation + `b6p-cli` dep removal.

### Platform prerequisite (manual — no code)

- Add the `NPM_TOKEN` secret (npm automation token, publish rights to `@bluestep-systems`) to the **bspecs**
  GitHub repo. The org + a suitable token already exist from the b6p-cli/b6p-core work; this only adds the
  secret to this repo.

## Approach

Ordered so the repo is never in a broken-publish state:

1. **Packaging** — flip `publishConfig`, remove the `b6p-cli` dep, rewrite repo-local `.npmrc`, regenerate
   the lockfile. Verify with `npm publish --dry-run` (shows `registry.npmjs.org`, `access: public`, and a
   tarball without `b6p-cli` in the dep tree).
2. **Templates + prose** — delete `.npmrc.template`; rewrite the `installDependencies` fallback message.
   Verify with `node test-scaffold.mjs` against a scratch scaffold (no `.npmrc` emitted; project still
   declares the b6p-cli devDependency).
3. **CI** — add `ci.yml` (no secrets); confirm it's green on a PR.
4. **Publish** — add `publish.yml`; **platform**: add `NPM_TOKEN`. Validate with a `workflow_dispatch`/dry
   run before the first real tag.
5. **Docs** — rewrite README/CLAUDE.md, flip the ADR, tick TODO→DONE, add the CHANGELOG entry.
6. **First public release** — bump version, tag `vX.Y.Z`, let `publish.yml` publish; verify an anonymous
   `npm install -g @bluestep-systems/bspecs` works on a clean machine/container with no `~/.npmrc`.

## Data / control flow

**Install, after the switch:**

```
npm install -g @bluestep-systems/bspecs
   └─ resolves from registry.npmjs.org  (no token, no ~/.npmrc)        ← bspecs only; no b6p-cli pulled
bspecs                       → scaffolds project (copyTemplateTree ×3; no .npmrc emitted)
   └─ installDependencies: npm install in projectDir (best-effort)
        └─ @bluestep-systems/b6p-cli resolves from public npm (no token)
/b6p-pull  → npx b6p …       → node_modules/.bin/b6p  (platform creds from ~/.b6p, set once via auth set)
```

**Release, after the switch:** bump `version` → commit → `git tag vX.Y.Z` → push tag → `publish.yml`
guards tag==version, runs smoke checks, `npm publish --provenance --access public`.

## Edge cases

- **Stale `~/.npmrc` scope mapping** routes `@bluestep-systems/*` to GitHub Packages and 404s on public
  npm. Mitigated by the committed repo-local `.npmrc` (for the bspecs repo) and the README migration note
  (for end users). Scaffolded projects no longer ship an `.npmrc`, so they inherit the user's `~/.npmrc` —
  the migration note is the fix there.
- **First publish to public npm** for the `bspecs` name under the scope — `npm publish --dry-run` and the
  workflow's provenance/`id-token: write` must be correct or publish fails. Verified by dry run + a
  `workflow_dispatch` before the first tag.
- **Lockfile churn** — regenerating drops `b6p-cli`; confirm `@clack/prompts` still resolves and `bspecs`
  runs (`node cli.js -h`).
- **`files` allowlist unchanged** (`cli.js`, `src/`, `templates/`) — the deleted `.npmrc.template` lived
  under `templates/` and simply stops being shipped; nothing else in the publish tarball changes.
- **Version-tag guard mismatch** — forgetting to bump `package.json` before tagging fails the guard early
  (by design) rather than mis-publishing.

## Alignment with existing patterns

- **Mirrors the sibling repos.** `b6p-cli`/`b6p-core`/`b6p-vscode` already committed the public-npm
  `.npmrc`, `publishConfig.access: public`, and the `ci.yml`/`publish.yml` shapes this design copies —
  consistency across the four repos, least surprise.
- **No new scaffolder pattern.** Logic is untouched; `copyTemplateTree` and dynamic `SYNC_TARGETS` handle
  the deleted template with no code change.
- **ADR-driven.** Flips the existing `install-friction-and-registry.md` to Accepted; the onboarding
  follow-up is parked in its own ADR (`b6p-cli-onboarding-in-scaffolds.md`), out of scope here.
- **Doc-sync rule.** README + CLAUDE.md + CHANGELOG + TODO/DONE updated together.

## Risks

No test suite — verify manually:

- **Anonymous install fails** → on a clean container with no `~/.npmrc`, `npm install -g
  @bluestep-systems/bspecs` must succeed and `bspecs -v` must run. The acceptance gate for the whole spec.
- **Publish misconfig** (still pointing at GitHub Packages, or `access` wrong) → `npm publish --dry-run`
  must show `registry.npmjs.org` + `public`; `publish.yml` dry run before the first tag.
- **Scaffold regression** from deleting `.npmrc.template` → `node test-scaffold.mjs` on a scratch scaffold:
  no `.npmrc` emitted, project still declares the b6p-cli devDependency, and a real `npm install` in that
  project pulls b6p-cli from public npm with no token.
- **Removing the `b6p-cli` dep breaks something unseen** → grep already confirms zero imports in
  `cli.js`/`src/*`/`test-scaffold.mjs`; `node cli.js -h` + a full scratch scaffold confirm runtime.
- **`NPM_TOKEN` missing/under-scoped or no `id-token: write`** → publish fails; caught by the pre-tag dry
  run.
