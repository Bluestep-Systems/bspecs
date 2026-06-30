# Requirements — plugin-distribution

**Status:** Drafting

## Context

bspecs distributes its reusable agentic tooling — skills, subagents, hooks, the
`instructions/` tree, spec-templates, and `settings.json` — by **copying a custom-templated file
tree** into each project (`copyTemplateTree` + `applyTemplate` + `bspecs sync` + `bspecs.lock`).
A survey of how other repos ship agentic workflows (skills/rules/agents) found they serve **raw
tools through native channels**, not a templating layer. Investigation of the bspecs tree
confirmed the templating is barely load-bearing: `{{VAR}}` tokens appear in **only 3 files**
(`templates/root/{CLAUDE.md,README.md,package.json}`). Every skill, agent, hook, and all ~40
`instructions/**` files carry a `.template` extension but contain **zero variables** — they are
raw markdown moved through a bespoke distribution engine.

Meanwhile, Claude Code now ships a **native distribution model** that fits this content exactly:
**plugins** (bundle skills + agents + hooks + MCP under one namespace) distributed via a
**marketplace** (a plain git repo — no npm, no binary, no build step), with **managed/enterprise
settings** that let an admin pre-register a marketplace and force-enable specific plugin versions
org-wide (`extraKnownMarketplaces`, `enabledPlugins`, `strictKnownMarketplaces`, `autoUpdate`).
Plugins serve content **verbatim** (no variable substitution) — which is fine, since the only
files needing substitution are the 3 root files, which are not `.claude/` tooling.

This reframes the in-flight **`standalone-binary-distribution`** spec. That spec builds a SEA
binary so no-npm/no-terminal internal staff can run the bspecs scaffolder; its delivery goal is
solved more cleanly by a plugin on a private git marketplace (Claude Code clones the marketplace
repo itself — no npm, no binary, no PATH setup), and admin release-level control is the native
managed-settings story. The binary and the plugin are two answers to the *same* "no-npm staff"
question, and the plugin wins on every axis (native delivery, native versioning/enforcement, no
per-OS SEA matrix, and it sidesteps the clack-prompt problem the binary spec punted on).

**Decision (settled with the requester): collapse to two delivery paths and drop the binary.**

- **Plugin** — internal, no-npm; the primary tooling-delivery + admin-enforcement + project-init
  path, run inside Claude Code.
- **npm package** (`@bluestep-systems/bspecs`) — external / terminal / CI users who want an actual
  CLI command and can run Node.

**Marketplace is public.** The plugin is distributed via a **public** git marketplace — consistent
with `Bluestep-Systems/bspecs` already being a public repo and the `templates/` tree already
shipping on public npm (so it discloses nothing new). Public removes the git-credential gate on
staff machines (the simplest possible install). Admin enforcement is **unchanged** by visibility:
managed settings pin the exact marketplace + plugin version (`extraKnownMarketplaces` +
`enabledPlugins` + `strictKnownMarketplaces`), which also defends against lookalike / typo-squat
marketplaces. **Gate:** a pre-publication sensitivity audit of the tooling content runs first;
anything it flags as not-for-public is removed or relocated to a private repo before publish.

The standalone binary is **not** a third path. **This spec supersedes
`standalone-binary-distribution`**: Part B's `{{B6P}}` profile is obsoleted by the plugin/npm
channel split, and the committed **Part A SEA binary code is fully reverted** (salvaging only the
orthogonal `publish.yml` GitHub-Release-creation step). The accepted tradeoff is losing a no-npm
*terminal* CLI — acceptable because bspecs's entire job is bootstrapping *Claude Code* projects,
so the no-npm path can require Claude Code to be present.

Related prior art (neither records the plugin route — this spec + its ADR close that gap):
- `TODO.md` #17 — "npm-free delivery via the VSCode extension (explore)".
- `docs/decisions/npm-free-scaffolding-via-vscode-extension.md` (Proposed) — weighed
  VSCode-extension / standalone-binary / internal-registry only.
- `docs/decisions/instruction-tree-and-claude-only.md` — the dynamic `SYNC_TARGETS` walk and
  Claude-only invariant this refactor must respect or retire.
- `.claude/specs/standalone-binary-distribution/` — superseded by this spec.

### Content sanitization (audit results, 2026-06-30)

A pre-publication sensitivity audit of the scaffolded content (51 files) returned **NOT clean —
~16 items (8 High / 5 Medium / 3 Low), no live secrets.** The `instructions/reference/` and
`instructions/conventions/` tree is working-memory from live customer engagements and leaks these
**categories** (literal identifiers are deliberately kept out of this committed file — see the
re-leak note below): customer org subdomains + file/script IDs; an internal product name and its
confidential go-to-market/branding strategy; a named employee; the customers' regulated-industry
nature (clinical/healthcare context and field names); and confidential business metrics (revenue,
margin, NPS, a sales-pipeline dashboard, a finance endpoint). Skills, agents, hooks, and root files
are clean. The generic *technical* lesson in each flagged file is keepable; only the
provenance/business context leaks.

