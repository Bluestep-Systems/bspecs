# ADR: Reducing install friction — registry choice and the GitHub PAT

**Status:** Proposed — awaiting a BlueStep decision on whether `bspecs` and
`@bluestep-systems/b6p-cli` may be published to the public npm registry.

**Date:** 2026-06-22

## Context

A new user installs `bspecs` from GitHub Packages (`npm.pkg.github.com`,
`access: restricted`). Before they can install, they must:

1. Create a classic GitHub PAT with `read:packages` (and authorize it for SSO if the
   `Bluestep-Systems` org enforces SSO).
2. Configure `~/.npmrc` to map the `@bluestep-systems` scope to GitHub Packages and
   reference the token.
3. `npm install -g @bluestep-systems/bspecs`.
4. After scaffolding, run `npm install` in the new project to fetch `b6p` via the
   `b6p-cli` devDependency.

The ask: collapse this to "install, then maybe `bspecs init`," and ideally drop the PAT.

## The binding constraint

**GitHub Packages requires authentication for *every* install — even public packages.**
There is no anonymous read, unlike the public npm registry (`npmjs.com`). This has two
consequences that bound every option:

- **The PAT gates the *first* step — downloading `bspecs` itself.** No `bspecs init`
  subcommand can bootstrap the auth, because the token is needed *before* any of our code
  can run. It is a chicken-and-egg.
- **"Just install `b6p` for them" hits the same gate.** `b6p-cli` is behind the same
  restricted GitHub Packages registry. Whether the scaffolder runs `npm install` or the
  user does, that download still needs the token. We cannot bundle around an auth
  requirement on our own registry.

One clarification that corrects earlier framing: the per-project `npm install` is **not a
second authentication**. The `~/.npmrc` + token configured once authorizes both the global
`bspecs` install and every per-project `b6p` install. Today's real cost is therefore:
**PAT setup (once) → `npm i -g bspecs` → per-project `npm install`.**

## Options considered

### 1. Stay private (status quo)

Keep both packages on GitHub Packages. The PAT remains mandatory for the first install.
We can still reduce *steps* (see "Independent improvements" below) but not remove the token.

### 2. Publish both to the public npm registry

Install becomes a single `npm install -g @bluestep-systems/bspecs` — no PAT, no `~/.npmrc`.
This is the **only** path that fully eliminates the token, because both the scaffolder and
the platform-sync tool must be anonymously installable. Blocker: BlueStep must agree the
code can be world-readable.

### 3. Public `bspecs`, private `b6p-cli`

Publish `bspecs` publicly (no token to get the scaffolder) but keep `b6p-cli` restricted.
The user still needs a PAT for the per-project `b6p` install — only the first hurdle drops.
This is the realistic middle ground if `b6p-cli` cannot go public but `bspecs` can.

## The question for BlueStep

One question, asked about two packages:

1. **`bspecs`** — scaffolding templates + wizard. Contains BlueStep conventions and
   instruction files; no credentials or platform internals. *Can it be world-readable?*
2. **`@bluestep-systems/b6p-cli`** — the binary that pushes/pulls code against the BlueStep
   platform. The sensitive one: *does exposing it reveal platform API surface BlueStep wants
   kept private?* It lives in the `Bluestep-Systems/vscode-extension` monorepo and is owned
   by that team, so publishing it publicly is **their** call — the bspecs repo cannot decide
   it alone (same ownership caveat the [b6p-cli-distribution ADR](b6p-cli-distribution.md)
   raised about the original publish).

If `b6p-cli` cannot go public but `bspecs` can → Option 3. If both can → Option 2.

## Independent improvements (ship regardless of the registry decision)

These reduce steps in every scenario and close off none of the three paths:

1. **Auto-run `npm install` in the scaffolded project — best-effort, with a fallback.**
   `scaffold.js` attempts the install (`installDependencies`) instead of only printing a
   reminder, and falls back to the reminder on failure. It must *not* assume the install
   succeeds: the project `.npmrc` reads the token from `${GITHUB_TOKEN}` (env-var indirection,
   per our own README), and that variable's presence in the scaffold process's environment is
   **not** guaranteed — a fresh shell/session may never have exported it (notably PowerShell on
   Windows, where a bash-rc `export` does not apply), the token may have expired since the
   global `bspecs` install, or the machine may be offline. (An earlier draft of this ADR claimed
   the token is "already configured by scaffold time"; that was wrong — only the scope *mapping*
   reliably persists in `~/.npmrc`, not the secret. The scaffolder's existing comment was
   correct.) So this removes a step in the common case without regressing the token-absent case.
2. **A `bspecs doctor` / `bspecs init` command.** Checks the Node version, writes/validates
   the `~/.npmrc` scope mapping, and tells the user exactly which PAT scope to create if the
   token is missing. It cannot mint the token (only GitHub can), but it turns "read three
   README steps" into "run one command and follow one prompt."

## Decision

Pending. Adopt one of Options 1–3 once BlueStep answers the public/private question. The two
independent improvements are not blocked by that answer and can proceed now.

## References

- [b6p-cli-distribution.md](b6p-cli-distribution.md) — the (now historical) ADR on how
  `bspecs` reaches `b6p`; establishes the GitHub Packages + restricted-access setup.
- Current install instructions: scaffolder `README.md` "Installation" section.
- GitHub Packages auth requirement:
  <https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry>
