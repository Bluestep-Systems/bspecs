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

- [x] **4.** [CODE] Create the plugin + marketplace skeleton: `plugin/.claude-plugin/plugin.json`
  (name `bluestep-tools`) and a repo-root `.claude-plugin/marketplace.json` listing it; confirm the
  exact in-repo `source` field against the plugin docs. Optionally add a manifest JSON-validity check
  to `ci.yml`. — files: new `plugin/.claude-plugin/plugin.json`, new `.claude-plugin/marketplace.json`,
  (optional) `.github/workflows/ci.yml`.
- [x] **5.** [CODE] Migrate skills to `plugin/skills/**`; switch `b6p-pull`/`b6p-push`/`b6p-audit`
  to bare `b6p` (drop `npx b6p`) and update each skill's `allowed-tools` frontmatter accordingly. —
  files: `templates/claude/skills/**` → `plugin/skills/**`.
- [x] **6.** [CODE] Migrate the three agents to `plugin/agents/**`; bundle the per-component README
  template (`templates/module/**`) with the `b6p-commenter` agent so it no longer needs the
  scaffolder. — files: `templates/claude/agents/**` → `plugin/agents/**`, `templates/module/**`.
- [x] **7.** [CODE] Migrate hooks to `plugin/hooks/hooks.json` + the three scripts, referencing them
  via `${CLAUDE_PLUGIN_ROOT}`. — files: `templates/claude/hooks/*.sh` → `plugin/hooks/`, new
  `plugin/hooks/hooks.json`.
- [x] **8.** [CODE] Re-home the instructions tree as the `bluestep-reference` skill: `SKILL.md` from
  the current `index.md`, with `reference/`/`conventions/`/`gotchas/` and the two Tier-2 overviews
  (`b6p-platform.md`, `bsjs-development.md`) as bundled resources; repoint every skill/agent that
  links to `instructions/...` at the new bundled paths. — files: `templates/claude/instructions/**`
  → `plugin/skills/bluestep-reference/**`, plus the skills/agents that reference instruction files.
- [x] **9.** [CODE] Bundle the **spec-templates with the `spec-create` skill** (analogous to task 6's
  README template → `b6p-pull`). Move `templates/claude/spec-templates/*.template.md`
  (`requirements`, `design`, `tasks`) → `plugin/skills/spec-create/spec-templates/` (strip `.template`
  per the verbatim convention — confirm no `{{VAR}}`), and repoint `plugin/skills/spec-create/SKILL.md`
  (and any other skill that copies a spec template) at the bundled path via `${CLAUDE_PLUGIN_ROOT}`.
  — files: `templates/claude/spec-templates/**` → `plugin/skills/spec-create/spec-templates/**`,
  `plugin/skills/spec-create/SKILL.md`.