**Disposition (high level — concrete file list + token set live in the gitignored
`sanitization-tokens.local.md`):**
- **Relocate/remove:** 2 pure-confidential product files (little generic value), plus 2 dashboard
  files pending the redact-vs-relocate decision.
- **Redact in place (~14 files):** strip the named employee, `<org>/<fileID>` provenance tails,
  internal endpoint paths, and clinical/business framing; keep the generic technique. Then update
  `index.md.template` and `b6p-platform.md.template` to match.
- The literal grep token set that drives the redaction pass is in `sanitization-tokens.local.md`
  (gitignored; never committed to this public repo; deleted once the phase is verified).

**Critical context — this content is already public.** The repo is public and `templates/` already
ships on public npm, so these items are publicly downloadable *today*; the plugin work surfaced the
exposure rather than creating it. The sanitization is therefore a **current data-exposure fix** and
is kept as the first/gating phase of this spec.

**Re-leak guard.** This spec, the ADR, and any committed artifact MUST describe the removed content
by **category and rationale only** — never by quoting the literal customer names, employee name,
file IDs, or business figures — or they re-publish into this public repo exactly what the
sanitization removes. The literal identifiers stay only in the gitignored `*.local.md` work file.

Separately (non-sensitivity, flag only): `templates/root/README.md.template` documents the old
GitHub-Packages / `GITHUB_TOKEN` / `~/.npmrc` install model, which contradicts the
public-npm-no-token reality in `CLAUDE.md` / `package.json.template` — stale doc to correct.

## Goals

- As an **internal developer with no npm and no terminal habit**, I want the BlueStep tooling
  installed by enabling a plugin from an admin-approved marketplace, so that I get skills/agents/
  hooks/instructions with no `npm install`, no binary download, and no PATH setup.
- As an **admin**, I want to control which version of the tooling staff run by publishing to a
  private marketplace and enforcing it through managed settings, so that distribution is gated
  natively without standing up new infrastructure or a binary release pipeline.
- As a **maintainer**, I want the shared tooling to live in **one** plugin source of truth that
  updates via marketplace pull (`/plugin marketplace update` / `autoUpdate`), so that the
  `copyTemplateTree`/`bspecs sync`/`bspecs.lock` drift-management machinery shrinks or retires.
- As a **developer starting a new project**, I want the genuinely per-project files (a project
  `CLAUDE.md`, `README`, `package.json`, and the `.claude/specs/` workspace) created for me, so
  that project bootstrapping still works once the shared tooling is plugin-delivered.
- As an **external user**, I want a working path that does not depend on internal infrastructure
  (npm scaffolder and/or public marketplace), so that the internal pivot does not strand me.
- As a **maintainer**, I want exactly **two** delivery paths (plugin + npm) sharing one source
  tree, so that I am not maintaining a redundant third (SEA binary) for an audience the plugin
  already serves better.
- As a **maintainer**, I want `standalone-binary-distribution` cleanly retired — Part B stopped,
  the committed Part A binary code fully reverted, and the independently-valuable Release-creation
  step salvaged — so that no half-built binary work rots in the tree.

## Acceptance criteria

- [ ] The shared `.claude/**` tooling (skills, agents, hooks, `instructions/**`, spec-templates,
      `settings.json` defaults) is restructured into a **Claude Code plugin** layout
      (`.claude-plugin/plugin.json` + `skills/`, `agents/`, `hooks/hooks.json`, etc.) with no loss
      of any current skill/agent/hook/instruction.
- [ ] A **marketplace manifest** (`.claude-plugin/marketplace.json`) makes the plugin installable
      from a **public** git repo via `/plugin marketplace add … && /plugin install …`, with **no
      npm** and **no git credentials** required on the staff machine.
