# ADR: One tooling repo per visibility, several plugins per repo

**Status:** Accepted (2026-11-03). Phase 1 is built in this repo; phases 2 to 5 are planned.

**Date:** 2026-11-03

**Relates to:** [`cross-tool-plugin-output.md`](cross-tool-plugin-output.md) (amended for the
per-plugin layout), [`client-data-guard.md`](client-data-guard.md) (amended: the write-time hook is
its own plugin), [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md),
[`plugin-distribution.md`](plugin-distribution.md).

## Context

BlueStep's agent tooling had grown into three repos, each shipping one plugin:

- **this repo** (`Bluestep-Systems/bspecs`, public) — `bluestep-tools`, plus the `bluestep`
  marketplace that also pointed at the other two;
- **the core-tools repo** (public) — `core-tools`, the base workflow for repos that are not
  BlueStep components;
- **the one-tools repo** — `one-tools`, the BlueStep One work, a mix of public-worthy platform
  knowledge and internal team process.

The platform team proposed folding these into one repo per visibility level, each holding several
plugins, with every mod as its own plugin entry instead of a hook bolted onto bluestep-tools. The
proposal also asked for a fresh public repo, to start without the old history.

Two facts shaped the answer. First, a fresh repo does not make the old history go away: forks of
this repo and the old npm tarballs keep their own copies. Second, a fresh repo costs a lot: every install line, the `extraKnownMarketplaces` block `/b6p-setup` wrote into every
B6P project's `.claude/settings.json`, the open issues, the `plugin-v*` tags and the links from the
issue tracker all point at this repo.

The write-time client-data hook (`phi-guard`) was also looking for a home. It shipped inside
bluestep-tools in 0.41.0, which turned it on for every install, including machines whose projects
hold no client data.

## Decisions

1. **Rename, don't rebuild.** This repo is renamed (phase 2) rather than replaced. GitHub keeps a
   redirect for git and web, so `marketplace add Bluestep-Systems/bspecs` keeps working while the
   strings are migrated. The history purge is its own optional step on the renamed repo, and it
   works the same there as on a new one.
2. **One repo per visibility, several plugins per repo.** A public repo with the `bluestep`
   marketplace, an internal one with its own marketplace. Each plugin installs on its own.
3. **Every plugin lives in `plugins/<name>/`** with its own `.claude-plugin/plugin.json`,
   `README.md` and `CHANGELOG.md`. The root `README.md` is a catalog (one row per plugin), the
   root `CHANGELOG.md` points at the per-plugin files. Each plugin has its own version stream and
   its own tags, `<name>-v<version>`; a merge to `main` tags every plugin whose version has no tag
   yet. Cross-tool output is opt-in per plugin with a top-level `"crossTool"` boolean in its
   manifest; the generator walks `plugins/*` and emits `dist/cursor/<name>/` and
   `dist/codex/<name>/` only for plugins that set it. Adding a plugin is a folder, not a repo.
4. **Names stay.** The marketplace stays `bluestep` and every plugin keeps its name. Renaming a
   plugin would break the `enabledPlugins` keys in project settings, the plugin checks in the setup
   skills and the migrations, all in the same move. Two invariants follow, and any later change to
   the layout must keep them:
   - **MCP tool names embed the plugin name**, so a plugin that ships an MCP server cannot be
     renamed without breaking every reference to its tools. Plugin names do not change.
   - **`${CLAUDE_PLUGIN_ROOT}` never crosses plugins.** A plugin reads only its own files. A file
     two plugins need exists once in each, and `npm run gen:check` fails if the copies differ by a
     byte (today: the client-data detector and the hook input helper).
5. **phi-guard is its own opt-in plugin.** Not every client handles PHI, so the write-time check
   is installed by whoever owns a machine that works on such projects, once per machine (user
   scope). It acts only inside B6P projects, and a project turns it off with
   `"enabledPlugins": { "phi-guard@bluestep": false }`. The git client-data check that
   `/b6p-setup` installs in every B6P project is not part of the plugin and stays the required
   gate. The cost is that an update to bluestep-tools 0.42.0 drops the write-time check from
   machines that had it; that loss is announced, not silent: bluestep-tools' `SessionStart` canary
   prints one line in a project that runs the git check without phi-guard installed (Claude Code),
   and `/b6p-setup` offers the install on every tool.
