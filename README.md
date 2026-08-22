# bluestep — BlueStep tooling marketplace for AI coding agents

A public **plugin marketplace** for BlueStep (B6P) development, serving
**Claude Code, Cursor, and OpenAI Codex**. This repo *is* the marketplace —
three of them, actually, one per tool, all built from the same source: add it
once in your tool, then install the plugins you want. It currently ships one
plugin — **`bluestep-tools`** — with more on the way.

## Prerequisites

Install these before (or shortly after) enabling the plugin — the sync skills
and hooks depend on them.

- **`b6p` CLI** — powers the `/b6p-*` platform-sync skills. It's distributed on
  npm as
  [`@bluestep-systems/b6p-cli`](https://www.npmjs.com/package/@bluestep-systems/b6p-cli):

  ```sh
  npm install -g @bluestep-systems/b6p-cli   # puts a bare `b6p` on your PATH
  ```

  **No npm?** Paste this into your Claude session and it'll set `b6p` up for you:

  ```
  Install the b6p CLI from https://github.com/Bluestep-Systems/b6p-cli/releases —
  download the right binary for my OS, put it on my PATH as `b6p`, and run
  `b6p auth set` so I can authenticate.
  ```

  <details>
  <summary>Prefer to do it by hand?</summary>

  Every GitHub Release ships a self-contained `b6p` binary (`b6p-windows-x64.exe`,
  `b6p-macos-x64`, `b6p-macos-arm64`) — no build step, no source checkout. Download it
  and put it on your `PATH` as `b6p`.

  </details>

  Then authenticate **once per machine**:

  ```sh
  b6p auth set   # access token stored globally in ~/.b6p, not per project
  ```

- **`B6PT_TOKEN`** *(optional)* — only needed for platform MCP authoring, and a
  **separate** credential from the `b6p` CLI's own access token (`b6p auth set`, stored in
  `~/.b6p/`; also a bearer token since b6p-cli 0.6.0, so keep the two straight — they are
  configured independently). The platform MCP is
  the **bundled `bluestep-gateway` server** — no per-org connect step; you just
  set `$B6PT_TOKEN` and it auto-registers once the plugin is enabled (in a
  **fresh session** — restart the app after setting it). It's an OS environment
  variable, so one token serves every tool on the machine. **Windows:**
  `setx B6PT_TOKEN "b6pt_…"` (User scope), then fully restart the app — a
  variable exported in a shell never reaches a GUI-launched app.
  `/bluestep-init` checks for the token and walks you through creating it if it's
  missing.

## Getting set up

Setup is **two steps**: **① install the plugin** (once per machine or account),
then **② activate the rules in your project**. Installing alone gives you the
skills, hooks, and reference — but the always-on BlueStep rules only take effect
after step ②.

### Step 1 — Install the plugin