- [ ] All content the sensitivity audit flagged is sanitized before publish — the 2 (–4)
      pure-confidential files relocated/removed and the ~14 redact-in-place files scrubbed of
      provenance tails, "Brandon", customer org/file IDs, internal endpoint paths, and
      clinical/business framing — with the generic platform technique in each preserved, and
      `index.md.template` + `b6p-platform.md.template` updated to match. (See "Content
      sanitization" below.)
- [ ] The marketplace is **pinned in managed settings** (exact repo + version) so staff cannot be
      redirected to a lookalike marketplace.
- [ ] An **admin-enforcement** path is documented (and validated as far as possible without an
      MDM): managed/project settings that pre-register the marketplace and enable the pinned
      plugin version (`extraKnownMarketplaces` + `enabledPlugins`, `strictKnownMarketplaces`).
- [ ] **Per-project bootstrap still works** for the 3 templated root files and the `.claude/specs/`
      workspace — via a decided mechanism (a thinned `bspecs init`, a `/…-init` plugin skill, or
      both). The decision and its rationale are recorded.
- [ ] **The standalone binary is dropped; exactly two delivery paths exist** — plugin (internal)
      and npm package (external/terminal/CI) — sharing one source tree.
- [ ] **`standalone-binary-distribution` is marked Superseded.** Part B (`{{B6P}}` profile, B1–B6)
      is stopped; the committed Part A binary code (A1 SEA-safe version read, A2 build config/script,
      A2.5 template embedding, A4 CI binary smoke, A5 `INSTALL.md`, and the `publish.yml`
      build-binaries job) is **fully reverted**; the `publish.yml` GitHub-Release-creation step
      (the salvageable half of A3) is **preserved**.
- [ ] **Existing scaffolded projects** have a documented migration/compat story (plugin skills are
      namespaced `/plugin:skill` while their copied local skills are bare `/skill`; name collisions,
      `bspecs sync` deprecation, and whether to delete the now-redundant copied tree are addressed).
- [ ] **b6p invocation** in the plugin's skills is resolved: skills call a bare `b6p`, and the
      cross-repo question of how the `b6p` binary reaches the machine (plugin `bin/` vs sibling
      b6p-cli binary) is at minimum documented as a tracked dependency with the chosen direction.
- [ ] An **ADR** records the plugin-over-binary decision, the templating-model change, the
      marketplace/enforcement model, and the supersession; `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`,
      and the relevant prior ADRs are updated in sync.
- [ ] A **separate ADR records the content-sanitization rationale** — *why* customer-derived
      working-memory (provenance, regulated-industry context, internal product strategy, employee
      names, business metrics) does not belong in publicly-distributed tooling, and the
      audit-before-publish process that now gates it. Written at **category level only** (no literal
      customer names / IDs / figures) so the ADR does not itself re-leak.

## Out of scope

- **Building the b6p-cli binary / plugin.** b6p-cli is a separate repo. This spec decides how
  *bspecs*'s plugin references `b6p` and documents the cross-repo dependency, but does not
  implement b6p's delivery.
- **Removing the public npm package.** `@bluestep-systems/bspecs` on public npm stays available
  for external users unless the design phase explicitly decides otherwise (it is a goal that
  external users keep a working path, not that npm is removed).
- **MDM / per-machine enforcement tooling.** Control is marketplace + managed-settings level;
  standing up Intune/Jamf policies is the org's concern, not this spec's.
- **A public/community marketplace listing.** Internal private marketplace only; public listing is
  a possible follow-up.
- **Authoring new skills/agents/instructions.** This is a distribution/packaging refactor of the
  existing content, not a content-authoring effort.
- **Active cross-IDE support (Codex / Cursor / Gemini CLI / etc.).** Per stakeholder decision, the
  posture is **portable-by-default, not supported**: skills are authored in the open `SKILL.md`
  standard so they *can* be consumed by other tools, but **Claude Code is the only host we build,
  test, and distribute for**. Distributing to other tools' formats, adding an `AGENTS.md` entry
  point, and exposing `b6p` as an MCP server (the only fully-portable path for the b6p operations,
  and cross-repo regardless) are all explicitly out of scope — revisit only if a tool other than
  Claude Code becomes a real target.

## Open questions

- **Repo topology.** Does the plugin + `marketplace.json` live **in this bspecs repo** (a
  `.claude-plugin/` at root, repo doubles as the marketplace), in a **dedicated marketplace repo**,
  or a **separate plugin repo + marketplace repo**? Affects versioning, release flow, and how
  `templates/` relates to the plugin source (one source of truth vs a copy that re-introduces the
  drift this refactor is trying to kill).
- **Single source of truth for tooling.** Today `templates/claude/**` is *both* the scaffolder's
  source and the de-facto canonical tooling. If the plugin becomes canonical, what happens to
  `templates/claude/**` and the scaffolder code that consumes it (`copyTemplateTree`,
  `enumerateClaudeTargets`, `SYNC_TARGETS`, `bspecs.lock`, the `SessionStart` sync hook)? Retire,
  or keep for the per-project-files-only scaffolder?
- **Per-project bootstrap mechanism.** Plugin skill (`/…-init`, Claude writes the 3 files in-chat —
  also solves the "clack prompts hang for Claude" item the binary spec punted on) vs a thinned
  `bspecs init` vs both (external=CLI, internal=plugin skill).
- **`@bluestep-systems/b6p-cli` delivery under the plugin model.** Can a plugin ship the `b6p`
  executable in `bin/` (added to PATH on enable) under the same "one audited artifact" trust model,
  making a separate b6p binary install unnecessary — or does b6p stay a sibling binary the
  installer places? Cross-repo; needs the b6p-cli owner's input.
- **Managed-settings reach on the team's hosts.** Which Claude Code channels do staff use (desktop
  app / VS Code extension / CLI), and does the managed-settings enforcement path work on all of
  them? Determines whether "force-enable the pinned plugin" is actually achievable or advisory.
- **Existing-project migration aggressiveness.** Leave copied trees in place (harmless, namespaced
  skills coexist) vs actively deprecate/remove them on next sync. Risk of skill-name collisions.
- **Sanitization track — DECIDED:** kept as the **first, gating phase inside this spec** (not split
  out). The content scrub must land before the plugin marketplace is published.
- **Redact vs relocate for the 4 High business-content files** (`blueiq-credit-integration-playbook`,
  `blueiq-no-ai-branding`, `crm-dashboard-inspo`, `dpn-dashboard-framework`). The first two have
  little generic value (lean relocate/remove); the latter two carry a reusable pattern under the
  business framing (relocate vs redact-to-generic is a judgment call).