- [x] **10.** [CODE] Add the **`/bluestep-init` plugin skill** — the single project-bootstrap path.
  `plugin/skills/bluestep-init/SKILL.md` instructs Claude to write the per-project files in-session:
  `CLAUDE.md`, `README.md`, a `package.json` (omitting the `@bluestep-systems/b6p-cli` devDependency —
  b6p is a standalone artifact, not an npm dep), `.gitignore`, `.prettierrc`, and a plugin-enabling
  `.claude/settings.json` (permissions + `extraKnownMarketplaces` for the `bluestep` marketplace +
  `enabledPlugins: ["bluestep-tools@bluestep"]`, **no** hooks block / **no** `SessionStart` sync —
  hooks come from the plugin), then guide `git init`. Bundle the needed root templates as skill
  resources (Claude fills the project/client values conversationally). The skill's prose notes the
  one-time plugin-install confirmation (per design: project-settings enablement isn't silent).
  *(Optional)* a b6p-PATH-not-found note. — files: new `plugin/skills/bluestep-init/**`.

## Phase 2 — Decommission the CLI + binary as delivery paths (leave CLI dormant)

- [ ] **11.** [CODE] Stop publishing + remove the binary build/CI: in `.github/workflows/publish.yml`
  remove the npm `publish` job and the `build-binaries` job, **keeping** the `gh release create` step
  (now tags releases for the marketplace repo); in `.github/workflows/ci.yml` remove the `binary`
  build job; delete `sea-config.json`, `scripts/build-binary.mjs`, and `INSTALL.md`. — files:
  `.github/workflows/publish.yml`, `.github/workflows/ci.yml`, `sea-config.json`,
  `scripts/build-binary.mjs`, `INSTALL.md`.
- [ ] **12.** [CODE] Revert the SEA source hooks and leave the CLI dormant: simplify `src/version.js`
  back to a plain on-disk `package.json` read (keep `getVersion()` for any dormant caller), remove
  `src/templates-embed.js` and its embedded-read fallbacks in `src/utils.js`/`src/scaffold.js`, and
  delete the orphaned `templates/claude/settings.json.template` (superseded by `/bluestep-init`).
  **Leave `cli.js`, `src/scaffold.js`, `src/sync.js`, `src/prompts.js` untouched and dormant** — not
  deleted, not rewired; they are a frozen, unsupported fallback (they no longer produce a complete
  project since the tooling now lives in the plugin — expected). Confirm `node cli.js -v`/`-h` still
  load. — files: `src/version.js`, `src/templates-embed.js`, `src/utils.js`, `src/scaffold.js`,
  `templates/claude/settings.json.template`.

## Phase 3 — Supersession

- [ ] **13.** [CODE] Mark `standalone-binary-distribution` **Superseded** (Status line + a pointer to
  this spec) across its three files. — files: `.claude/specs/standalone-binary-distribution/{requirements,design,tasks}.md`.

## Phase 4 — Docs & ADRs

- [ ] **14.** [CODE] ADR `docs/decisions/plugin-distribution.md` — plugin as the **single** delivery
  path; the templating-model change (templating now lives only in `/bluestep-init`'s bundled root
  templates); the npm CLI **dropped-but-kept-dormant** rationale; public marketplace +
  managed-settings enforcement; cross-IDE portable-by-default; and the supersession of both the
  binary and the two-paths plan. Amend `npm-free-scaffolding-via-vscode-extension.md` and
  `b6p-cli-distribution.md` to cross-reference. — files: new `docs/decisions/plugin-distribution.md`,
  `docs/decisions/npm-free-scaffolding-via-vscode-extension.md`, `docs/decisions/b6p-cli-distribution.md`.
- [ ] **15.** [CODE] ADR `docs/decisions/content-sanitization-for-public-tooling.md` — **category-level
  only** (no literal names/IDs): why customer-derived working-memory does not belong in publicly
  distributed tooling, and the audit-before-publish gate that now governs it. — files: new
  `docs/decisions/content-sanitization-for-public-tooling.md`.
- [ ] **16.** [CODE] Sync the working docs + final cleanup: update `CLAUDE.md` (plugin-only model,
  `/bluestep-init` bootstrap, the dormant/unpublished CLI, no sync, the two ADRs), the root
  `README.md` (plugin-only onboarding: add marketplace → install → `/bluestep-init`; drop the stale
  `GITHUB_TOKEN`/`~/.npmrc` doc), `TODO.md` (tick the npm-free item #17; reconcile the
  GitHub-Releases item), and add a `CHANGELOG.md` entry; then **delete `sanitization-tokens.local.md`**
  once task 3's grep is confirmed clean. — files: `CLAUDE.md`, `README.md`, `TODO.md`, `CHANGELOG.md`,
  `.claude/specs/plugin-distribution/sanitization-tokens.local.md`.

## Verification

No test suite — confirm manually + via CI smoke:

- **Phase 0:** repo-wide grep of the token set over `templates/` returns clean before any publish.
- **Plugin:** install `bluestep-tools` from the in-repo marketplace into a scratch project →
  `/bluestep-tools:*` skills appear, the three hooks fire on Edit/Write/Bash, and the
  `bluestep-reference` skill serves instruction files on demand. (Highest-risk: the
  instructions-as-skill remap in task 8 and the `${CLAUDE_PLUGIN_ROOT}` hook paths in task 7.)
- **Bootstrap:** in a scratch dir with the plugin enabled, run `/bluestep-init` → it writes the root
  files + a plugin-enabling `.claude/settings.json` (no hooks block, no sync) and guides `git init`;
  the generated `package.json` has no `b6p-cli` devDependency.
- **Dormant CLI:** `node cli.js -v` / `-h` still load after task 12; no dead `templates-embed`/SEA
  refs. (The dormant scaffolder no longer produces a complete project — expected.)

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync with the plugin-only model + dormant CLI (task 16).
- Tick `TODO.md` #17 (npm-free delivery) and reconcile the GitHub-Releases item (task 16).
- Add a `CHANGELOG.md` entry (task 16).
- Both ADRs present and category-safe (tasks 14, 15).
- `standalone-binary-distribution` marked Superseded (task 13).
- `sanitization-tokens.local.md` deleted after the grep is verified clean (task 16).
- No `templates/claude/instructions/` entry-point left dangling — the `bluestep-reference` skill is
  the new on-demand index (task 8).
