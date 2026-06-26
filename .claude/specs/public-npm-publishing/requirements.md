# Requirements — Public npm publishing (remove the PAT requirement)

**Status:** Approved (2026-06-24 — `b6p-cli` is now public; publish automation folded in)

## Context

Installing `bspecs` today requires a GitHub Personal Access Token, because `bspecs` lives on GitHub
Packages (`npm.pkg.github.com`), which authenticates **every** install — even public packages. The ADR
[`docs/decisions/install-friction-and-registry.md`](../../../docs/decisions/install-friction-and-registry.md)
laid out three options and asked BlueStep to decide. TODO item [TODO.md:10](../../../TODO.md) tracked the wait.

Two things have since unblocked this work:

1. **A BlueStep engineer decided: Option 2 — publish to the public npm registry.** `bspecs` was always
   intended for public consumption; it was kept private only as a precaution.
2. **The external prerequisite is already done.** When this spec was first drafted, the publish of
   `@bluestep-systems/b6p-cli` was owned by another team and tracked here as a blocker. That team has
   since split the CLI into its own repo and **published `@bluestep-systems/b6p-cli@0.1.0` to public npm**
   (`publishConfig.access: "public"`, default registry, no token to install). The `@bluestep-systems` npm
   org exists and already publishes scoped public packages (`b6p-cli` and `b6p-core` are both live). So the
   sequencing risk — "bspecs goes public but its dependency is still private" — **no longer exists**.

This removes the PAT entirely: install collapses to `npm install -g @bluestep-systems/bspecs`, and a
scaffolded project's `npm install` resolves `@bluestep-systems/b6p-cli` anonymously from public npm.

With the dependency already public, this spec also **folds in the publish automation** (previously deferred
to [TODO.md:9](../../../TODO.md)): a GitHub Actions `publish.yml` + `ci.yml` for `bspecs`, modeled on the
proven workflows now living in the `b6p-cli` repo. The first `bspecs` publish was a manual `npm publish` to
GitHub Packages; this spec re-points it at public npm and automates subsequent releases on version tags.

## Goals

- As a new user, I want to install `bspecs` with a single `npm install -g @bluestep-systems/bspecs`
  and no PAT or `~/.npmrc` setup, so that onboarding is one command.
- As a scaffolded-project user, I want `npm install` / `npx b6p` to resolve `@bluestep-systems/b6p-cli`
  from the public registry with no token, so that the per-project install just works on any machine.
- As a maintainer, I want `bspecs` published to public npm under the `@bluestep-systems` org with
  `access: public`, so that anonymous installs succeed.
- As a maintainer, I want `bspecs` releases automated by a tag-triggered GitHub Actions workflow (with a
  PR/push CI workflow validating changes), modeled on the existing `b6p-cli` workflows, so that I stop
  hand-publishing and every release is built/verified consistently.
- As a maintainer, I want the README, `CLAUDE.md`, and the ADR to reflect the public-registry reality,
  so that the docs stop telling people to create a PAT.

## Acceptance criteria

### Registry switch (bspecs)

- [ ] `bspecs` `package.json` `publishConfig` targets the public npm registry with `access: "public"`
      (registry either omitted to use the default, or set to `https://registry.npmjs.org`); the current
      `npm.pkg.github.com` / `access: "restricted"` values are removed.
- [ ] `@bluestep-systems/b6p-cli` is removed from bspecs's own `package.json` `dependencies` (and
      `package-lock.json` regenerated). bspecs's source never imports, spawns, or installs it — it is a
      `devDependency` of *scaffolded* projects (`templates/root/package.json.template`), not of the
      scaffolder. While `b6p-cli` was on GitHub Packages this stray runtime dep forced `npm install -g
      @bluestep-systems/bspecs` itself to resolve `b6p-cli` (and thus need the PAT), compounding the very
      friction this spec removes.
- [ ] The repo-local `.npmrc` no longer maps `@bluestep-systems` to GitHub Packages or references
      `${GITHUB_TOKEN}`; it either is removed or pins the scope to `https://registry.npmjs.org` defensively
      (matching what the `b6p-cli`/`b6p-core` repos committed, to override any inherited stale mapping).
- [ ] The scaffolded `.npmrc.template` no longer maps `@bluestep-systems` to GitHub Packages and no
      longer references `${GITHUB_TOKEN}` (the file is removed entirely, or reduced to whatever the
      public default needs — see Open questions).
- [ ] A freshly scaffolded project installs `@bluestep-systems/b6p-cli` via `npm install` with **no**
      token configured. *(Now directly verifiable — `b6p-cli` is public.)*

### Publish + CI automation (new — modeled on `b6p-cli`)

