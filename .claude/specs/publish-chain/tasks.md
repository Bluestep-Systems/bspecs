# Tasks — Publish chain (b6p-cli → bspecs)

**Status:** Drafting

Each task is one coherent unit (one `/spec-execute` invocation). Tasks are tagged:

- **`[CODE]`** — in-repo edits I make; you review the diff and approve.
- **`[MANUAL]`** — you run these (need a PAT / registry write / GitHub org access). I supply
  copy-paste commands + a verification line; I do not run publish, push, or repo-create.

**Ordering is load-bearing:** A0 gates everything; the A2 publish (task 2) must land **before** the
lockfile refresh in task 5, or `npm install` 404s on the unpublished dependency.

## Tasks

- [x] **1.** `[MANUAL]` **A0 — auth gate.** Confirm `Bluestep-Systems` org membership + publish
      rights on the `@bluestep-systems` scope (GitHub Packages). Ensure `~/.npmrc` has a
      `write:packages` PAT and the scope mapping:
      `@bluestep-systems:registry=https://npm.pkg.github.com` +
      `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`.
      *Verify:* `echo $GITHUB_TOKEN` is set and `npm whoami --registry=https://npm.pkg.github.com`
      resolves. Blocks all other tasks.
      **DONE (2026-06-19):** org membership `active`/`member`; classic PAT valid (`HTTP 200` on
      `/user`, scopes `read:org, repo, write:packages`), no SSO challenge on org/repo endpoints.
      `npm whoami` returns 403 — a known GitHub-Packages `whoami` quirk, not a blocker. Token stashed
      in `~/.bspecs_token` for the session.

- [x] **2.** `[MANUAL]` **A2 — publish `b6p-cli`** from the monorepo
      (`/home/fchazarreta/vscode-extension`, WSL). PR #14 is already merged (`413ac23`), so no edits
      — run, in `packages/b6p-cli/`: `npm run prepublishOnly`, then `npm pack --dry-run` (expect
      exactly `dist/cli.js`, `package.json`, `README.md`, `CHANGELOG.md`), then
      `npm publish -w @bluestep-systems/b6p-cli`.
      *Verify:* `npm view @bluestep-systems/b6p-cli version` returns `0.1.0` (no E404), and the
      package shows under `Bluestep-Systems` in GitHub Packages. **Must complete before task 5.**

- [x] **3.** `[MANUAL]` **A2 — verify clean `b6p-cli` install.** From a throwaway empty dir with an
      `.npmrc` pointing at GitHub Packages + a `read:packages` PAT, run
      `npm i -g @bluestep-systems/b6p-cli` and `b6p --help`.
      *Verify:* install succeeds and `b6p --help` prints CLI help. Confirms the published tarball is
      self-contained (core is bundled).
      **DONE (2026-06-19):** `npm i -g` added the package; `b6p --help` prints the full command list
      when run from its install path → **tarball is self-contained (core bundled).** ⚠️ **A5 PATH
      finding:** the dev env has THREE complications the A5 spec must resolve before skills can rely
      on a global `b6p`: (1) a stale `npm link` of `b6p@0.0.1` (source checkout) sits on the
      interactive-zsh PATH at `~/.nvm/.../v24.15.0/bin/b6p` and **masks** the published version;
      (2) the published `0.1.0` installed to `~/.npm-global/bin` (from the `prefix` in `~/.npmrc`),
      which is **not on the interactive PATH**; (3) npm warns `~/.npmrc`'s `prefix` setting is
      **incompatible with nvm**, so nvm-npm and prefix-npm write to different global dirs. This is the
      "biggest integration risk" from the master plan — A5's `npx b6p` switch sidesteps all of it.

