# Tasks — standalone-binary-distribution

**Status:** Drafting

Each task references specific files and is sized for one `/spec-execute`. Ordered so dependents
follow their prerequisites. Tasks are tagged `[CODE]` (implementable here) or `[PLATFORM]`
(external dependency outside this repo). The two halves (Part A = binary build/distribution,
Part B = npm-free scaffold profile) are independent; Part A can ship entirely before Part B.

## Part A — build & distribute the bspecs binary

- [x] **A1. [CODE] Make the version read SEA-safe.** `cli.js:10-11` reads `package.json` from disk
  via `__dirname`; inside a self-contained SEA that path doesn't exist. Replace with a build-time
  injected version (e.g. a generated `src/version.js` written by the build step, or
  `process.env.BSPECS_VERSION` baked at bundle time) with a fallback to the on-disk read for the
  `node cli.js` dev path. Must keep `node cli.js -v` working unchanged. — files: `cli.js`, new
  `src/version.js` (or equivalent), `package.json` (build script).

- [x] **A2. [CODE] Add the SEA build config + local build script.** Create `sea-config.json` and a
  `scripts/build-binary.mjs` (or npm `build:binary` script) that runs: esbuild bundle
  (`cli.js` → `build/bspecs.cjs`, `--platform=node --format=cjs`), `node --experimental-sea-config`,
  copy the `node` binary, `postject` the blob. Add `esbuild` + `postject` as **devDependencies**
  only. Document the local invocation in a comment. — files: new `sea-config.json`, new
  `scripts/build-binary.mjs`, `package.json` (devDeps + script).

- [x] **A2.5. [CODE] Embed the template tree into the binary.** A self-contained SEA has no
  on-disk `templates/` dir, but `src/utils.js:6` reads templates from
  `join(__dirname, "..", "templates")` — so `bspecs new`/`init`/`sync` fail at runtime in the
  binary (only `-v`/`-h` work without it). Make the template tree available without a disk path:
  preferred approach is an esbuild step that bundles `templates/**` as in-binary data (a generated
  manifest of path→contents the bundle imports), with `utils.js`/`scaffold.js`/`sync.js` reading
  from that embedded map when no on-disk `templates/` is present and falling back to the disk read
  for the `node cli.js` dev path. (SEA `assets` + `sea.getAsset()` is the alternative; pick in
  implementation.) The version-injection pattern in `src/version.js` (A1) is the model: build-time
  bake, disk fallback for dev. — files: `scripts/build-binary.mjs`, `src/utils.js`,
  `src/scaffold.js`, `src/sync.js`, possibly a new `src/templates-embed.js`. Discovered during A2
  verification.

- [x] **A3. [CODE] Add the `build-binaries` CI job to `publish.yml`.** A 3-leg matrix
  (`windows-latest`, `macos-13` Intel, `macos-14` arm64), `needs: publish`, `permissions:
  contents: write`. Each leg builds via A2's script, smoke-runs the produced binary (`-v` prints the
  real version, `-h` prints help), and `gh release upload`s its asset. A single guarded step
  creates the GitHub Release (`gh release create "$GITHUB_REF_NAME" --generate-notes`) before
  uploads — this also closes the open TODO "GitHub Releases aren't created on publish." — files:
  `.github/workflows/publish.yml`.

- [x] **A4. [CODE] Mirror the binary smoke build into `ci.yml`.** Build the binary for the runner's
  own OS on every PR/push (no upload) and smoke-run it, so SEA bundling breakage is caught before a
  release tag, not at publish time. — files: `.github/workflows/ci.yml`.

