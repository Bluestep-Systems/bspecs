# Requirements — standalone-binary-distribution

**Status:** Superseded — see [`plugin-distribution`](../plugin-distribution/). The standalone SEA
binary and the two-delivery-paths plan are dropped in favor of a single Claude Code plugin; Part A's
committed code was reverted there and Part B (the `{{B6P}}` profile) was never started.

## Context

bspecs is distributed only on public npm; installing or running it needs Node + npm +
registry access. Internal staff machines have a **security policy against arbitrary code
execution** — `npm install` runs arbitrary install scripts and a full transitive tree, so the
whole npm path is unavailable to them. Most of these users also **do not use a terminal** and
may have **no Node installed at all**, on **both Windows and Mac**.

The team's chosen delivery model: staff open a **Claude Code** session, give it the repo link,
and Claude figures out how to install the tooling on their machine — no terminal, no npm, no
manual steps. Admin control is exercised at the **GitHub Release level** (publishing a Release
approves a version; yanking it pulls the version). Machine-level policy enforcement is **not**
required (no MDM today).

This **keeps the public npm release unchanged** for external users — the standalone binary is an
*additional* delivery artifact built from the same source, not a replacement.

### Relationship to existing decisions

- [`docs/decisions/npm-free-scaffolding-via-vscode-extension.md`](../../../docs/decisions/npm-free-scaffolding-via-vscode-extension.md)
  lists "Single-executable build" as an **Alternative it rejected**, preferring to fold
  scaffolding into the VSCode extension. This spec **reverses that** for the Claude-Code-host
  case: a standalone binary + Claude-as-installer is simpler than the `bspecs-core` extraction +
  extension command, and works outside VSCode. The design phase MUST produce an ADR
  amendment/supersession recording the reversal and its rationale.
- TODO item "npm-free delivery via the VSCode extension (explore)" ([TODO.md:17](../../../TODO.md))
  covers the same problem space.
- The "scaffolded content still assumes npm" problem (the `/b6p-pull|push|audit` skills call
  `npx b6p`; the `SessionStart` hook runs `bspecs sync`) is resolved here by a different route
  than the ADR's "reroute through extension commands": ship **`b6p-cli` as its own standalone
  binary too** (we own that repo) so scaffolded skills call a bare `b6p` on PATH and the hook
  calls a bare `bspecs`. See Out of scope for the repo boundary.

## Goals

- As an **internal developer with no Node/npm and no terminal habit**, I want to paste the bspecs
  repo link into a Claude Code session and have it install the tooling on my machine (Windows or
  Mac), so that I can use bspecs without violating the no-arbitrary-code-execution policy.
- As an **admin**, I want to control which bspecs versions staff can install by publishing/yanking
  GitHub Releases, so that distribution is gated without standing up new infrastructure.
- As an **external user**, I want the public npm package to keep working exactly as today, so that
  nothing about the internal change affects me.
- As a **maintainer**, I want the binary built automatically by CI from the same source on every
  release, so that npm and binary artifacts never drift and there is no hand-publish step.
- As an **internal developer**, I want the tooling that bspecs *scaffolds* (the `/b6p-*` skills,
  the sync mechanism) to also work with no npm on my machine, so that installing bspecs npm-free
  doesn't just relocate the forbidden `npm install` one directory downstream.

## Acceptance criteria

- [ ] On a tagged release, CI builds standalone bspecs binaries for **Windows (x64)** and
      **macOS** (at minimum x64; arm64 if the toolchain supports it) and **attaches them to the
      GitHub Release**, alongside the existing `npm publish` step.
- [ ] The binary runs `bspecs new`, `bspecs init`, and `bspecs sync` with **no Node and no npm**
      installed on the target machine, on both Windows and Mac.
- [ ] The public npm package (`@bluestep-systems/bspecs`) is published unchanged — same name,
      same `bin`, same `files`, same external-user UX.
- [ ] The repo contains an **installer-facing document** (e.g. `INSTALL.md`) that a cold Claude
      Code session can follow with no prior context to: detect the OS, fetch the correct binary
      from the latest GitHub Release, place it in a **single shared BlueStep bin directory**
      (`%LOCALAPPDATA%\BlueStep\bin\` on Windows, `~/.bluestep/bin/` on Mac) that holds both the
      `bspecs` and `b6p` binaries, ensure that one directory is on PATH, and run `bspecs init` in
      the user's project — without requiring the user to touch a terminal. The shared-dir
      convention MUST match the b6p-cli spec so both binaries co-locate.
- [ ] Scaffolded content no longer hard-requires npm on the end-user machine: the `/b6p-*` skills
      invoke a bare `b6p` (resolved from PATH) instead of `npx b6p`, and the sync mechanism does
      not depend on `npx`. (Gated on the b6p-cli binary existing — see Out of scope / Open
      questions.)
- [ ] The `npm-free-scaffolding-via-vscode-extension.md` ADR is amended or superseded to record
      that the standalone-binary + Claude-installer route is now the chosen path for the
      Claude-Code host, with rationale.
- [ ] `CHANGELOG.md`, `TODO.md`, and the relevant ADR(s) are updated in sync with the change.

## Out of scope

- **The `b6p-cli` standalone binary build itself.** `b6p-cli` lives in a separate repo (also
  owned by the team). Producing its binary is a **parallel, tracked dependency** — this spec
  changes the *bspecs* side (scaffolded skills call bare `b6p`; installer places the b6p binary)
  but does not implement the b6p-cli CI build. The scaffolded-content acceptance criterion is
  gated on that binary existing.
- **Machine-level / per-user install enforcement** (MDM, Intune, winget/choco private feeds).
  Control is release-level only.
- **The VSCode-extension scaffolding path** from the prior ADR. Not pursued here; the ADR
  amendment records why.
- **Removing or changing the npm package** — it stays exactly as-is.
- **Claude-driven (non-interactive) scaffolding.** This spec covers *installing* the CLI from the
  binary (mechanical, no prompts) — not having Claude *run* the scaffolder for the user. `bspecs
  new`/`init` use interactive clack prompts that Claude cannot answer mid-execution (it would
  hang). A human running them in a terminal works as designed. If we later want Claude to scaffold
  on behalf of non-terminal users, that needs a non-interactive flag mode
  (`bspecs new --name … --client … --yes`) — a separate follow-up (track in `TODO.md` / its own
  spec), deliberately out of scope here.

## Open questions

- **b6p-cli binary timing.** Can the b6p-cli binary land before or alongside this work, or does
  the scaffolded-content change ship gated/behind a flag until it exists? (Determines whether the
  content criterion is in this spec's first release or a follow-up.)
- **Binary build toolchain.** Node SEA vs `bun build --compile` vs `pkg`/`nexe` — decided in the
  design phase (per the wizard answer). Affects ESM handling, arm64 macOS coverage, and CI cost.
- **macOS Gatekeeper / code signing.** Unsigned binaries trigger Gatekeeper warnings on Mac and
  SmartScreen on Windows. Does Claude-as-installer's placement avoid the worst of this (e.g. via
  quarantine-attribute removal), or do we need signing/notarization? (Could be a separate spec.)
- **Binary size / per-release artifact count.** Each platform binary bundles Node (~50–100MB).
  Acceptable on GitHub Releases; note for awareness.
- **Where the installer doc lives** — root `INSTALL.md` vs a section in `CLAUDE.md`. Leaning a
  dedicated `INSTALL.md` so it reads cleanly to a cold session.