- [x] **4.** `[CODE]` **A3 — rewire `package.json`.** Edit `package.json`: `name` →
      `@bluestep-systems/bspecs`; add `dependencies["@bluestep-systems/b6p-cli"] = "^0.1.0"`;
      `repository.url` → `https://github.com/Bluestep-Systems/bspecs.git`. Do **not** bump `version`
      yet (that's task 9). — files: `package.json`

- [x] **5.** `[CODE]` **A3 — add root `.npmrc` + refresh lockfile.** Create `.npmrc` at repo root
      with `@bluestep-systems:registry=https://npm.pkg.github.com` and
      `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}` (placeholder only — no literal secret).
      Run `npm install` to regenerate `package-lock.json` with the new name + dependency (requires
      task 2 published + a `read:packages` token in env). — files: `.npmrc` (new),
      `package-lock.json`

- [x] **6.** `[CODE]` **A3 — update README** for the new name + consumer auth. Change the title and
      the `npm install -g` / `npm update -g` lines to `@bluestep-systems/bspecs`; add a "Consumer
      auth" section documenting the `.npmrc` scope mapping + a `read:packages` PAT needed to install
      from GitHub Packages. — files: `README.md`

- [x] **7.** `[CODE]` **A3 — update CLAUDE.md** intro line + "Publishing" section: new package name,
      the new `b6p-cli` runtime dependency, org repo URL (`github.com/Bluestep-Systems/bspecs`). —
      files: `CLAUDE.md`

- [x] **8.** `[CODE]` **A3/A5-bridge — update the ADR.** Add a note (and bump status) to
      `docs/decisions/b6p-cli-distribution.md`: `b6p-cli` was published directly (not via the
      upstream-issue route); bspecs uses a plain `dependencies` entry for the first release;
      `peerDependencies` + `npx b6p` deferred to the A5 spec. Record the package **rename**
      (`@bluestep` → `@bluestep-systems`) decision as a one-liner here too. — files:
      `docs/decisions/b6p-cli-distribution.md`

- [x] **9.** `[CODE]` **A4 — bump version + CHANGELOG.** Bump `package.json` `version` 0.7.0 →
      0.8.0. Add a `## [0.8.0]` CHANGELOG entry (rename, new `b6p-cli` dependency, org move); update
      the top "All notable changes to …" line to the new name. **Leave historical `@bluestep/init` /
      older rename entries untouched.** — files: `package.json`, `CHANGELOG.md`

- [x] **10.** `[CODE]` **A4 — pre-publish dry run.** Run `npm pack --dry-run` and confirm the
      tarball contains only the `files` allowlist (`cli.js`, `src/`, `templates/`) plus
      `package.json`/`README`. No code edit unless the dry run reveals a stray include. — files:
      (verification; possibly `.npmignore`/`files` if a leak is found)

- [ ] **11.** `[MANUAL]` **A3 — move repo to the org.** Create `Bluestep-Systems/bspecs` (private),
      repoint `origin` off `fchazarreta-bs`, push `main` + tags:
      `git remote set-url origin git@github.com:Bluestep-Systems/bspecs.git` then
      `git push -u origin main --tags`.
      *Verify:* `git remote -v` shows the org URL; `main` is visible on the org repo. One-way door —
      confirm the exact repo name first.

- [ ] **12.** `[MANUAL]` **A4 — publish bspecs + verify transitive install.**
      `npm publish` from the repo root (publishConfig targets GitHub Packages restricted). Then from
      a clean dir: `npm i -g @bluestep-systems/bspecs` and `b6p --version`.
      *Verify:* `npm view @bluestep-systems/bspecs version` returns `0.8.0`; the clean install pulls
      `b6p-cli` transitively and `b6p --version` resolves. **Record** whether `b6p` is reachable from
      the WSL hooks/skills (input for the A5 spec) — do not fix here.

- [ ] **13.** `[CODE]` **Housekeeping — TODO/DONE.** Check off / archive the resolved TODO.md items
      ("Push to GitHub", "Consumer auth docs", upstream-publish item; note the peer-dep migration is
      now the A5 spec). Move completed entries to `DONE.md` per repo convention. — files: `TODO.md`,
      `DONE.md`

## Verification

No test suite — confirm manually:

- `node cli.js -v` still prints the version after the `package.json`/rename edits.
- After task 5, `package-lock.json` lists `@bluestep-systems/bspecs` as the root package name and
  `@bluestep-systems/b6p-cli` under dependencies.
- `npm pack --dry-run` (task 10) lists only allowlisted files.
- Registry checks: `npm view @bluestep-systems/b6p-cli version` → `0.1.0`;
  `npm view @bluestep-systems/bspecs version` → `0.8.0`.
- Clean-dir global install of `@bluestep-systems/bspecs` brings `b6p`; `b6p --version` resolves.
- `grep` the repo for stray `@bluestep/bspecs` / `fchazarreta-bs` in living docs (historical
  CHANGELOG mentions of `@bluestep/init` are expected to remain).

## Wrap-up

- README, CLAUDE.md, CHANGELOG, TODO.md/DONE.md all in sync with the new name + dependency.
- ADR `b6p-cli-distribution.md` reflects the direct-publish + rename decisions.
- No `templates/**` changes — scaffolded output is unaffected by this spec.
- Open the A5 fast-follow spec next (delete shell-detection, switch skills to `npx b6p`), carrying
  the WSL-PATH observation from task 12.
