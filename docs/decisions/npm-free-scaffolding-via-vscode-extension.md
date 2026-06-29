# ADR: npm-free delivery of bspecs scaffolding via the VSCode extension

**Status:** Proposed — leaning accept, pending the update-process conversation.

**Date:** 2026-06-25

**Decision by:** TBD. Prompted by the question: if a company forbids installing npm on
staff machines, how do we still get developers onto the BlueStep tooling?

## Context

`bspecs` is a Node CLI distributed on public npm; installing or running it (and the
`@bluestep-systems/b6p-cli` it wires into scaffolded projects) needs Node + npm + registry
access. In shops that block npm on staff machines, that whole path is unavailable.

The `b6p-vscode` extension (`bsjs-push-pull`, currently v1.2.2) is already an **npm-free
precedent** for the BlueStep toolchain, and this ADR records whether bspecs's scaffolding
could ride the same rails.

## Constraint clarification (engineer input, 2026-06-25)

The binding constraint is **not** network reachability — it is a **security policy against
arbitrary code execution / supply-chain risk**. Giving developers enough access to run
`npm install` lets arbitrary package code (install scripts + the whole transitive tree)
execute on their machine; the company will not accept that surface. This reframes the options:

- It **rejects** any internal-registry solution (Artifactory / Nexus / Verdaccio). A proxying
  registry changes only *where* packages come from — every laptop still runs `npm install` and
  still executes arbitrary code. It addresses reachability, not the policy.
- It **promotes** single-artifact distribution from fallback to primary. A pre-built artifact
  moves the arbitrary-code-execution surface from N developer laptops to **one audited
  build/release pipeline** — code executes once, where it can be reviewed. That is the real win
  (and an easier organizational conversation than blanket npm access), not "no code ever runs."
- Accepted cost: losing npm's update mechanism — we build our own. But the `b6p-vscode`
  extension **already ships one** (the `bsjs-push-pull.checkForUpdates` command, `UpdateUI.ts`,
  `core.updateService`), so that work is partly done and it tilts the artifact toward *the
  extension itself* rather than a standalone binary needing a brand-new updater.

## Findings (investigated 2026-06-25)

### The extension does not use b6p-cli at all

- `b6p-vscode/package.json` declares only `@bluestep-systems/b6p-core` (`^0.1.1`) and
  `fast-xml-parser`. No `b6p-cli` in any dependency field.
- It imports b6p-core as a **library** (`import { B6PCore } from "@bluestep-systems/b6p-core"`
  in `src/main/app/App.ts`) and instantiates it with VSCode-backed providers. There is **zero**
  `child_process`/`spawn`/`exec`/`npx` in `src/` — it never shells out to a `b6p` binary.
- esbuild bundles everything except `vscode` into a single `dist/extension.js`; `node_modules`
  is excluded from the `.vsix`. So the b6p engine ships **inside** the extension — install the
  `.vsix`, no npm needed at install or run time.

This is the key architectural pattern: **b6p-core is a shared engine with two front-ends** —
`b6p-cli` (npm-distributed) and the extension (bundled `.vsix`).

| | `b6p-cli` | VSCode extension |
|---|---|---|
| Engine | b6p-core | b6p-core |
| Distribution | npm (`npx b6p`) | `.vsix` (Marketplace / sideload / private gallery) |
| Needs npm on dev machine? | Yes | **No** |

### The extension already has every primitive bspecs scaffolding needs

- **Prompts:** `VscodePrompt` (`src/main/providers/VscodePrompt.ts`) — `inputBox()`, `confirm()`.
- **File writes:** `VscodeFileSystem` (`src/main/providers/VscodeFileSystem.ts`) — unrestricted
  `writeFile`/`createDirectory`/`exists`; workspace root via `vscode.workspace.workspaceFolders[0].uri`.
- **Shipping a static template tree:** `src/main/resources/` is copied wholesale into the
  `.vsix` by `package-extension.js`, read at runtime via `context.extensionUri`.
- **Adding a command:** ~5-step pattern (`ctrl-p-commands/<name>.ts` → `index.ts` namespace →
  `App.registerCommands()` → `contributes.commands` in `package.json`).
- bspecs's pure logic (`{{VAR}}` substitution, `.template` stripping, skip-existing,
  `bspecs.lock` writing) ports directly from `src/utils.js` / `src/scaffold.js`.

