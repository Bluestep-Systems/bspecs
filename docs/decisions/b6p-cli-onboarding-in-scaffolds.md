# ADR: b6p-cli onboarding in scaffolded projects — duplication & first-run auth

**Status:** Partially accepted. Concern C (first-run auth) is **implemented** (see Decision); Concern B
needs no action; Concern A stays deferred. Captures three concerns raised about how scaffolded projects
obtain and authenticate `@bluestep-systems/b6p-cli`.

**Date:** 2026-06-24

**Related:** [install-friction-and-registry.md](install-friction-and-registry.md) (npm *install* auth — the
PAT), [b6p-cli-distribution.md](b6p-cli-distribution.md), and the A5 `npx` migration
(`.claude/specs/b6p-npx-migration/`). This ADR is about **platform** auth and per-project install cost,
which are distinct from the npm-registry question.

## Context

Since A5 (0.9.0), scaffolded projects reach the `b6p` binary via `npx b6p`, resolving a **local
`devDependency`** (`node_modules/.bin/b6p`). There is deliberately no global install and no PATH/shell
detection. Two concerns about that model:

## Concern A — duplicate b6p-cli downloads (per project)

Every scaffolded project installs its own copy of `@bluestep-systems/b6p-cli` into its `node_modules`. A
developer with N BlueStep projects has N copies on disk and N installs over time.

- **This is an accepted consequence of the A5 decision**, not an oversight. Local pinning buys
  reproducibility and per-project version control; the trade is disk duplication and repeated installs.
- The deliberately-rejected alternative was a **global** `b6p` install (+ existence/version check). A5
  removed exactly that (global install, PATH detection, `b6p-env.json`) to escape cross-platform shell
  detection pain.
- Revisiting this = **reopening A5**, not a tweak. Realistic mitigations if we do: a global install with a
  version-floor check, or relying on the npm cache (which already de-dupes *downloads* across projects on
  the same machine — so the "download" cost is smaller than it looks; the *disk* duplication in each
  `node_modules` remains).

## Concern B — re-configuring credentials every scaffold

**Not an issue — credentials are global, not per-project.** `SharedFilePersistence` stores them in
`~/.b6p` (`os.homedir()/.b6p`: `state.json`, `secrets.enc`, `key`) — see
`b6p-core/src/persistence/SharedFilePersistence.ts`. `b6p auth set` is run **once per machine**; every
scaffolded project's `npx b6p` reads the same store. The scaffolded `README.md` already states this
("Set your BlueStep platform credentials **once per machine**").

## Concern C — first-run auth is under-surfaced; Claude can hang

The real, narrower gap. On a machine that has **never** run `b6p auth set`, the first `npx b6p pull`
prompts for credentials interactively. Claude Code cannot answer an interactive prompt, so the call
**hangs**. Important nuance: the `--yes` flag the skills pass guards the *confirmation* prompt, **not** the
*missing-credentials* prompt — so `--yes` does not save us here.

What exists today:
- The scaffolded `README.md` documents the one-time `b6p auth set` and even warns about the hang
  (`templates/root/README.md.template`).
- The `/b6p-pull`, `/b6p-push`, `/b6p-audit` skills mention auth **only in error-handling** ("if it looks
  like an auth issue, try `b6p auth set`"), not as a precondition.

What's missing:
- No **auth preflight** in the b6p skills (e.g. a non-interactive `b6p auth status`-style check before the
  first pull, failing fast with a clear "run `b6p auth set` first" instead of hanging).
- The auth-first instruction lives in README *prose*, not in the scaffolded `CLAUDE.md` or the skill
  preconditions — i.e. not where the agent reliably reads it before acting.

Possible fixes (to discuss): add an auth-preflight step to the b6p skills; surface the one-time
`b6p auth set` in the scaffolded `CLAUDE.md` / post-scaffold next-steps, not just the README; confirm
whether `b6p-cli` exposes a non-interactive "am I authed?" check (the command tree has `auth set` /
`auth clear` — verify there's a status/probe, or add one upstream).

## Relationship to the public-npm-publishing spec

Orthogonal in scope, but with **one doc-interaction to honor**: that spec removes the npm-registry **PAT**
and rewrites the README/CLAUDE.md to a "one command, no token" install story. The rewrite must **keep and
clearly separate** the still-required, unrelated **platform** credential step (`b6p auth set`, once per
machine) — otherwise "no setup" reads as false and Concern C gets worse. Captured as a guard in that spec's
requirements; the broader onboarding work tracked here is a follow-up, not part of it.

## Decision

**Concern C — accepted and implemented.** The `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills now run
an auth preflight before any `b6p` call: `test -f ~/.b6p/secrets.enc`. If the encrypted credential store
is absent, the skill STOPs and tells the user to run `npx b6p auth set` once, instead of hanging on the
interactive credentials prompt. File-existence is the check because the b6p CLI exposes no non-interactive
`auth status` command (only `auth set` / `auth clear`), and `BasicAuthProvider.hasCredentials()` is not
surfaced on the CLI. The one-time `auth set` step is also surfaced where the agent reads it before acting:
the scaffolded `CLAUDE.md` Sync-workflow section and a post-scaffold reminder printed by
`scaffold.js`, not only the scaffolded README prose. A non-interactive `b6p auth status` probe upstream
would let us replace the file check with a real status call — worth proposing to the monorepo team but not
required.

**Concern B — no action** (credentials are global in `~/.b6p`, not per project).

**Concern A — deferred.** Per-project `b6p-cli` duplication is an accepted A5 consequence; revisit only if
disk duplication becomes a real pain point (it would mean reopening A5, not a tweak).