- [ ] `.github/workflows/publish.yml` exists: triggers on `v[0-9]+.[0-9]+.[0-9]+*` tags, `permissions:
      { contents: read, id-token: write }`, `setup-node` with `registry-url: https://registry.npmjs.org`,
      verifies the tag matches `package.json` version, then `npm publish --provenance --access public`
      using `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. Mirrors
      [`b6p-cli/.github/workflows/publish.yml`](../../../../b6p-cli/.github/workflows/publish.yml).
- [ ] `.github/workflows/ci.yml` exists: triggers on `pull_request` and push to the default branch, runs a
      lightweight validation appropriate to bspecs (it has no build/test suite — at minimum a scaffold
      smoke check such as `node cli.js -v` / `node cli.js -h`, and `test-scaffold.mjs` if wired up), with
      `permissions: contents: read` and no secrets. Modeled on
      [`b6p-cli/.github/workflows/ci.yml`](../../../../b6p-cli/.github/workflows/ci.yml) but trimmed (no
      `tsc`/`eslint`/`esbuild` — bspecs is plain ESM JS).
- [ ] The `NPM_TOKEN` secret (npm automation token with publish rights to `@bluestep-systems`) is added to
      the `bspecs` GitHub repo. *(Platform prerequisite — the org + token already exist from the b6p-cli
      work; this only adds the secret to the bspecs repo.)*

### Docs

- [ ] README "Installation", "Prerequisites", and "Publishing" sections describe the public-registry,
      no-PAT flow; the PAT steps are removed and the manual-`npm publish` instructions are replaced by the
      tag-to-release workflow.
- [ ] The README/CLAUDE.md rewrite **removes only the npm-registry PAT** and must **keep and clearly
      separate** the unrelated, still-required one-time **platform** credential step (`npx b6p auth set`,
      once per machine → `~/.b6p`). Dropping the npm token does not mean "zero setup" — overclaiming that
      worsens the first-run auth hang. See
      [`docs/decisions/b6p-cli-onboarding-in-scaffolds.md`](../../../docs/decisions/b6p-cli-onboarding-in-scaffolds.md).
- [ ] `CLAUDE.md` (the bspecs repo's own) "Publishing" section and the b6p-invocation paragraph reflect the
      public registry; references to the restricted registry / PAT are corrected.
- [ ] The ADR [`install-friction-and-registry.md`](../../../docs/decisions/install-friction-and-registry.md)
      status changes from *Proposed* to *Accepted*, recording Option 2 as the decision, the engineer
      sign-off, and that `b6p-cli` is already public (the open question it posed is answered).
- [ ] [TODO.md:9](../../../TODO.md) (publish workflow) and [TODO.md:10](../../../TODO.md) (registry decision)
      are marked resolved / moved to `DONE.md`.
- [ ] `CHANGELOG.md` gets an entry for the registry switch + publish automation.

## Out of scope

- **Publishing `@bluestep-systems/b6p-cli` itself** — already done (public, `0.1.0`). This spec only
  consumes it.
- **`bspecs doctor` / `bspecs init`** ([TODO.md:11](../../../TODO.md)) — Option 2 removes most of its
  reason to exist (no `~/.npmrc` to validate); revisit separately, not here.
- **Migrating already-scaffolded consumer projects.** Existing projects keep their GitHub Packages
  `.npmrc` until re-scaffolded or synced; `bspecs sync` does not manage the root `.npmrc` (it lives
  under `templates/root/`, outside the synced `.claude/` tree). Whether to help existing projects
  migrate is a follow-up, not part of this spec.
- **Converting bspecs source to TypeScript** ([TODO.md:15](../../../TODO.md)) — independent; the CI
  workflow here validates the current plain-JS source and should not block on the TS conversion.

## Open questions

1. **Keep a scaffolded `.npmrc` at all?** Once `@bluestep-systems/*` is public, the default registry
   resolves it with no config. Options: (a) delete `.npmrc.template` (and the repo-local `.npmrc`)
   entirely, (b) keep a minimal `@bluestep-systems:registry=https://registry.npmjs.org` line as a
   defensive override against a stale GitHub-Packages mapping in a developer's `~/.npmrc` (this is what the
   `b6p-cli`/`b6p-core`/`b6p-vscode` repos chose). Leaning (b) for the **repo-local** `.npmrc` (cheap
   insurance, matches the sibling repos) and (a) for the **scaffolded template** (fewer files in generated
   projects) — confirm in design.
2. **Existing `~/.npmrc` interaction.** A user who already has the GitHub Packages scope mapping in
   `~/.npmrc` will keep routing `@bluestep-systems/*` there even after we go public, and 404. A committed
   repo-local `.npmrc` pinning the scope to public npm (option 1b) neutralizes this for the bspecs repo and
   for freshly scaffolded projects; a one-line migration note in the README covers users on older
   scaffolds. Decide whether the note is worth adding.
3. **CI depth for a no-build package.** bspecs has no `tsc`/lint/test suite today. Is a scaffold smoke run
   (`node cli.js -h` + `test-scaffold.mjs`) enough for `ci.yml`, or do we want to add a real test step
   first? Leaning "smoke run now, expand when a test suite lands" so CI ships with this spec rather than
   waiting on the TS-conversion / test work.

## Resolved since the original draft

- ~~Sequencing vs. `b6p-cli` (gate the bspecs publish on b6p-cli being public first?)~~ — moot; `b6p-cli`
  is already public.
- ~~Fallback-to-PAT trip-wire (define the blocker that aborts the migration)~~ — moot; the only blocker the
  ADR named (org name unavailable / `b6p-cli` not published publicly) has not materialized — both are done.
- ~~npm `bluestep-systems` org exists and can publish scoped public packages~~ — confirmed (b6p-cli +
  b6p-core are live under it).
