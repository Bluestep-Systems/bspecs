# ADR: Distribute bspecs tooling as a Claude Code plugin (single delivery path)

**Status:** Accepted

**Date:** 2026-06-30

**Supersedes:** the `standalone-binary-distribution` spec (both its SEA binary and its two-delivery-
paths plan); reverses the "single-executable rejected, fold into the VSCode extension" direction of
[`npm-free-scaffolding-via-vscode-extension.md`](npm-free-scaffolding-via-vscode-extension.md).

## Context

bspecs distributed its reusable agentic tooling — skills, subagents, hooks, the on-demand
`instructions/` tree, spec-templates, and `settings.json` — by **copying a custom-templated file tree
into each project** (`copyTemplateTree` + `applyTemplate` + `bspecs sync` + `bspecs.lock`, with a
`SessionStart` hook re-syncing on every open). Two forces made this worth revisiting:

1. **The templating was barely load-bearing.** Of the whole template tree, `{{VAR}}` substitution
   appeared in only **3 files** (`templates/root/{CLAUDE.md,README.md,package.json}`). Every skill,
   agent, hook, and all ~45 instruction files were raw markdown wearing a `.template` extension and
   moving through a bespoke copy/sync engine. Other ecosystems ship such content as *raw tools through
   native channels*, not a templating layer.

2. **Claude Code now has a native distribution model that fits exactly.** **Plugins** bundle skills +
   agents + hooks + MCP under one namespace; a **marketplace** (a plain git repo with
   `.claude-plugin/marketplace.json`) distributes them with no npm and no binary; **managed settings**
   let an admin pre-register a marketplace and enforce specific plugin versions org-wide.

This also reframed the in-flight `standalone-binary-distribution` effort, whose goal was to deliver
bspecs to no-npm/no-terminal internal staff via a SEA binary. A plugin on a public git marketplace
solves that *more cleanly* (Claude Code clones the marketplace itself — no npm, no binary, no PATH
setup) and gives admin release-level control natively.

## Decision

**One delivery path: a Claude Code plugin.**

- **`bluestep-tools` plugin lives in this repo** (`plugin/`), and the repo doubles as its marketplace
  (`bluestep`, via a repo-root `.claude-plugin/marketplace.json` with `"source": "./plugin"`). One
  source of truth, no second-repo drift.
