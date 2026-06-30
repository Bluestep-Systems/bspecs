# Tasks — plugin-distribution

**Status:** Drafting

Phased per the design: **sanitize → build the plugin → shrink the scaffolder → revert Part A →
docs/ADRs.** Each task is one `/spec-execute`. The concrete sensitive file list + grep token set
referenced by Phase 0 live in the gitignored `sanitization-tokens.local.md` (never committed).

## Phase 0 — Content sanitization (gating; must land before the marketplace is public)

- [x] **1.** [CODE] Remove/relocate the 4 high business-content instruction files (the 2 pure-IP
  product files + the 2 dashboard files; relocate the pure-IP pair to a private store, redact the
  dashboards to a generic pattern), and drop their entries from the index + platform overview. —
  files: the 4 files under `templates/claude/instructions/reference|conventions/` named in
  `sanitization-tokens.local.md`, `templates/claude/instructions/index.md.template`,
  `templates/claude/instructions/b6p-platform.md.template`.
- [x] **2.** [CODE] Redact-in-place the ~14 provenance/business-framed files — strip the employee
  name, `<org>/<fileID>` provenance tails, internal endpoint paths, and clinical/business framing,
  keeping the generic platform technique each file teaches. — files: the ~14 files listed in
  `sanitization-tokens.local.md` (reference/ + conventions/).
- [x] **3.** [CODE] Verify sanitization: a repo-wide grep of the token set over `templates/` returns
  clean; reconcile `index.md.template` entries with the redacted/removed files. (Do **not** delete
  `sanitization-tokens.local.md` yet — final cleanup is task 18.) — files: `templates/**`
  (verification), `templates/claude/instructions/index.md.template`.

## Phase 1 — Build the plugin

- [ ] **4.** [CODE] Create the plugin + marketplace skeleton: `plugin/.claude-plugin/plugin.json`
  (name `bluestep-tools`) and a repo-root `.claude-plugin/marketplace.json` listing it; confirm the
  exact in-repo `source` field against the plugin docs. Optionally add a manifest JSON-validity check
  to `ci.yml`. — files: new `plugin/.claude-plugin/plugin.json`, new `.claude-plugin/marketplace.json`,
  (optional) `.github/workflows/ci.yml`.
- [ ] **5.** [CODE] Migrate skills to `plugin/skills/**`; switch `b6p-pull`/`b6p-push`/`b6p-audit`
  to bare `b6p` (drop `npx b6p`) and update each skill's `allowed-tools` frontmatter accordingly. —
  files: `templates/claude/skills/**` → `plugin/skills/**`.
- [ ] **6.** [CODE] Migrate the three agents to `plugin/agents/**`; bundle the per-component README
  template (`templates/module/**`) with the `b6p-commenter` agent so it no longer needs the
  scaffolder. — files: `templates/claude/agents/**` → `plugin/agents/**`, `templates/module/**`.
- [ ] **7.** [CODE] Migrate hooks to `plugin/hooks/hooks.json` + the three scripts, referencing them
  via `${CLAUDE_PLUGIN_ROOT}`. — files: `templates/claude/hooks/*.sh` → `plugin/hooks/`, new
  `plugin/hooks/hooks.json`.
- [ ] **8.** [CODE] Re-home the instructions tree as the `bluestep-reference` skill: `SKILL.md` from
  the current `index.md`, with `reference/`/`conventions/`/`gotchas/` and the two Tier-2 overviews
  (`b6p-platform.md`, `bsjs-development.md`) as bundled resources; repoint every skill/agent that
  links to `instructions/...` at the new bundled paths. — files: `templates/claude/instructions/**`
  → `plugin/skills/bluestep-reference/**`, plus the skills/agents that reference instruction files.
- [ ] **9.** [CODE] *(optional)* Add a b6p PATH-validation check (skill preamble or a hook) that
  prints a clear "install the b6p binary from its release" message when `b6p` is not resolvable. —
  files: `plugin/skills/...` or `plugin/hooks/`.

## Phase 2 — Shrink the scaffolder + retire sync

- [ ] **10.** [CODE] Retire sync: neutralize `src/sync.js` to a no-op + one-time migration notice
  (so the old `SessionStart` hook in pre-migration projects never errors), remove
  `enumerateClaudeTargets`/`walkClaude` from `src/utils.js`, drop `writeBspecsLock` + `SYNC_TARGETS`
  use from `src/scaffold.js`, and deprecate the `sync` verb in `cli.js`. — files: `src/sync.js`,
  `src/utils.js`, `src/scaffold.js`, `cli.js`.
- [ ] **11.** [CODE] Shrink `scaffold`/`init`: drop `copyTemplateTree('claude', …)` and
  `copyTemplateTree('module', …)`; write only the root files + the plugin-enabling
  `.claude/settings.json`; update the `cli.js` outros (no `bspecs sync`; b6p is a standalone artifact,
  not `npm install`). — files: `src/scaffold.js`, `cli.js`.
