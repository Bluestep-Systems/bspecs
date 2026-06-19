# Requirements — b6p `npx` migration + shell-detection removal (A5)

**Status:** Drafting

## Context

The "A5 fast-follow" from Track A (the `publish-chain` spec). Now that
`@bluestep-systems/b6p-cli@0.1.0` is published and `@bluestep-systems/bspecs@0.8.0` depends on it,
the disposable shell-detection scaffolding can be removed and skills can invoke `b6p` the standard
Node way. See the ADR [b6p-cli-distribution.md](../../../docs/decisions/b6p-cli-distribution.md)
("Cleanup once b6p-cli is published") and the findings recorded in
[publish-chain/tasks.md](../publish-chain/tasks.md) (tasks 3 & 12).

**What the publish-chain spec proved (the data this spec must design against):**

1. **A dependency's bin is NOT placed on the global PATH.** `npm i -g @bluestep-systems/bspecs`
   downloads `b6p-cli` into bspecs' own tree but leaves `b6p` at
   `…/bspecs/node_modules/.bin/b6p` — *not* globally reachable. So depending on `b6p-cli` from
   **bspecs** does not, by itself, give a scaffolded project a usable `b6p`. The fix is to make each
   **scaffolded project** depend on `b6p-cli` and invoke it with `npx b6p`, which resolves
   `node_modules/.bin/` cross-platform with no shells or PATH involved.
2. **The current dev env has a PATH mess** the workaround can't reconcile: a stale `npm link` of
   `b6p@0.0.1` on the interactive PATH, a `prefix`-based global dir that diverges from nvm's, and an
   npm warning that `~/.npmrc`'s `prefix` is incompatible with nvm. `npx b6p` sidesteps all of it.

**Disposable scaffolding to remove** (per the ADR): the shell-prefix detection in `src/scaffold.js`
(`detectEnvironmentFor`, `probeCommand`, `shellPrefixCandidates`), the persisted
`.claude/b6p-env.json`, the `/b6p-detect` skill, the `require-wsl-for-b6p` hook regex, and the
"shellPrefix"/"install b6p" prose in `/b6p-pull`, `/b6p-push`, `/b6p-audit`, `CLAUDE.md`, and the
scaffolded `README`.

## Goals

- As a builder, after `bspecs` scaffolds my project, I want the `b6p` skills to just work — no
  manual b6p install, no shell/PATH detection — so I can `/b6p-pull` and `/b6p-push` immediately.
- As the bspecs maintainer, I want to delete the ~200 lines of shell-detection workaround now that
  it's obsolete, so the codebase reflects the intended design (the standard Node CLI distribution),
  not a historical workaround.
- As a builder on Windows+WSL or nvm, I want `b6p` invoked in a way that doesn't depend on which
  shell or global prefix I use.

## Acceptance criteria

- [ ] Scaffolded projects declare `@bluestep-systems/b6p-cli` (pinned to the published range) as a
      **devDependency** in the project's `package.json`, and the scaffolder installs it (or clearly
      instructs the user to run `npm install`).
- [ ] The `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills invoke b6p as **`npx b6p …`** (resolving
      the project's `node_modules/.bin/b6p`), with no `shellPrefix` / `wsl <shell> -lc` prose.
- [ ] `src/scaffold.js` no longer contains `detectEnvironmentFor`, `probeCommand`, or
      `shellPrefixCandidates`; nothing writes `.claude/b6p-env.json`.
- [ ] The `/b6p-detect` skill is removed (`templates/claude/skills/b6p-detect/`), and no doc/skill
      references it.
- [ ] The `require-wsl-for-b6p` hook is removed or reduced (decide: does `npx b6p` still need a
      WSL guard at all?), and `settings.json.template` is updated to match.
- [ ] All "install the b6p CLI" / shell-prefix prose is gone from `templates/root/CLAUDE.md.template`,
      `templates/root/README.md.template`, and `templates/claude/instructions/b6p-platform.md.template`.
- [ ] A fresh `node cli.js` scaffold produces a project where a b6p skill runs end-to-end via
      `npx b6p` (verified manually).
- [ ] `bspecs sync` continues to work — the removed `b6p-detect` skill drops out of the dynamic
      `SYNC_TARGETS` automatically; confirm `.claude/b6p-env.json` (a scaffold-once file) is handled.
- [ ] Version bump + CHANGELOG `### Removed` section; ADR status moved to fully superseded; this
      repo's `CLAUDE.md` "key behaviors" updated (the b6p-detection paragraph is now obsolete).

## Out of scope

- Anything already shipped in Track A (publishing, rename, repo move).
- The upstream `b6p --version` = `0.0.1` bug (tracked separately; not blocking).
- Publishing `b6p-core`.
- Reworking unrelated skills/hooks.

## Open questions

- **WSL guard:** with `npx b6p`, is the `require-wsl-for-b6p` hook still needed at all? `npx` is
  cross-platform; if b6p itself only needs WSL for WebDAV/network reasons on this user's setup, the
  guard may be vestigial. Decide: delete entirely vs. keep a minimal version.
- **Does the scaffolded project already have a `package.json`?** If not, A5 must add one (or a
  minimal one) to host the `b6p-cli` devDependency — confirm current scaffold output.
- **Install timing:** should the scaffolder run `npm install` automatically (slower scaffold, needs
  the consumer's `~/.npmrc`/PAT at scaffold time) or print a one-line "run `npm install`" step?
  Auto-install needs registry auth during scaffold — that may be a poor first-run experience.
- **Version range for the project devDependency:** pin `^0.1.0` (matches bspecs' own dep) — revisit
  once b6p-cli has more releases.