- [x] **A5. [CODE] Write `INSTALL.md` (installer-facing, for a cold Claude session).** **Install
  only** — getting the binary onto the machine, which is fully non-interactive (no scaffolder run,
  so no clack prompts for Claude to hang on). Imperative steps for Claude to: detect OS/arch;
  resolve the latest Release asset via the GitHub API; download the matching `bspecs-*` into the
  shared BlueStep bin dir (`%LOCALAPPDATA%\BlueStep\bin\` Windows / `~/.bluestep/bin/` Mac);
  `chmod +x` + `xattr -d com.apple.quarantine` on Mac; ensure that dir is on PATH; verify with
  `bspecs -v`. Note the dir is shared with the `b6p` binary. Do NOT run `bspecs new`/`init` here —
  scaffolding is a later, user-initiated step (see Out of scope re: who runs the scaffolder). —
  files: new `INSTALL.md`.

## Part B — npm-free scaffold profile (gated on the b6p-cli binary)

- [ ] **B1. [CODE] Add the `{{B6P}}` token + profile resolution.** `applyTemplate()` substitutes
  `{{B6P}}` (`npx b6p` for the `npx` profile, `b6p` for `path`). Resolve the profile in `cli.js`:
  default `path` when the SEA marker is set (e.g. `process.env.BSPECS_PROFILE` baked at build / a
  build-time constant), else `npx`; overridable via `--profile npx|path`. Thread the profile into
  scaffold/init/sync. — files: `src/utils.js`, `cli.js`, `src/prompts.js`, `src/scaffold.js`.

- [ ] **B2. [CODE] Add the consolidated `b6p-invocation.md` instruction file (profile-aware).**
  New `templates/claude/instructions/reference/b6p-invocation.md.template` holding the
  profile-specific "how `b6p` is invoked" prose — `npx` form (devDependency, `npm install`) vs
  `path` form (binary on PATH in the shared BlueStep dir, "install it if not found"). Add the
  one-line entry to `templates/claude/instructions/index.md.template`. — files: new
  `templates/claude/instructions/reference/b6p-invocation.md.template`,
  `templates/claude/instructions/index.md.template`.

- [ ] **B3. [CODE] Switch the b6p skills to `{{B6P}}` and link the invocation file.** Replace inline
  `npx b6p` with `{{B6P}}` and move the npm-specific prose out into a link to `b6p-invocation.md`.
  Update the `allowed-tools` frontmatter (`Bash(npx b6p *)` → cover both `npx b6p` and bare `b6p`).
  — files: `templates/claude/skills/b6p-pull/SKILL.md`, `templates/claude/skills/b6p-push/SKILL.md`,
  `templates/claude/skills/b6p-audit/SKILL.md`.

- [ ] **B4. [CODE] Switch the remaining `npx b6p` references to `{{B6P}}`.** The instruction/doc/hook
  files that mention `npx b6p` outside the three skills. — files:
  `templates/root/CLAUDE.md.template`, `templates/root/README.md.template`,
  `templates/claude/instructions/b6p-platform.md.template`,
  `templates/claude/instructions/bsjs-development.md.template`,
  `templates/claude/instructions/reference/merge-report-memo-json.md.template`,
  `templates/claude/spec-templates/tasks.template.md`,
  `templates/claude/skills/bspecs-feedback/SKILL.md` (the "node backs `npx b6p`" aside),
  `templates/claude/hooks/block-generated-files.sh`.

- [ ] **B5. [CODE] Make `package.json.template` + settings profile-aware.** In the `path` profile,
  drop the `@bluestep-systems/b6p-cli` devDependency and the `"b6p": "b6p"` script from
  `templates/root/package.json.template`, and drop the now-unused `Bash(npx:*)`/`Bash(npm:*)`
  permissions from `templates/claude/settings.json.template`. Keep both intact for the `npx`
  profile. (The `SessionStart` hook already calls bare `bspecs sync` — no change.) — files:
  `templates/root/package.json.template`, `templates/claude/settings.json.template`,
  `src/scaffold.js` (profile-conditional emission).

- [ ] **B6. [CODE] Record + honor the profile across `bspecs sync`.** Persist the chosen profile in
  `.claude/bspecs.lock` at scaffold time; `bspecs sync` reads it so a re-sync never silently flips a
  project's profile. — files: `src/sync.js`, `src/scaffold.js`.

- [ ] **B7. [PLATFORM] b6p-cli standalone binary exists.** External dependency in the b6p-cli repo
  (parallel spec). The `path` profile is non-functional until a bare `b6p` binary is installable
  into the shared BlueStep bin dir. Until then, `path` is opt-in via `--profile path` only; do not
  flip the binary's default to `path` until this lands. — files: none here (tracking only).

## Docs & ADR (do alongside the relevant tasks)

- [ ] **D1. [CODE] Amend/supersede the npm-free ADR.** Update
  `docs/decisions/npm-free-scaffolding-via-vscode-extension.md` to record that the
  standalone-binary + Claude-installer route is the chosen path for the Claude-Code host (reversing
  the prior "rejected" status of the single-executable alternative), the SEA/parity rationale, the
  profile concept, and the still-open "no npm vs no arbitrary execution" policy pivot. Add a short
  cross-reference note in `docs/decisions/b6p-cli-distribution.md`. — files:
  `docs/decisions/npm-free-scaffolding-via-vscode-extension.md`,
  `docs/decisions/b6p-cli-distribution.md`.

- [ ] **D2. [CODE] Update `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`.** Document the binary artifact +
  install flow + profile in this repo's `CLAUDE.md` (Publishing / Key behaviors); tick/replace the
  "npm-free delivery via the VSCode extension (explore)" TODO item; add a `CHANGELOG.md` entry.
  — files: `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`.

## Verification

No test suite — confirm manually + via CI smoke:

- `node cli.js -v` / `node cli.js -h` still work (dev path unaffected by A1/B1).
- Build the binary locally (A2) and run `<binary> -v` → prints the **real** version (not `0.0.0`),
  `<binary> -h` → help. (Validates the SEA version-read fix.)
- `node cli.js new --profile npx` into a scratch dir → skills/docs render `npx b6p`, package.json
  keeps the devDependency.
- `node cli.js new --profile path` into a scratch dir → skills/docs render bare `b6p`, package.json
  omits the devDependency, `b6p-invocation.md` is present in its `path` form.
- Inspect `INSTALL.md` for a cold-session-followable sequence.
- CI: the `build-binaries` matrix produces and uploads three assets on a tag; `ci.yml` builds the
  binary on PRs.

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync with the binary + profile behavior (D2).
- Tick the relevant `TODO.md` item (D2).
- Note the change in `CHANGELOG.md` (D2).
- `b6p-invocation.md` (B2) must have a matching `templates/claude/instructions/index.md.template`
  entry.
- The npm-free ADR (D1) must reflect the reversal before this is considered done.