6. **core-tools moves in, Claude Code-only for now.** It is copied into `plugins/core-tools/` (a
   copy, not a subtree) and ships from here from 0.5.0. Its rule set lives in a `lane/` folder the
   cross-tool emitters do not carry, so on Cursor and Codex it would ship broken; it sets
   `"crossTool": false` until the emitters learn to carry extra folders.
7. **one-tools stays listed in the public marketplace until the internal one exists.** Removing
   the entry first would cut staff off from one-tools updates. It goes private as a starting
   point, not as a verdict: most of what it holds is platform knowledge that only needs the
   sanitization pass, and a later phase splits it into a public part and an internal part.
8. **Phase order.**
   1. **Multi-plugin layout in this repo** — the decisions above; ships as bluestep-tools 0.42.0,
      core-tools 0.5.0 and phi-guard 0.1.0.
   2. **Rename this repo** to the public consolidated name, archive the old core-tools repo as a
      pointer, add a `/b6p-setup` migration that rewrites each project's marketplace source, and
      delete the dormant npm CLI. Depends on 1.
   3. **The internal repo copies this layout**: one-tools moves to `plugins/one-tools/` under its
      own marketplace, with the same CI and tag scheme (no generator, Claude Code only). Depends
      on 1, not on 2. When it is live, the `one-tools` entry leaves this marketplace.
   4. **History purge** of the public repo (optional, an admin runbook), any time after 2.
   5. **Split one-tools** into a public plugin and an internal one, after 1 to 3 and a
      sanitization audit. A shared public tab-guard mod is a candidate for the same phase.

   Each phase runs in its own repo's checkout, with its own spec; nothing is orchestrated across
   repos from one session, because the hooks and generator only work inside their own repo.

## Consequences

- An installed bluestep-tools sees a version bump and a smaller hook set, nothing else: plugin
  names, skill names, MCP tool names and the install cache layout are unchanged.
- Hook paths change, so Codex users re-trust bluestep-tools' hooks and trust phi-guard's. The
  0.42.0 CHANGELOG and the release email say so.
- A machine that relied on the write-time check loses it on update until phi-guard is installed;
  the canary line and `/b6p-setup` say so in the project, and the git check still runs.
- A change to one plugin releases that plugin only. A change to the generator bumps every plugin
  with `"crossTool": true`.
- The generator, CI and the hook tests walk `plugins/*`, so a new plugin needs a folder, a manifest
  with `crossTool`, and a marketplace entry; CI fails if folder name, manifest name and entry
  name disagree.
- Two files exist twice. The byte check catches drift, but an edit has to land in both.
- core-tools is not served to Cursor or Codex until the emitters carry payload folders.

## Open admin step

Whether staff machines get `phi-guard@bluestep` enabled through the organization's managed
settings is an admin decision outside this repo. It should be made before the phase 1 merge: if
it is enabled there, staff keep the write-time check across the update; if not, each machine owner
installs it when the canary or `/b6p-setup` asks. Phase 2 has a related admin check: if managed
settings set `extraKnownMarketplaces`, they need the new repo name.

## References

- Spec: `.claude/specs/multi-plugin-layout/{requirements,design,tasks}.md` (phase 1; the design's
  "Prove-out" section records the `crossTool` test)
- Layout: `plugins/bluestep-tools/`, `plugins/core-tools/`, `plugins/phi-guard/`;
  marketplace `.claude-plugin/marketplace.json`; catalog [`README.md`](../../README.md)
- phi-guard: [`plugins/phi-guard/README.md`](../../plugins/phi-guard/README.md); canary nudge in
  `plugins/bluestep-tools/hooks/canary.sh`
- Shared copies: `SHARED_COPIES` in `tools/gen-cross-tool/lib.mjs`
- CI / release: `.github/workflows/ci.yml`, `.github/workflows/release-tag.yml`,
  `.github/workflows/publish.yml`
