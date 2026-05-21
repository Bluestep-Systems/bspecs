# ADR: How `bluestep-init` handles the `b6p` CLI dependency

**Status:** Accepted (interim). Will be revisited once `@bluestep-systems/b6p-cli` is published.

**Date:** 2026-05-21

## Context

Projects scaffolded by `bluestep-init` rely on the `b6p` CLI for the only way to sync code with the BlueStep platform. The `/b6p-pull` and `/b6p-push` Claude skills, the `require-wsl-for-b6p` hook, and the entire workflow documented in `CLAUDE.md` all assume `b6p` is available.

When this CLI was first designed, we assumed (incorrectly) that every BlueStep dev already had `b6p` installed because the project we work from is the same one used for `wsl b6p`. That assumption was Fernando's personal setup, not a team standard. Most devs use the VS Code extension `bsjs-push-pull` instead — they have never installed the CLI.

`b6p` lives at [`Bluestep-Systems/vscode-extension`](https://github.com/Bluestep-Systems/vscode-extension), in `packages/b6p-cli/`. It is a Node.js binary built with esbuild. The repository is an npm-workspaces monorepo containing three packages:

| Package | Status |
|---|---|
| `bsjs-push-pull` (VS Code extension) | Published to VS Code Marketplace |
| `@bluestep-systems/b6p-cli` | **Not published.** Only installable from source |
| `@bluestep-systems/b6p-core` | **Not published.** Internal dependency of the other two |

The monorepo's root `README.md` documents this explicitly:

> "The CLI is not yet published to npm. Until then, install from a source checkout"

and lists the install commands. The README's "Follow-ups (out of scope for the initial split)" section also says:

> "Publish `@bluestep-systems/b6p-core` and `@bluestep-systems/b6p-cli` to npm"

So publishing is recognised future work in the upstream repo — just not prioritised yet.

## Options considered

### A. Publish `b6p-cli` to a registry, declare it as a `peerDependency`

The clean long-term solution. Add `"@bluestep-systems/b6p-cli": "^0.1.0"` under `peerDependencies` in our `package.json`. npm would warn the user at install time if it's missing.

Why this is correct in the long run:
- `peerDependencies` is the right tool for "a CLI my CLI expects you to have separately installed."
- One install command works for everyone, regardless of OS.
- Versioning is explicit — we can require `^0.2.0` once the upstream stabilises.

Why we cannot do this today:
- The package is not published anywhere. Pre-condition is upstream publishing both `b6p-core` and `b6p-cli` (core is `b6p-cli`'s dependency).
- Publishing is owned by the upstream team. We need them to act, not just us.

### B. Install from GitHub directly as a git dependency

Put `"@bluestep-systems/b6p-cli": "git+ssh://git@github.com:Bluestep-Systems/vscode-extension.git"` in `dependencies`. npm would clone and build on install.

Why this fails in practice:
- `b6p-cli` lives inside a **monorepo**. `npm install` against a monorepo URL clones the entire repo and has no way to know which sub-package to install. There is no per-package URL we can target.
- The CLI requires `npm run compile` (esbuild) to be runnable. npm-on-git does not run arbitrary post-install build steps.
- Every consumer would need SSH access to the `Bluestep-Systems` org, which is the same auth requirement as Option D below but with extra fragility.

### C. Detect and guide

Our CLI does not install `b6p`. It detects whether `b6p` is reachable at scaffold time and prints the exact commands the user needs to run to install it, including a hint about the SSH access requirement.

Why this is good enough today:
- Costs us a few lines of code and zero coordination with upstream.
- The user keeps control of where the repo is cloned and what version of Node is used.
- If anything fails (SSH, npm, compile), the user sees the raw error and can react — no half-failed automatic setup.
- The instructions are a verbatim copy of the `README.md` already published upstream; no risk of drift while it stays static.

Risks:
- Users who skip the warning will get confusing failures when `/b6p-pull` tries to run a missing binary.
- We are taking on a small documentation maintenance load — if upstream changes the install steps, we need to update ours.

### D. Push upstream to publish

Open an issue in `Bluestep-Systems/vscode-extension` asking for `b6p-core` and `b6p-cli` to be published, citing our CLI as a concrete consumer. This is the **correct** long-term work and is independent of which interim option we pick.

Whether Fernando can do this himself: technically yes for the publish itself (`npm publish` inside each package), but it requires:
1. Decision on the target registry (npm public vs. GitHub Packages).
2. Membership/permissions in the `bluestep-systems` npm or GitHub org.
3. Coordination with upstream maintainers — they own the package, even if they have not prioritised publishing it.
4. Publishing `b6p-core` first, then `b6p-cli` (the latter depends on the former).
5. Ideally, a GitHub Actions workflow so future bumps don't require manual `npm publish`.

That is a 30-60 minute task once the decisions are made, but the decisions are not ours to make alone.

### E. C + D in parallel (chosen)

Implement Option C today so the flow is usable for new devs without waiting on anyone. Open the upstream issue (Option D) so the publish work is tracked where it belongs. When upstream publishes, replace Option C with Option A and remove the detect-and-guide code.

## Decision

**Adopt Option E.**

Today:
- Add a pre-flight check in `scaffold.js` (next to `checkPrettierOnPath`) that detects whether `b6p` is reachable.
- If not reachable, print the install commands from the upstream README, plus a hint about SSH access.
- Surface the same instructions in the scaffolded project's `README.md` under "Prerequisites".
- Add guidance to the `/b6p-pull` and `/b6p-push` skills so Claude detects `command not found` and points the user back at the install instructions rather than guessing.

Later, once upstream publishes:
- Replace all of the above with `peerDependencies: { "@bluestep-systems/b6p-cli": "^X.Y.Z" }`.
- Update `CHANGELOG.md` to note the breaking change for the user (no behaviour change in our CLI, but the install story shifts).

## Action items

- [ ] **Now:** Implement Option C (tracked in `TODO.md` under "Pre-flight check for b6p").
- [ ] **Now:** Open upstream issue at `Bluestep-Systems/vscode-extension` requesting publish (tracked in `TODO.md` under "Upstream issue for b6p-cli publish").
- [ ] **When upstream publishes:** Remove Option C code, add `peerDependencies` entry, version bump (likely minor).

## References

- Upstream repo: <https://github.com/Bluestep-Systems/vscode-extension>
- Upstream README's install instructions and "Follow-ups" section confirm this is recognised pending work.
- `@bluestep-systems/b6p-cli` package metadata (read from local install): `0.1.0`, MIT, depends on `@bluestep-systems/b6p-core` `^0.1.0`.
