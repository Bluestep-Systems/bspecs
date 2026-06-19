# Requirements — Publish chain (b6p-cli → bspecs)

**Status:** Drafting

## Context

Track A of the master plan [docs/bspecs-builder/requirements.md](../../../docs/bspecs-builder/requirements.md):
make `@bluestep-systems/bspecs` the single tool BlueStep builders install, where installing
bspecs transitively brings the `b6p` CLI. Track B (rules consolidation, B4 subagents) already
shipped in 0.6.0/0.7.0; this spec finishes the **publishing chain**.

The upstream publishing setup (PR #14) is **merged** — confirmed as commit
`413ac23 chore(cli): set up b6p-cli for publishing to GitHub Packages` in the monorepo
`Bluestep-Systems/vscode-extension` (WSL: `/home/fchazarreta/vscode-extension`). `b6p-cli` is at
`v0.1.0` but is **not yet published** — none of its PR test-plan steps (publish, clean-install
verify) have been run.

This repo (`@bluestep/bspecs`, v0.7.0) currently:
- is **not** scoped under the org (decision: rename to `@bluestep-systems/bspecs`),
- has `repository.url` wrongly pointing at `github.com/bluestep/bspecs`,
- has its `origin` remote on the personal account `fchazarreta-bs/bspecs`,
- declares no `@bluestep-systems/b6p-cli` dependency and has no `.npmrc`.

Related: TODO.md → *"Blocking publication / cross-machine use"*; ADR
[b6p-cli-distribution.md](../../../docs/decisions/b6p-cli-distribution.md) (end state =
publish cli → consumers declare the dep → eventually `npx b6p`).

**Decisions locked for this spec** (via /spec-create):
1. Package **renamed** `@bluestep/bspecs` → `@bluestep-systems/bspecs` (cheaper before first publish).
2. The **A5 cleanup** (delete the ~200 lines of shell-detection, switch skills to `npx b6p`) is a
   **separate fast-follow spec**, not part of this one. This spec stops at A4 + verification.
3. `b6p-core` publish is **skipped** — the cli esbuild-bundles core, so the published cli tarball is
   self-contained (master plan A1 / ADR).

## Goals

- As a BlueStep builder, I want `npm i -g @bluestep-systems/bspecs` to also give me a working `b6p`
  binary, so I don't have to install the CLI from a source checkout.
- As the bspecs maintainer, I want `@bluestep-systems/b6p-cli` published to GitHub Packages
  (restricted), so bspecs can declare it as a normal dependency instead of a detect-and-guide
  workaround.
- As the bspecs maintainer, I want this repo living under the `Bluestep-Systems` org with correct
  `repository` metadata, so it's discoverable and ownership matches the rest of the toolchain.
- As the bspecs maintainer, I want `@bluestep-systems/bspecs` published to GitHub Packages, so the
  team installs one tool from one registry.
- As a consumer, I want documented `.npmrc`/PAT auth steps, so install from GitHub Packages succeeds
  on a clean machine.

## Acceptance criteria

**A0 — Prerequisites / auth (blockers, verify first)**

- [ ] Confirmed publish rights on the `@bluestep-systems` scope and `Bluestep-Systems` org
      membership for the publisher.
- [ ] A working `~/.npmrc` exists with a GitHub PAT (`write:packages`) and the scope→registry
      mapping for `@bluestep-systems` → `https://npm.pkg.github.com`.

**A2 — Publish `b6p-cli` (in the monorepo)**

- [ ] `npm run prepublishOnly` in `packages/b6p-cli/` passes (clean → lint → check-types → compile).
- [ ] `npm pack --dry-run` shows exactly the intended 4 files (`dist/cli.js`, `package.json`,
      `README.md`, `CHANGELOG.md`) — no `src/`, `esbuild.js`, or `.npmrc`.
- [ ] `npm publish -w @bluestep-systems/b6p-cli` succeeds; the package appears in GitHub Packages
      under `Bluestep-Systems`.
- [ ] `npm view @bluestep-systems/b6p-cli version` returns `0.1.0` (no E404).
- [ ] From a clean dir (with `.npmrc` + a `read:packages` PAT), `npm i -g @bluestep-systems/b6p-cli`
      succeeds and `b6p --help` prints CLI help.

**A3 — Wire bspecs to depend on the cli + move to the org**

- [ ] `package.json` `name` is `@bluestep-systems/bspecs`.
- [ ] `package.json` `dependencies` includes `"@bluestep-systems/b6p-cli": "^0.1.0"`.
- [ ] `package.json` `repository.url` is `https://github.com/Bluestep-Systems/bspecs.git`
      (exact name confirmed in A0).
- [ ] A repo-root `.npmrc` maps `@bluestep-systems` → `npm.pkg.github.com` (token via
      `${GITHUB_TOKEN}` placeholder, no secret committed).
- [ ] `Bluestep-Systems/bspecs` repo exists; `origin` remote is repointed off `fchazarreta-bs`;
      `main` (and tags) pushed.
- [ ] All in-repo references to the old name/remote that must change are updated (README, docs,
      CHANGELOG header links as applicable).

**A4 — Publish bspecs**

- [ ] Version bumped (0.7.0 → 0.8.0) with a CHANGELOG entry covering the rename, the new
      `b6p-cli` dependency, and the org move.
- [ ] `npm publish` succeeds; `@bluestep-systems/bspecs` appears in GitHub Packages.
- [ ] `npm i -g @bluestep-systems/bspecs` on a clean dir succeeds and **transitively installs**
      `b6p-cli`; `b6p --version` resolves. (Records the WSL-vs-Windows PATH observation for the
      separate A5 spec — see Out of scope.)

**Docs / housekeeping**

- [ ] Consumer auth flow (`.npmrc` + PAT) documented in this repo's `README.md`.
- [ ] `CLAUDE.md` "Publishing" section updated for the new package name, the `b6p-cli` dependency,
      and the org repo.
- [ ] TODO.md items resolved/checked off as appropriate (push to GitHub, consumer auth docs,
      peer-dep migration note); the upstream-publish item closed since we publish directly.

## Out of scope

- **A5 cleanup** — removing `detectEnvironmentFor` / `.claude/b6p-env.json` / `/b6p-detect` /
  the `require-wsl-for-b6p.sh` regex and switching skills to `npx b6p`. Tracked as a **separate
  fast-follow spec** per the locked decision and the ADR. This spec only *records* the WSL-PATH
  observation that spec will need.
- **Publishing `b6p-core`** — skipped; the cli bundles it.
- **GitHub Actions publish workflow** — the first publish is a manual one-liner; automating it
  (`.github/workflows/publish.yml`) is deferred (separate TODO item).
- **`peerDependencies` migration** — this spec uses a plain `dependencies` entry; the
  peer-dependency form is part of the A5 cleanup era.
- All of Track B (already shipped).

## Open questions

- Exact casing of the new repo name under the org: `Bluestep-Systems/bspecs` (assumed) — confirm in
  A0 before pushing and before fixing `repository.url`.
- Does any monorepo-side step (A2) need a second person with publish rights, or can the bspecs
  maintainer run `npm publish` for `b6p-cli` directly? (A0 verification answers this.)
- Should the first bspecs publish be `0.8.0` (minor — new dependency + rename) vs `1.0.0` (signals
  "team-ready, installable")? Drafted as `0.8.0`; flag if a 1.0.0 milestone is preferred.
