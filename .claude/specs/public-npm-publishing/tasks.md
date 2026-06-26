# Tasks — Public npm publishing (remove the PAT requirement)

**Status:** Approved

Tasks are tagged **[C]** (code — doable in this repo) or **[PLATFORM]** (manual: npm/GitHub). Ordered so the
repo is never in a broken-publish state. Each is one `/spec-execute` unit.

## Tasks

- [x] **1. [C]** Flip `package.json` to public npm and drop the dead dependency: `publishConfig` →
      `{ "access": "public" }` (remove `registry: npm.pkg.github.com` and `access: "restricted"`); **remove**
      `dependencies["@bluestep-systems/b6p-cli"]`; then regenerate the lockfile (`npm install`) so the
      `b6p-cli` tree and its `npm.pkg.github.com` `resolved` URLs are gone. Verify `npm publish --dry-run`
      shows `registry.npmjs.org` + `access: public` and `node cli.js -h` still runs. — files: `package.json`,
      `package-lock.json`
- [x] **2. [C]** Rewrite the repo-local `.npmrc` to a single line `@bluestep-systems:registry=https://registry.npmjs.org`
      (remove the `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}` and `always-auth=true` lines; no token
      committed). — files: `.npmrc`
- [x] **3. [C]** Delete the scaffolded `templates/root/.npmrc.template` and rewrite the
      `installDependencies` fallback message in `scaffold.js` (it no longer needs a `~/.npmrc` + `GITHUB_TOKEN`
      PAT — `@bluestep-systems/b6p-cli` resolves from public npm; the only likely failure is being offline).
      Keep it best-effort. Confirm no code references the deleted `.npmrc` by name. — files:
      `templates/root/.npmrc.template`, `src/scaffold.js`

  > **✓ Checkpoint — commit after Task 3.** The local registry switch is a coherent, testable unit.
  > Verify `npm publish --dry-run` + `node test-scaffold.mjs` first. Suggested message:
  > `feat: switch bspecs to public npm registry; drop dead b6p-cli dependency`.

- [x] **4. [C]** Add `.github/workflows/ci.yml`: PR + push-to-default trigger, `permissions: contents: read`,
      concurrency cancel-in-progress, `setup-node@v4` matrix `['18','20','22']` with `cache: npm`, `npm ci`
      (retry loop as in b6p-cli), then smoke steps `node cli.js -v`, `node cli.js -h`, `node test-scaffold.mjs`.
      No secrets. Trimmed copy of `b6p-cli/.github/workflows/ci.yml`. — files: `.github/workflows/ci.yml`
- [x] **5. [C]** Add `.github/workflows/publish.yml`: trigger on `v[0-9]+.[0-9]+.[0-9]+*` tags,
      `permissions: { contents: read, id-token: write }`, concurrency `cancel-in-progress: false`,
      `setup-node` with `registry-url: https://registry.npmjs.org`, `npm ci`, **tag-vs-package.json version
      guard** (verbatim from b6p-cli), the same smoke steps as ci.yml, then
      `npm publish --provenance --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. — files:
      `.github/workflows/publish.yml`

  > **✓ Checkpoint — commit after Task 5.** Both workflows added. Safe to commit before the `NPM_TOKEN`
  > secret exists — `publish.yml` only fires on a tag, and `ci.yml` needs no secrets. Suggested message:
  > `ci: add CI and tag-triggered npm publish workflows`.

- [x] **6. [PLATFORM]** Add the `NPM_TOKEN` repo secret (npm automation token with publish rights to
      `@bluestep-systems`) to the **bspecs** GitHub repo. The org + token already exist from the
      b6p-cli/b6p-core work — this only adds the secret here.
- [x] **7. [C]** Rewrite `README.md`: "Installation" → single `npm install -g @bluestep-systems/bspecs`, no
      PAT; "Prerequisites" → drop the PAT, keep the `b6p` devDependency note; "Publishing" → public npm +
      tag→release workflow (not manual `npm publish`); "Generated structure" → remove the `.npmrc` line. Add a
      migration note (remove the old `@bluestep-systems:registry=https://npm.pkg.github.com` line from
      `~/.npmrc`). **Guard:** keep the one-time `npx b6p auth set` platform-credential step clearly separate
      from the removed npm PAT — do not imply "zero setup." — files: `README.md`
- [x] **8. [C]** Update `CLAUDE.md`: "Publishing" paragraph → public npm, `access: public`, no PAT; the
      b6p-invocation paragraph → drop the GitHub-Packages `.npmrc`/PAT references and the now-deleted
      scaffolded `.npmrc`. — files: `CLAUDE.md`
- [x] **9. [C]** Flip the ADR `docs/decisions/install-friction-and-registry.md` status *Proposed* →
      *Accepted*: record Option 2, the engineer sign-off, and that `b6p-cli` is already public (answers its
      open question). Add a light supersede note to `docs/decisions/b6p-cli-distribution.md`. — files:
      `docs/decisions/install-friction-and-registry.md`, `docs/decisions/b6p-cli-distribution.md`
- [x] **10. [C]** Tick [TODO.md:9](../../../TODO.md) (publish workflow) and [TODO.md:10](../../../TODO.md)
      (registry decision) and move both to `DONE.md`; add a `CHANGELOG.md` entry for the registry switch +
      publish automation + `b6p-cli` dep removal. — files: `TODO.md`, `DONE.md`, `CHANGELOG.md`

  > **✓ Checkpoint — commit after Task 10.** All docs synced to the public-registry reality. Suggested
  > message: `docs: rewrite install/publishing for public npm; accept registry ADR`.

- [x] **11. [PLATFORM]** First public release: bump `package.json` `version`, commit, `git tag vX.Y.Z`, push
      the tag to fire `publish.yml`. Verify the published package and that an anonymous
      `npm install -g @bluestep-systems/bspecs` succeeds on a clean machine/container with **no** `~/.npmrc`.
      — files: `package.json`

## Verification

No test suite — confirm manually:

- `npm publish --dry-run` → `registry.npmjs.org`, `access: public`, tarball dep tree without `b6p-cli`.
- `node cli.js -v` / `node cli.js -h` still run after the dependency removal.
- `node test-scaffold.mjs` on a scratch scaffold: **no** `.npmrc` emitted, project still declares the
  `@bluestep-systems/b6p-cli` devDependency; a real `npm install` in that project pulls b6p-cli from public
  npm with no token.
- `ci.yml` green on a PR; `publish.yml` validated via `workflow_dispatch`/dry run before the first real tag.
- **Acceptance gate:** anonymous `npm install -g @bluestep-systems/bspecs` on a clean machine with no
  `~/.npmrc` succeeds and `bspecs -v` runs.

## Wrap-up

- Keep `README.md` / `CLAUDE.md` in sync with the public-registry reality (tasks 7–8).
- Tick `TODO.md` items 9 + 10 → `DONE.md`; add the `CHANGELOG.md` entry (task 10).
- ADR flipped to Accepted (task 9).
- No instruction file added under `templates/claude/instructions/`, so no `index.md` entry needed.
- Onboarding/first-run-auth follow-up stays in `docs/decisions/b6p-cli-onboarding-in-scaffolds.md` + its
  TODO item — out of scope here.
