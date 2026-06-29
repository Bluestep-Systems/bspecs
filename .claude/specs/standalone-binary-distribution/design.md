# Design — standalone-binary-distribution

**Status:** Drafting

The work splits cleanly into two independent halves:

- **Part A — Build & distribute the bspecs binary.** Pure CI/packaging. No effect on the
  scaffolded output. Can ship first and alone.
- **Part B — npm-free scaffold profile.** Make the *scaffolded content* runnable on a no-npm
  machine (the `npx b6p` → bare `b6p` switch). Gated on the b6p-cli binary (separate repo).

They share no code; sequencing A before B is fine.

## Files / areas affected

### Part A — binary build & distribution

- `.github/workflows/publish.yml` — add a `build-binaries` job (matrix over OS) that compiles the
  binary and uploads each artifact to the GitHub Release created for the tag. Add
  `permissions: contents: write` for the release-upload step (today it's `contents: read`).
- **New build config** for SEA — a `sea-config.json` (points at the esbuild-bundled entry) plus the
  bundle/postject steps in the workflow. `esbuild` is added as a **build-time** devDependency only
  (bundles ESM→single CJS for SEA); nothing new in the runtime/published deps.
- **Template embedding (task A2.5)** — the scaffolder reads `templates/**` from disk via
  `utils.js`'s `TEMPLATES_DIR = join(__dirname, "..", "templates")`. A self-contained SEA has no
  such dir, so the template tree must be embedded in the binary (esbuild-bundled data map, or SEA
  assets) with a disk-read fallback for the `node cli.js` dev path — same build-time-bake +
  dev-fallback shape as the version read (A1). Without this the binary runs `-v`/`-h` but cannot
  scaffold. Discovered during A2 verification.
- **New `INSTALL.md`** at repo root — installer-facing doc a cold Claude session follows.
- `package.json` — unchanged `bin`/`files`/`name`; npm publish path untouched. (Possibly a
  `build:binary` script for local repro.)
- `CHANGELOG.md`, `TODO.md`, ADR — sync.

### Part B — npm-free scaffold profile

- `src/utils.js` — `applyTemplate()` gains a `{{B6P}}` substitution (the b6p invocation token).
- `src/prompts.js` / `cli.js` — profile selection: `npx` (npm world) vs `path` (binary world).
- `templates/root/package.json.template` — in the `path` profile, drop the `b6p-cli`
  devDependency and the `"b6p": "b6p"` script (both are npm-world artifacts).
- The **13 `npx b6p` template files** — replace inline `npx b6p` with the `{{B6P}}` token; move
  the npm-specific *prose* ("resolves `node_modules/.bin/b6p`", "run `npm install`",
  "devDependency") out of each skill into **one** consolidated, profile-aware invocation file
  (see below), which the skills link to. This honors the repo's no-duplication invariant.
- **New `templates/claude/instructions/reference/b6p-invocation.md.template`** — single source of
  truth for "how `b6p` is invoked on this machine," rendered per profile. Add the one-line entry
  to `instructions/index.md.template`.
- `templates/claude/settings.json.template` — `SessionStart` already calls bare `bspecs sync`;
  no change needed. In the `path` profile, drop the now-unused `Bash(npx:*)`/`Bash(npm:*)`
  permissions (optional tidy).
- ADR amendment + `CHANGELOG.md` / `TODO.md` sync.

## Approach

### Part A — toolchain (decision: Node SEA, for parity with b6p-cli)

bspecs is ESM (`"type": "module"`, dynamic `import` of `src/*.js`, top-level `await`). The two
realistic candidates:

- **Node SEA** *(chosen)* — official Node Single Executable Applications. Cross-OS builds need a
  runner per OS/arch (a 3-leg CI matrix); ESM requires pre-bundling to a single file (esbuild)
  before `--experimental-sea-config`; the produced binary embeds **real Node**, identical to the
  runtime `test-scaffold.mjs` already exercises. ~75–110 MB/asset.
- **`bun build --compile`** *(not chosen)* — lighter (~50–60 MB), one-runner cross-compile, trivial
  arm64. But the binary embeds **JavaScriptCore**, not Node, so the shipped runtime differs from the
  tested one.

**Why SEA despite bun being lighter — two reasons specific to this program, not a blanket
preference:**

1. **Toolchain parity with b6p-cli.** The b6p-cli binary (sibling repo) has a *hard* requirement
   for SEA: its `CliPrompt.readMasked` credential path (raw-mode TTY, keypress decoder,
   `process.kill(pid,"SIGINT")` teardown — the 0.1.1 masking security fix) is exactly where Bun's
   Node-TTY compat is most likely to diverge, and a `--help`/`--version` smoke test can't catch a
   masking regression. bspecs and b6p-cli ship as a **set** (same shared bin dir, same `INSTALL.md`
   flow, installed together), so a single toolchain + CI pattern across both repos beats maintaining
   two. The org is paying the SEA matrix cost in b6p-cli regardless; bspecs reuses that established
   pattern.
2. **Free runtime fidelity.** bspecs is already tested under Node (`test-scaffold.mjs` runs on
   node). SEA ships that exact runtime, so tested-path == shipped-path with zero behavioral risk.

Note: bspecs itself has **no** security-sensitive TTY path (its prompts are `@clack/prompts` text +
confirm — no credential masking), so the fidelity argument is weaker for bspecs *in isolation* than
for b6p-cli. The decision rides on parity + free fidelity, not on bspecs needing SEA for
correctness.

The toolchain choice + binary distribution reverses a prior ADR direction → **warrants an ADR**
(amend `npm-free-scaffolding-via-vscode-extension.md`; record the SEA/parity rationale there).

CI shape (in `publish.yml`, after the existing npm publish job): a per-OS matrix, since SEA cannot
cross-compile.

```
build-binaries:
  needs: publish            # publish gates correctness; binaries follow
  permissions: { contents: write }
  strategy:
    matrix:
      include:
        - { os: windows-latest, target: win-x64,    out: bspecs-win-x64.exe }
        - { os: macos-13,       target: macos-x64,   out: bspecs-macos-x64 }   # Intel
        - { os: macos-14,       target: macos-arm64, out: bspecs-macos-arm64 } # Apple Silicon
  steps:
    - checkout
    - setup-node (22)
    - bundle:   esbuild cli.js --bundle --platform=node --format=cjs --outfile build/bspecs.cjs
    - sea blob: node --experimental-sea-config sea-config.json
    - copy node binary, postject the blob, (codesign on macOS)
    - smoke:    run the produced binary with -v / -h
    - gh release upload "$GITHUB_REF_NAME" <out> --clobber
```

This dovetails with the open TODO item "GitHub Releases aren't created on publish" — the release
must exist before upload, so a preceding step creates it via
`gh release create "$GITHUB_REF_NAME" --generate-notes` (guarded to run once, not per matrix leg).

### Part A — the installer doc (`INSTALL.md`)

Written **for a cold Claude Code session**, imperative and literal. It instructs Claude to:

1. Detect OS/arch (`process.platform` / `uname` / `$env:OS`).
2. Resolve the latest Release asset via the GitHub API
   (`https://api.github.com/repos/Bluestep-Systems/bspecs/releases/latest`) and pick the matching
   `bspecs-*` asset.
3. Download it into the **shared BlueStep bin dir** — `%LOCALAPPDATA%\BlueStep\bin\` (Windows) or
   `~/.bluestep/bin/` (Mac) — the same dir the b6p-cli binary uses, so both co-locate.
4. Mark executable (`chmod +x` on Mac) and, on Mac, strip the quarantine attribute
   (`xattr -d com.apple.quarantine`) to dodge Gatekeeper for a locally-downloaded binary.
5. Ensure that dir is on PATH (append to the shell profile / user PATH), or fall back to invoking
   by absolute path for the immediate `bspecs init`.
6. Run `bspecs init` in the user's project.

No terminal action by the user; Claude drives it all through its own tool calls.

### Part B — the invocation profile

A scaffolded project is born into exactly one world: npm (external) or binary (internal). The
content can't straddle both, so the scaffolder picks a **profile** and renders accordingly.

- **`{{B6P}}` token** — `npx b6p` in the `npx` profile, `b6p` in the `path` profile. Substituted
  by `applyTemplate()` alongside the existing vars.
- **Profile selection** — default by how bspecs was delivered: the **binary** defaults to `path`
  (an env marker baked at build time, e.g. `BSPECS_PROFILE=path`, read by `cli.js`); **npm/node**
  defaults to `npx`. Overridable by a `--profile npx|path` flag for explicit control.
- **Consolidated invocation prose** — instead of each of the 13 files restating the npm mechanics,
  a single `b6p-invocation.md` instruction file carries the profile-specific explanation
  (`npx`: devDependency + `npm install`; `path`: binary on PATH in the shared BlueStep dir). Skills
  reference it. This both fixes the npm-prose-in-binary-world problem and reduces duplication.

## Data / control flow

**Build (Part A):** tag push → `publish.yml` → npm publish (unchanged) → create/locate GitHub
Release → `bun build --compile` per target → upload assets. External users: `npm`/`npx` as today.

**Install (Part A):** user pastes repo link into Claude → Claude reads `INSTALL.md` → detects
OS → fetches matching Release asset → places in shared bin dir → PATH → `bspecs init`.

**Scaffold (Part B):** `bspecs new`/`init` resolves the profile (binary→`path`, npm→`npx`, or
`--profile`) → `copyTemplateTree()` runs as today, with `applyTemplate()` now also substituting
`{{B6P}}` → the `path` profile additionally omits the devDependency from `package.json` and
renders `b6p-invocation.md` in its binary form. Everything else (template trees, `.template`
stripping, skip-existing, `bspecs.lock`) is unchanged.

## Edge cases

- **Mixed machine** (has npm *and* the binary). Profile is a scaffold-time choice, not runtime
  detection — whatever profile produced the project's files is what its skills use. Documented.
- **`path` profile but `b6p` not yet on PATH** (b6p-cli binary not installed). Skills fail with a
  clear "b6p not found on PATH — install it from the shared BlueStep bin dir" message routed
  through `b6p-invocation.md`, mirroring today's "run `npm install`" guidance.
- **`bspecs sync` in `path` profile** — hook already calls bare `bspecs`; works once bspecs is on
  PATH (the installer guarantees it). No change.
- **Existing scaffolded projects** are `npx`-profile and keep working; this is additive.
- **Re-running `bspecs sync` across profiles** — sync must not flip a project's profile silently.
  The profile is recorded (e.g. in `bspecs.lock`) and honored on sync.
- **arm64 macOS** — Apple Silicon is now the majority of Macs; the matrix must include it.

## Alignment with existing patterns

- **`{{VAR}}` substitution** (`utils.applyTemplate()`) — `{{B6P}}` is just another variable; no new
  mechanism.
- **No-duplication / instruction tree** (CLAUDE.md, `instruction-tree-and-claude-only.md`) —
  consolidating invocation prose into one `instructions/reference/` file that skills link to is the
  established pattern, not a new one. The dynamic `SYNC_TARGETS` walk picks up the new file
  automatically.
- **Claude-only** — `INSTALL.md` and the new instruction file are Claude-facing markdown; no
  `.github/` Copilot mirror, consistent with the repo invariant.
- **New patterns warranting an ADR:** (1) standalone-binary distribution reversing the
  VSCode-extension ADR; (2) the `bun` toolchain choice; (3) the profile concept. All folded into an
  amendment/supersession of `npm-free-scaffolding-via-vscode-extension.md` plus a short note in
  `b6p-cli-distribution.md`.

## Risks

No test suite, so verification is manual + CI smoke:

- **SEA bundling correctness** — the ESM→CJS esbuild step (dynamic `import` of `src/*.js`, the
  `readFileSync(join(__dirname,'package.json'))` version read) must resolve in the bundled/SEA
  context where `import.meta.url` and `__dirname` behave differently. Verified by running each
  produced binary in CI (`-v` must print the real version, `-h` the help) and a scratch-dir
  `bspecs init` smoke. The `package.json` read in `cli.js:10-11` is the most likely break point
  (path resolution inside a SEA) — confirm the version prints correctly, not `0.0.0`/throw.
- **Gatekeeper / SmartScreen** — unsigned binaries warn. The `INSTALL.md` quarantine-strip handles
  the common Mac case; full signing/notarization (Apple Developer ID) and Windows Authenticode are
  **out of scope** here and flagged as a possible follow-up spec. Documented limitation.
- **Profile drift on sync** — mitigated by recording the profile in `bspecs.lock` and honoring it.
- **b6p-cli binary not ready** — Part B's `path` profile is non-functional until the sibling
  binary ships. Mitigation: ship Part A first; gate Part B's default-to-`path` behind the b6p-cli
  binary's availability, or land Part B behind `--profile path` (opt-in) until then.
- **Binary size** (~50–100MB/asset) — acceptable on GitHub Releases; noted.