- [ ] **12.** [CODE] New project `settings.json`: permissions + `extraKnownMarketplaces` +
  `enabledPlugins`, with **no** hooks block and **no** `SessionStart` sync (hooks are now
  plugin-provided). Delete the old synced template. — files: new
  `templates/root/.claude/settings.json.template`, delete `templates/claude/settings.json.template`.
- [ ] **13.** [CODE] Drop the `@bluestep-systems/b6p-cli` devDependency + the `"b6p"` script from
  `package.json.template` and the now-unused `Bash(npx:*)`/`Bash(npm:*)`-for-b6p permissions — b6p is
  a standalone artifact now, not an npm dep. — files: `templates/root/package.json.template`.

## Phase 3 — Part A revert + supersession

- [ ] **14.** [CODE] Revert the Part A SEA binary machinery: simplify `src/version.js` back to a
  plain on-disk `package.json` read (keep `getVersion()` as the shared accessor its callers use),
  remove `src/templates-embed.js` and its fallbacks in `src/utils.js`/`src/scaffold.js`, delete
  `sea-config.json` / `scripts/build-binary.mjs` / `INSTALL.md`, and remove the `build-binaries` job
  from `publish.yml` and the binary smoke from `ci.yml`. **Keep** the `gh release create` step in
  `publish.yml`. Confirm `node cli.js -v`/`-h` still work. — files: `src/version.js`,
  `src/templates-embed.js`, `src/utils.js`, `src/scaffold.js`, `sea-config.json`,
  `scripts/build-binary.mjs`, `INSTALL.md`, `.github/workflows/publish.yml`, `.github/workflows/ci.yml`.
- [ ] **15.** [CODE] Mark `standalone-binary-distribution` **Superseded** (Status line + a pointer to
  this spec) across its three files. — files: `.claude/specs/standalone-binary-distribution/{requirements,design,tasks}.md`.

## Phase 4 — Docs & ADRs

- [ ] **16.** [CODE] ADR `docs/decisions/plugin-distribution.md` — plugin-over-binary, the
  templating-model change (templating shrinks to `templates/root/**`), public marketplace +
  managed-settings enforcement, cross-IDE portable-by-default, and the supersession; amend
  `npm-free-scaffolding-via-vscode-extension.md` and `b6p-cli-distribution.md` to cross-reference. —
  files: new `docs/decisions/plugin-distribution.md`, `docs/decisions/npm-free-scaffolding-via-vscode-extension.md`,
  `docs/decisions/b6p-cli-distribution.md`.
- [ ] **17.** [CODE] ADR `docs/decisions/content-sanitization-for-public-tooling.md` — **category-level
  only** (no literal names/IDs): why customer-derived working-memory does not belong in publicly
  distributed tooling, and the audit-before-publish gate that now governs it. — files: new
  `docs/decisions/content-sanitization-for-public-tooling.md`.
- [ ] **18.** [CODE] Sync the working docs + final cleanup: update `CLAUDE.md` (plugin model,
  shrunken scaffolder, no sync, the two ADRs), the root `README.md` + `templates/root/README.md.template`
  (fix the stale `GITHUB_TOKEN`/`~/.npmrc` install doc), `TODO.md` (tick the npm-free item #17;
  reconcile the GitHub-Releases item), and add a `CHANGELOG.md` entry; then **delete
  `sanitization-tokens.local.md`** once task 3's grep is confirmed clean. — files: `CLAUDE.md`,
  `README.md`, `templates/root/README.md.template`, `TODO.md`, `CHANGELOG.md`,
  `.claude/specs/plugin-distribution/sanitization-tokens.local.md`.

## Verification

No test suite — confirm manually + via CI smoke:

- **Phase 0:** repo-wide grep of the token set over `templates/` returns clean before any publish.
- **Plugin:** install `bluestep-tools` from the in-repo marketplace into a scratch project →
  `/bluestep-tools:*` skills appear, the three hooks fire on Edit/Write/Bash, and the
  `bluestep-reference` skill serves instruction files on demand. (Highest-risk: the
  instructions-as-skill remap in task 8 and the `${CLAUDE_PLUGIN_ROOT}` hook paths in task 7.)
- **Scaffolder:** `node cli.js new` into a scratch dir → root files + a `.claude/settings.json` that
  registers the marketplace and enables the plugin; **no** `.claude/**` tooling tree, **no**
  `bspecs.lock`.
- **Revert:** `node cli.js -v` / `-h` still work after task 14; no dead `templates-embed`/SEA refs.
- **Old projects:** a pre-migration project opens without the `bspecs sync` `SessionStart` hook
  erroring (no-op + notice path).

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync with the plugin + shrunken-scaffolder behavior (task 18).
- Tick `TODO.md` #17 (npm-free delivery) and reconcile the GitHub-Releases item (task 18).
- Add a `CHANGELOG.md` entry (task 18).
- Both ADRs present and category-safe (tasks 16, 17).
- `standalone-binary-distribution` marked Superseded (task 15).
- `sanitization-tokens.local.md` deleted after the grep is verified clean (task 18).
- No `templates/claude/instructions/` entry-point left dangling — the `bluestep-reference` skill is
  the new on-demand index (task 8).