Add the marketplace **once** (paste this repo:
`https://github.com/Bluestep-Systems/bspecs`), then install **`bluestep-tools`**
from it. **Each section below is self-contained** — follow only the one for the
tool you use ([Claude Code](#claude-code) · [Cursor](#cursor) ·
[Codex (OpenAI)](#codex-openai)) and skip the rest.

---

### Claude Code

The `@bluestep` suffix in the commands below is the marketplace name, so future
plugins install the same way (`<plugin>@bluestep`). Pick your surface:

#### Claude desktop app (Mac/Windows)

No terminal required:

1. Click **Customize** in the left sidebar, then open the **Plugins** tab.
2. Under **Personal plugins**, click **+** → **Add marketplace**.
3. Choose **From repository** and paste the repo URL `https://github.com/Bluestep-Systems/bspecs`, then click **Done**.
4. Click **Browse plugins**, find **bluestep-tools**, and click **Install**.

**Recommended:** turn on **Sync automatically** in the marketplace's settings so
new releases install on their own (needs a one-time GitHub access approval).
Otherwise, use **Check for updates** to pull new releases manually.

#### Claude Code CLI (terminal)

```
/plugin marketplace add Bluestep-Systems/bspecs
/plugin install bluestep-tools@bluestep
```

For scripting, the same thing works non-interactively from your shell:
`claude plugin marketplace add Bluestep-Systems/bspecs` then
`claude plugin install bluestep-tools@bluestep`.

#### Claude Code VS Code extension

1. Type `/plugins` in the prompt box to open **Manage plugins**.
2. On the **Marketplaces** tab, add `Bluestep-Systems/bspecs`.
3. On the **Plugins** tab, find **bluestep-tools** and click **Install** (pick user, project, or local scope).
4. Restart Claude Code when prompted, or run `/reload-plugins`.

(JetBrains IDEs have no plugin GUI — run `claude` in the integrated terminal and use the CLI commands above.)

Also needed on this machine (regardless of surface): the **`b6p` CLI** (installed
separately — see [Prerequisites](#prerequisites)) and, for platform MCP authoring,
the **`B6PT_TOKEN`** environment variable (Windows: `setx` at User scope + fully
restart the app). **Verify:** in a fresh session, the `/bluestep-tools:*` skills
appear in the slash menu.

---

### Cursor

1. Open the plugins screen and choose **Add Marketplace → Import from Repo**,
   pasting the repo URL `https://github.com/Bluestep-Systems/bspecs`.
2. Find **bluestep-tools** in the imported marketplace and install it (enable it
   on the Manage screen if it isn't on by default).

Notes for Cursor:

- **Open your project folder first.** Skills and hooks are workspace-coupled —
  an empty window shows only user-global surfaces (like the MCP server).
- **Updates arrive on their own**: an imported marketplace refreshes from this
  repo on push, so new releases show up without re-importing.
- The edit-guardrail hooks run as **post-edit advisories** on Cursor (it has no
  blocking pre-edit event) — they warn instead of block.
- Also needed on this machine: the **`b6p` CLI** (installed separately — see
  [Prerequisites](#prerequisites)) and, for platform MCP authoring, the
  **`B6PT_TOKEN`** environment variable in the environment Cursor launches from
  (Windows: `setx` at User scope + fully restart the app).
- **Verify:** with a project folder open, the `bluestep-tools` skills appear in
  the composer's slash menu, and the plugin page shows the `bluestep-gateway`
  MCP server.
- Don't judge the install by the plugin page's skill count — it can under-count
  (it renders workspace-dependently). The composer's slash menu with your
  project open is the source of truth.

---

### Codex (OpenAI)

```
codex plugin marketplace add Bluestep-Systems/bspecs
```

then install **bluestep-tools** from it (CLI or the desktop app's plugins
screen), and start a **fresh session** so the bundled MCP server and hooks load.

Two Codex steps that are easy to miss:

- **Trust the hooks — they silently do nothing until you do.** Open the
  plugin's page and use **Review → trust** on its hooks (`/hooks` in the CLI).
  An untrusted hook produces no error and no log. **Re-trust after any release
  that changes a hook** (the changelog calls those out).
- **Subagents don't ship via the plugin on Codex.** Copy the three TOML agents
  from `dist/codex/bluestep-tools/agents/` in this repo into `~/.codex/agents/`
  or your project's `.codex/agents/` (they use underscore names, e.g.
  `b6p_task_implementer`). Until `/bluestep-init` learns to write them, this is
  a manual step — without it, the spec skills simply run in-session instead of
  delegating.
- Also needed on this machine: the **`b6p` CLI** (installed separately — see
  [Prerequisites](#prerequisites)) and, for platform MCP authoring, the
  **`B6PT_TOKEN`** environment variable in the environment Codex launches from
  (Windows: `setx` at User scope + fully restart the app).
- **Verify:** in a fresh session the skill catalog lists
  `bluestep-tools:` skills, and with the token set the plugin page shows
  `bluestep-gateway` connected.

### Step 2 — Activate the rules in your project

Installing the plugin gives the agent the skills, guardrail hooks, and the
on-demand reference. But the **always-on** BlueStep rules live in a project
`AGENTS.md` — read natively by Cursor, Codex, and most other tools — plus a
one-line `CLAUDE.md` containing `@AGENTS.md` for Claude Code (which doesn't read
`AGENTS.md` natively). A plugin can't write those files on its own. So, from
your project directory, run:

```
/bluestep-init
```

This works in a **new *or* existing** project — it's non-destructive and skips any
file that already exists, so in an existing repo it just drops the missing
`AGENTS.md` (plus the other tooling files) and leaves your code untouched. An
existing populated `CLAUDE.md` is never overwritten — the skill offers the
migration to `AGENTS.md` instead of doing it silently. Think of it as "activate
BlueStep rules here," not only "scaffold a new project."

Skip step ② and Claude still has the tools and hard guardrails, but may miss
BlueStep-specific patterns since the rules aren't in context every turn.

### Keeping it updated

Claude Code: run `/plugin marketplace update` (or enable `autoUpdate`). Cursor:
imported marketplaces refresh from this repo on push — nothing to run. Codex:
update from the plugins screen / CLI, and **re-trust the hooks** after any
release that changes one (the changelog calls those out). On every tool, an
install only changes when the plugin's version changes — see
[For maintainers](#for-maintainers).

### Sharing it with your team

On Claude Code, the same `/bluestep-init` from step ② also writes a project
`.claude/settings.json` that registers the `bluestep` marketplace and lists
`enabledPlugins: ["bluestep-tools@bluestep"]`. Commit that file **and** the
generated `AGENTS.md` + `CLAUDE.md` bridge, and the whole setup **travels with
the repo**: a teammate who clones it gets step ② for free (the rules files are
already there) and is offered the plugin for step ① via the committed settings —
they just confirm the one-time install prompt on folder-trust. So after the
first person runs `/bluestep-init`, everyone after them is essentially set up on
clone. (Cursor and Codex enablement is per-user — teammates on those tools do
step ① themselves, but still get the committed `AGENTS.md` for free.)

## What it solves

BlueStep developers work in local copies of components whose source of truth
lives on the BlueStep platform, using ad-hoc per-developer tooling and
undocumented platform conventions. The `bluestep` marketplace packages the
team's shared practice — a spec-driven workflow, platform-sync skills, guardrail
hooks, subagents, and an on-demand BsJs/RelateScript reference — into versioned
agent plugins (Claude Code, Cursor, Codex — one source, three generated
outputs). Everyone gets the same reviewed, traceable conventions with
no per-project copying and no drift: updates ship centrally instead of being
hand-copied into each `.claude/` tree.

## Available plugins

This marketplace ships the following plugins; more are on the way.

| Plugin | What it's for | Install |
| --- | --- | --- |
| **`bluestep-tools`** | Spec-driven BlueStep development: the `/spec-*` workflow, `/b6p-*` platform-sync skills, BlueStep subagents, guardrail hooks, and an on-demand platform reference. | `bluestep-tools@bluestep` |

Each plugin is versioned and released independently — installing one does not
pull in the others.

## What `bluestep-tools` gives you

Everything below is contributed by the `bluestep-tools` plugin once it's enabled:

- **Spec-driven workflow** — `/spec-create` → `/spec-execute` → `/spec-status`, plus `/quick-task` for small changes.
- **Platform sync** — `/b6p-pull`, `/b6p-push`, `/b6p-audit` (the agent usually runs these for you).
- **Project scaffolding** — `/bluestep-init` (bootstrap a project) and `/bluestep-vite-report` (scaffold a Vite/Preact merge report).
- **Platform authoring** — the bundled `bluestep-gateway` MCP server (auto-registers once the plugin is enabled and `$B6PT_TOKEN` is set) lets the agent create/wire platform objects in-session.
- **Subagents** — `b6p-task-implementer` (isolated task execution), `b6p-commenter` (component README), `b6p-code-review` (report-only review).
- **Guardrail hooks** — auto-format on save, block hand-editing platform-generated files, block local `tsc`.
- **On-demand reference** — `bluestep-reference`, a BsJs/RelateScript/platform reference Claude reads only when a task needs it.
- **Feedback** — `/task-comment` (ClickUp implementation comment), `/bspecs-feedback` (propose a plugin change upstream).

## How the rules & reference reach the agent

A plugin can't ship *always-on* context, which is why `/bluestep-init` writes
the critical BlueStep rules into your project's own `AGENTS.md` (with a
one-line `CLAUDE.md` bridge for Claude Code) — that's their only correct home.
The deeper platform reference (`bluestep-reference`) works differently: the
agent reads it on demand, one self-contained file at a time, only when a task
actually calls for it — nothing is bulk-loaded into every session.

## The `bluestep-tools` tools, and when to use each

### Set up a project

| Command | Use it to | When |
| --- | --- | --- |
| `/bluestep-init` | Bootstrap a BlueStep project — writes `AGENTS.md` (the always-on rules), a one-line `CLAUDE.md` bridge, `README.md`, `package.json`, `.gitignore`, `.prettierrc`, then guides per-tool plugin enablement (on Claude Code that includes the project `.claude/settings.json`) and `git init`. | Starting a new project, or adding tooling to an empty/existing dir. Non-destructive; asks for project/client values conversationally. |
| `/bluestep-vite-report` | Scaffold an **off-platform** Vite/Preact single-page-app merge report — a different approach from a platform-compiled report (a bundled `static/index.html` deployed via deploy-lib). | Starting a merge report that needs a real SPA build rather than the platform's `static/script.ts` path. |

### Spec-driven workflow

| Command | Use it to | When |
| --- | --- | --- |
| `/spec-create` | Plan a feature — produces `requirements.md`, then `design.md`, then `tasks.md`, with explicit approval between each phase. | A non-trivial change that's worth designing before coding. |
| `/spec-execute` | Implement **one** approved task, then update its checkbox. Delegates to the `b6p-task-implementer` subagent by default (isolated context); `--inline` implements in the main session. | After `/spec-create` has produced an approved `tasks.md`. Run once per task. |
| `/spec-status` | Show progress across all specs in `.claude/specs/`. | A quick done/pending tally of what's in flight. |
| `/quick-task` | A short workflow for small, clearly-scoped changes and bugs — one living markdown doc, no 3-phase spec. | Small fixes that don't warrant a full spec (escalates to `/spec-create` if the scope grows). |

### Sync with the platform (usually automatic)

You rarely invoke these yourself — the agent runs pull / push / audit as part of
its normal workflow (bringing a component down before editing, auditing before a
push, pushing when you're ready). You mainly just need the `b6p` CLI installed
and authed (see [Prerequisites](#prerequisites)). For reference:

| Command | What it does |
| --- | --- |
| `/b6p-pull` | Bring a component down from the platform into the local workspace. |
| `/b6p-push` | Push local edits back to the platform. |
| `/b6p-audit` | List files that differ between local and platform (read-only). |

### Platform authoring (bundled gateway MCP)

The plugin bundles the `bluestep-gateway` MCP server, so the agent can
create/wire platform objects (forms, fields, queries) directly in-session
instead of a manual UI round-trip. There's no per-org connect step: the gateway
auto-registers once the plugin is enabled and `$B6PT_TOKEN` is set — a
**separate** credential from the `b6p` CLI (see [Prerequisites](#prerequisites),
and `/bluestep-init` for token setup). The authoring flow itself lives in the
`bluestep-reference` skill's `conventions/mcp-platform-authoring.md`.

Component sync (`/b6p-*`) stays on the `b6p` CLI; MCP owns only the platform
authoring the CLI can't do.

### Subagents

| Agent | What it does | How it fires |
| --- | --- | --- |
| `b6p-task-implementer` | Implements one approved spec task in an isolated context and returns a summary. | **Automatically**, as the default path of `/spec-execute` (skipped with `--inline`). |
| `b6p-commenter` | Fills in a component's `draft/README.md` from the code (edits the README only). | On-demand; suggested at a `/spec-execute` STOP, never auto-fired. |
| `b6p-code-review` | Report-only code review grouped Critical / Warnings / Suggestions. | On-demand; suggested at a `/spec-execute` STOP, never auto-fired. |

### Feedback

| Command | Use it to |
| --- | --- |
| `/task-comment` | Draft a standardized ClickUp implementation comment after shipping a fix or feature. |
| `/bspecs-feedback` | Propose a change to the plugin itself — drafted from session context, confirmed in chat, POSTed to the BlueHQ intake endpoint (ClickUp task + linked GitHub issue, no account needed). You'll get an email when your item is closed, saying what happened. |

---

## For maintainers

**Distribution.** The plugin source lives in `plugin/`; this repo doubles as
**three marketplaces**, one per tool:
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) for Claude
Code (`source: ./plugin`), [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json)
for Cursor, and [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json)
for Codex — the latter two serving **generated** trees under `dist/cursor/` and
`dist/codex/`, emitted from `plugin/**` by `tools/gen-cross-tool/`
(`npm run gen`; the output is committed because git-based marketplace imports
need it in the tree, and never hand-edited — CI regenerates and diffs). There is
**no npm publish and no binary build** — each marketplace is a plain git repo
tracking this repo's default branch. The npm CLI that previously scaffolded
these files (`cli.js`/`src/*`) is retained but **dormant** (unpublished,
unsupported). See
[`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md),
[`docs/decisions/cross-tool-plugin-output.md`](docs/decisions/cross-tool-plugin-output.md),
and
[`docs/decisions/content-sanitization-for-public-tooling.md`](docs/decisions/content-sanitization-for-public-tooling.md).

**Releasing.** Merging a version-bumped PR to `main` **is** the release — the
tag and GitHub Release are automated. The `version` in
[`plugin/.claude-plugin/plugin.json`](plugin/.claude-plugin/plugin.json) is the
single update signal for **all three tools**: every generated manifest mirrors
it, each tool caches installs by it and **skips the plugin on update when it's
unchanged**. Merged changes stay dormant until a version bump ships them.

1. Bump `version` in `plugin/.claude-plugin/plugin.json` (semver — patch = fix,
   minor = feature, major = breaking). This is one shared version stream: bump
   it for **any** change that alters shipped bytes, including emitter-only
   changes under `tools/gen-cross-tool/` (tools whose output didn't change get
   a harmless no-op update).
2. Run `npm run gen` and commit the regenerated `dist/` and root marketplace
   manifests alongside the source change. The `cross-tool-drift` CI job
   regenerates and fails the PR on any diff, so stale output can't merge.
3. If the release changes a **hook**, say so in the changelog entry — Codex
   users must re-trust hooks after a hook-changing update or the guardrails
   silently stop running.
4. Merge to `main`. Done: users get everything since the previous version on
   their next update (Claude Code `autoUpdate` / `/plugin marketplace update`,
   Cursor marketplace auto-refresh, Codex update), and
   `.github/workflows/release-tag.yml` pushes the `plugin-vX.Y.Z` tag **and**
   records the GitHub Release — no terminal step.

Manual tagging still works and simply pre-empts the automation
(`git tag plugin-v0.8.0 && git push origin plugin-v0.8.0` —
`.github/workflows/publish.yml` cuts the Release for a human-pushed tag; both
paths produce the same Release shape). **Use the `plugin-vX.Y.Z` namespace** —
the plain `vX.Y.Z` tags (`v0.2.0`..`v0.15.0`) belong to the frozen npm-package
history and must not be reused.

CI fails any PR that changes `plugin/**` or `tools/gen-cross-tool/**` without a
version bump (the `plugin-version-bump` job), so a release can't be silently
forgotten. Repo-only changes (docs, CI, this README, the dormant CLI) need no
bump and don't affect installs — and a merge to `main` without a version change
creates no tag and no Release, which is correct: nothing shipped.

**Feedback pipeline.** `/bspecs-feedback` POSTs to a public BlueHQ intake
endpoint that files a ClickUp task on AI.List **and** a routed GitHub issue via
a GitHub App, links the two, and returns both URLs — no GitHub Actions, no repo
secret, no submitter account. The reporter's email is required at filing: when
the task is later closed with a `resolution` set, the endpoint emails the
reporter what happened (a `resolution-note` verbatim, an AI-drafted summary, or
generic wording) and comments the sent email back on the task. Setup and
credentials live on BlueHQ — see
[`docs/bluehq-feedback-endpoint-setup.md`](docs/bluehq-feedback-endpoint-setup.md).

**Adding a plugin to the marketplace.** Append an entry to the `plugins[]` array
in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) — a
`name`, a `source` directory (its own folder alongside `plugin/`), and a
`description`. Each plugin carries its own `plugin.json` `version` and is
released and tagged independently (`<name>-vX.Y.Z`). Add a row to the
[Available plugins](#available-plugins) table above when you do.

**Proposing changes.** Found something that should improve across all BlueStep
projects — a skill, hook, reference rule, or subagent? Use the `/bspecs-feedback`
skill, or open an issue/PR in this repo. Once merged and released,
`/plugin marketplace update` propagates it.