A `B6P: Set Up Project Tooling` command running the `bspecs init` (non-destructive, in-place)
flow is a small job for the happy path (~1–2 days).

## The three decisions that are the real work

The mechanical command is easy; delivering a genuinely npm-free *toolchain* (not just npm-free
file-copying) turns on three choices:

1. **Template source-of-truth.** Templates live in `bspecs/templates/`. Shipping a second copy
   in the extension invites drift. Mirror the b6p-core precedent: extract the scaffolding engine
   + templates into a shared package (e.g. `bspecs-core`) that **both** the `bspecs` CLI and the
   extension bundle. This is the clean architecture, not a copy-paste.

2. **The scaffolded *content* assumes npm — which otherwise defeats the purpose.** What bspecs
   scaffolds includes `/b6p-pull`, `/b6p-push`, `/b6p-audit` skills that shell out to `npx b6p`,
   and a `SessionStart` hook that runs `bspecs sync --silent`. All of those are dead on a
   no-npm machine. A npm-free profile of the scaffolded content must route b6p operations through
   the **extension's own commands** (backed by bundled b6p-core) instead of `npx b6p`, and let
   the extension own "sync" (re-syncing its bundled templates on activation — cleaner than the
   hook regardless).

3. **Prompt UX.** `VscodePrompt` covers text + confirm but is thinner than the CLI's
   `@clack/prompts` (`confirm()` is built on `showInformationMessage`; no input validation/cancel
   semantics). Adequate for `init`'s 2–3 questions; not the CLI's polish.

## Host and engine are already npm-free

(Corrects an earlier draft that wrongly assumed Claude Code is npm-only.) Claude Code — the host
these scaffolded skills drive — ships npm-free via the **VS Code extension** and the **Claude
desktop app (Windows / Mac)** (also JetBrains / web). Users on those channels need no
`npm install` for the host. The b6p **engine** is likewise already npm-free (bundled `b6p-core`
in the `b6p-vscode` extension). So three of the four layers are already solved:

| Layer | npm-free today? |
|---|---|
| Claude Code host | ✅ VS Code extension / desktop app |
| b6p engine | ✅ bundled `b6p-core` in the extension |
| bspecs scaffolding *delivery* | ❌ — fold into the artifact (the build work) |
| scaffolded *content* | ❌ — needs the npm-free profile (decision #2) |

The only remaining npm surface lives in the scaffolded *content*: the `/b6p-*` skills that call
`npx b6p`, the `SessionStart` → `bspecs sync` hook, and the prettier-on-save hook. All of that
is decision #2.

## Recommendation (proposed, not decided)

Worth doing; the b6p-core precedent makes it architecturally clean. Sequence:

1. Extract a shared `bspecs-core` package (engine + templates) consumed by both front-ends.
2. Add the extension command that consumes it (`B6P: Set Up Project Tooling`).
3. Produce an npm-free *profile* of the scaffolded content where b6p skills call extension
   commands instead of `npx b6p`, and the extension owns template sync.

Under the security constraint, decision #2 (the content profile) is a **hard requirement**, not
a tradeoff: without it the artifact delivers bspecs npm-free but its *output* still demands
`npm install` downstream (the `b6p-cli` devDependency, the `npx b6p` skills, the `bspecs sync`
hook) — merely relocating the forbidden step one directory away. The single artifact only pays
off paired with the npm-free content profile.

## Alternatives

- **Single-executable build** of bspecs (Node SEA / `pkg` + esbuild) — a standalone binary, no
  Node or npm on the target. Viable, but largely redundant with folding into the extension,
  which already bundles the engine and ships an updater. Prefer the extension unless a
  non-VSCode delivery channel is specifically needed.
- **Internal npm registry** (Artifactory / Nexus / Verdaccio) — **rejected under the security
  constraint above.** It solves a blocked-*network* problem, not an arbitrary-code-execution
  *policy*: developers still run `npm install`. Recorded only to document why it does not apply
  here (and contrast with the registry discussion in `install-friction-and-registry.md`, which
  was about install *friction*, a different problem).

See also `docs/decisions/b6p-cli-distribution.md` and
`docs/decisions/install-friction-and-registry.md`.
