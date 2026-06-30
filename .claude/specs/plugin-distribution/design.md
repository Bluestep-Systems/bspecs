# Design — plugin-distribution

**Status:** Drafting

The migration has a natural ordering: **sanitize first** (closes the live exposure on the current
tree), **then restructure** the clean content into a plugin, **then shrink** the scaffolder and
retire the sync machinery, **then revert** Part A and write docs/ADRs. Each is its own phase.

## Decisions on the four load-bearing questions

1. **Repo topology — plugin lives in *this* repo; the repo doubles as the marketplace.** A
   `plugin/` subdirectory holds the plugin (`plugin/.claude-plugin/plugin.json` + `skills/`,
   `agents/`, `hooks/`, etc.); `.claude-plugin/marketplace.json` at the repo root lists it. One repo,
   one source of truth, no second-repo drift, and it's already public. (A dedicated marketplace repo
   is rejected — it re-introduces the cross-copy drift this refactor exists to kill.)
2. **Single source of truth — the plugin is canonical for the shared tooling.**
   `templates/claude/**` is *migrated into* the plugin and removed as a scaffolder source. The
   scaffolder stops copying the `.claude/**` tree entirely; the plugin delivers it natively.
3. **Per-project bootstrap — one path, a `/bluestep-init` plugin skill.** Claude writes the
   per-project files + a plugin-enabling `.claude/settings.json` and guides `git init`, in-session,
   for *everyone* (incl. no-npm staff who can't run the npm CLI). The npm CLI/scaffolder
   (`cli.js`/`src/*`) is **dropped as a path and left dormant** in the repo (unpublished,
   unsupported) — not shrunk into a new role, not deleted. This sidesteps the clack-prompt-hang the
   binary spec punted on and retires the scaffolder-maintenance surface.
4. **Sync machinery — retired.** `bspecs sync`, `bspecs.lock`'s file map, `enumerateClaudeTargets`,
   `SYNC_TARGETS`, and the `SessionStart` sync hook are removed; native marketplace update
   (`/plugin marketplace update` / `autoUpdate`) replaces them.

## Files / areas affected

### New (the plugin)
- `plugin/.claude-plugin/plugin.json` — manifest (name `bluestep-tools`, description, version).
- `.claude-plugin/marketplace.json` — repo-root marketplace listing the plugin.
- `plugin/skills/**` — the current `templates/claude/skills/**` (b6p-pull/push/audit, spec-*,
  bug-fix, task-comment, bspecs-feedback), raw (no `.template`), namespaced `/bluestep-tools:<name>`.
- `plugin/agents/**` — the three subagents.
- `plugin/hooks/hooks.json` + `plugin/hooks/*.sh` — block-generated-files, block-tsc,
  prettier-on-save, referenced via `${CLAUDE_PLUGIN_ROOT}` (placeholder valid in hooks).
- `plugin/skills/bluestep-reference/` — **the instructions tree, re-homed as a skill** (see
  Approach). `SKILL.md` = today's `index.md`; the `reference/`/`conventions/`/`gotchas/` files
  become the skill's bundled resources.

### Changed (the scaffolder shrinks)
- `src/scaffold.js` — drop `copyTemplateTree('claude', …)` and `copyTemplateTree('module', …)`; drop
  `writeBspecsLock`. `scaffold`/`init` now write only `templates/root/**` + a plugin-enabling
  `.claude/settings.json`. `installDependencies`/`printAuthReminder` revisited (npm-world only).
- `src/sync.js` — **removed** (or reduced to a deprecation notice for old projects; see Edge cases).
- `cli.js` — `sync` verb deprecated; `init`/`new` outros updated (plugin enablement, not `npm install`).
- `src/utils.js` — `enumerateClaudeTargets`/`walkClaude` removed (only sync used them).
- `templates/claude/**` — **migrated out** to `plugin/**`, then deleted.
- `templates/claude/settings.json.template` → a much smaller project `settings.json`: permissions +
  `extraKnownMarketplaces` + `enabledPlugins`; **hooks and the SessionStart sync block removed**
  (hooks are now plugin-provided).
- `templates/module/**` — folded into the plugin (the `b6p-commenter` agent bundles its README
  template); removed from the scaffolder.

### Reverted (Part A supersession)
- `cli.js` (version read), `src/version.js`, `src/templates-embed.js`, `sea-config.json`,
  `scripts/build-binary.mjs`, `INSTALL.md`, the `build-binaries` job in `.github/workflows/publish.yml`,
  the binary smoke in `.github/workflows/ci.yml` — all reverted. **Keep** the `gh release create`
  step in `publish.yml`. `src/utils.js`/`scaffold.js` embed-fallback code reverted.

### Docs
- `docs/decisions/plugin-distribution.md` (new ADR), `docs/decisions/content-sanitization-for-public-tooling.md`
  (new ADR, category-level), amendments to `npm-free-scaffolding-via-vscode-extension.md` and
  `b6p-cli-distribution.md`; `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`; mark
  `standalone-binary-distribution` Superseded.

## Approach

**The plugin layout already exists.** `templates/claude/` is structurally a plugin minus the
manifest: `skills/<name>/SKILL.md`, `agents/<name>.md`, loose hook scripts. Migration is mostly a
move + add `plugin.json` + strip `.template`. Because the claude tree carries **zero `{{VAR}}`
tokens**, "plugins are verbatim" costs nothing here.

**Instructions are the one non-trivial mapping.** The `instructions/` tree is a *bspecs* invention
(on-demand `index.md` → atomic files), not a Claude Code primitive, and `${CLAUDE_PLUGIN_ROOT}` is
**not** available inside `SKILL.md`. Resolve by re-homing the tree as a **plugin skill**
(`bluestep-reference`): its `SKILL.md` is the former `index.md` and the atomic files are bundled in
the skill directory, which Claude resolves relatively. The on-demand-read pattern (the
`instruction-tree-and-claude-only.md` ADR) is preserved; only the entry point moves from
`.claude/instructions/index.md` to a skill. Skills that currently link to `instructions/...` are
repointed to the bundled paths.

**b6p invocation (replaces the dropped `{{B6P}}` profile).** Plugin content is shared by all users
and can't be profile-substituted, so skills call **bare `b6p`**. This is now safe to assume:
b6p-cli is being delivered as its **own standalone artifact** that users install first
([Bluestep-Systems/b6p-cli#3](https://github.com/Bluestep-Systems/b6p-cli/pull/3)) — so `b6p` is on
PATH independently of bspecs, with no npm and no plugin `bin/` needed. The `npx b6p` fallback is
dropped. Optional hardening: a lightweight **PATH-validation check** (a skill preamble or a hook)
that, when `b6p` is not resolvable, prints a clear "install the b6p binary from its release" message
instead of a raw command-not-found — nice-to-have, not blocking.

**The scaffolder becomes a per-project bootstrapper.** It no longer ships tooling — it writes the 3
root files (`CLAUDE.md`, `README`, `package.json`), `.gitignore`/`.prettierrc`, and a project
`.claude/settings.json` that registers the public marketplace and enables `bluestep-tools`. `git
init` stays. For no-npm users the `/bluestep-init` plugin skill does the same writes in-session.

## Data / control flow

**Install (internal):** managed settings install the plugin at **managed scope** + pre-register the
marketplace → plugin is present and enforced on every staff session, no npm, no git creds (public
repo), **no user action**. **Install (external):** `bspecs init` writes a project `settings.json`
with `extraKnownMarketplaces` + `enabledPlugins` → this **pre-registers + enables but does not
silently auto-install** (Claude Code v2.1.195+): on folder-trust Claude Code **prompts** the user to
install, and until then reports the plugin not-installed with the `claude plugin install
bluestep-tools@bluestep` command. So the external path is **one-time confirm, not zero-touch** — the
`bspecs init` outro and the README MUST surface this install step (tasks 11/12/18) rather than
implying skills appear automatically. **Update:** `autoUpdate` / `/plugin marketplace update` — no
`bspecs sync`.

**Scaffold:** `bspecs new` → write `templates/root/**` (still `{{VAR}}`-substituted via
`applyTemplate`) + plugin-enabling `settings.json` + `git init`. No `.claude/**` tree, no lock.

**Tooling at runtime:** skills/agents/hooks come from the enabled plugin (namespaced); hooks fire via
`hooks.json`; `bluestep-reference` skill serves the instruction tree on demand.

## Edge cases

- **Existing scaffolded projects** carry a copied `.claude/**` tree, a `bspecs.lock`, and a
  `SessionStart → bspecs sync` hook. Their bare `/skill` names take precedence over the plugin's
  `/bluestep-tools:skill`, so they keep working untouched. `bspecs sync` is made a **no-op +
  one-time migration notice** (delete the copied tree, enable the plugin) rather than removed
  outright, so the old hook doesn't error. Auto-removal of old trees is out of scope (per
  requirements).
- **Plugin not yet enabled when `/bluestep-init` is wanted** — managed settings guarantee enablement
  internally; externally the scaffolded `settings.json` enables it. Chicken-and-egg only if neither
  ran — documented.
- **`b6p` not on PATH** — the user hasn't installed the b6p-cli artifact yet. The optional
  PATH-validation check surfaces a clear install message; b6p's own install docs own the rest
  (cross-repo).
- **Two `.claude-plugin/` manifest shapes** (plugin vs marketplace) — confirm exact `source` field
  for an in-repo plugin against the plugin docs in the first task.

## Alignment with existing patterns

- **No-duplication / single source of truth** (`instruction-tree-and-claude-only.md`) — *strengthened*:
  the plugin is the one canonical copy; the per-project copy + sync-to-keep-in-step machinery is
  retired, which is what that ADR was working around.
- **Claude-only** — preserved; no `.github/` mirror. Skills stay in the open `SKILL.md` format
  (portable-by-default per requirements), Claude Code the only built/tested host.
- **`{{VAR}}` substitution** — still used, but now *only* for `templates/root/**` (its true scope).
- **New patterns → ADRs:** plugin-over-binary + templating-model change + marketplace/enforcement +
  supersession (ADR 1); content-sanitization-for-public-tooling rationale + audit-before-publish
  gate (ADR 2, category-level). Both warranted.

## Risks

No test suite — verify manually + CI smoke:
- **Plugin loads and skills/agents/hooks fire** — install from the in-repo marketplace into a
  scratch project; confirm `/bluestep-tools:*` skills appear, hooks run, `bluestep-reference` serves
  the instruction files. Highest-risk: the instructions-as-skill remap and hook `${CLAUDE_PLUGIN_ROOT}`
  paths.
- **Scaffolder still produces a valid project** after the shrink — `node cli.js new` into a scratch
  dir renders root files + a settings.json that enables the plugin; no `.claude/**` tree, no lock.
- **Sanitization completeness** — the gitignored-token grep returns clean across the migrated plugin
  tree before the marketplace is published.
- **Old-project regression** — a pre-migration project still opens without the `bspecs sync` hook
  erroring (no-op notice path).
- **Part A revert leaves no dead refs** — `getVersion()` callers, `templates-embed` imports, workflow
  jobs all cleaned; `node cli.js -v`/`-h` still work.
- **b6p not installed** — skills assume `b6p` on PATH (b6p-cli standalone artifact). Mitigated by the
  optional PATH-validation check; b6p's own install flow is the cross-repo dependency.