- **The plugin is canonical for all shared tooling.** `templates/claude/**` was migrated into
  `plugin/` and removed; the scaffolder no longer ships a `.claude/**` tree. The instruction tree is
  re-homed as the `bluestep-reference` skill (its `index.md` → `SKILL.md`, atomic files as bundled
  resources), preserving the on-demand-read pattern of
  [`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md).
- **The templating model is retired** down to its real scope: the 3 per-project root files, now
  bundled with and written by a new **`/bluestep-init` plugin skill** (Claude substitutes the values
  in-session). This is the single project-bootstrap path and works for everyone — including no-npm
  staff who could never run the npm CLI, and it sidesteps the interactive-prompt-hang problem.
- **The standalone SEA binary is dropped** (Part A reverted: `sea-config.json`,
  `scripts/build-binary.mjs`, `src/templates-embed.js`, `INSTALL.md`, the binary CI/build jobs, and
  the SEA version-injection). The plugin makes it redundant.
- **The npm CLI is dropped as a supported/published path** (no more `npm publish`; `publish.yml` now
  only cuts a GitHub Release on a tag). Its code (`cli.js`/`src/*`) is **left dormant** in the repo —
  a frozen, unsupported fallback that still loads (`node cli.js -v`/`-h`) but no longer produces a
  complete project. There are no real external npm users to break; the option to resurrect it is
  cheap to preserve.
- **Distribution is public.** The marketplace repo is public — consistent with the bspecs repo
  already being public and `templates/` already shipping on public npm, so it discloses nothing new,
  and it removes any git-credential requirement on staff machines. **Admin enforcement** is unchanged
  by visibility: managed settings pin the exact marketplace + plugin version
  (`extraKnownMarketplaces` + `enabledPlugins` + `strictKnownMarketplaces`), which also defends
  against lookalike marketplaces. Internal staff get the plugin at **managed scope** (auto-installed,
  enforced); external users get a project `settings.json` that pre-registers + enables it, which is a
  **one-time install confirmation** (not silent — Claude Code v2.1.195+ prompts on folder-trust).
- **b6p invocation is bare `b6p`** (the standalone b6p-cli artifact, installed separately — see the
  cross-repo note below), replacing the dropped `npx b6p` / `{{B6P}}`-profile idea.
- **Cross-IDE: portable-by-default, not supported.** Skills stay in the open `SKILL.md` standard, so
  they *can* run in Codex/Cursor/etc., but Claude Code is the only host we build, test, and
  distribute for. Distributing to other tools' formats and exposing b6p as an MCP server (the only
  fully-portable path for the b6p operations, and cross-repo regardless) are out of scope.
- **A content-sanitization gate precedes publication** — see
  [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md).

## Options considered

- **Keep the templating + scaffolder, ship a standalone binary for no-npm staff** (the
  `standalone-binary-distribution` plan) — rejected. The plugin delivers the same tooling npm-free and
  binary-free, with native versioning/enforcement, and avoids maintaining a per-OS SEA matrix
  (~75–110 MB × 3 assets) plus the binary's template-embedding and version-injection machinery.
- **Two paths (plugin + npm CLI), sharing one source tree** — rejected. Once the plugin is the
  tooling source, the CLI's only remaining job is bootstrapping 3 root files, which `/bluestep-init`
  does better and for a wider audience. Maintaining a published npm package + release pipeline for
  that sliver isn't worth it; dormant-but-kept preserves the fallback at zero ongoing cost.
- **Fold scaffolding into the `b6p-vscode` extension** (the prior ADR's preferred route) — not
  pursued. A plugin + Claude-as-installer is simpler, works outside VSCode, and needs no
  `bspecs-core` extraction.
- **Internal npm registry** (Artifactory/Nexus/Verdaccio) — already rejected in the prior ADR (it
  addresses reachability, not the arbitrary-code-execution policy).
- **Dedicated marketplace repo** (separate from this one) — rejected; re-introduces the cross-copy
  drift this refactor exists to kill.

## Consequences

- **One artifact, no drift.** The per-project copy + `bspecs sync`/`bspecs.lock`/`SessionStart`-sync
  machinery is retired; "update the tooling" becomes `/plugin marketplace update` / `autoUpdate`.
- **Native admin control** without new infrastructure (managed settings + a public git repo the org
  already controls).
- **External onboarding is one-time-confirm**, not zero-touch: add marketplace → install → run
  `/bluestep-init`. Documented in the plugin README and `/bluestep-init`.
- **The dormant CLI no longer produces a complete project.** Acceptable (frozen fallback); `templates/`
  is now empty.
- **Now-unused `esbuild`/`postject` devDeps** remain in `package.json`/lock until the lockfile is
  regenerated (deferred cleanup).
- **Cross-repo dependency:** the `/b6p-*` skills assume `b6p` on PATH (the b6p-cli standalone
  artifact). See [`b6p-cli-distribution.md`](b6p-cli-distribution.md).
- **Git history still contains the pre-sanitization content** — a separate, tracked follow-up (see
  the sanitization ADR).

## References

- Spec: `.claude/specs/plugin-distribution/{requirements,design,tasks}.md`
- Superseded: `.claude/specs/standalone-binary-distribution/` (all three files marked Superseded)
- Related ADRs: `npm-free-scaffolding-via-vscode-extension.md` (amended),
  `b6p-cli-distribution.md` (amended), `instruction-tree-and-claude-only.md`,
  `content-sanitization-for-public-tooling.md`
- Claude Code plugin docs: plugins, plugin-marketplaces, discover-plugins, settings (plugin settings).
