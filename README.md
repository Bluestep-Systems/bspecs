# bluestep — BlueStep tooling marketplace for Claude Code

A public **Claude Code plugin marketplace** for BlueStep (B6P) development. This
repo *is* the marketplace: add it once, then install the plugins you want. It
currently ships one plugin — **`bluestep-tools`** — with more on the way.

## What it solves

BlueStep developers work in local copies of components whose source of truth
lives on the BlueStep platform, using ad-hoc per-developer tooling and
undocumented platform conventions. The `bluestep` marketplace packages the
team's shared practice — a spec-driven workflow, platform-sync skills, guardrail
hooks, subagents, and an on-demand BsJs/RelateScript reference — into versioned
Claude Code plugins. Everyone gets the same reviewed, traceable conventions with
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
- **Platform authoring** — `/bluestep-mcp-connect` connects an org's platform MCP so the agent can create/wire platform objects in-session.
- **Subagents** — `b6p-task-implementer` (isolated task execution), `b6p-commenter` (component README), `b6p-code-review` (report-only review).
- **Guardrail hooks** — auto-format on save, block hand-editing platform-generated files, block local `tsc`.
- **On-demand reference** — `bluestep-reference`, a BsJs/RelateScript/platform reference Claude reads only when a task needs it.
- **Feedback** — `/task-comment` (ClickUp implementation comment), `/bspecs-feedback` (propose a plugin change upstream).

## Prerequisites

Install these before (or shortly after) enabling the plugin — the sync skills
and hooks depend on them.

- **`b6p` CLI** — powers the `/b6p-*` platform-sync skills. It's distributed on
  npm as
  [`@bluestep-systems/b6p-cli`](https://www.npmjs.com/package/@bluestep-systems/b6p-cli):

  ```sh
  npm install -g @bluestep-systems/b6p-cli   # puts a bare `b6p` on your PATH
  ```

  **No npm?** Grab the binary from the source repo
  [`Bluestep-Systems/vscode-extension`](https://github.com/Bluestep-Systems/vscode-extension)
  (`packages/b6p-cli/`) — or just paste that link into Claude and have it install
  `b6p` for you. Then authenticate **once per machine**:

  ```sh
  b6p auth set   # credentials stored globally in ~/.b6p, not per project
  ```

- **`prettier`** — required for the auto-format-on-save hook (which runs in WSL
  on Windows). Make it available in the project (`npm install --save-dev prettier`)
  or globally.

- **`B6PT_TOKEN`** *(optional)* — only if you want the platform MCP connection
  (`/bluestep-mcp-connect`). Create a global `b6pt_` access token once in the
  BlueStep UI and put it in the `B6PT_TOKEN` environment variable. This is a
  **separate** credential from the `b6p` CLI's WebDAV login.

## Getting set up

Setup is **two steps**: **① install the plugin** (once per machine or account),
then **② activate the rules in your project**. Installing alone gives you the
skills, hooks, and reference — but the always-on BlueStep rules only take effect
after step ②.

### Step 1 — Install the plugin

Add the marketplace **once** (paste this repo:
`https://github.com/Bluestep-Systems/bspecs`), then install **`bluestep-tools`**
from it. The `@bluestep` suffix everywhere is the marketplace name, so future
plugins install the same way (`<plugin>@bluestep`).

#### Claude desktop app (Mac/Windows)

No terminal required:

1. Click **Customize** in the left sidebar, then open the **Plugins** tab.
2. Under **Personal plugins**, click **+** → **Add marketplace**.
3. Choose **From repository** and paste the repo URL `https://github.com/Bluestep-Systems/bspecs`, then click **Done**.
4. Click **Browse plugins**, find **bluestep-tools**, and click **Install**.

**Recommended:** turn on **Sync automatically** for the marketplace so new plugin
releases propagate on their own. In the desktop app, marketplaces are tied to
your Claude account (claude.ai); you enable this from the marketplace's settings,
and it requires **granting the Claude GitHub App access** to the `bspecs` repo.
With it off, the marketplace stays pinned to the commit it was added at and won't
pick up releases (use **Check for updates** for a one-time manual sync).

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

### Step 2 — Activate the rules in your project

Installing the plugin gives Claude the skills, guardrail hooks, and the on-demand
reference. But the **always-on** BlueStep rules — use `B.time` not `Date`,
queries are unit-scoped, commit semantics, the endpoint output rule,
RelateScript-isn't-JS, and the rest — live in a project `CLAUDE.md`, and a plugin
**can't** inject that on its own ([why](#how-the-rules--reference-reach-claude)).
So, from your project directory, run:

```
/bluestep-init
```

This works in a **new *or* existing** project — it's non-destructive and skips any
file that already exists, so in an existing repo it just drops the missing
`CLAUDE.md` (plus the other tooling files) and leaves your code untouched. Think
of it as "activate BlueStep rules here," not only "scaffold a new project."

Skip step ② and Claude still has the tools and the hard guardrails, but won't
carry the platform rules in context every turn — so on a quick edit it doesn't
think to consult the reference for, it can miss BlueStep patterns. Run
`/bluestep-init` once per project to close that gap.

### Keeping it updated

Run `/plugin marketplace update` (or enable `autoUpdate`) to pull the latest
released versions. An install only changes when the plugin's version changes —
see [For maintainers](#for-maintainers).

### Sharing it with your team

The same `/bluestep-init` from step ② also writes a project
`.claude/settings.json` that registers the `bluestep` marketplace and lists
`enabledPlugins: ["bluestep-tools@bluestep"]`. Commit that file **and** the
generated `CLAUDE.md`, and the whole setup **travels with the repo**: a teammate
who clones it gets step ② for free (the `CLAUDE.md` is already there) and is
offered the plugin for step ① via the committed settings — they just confirm the
one-time install prompt on folder-trust. So after the first person runs
`/bluestep-init`, everyone after them is essentially set up on clone.

## How the rules & reference reach Claude

Once the plugin is enabled, it contributes context through three channels:

- **Skills** — every skill's *description* is always in context (so Claude knows what's available), but a skill's full *body* loads only when it's invoked.
- **Hooks** — the plugin's hooks merge with your project hooks and fire automatically on the matching Edit / Write / Bash events. No per-project hooks block is needed.
- **Subagents** — inherit the memory hierarchy (project `CLAUDE.md` + rules) and reach the plugin's bundled reference files on demand.

Two things worth knowing:

- **Always-on rules live in the project `CLAUDE.md`.** A plugin can't ship
  always-on context (a `CLAUDE.md` at the plugin root is not loaded), so the
  critical Tier-1 rules are written into the per-project `CLAUDE.md` by
  `/bluestep-init` — that's their only correct home.
- **The reference is read on demand — no `@`-imports.** Nothing is bulk-loaded
  into every session. The project `CLAUDE.md` points at the `bluestep-reference`
  skill; Claude reads its manifest, matches the "Load when …" trigger for the
  task at hand, and opens the **one** self-contained file it needs (reference/,
  conventions/, or gotchas/). Large platform detail stays out of context until a
  specific task calls for it.

## The `bluestep-tools` tools, and when to use each

### Set up a project

| Command | Use it to | When |
| --- | --- | --- |
| `/bluestep-init` | Bootstrap a BlueStep project — writes `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `.prettierrc`, and the project `.claude/settings.json`, then guides `git init`. | Starting a new project, or adding tooling to an empty/existing dir. Non-destructive; asks for project/client values conversationally. |
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

### Platform authoring (`/bluestep-mcp-connect`)

The platform exposes a **per-org** MCP server at
`https://<org>.bluestep.net/mcp`. `/bluestep-mcp-connect` registers a connection
for an org so the agent can perform `[PLATFORM]` authoring/wiring operations
directly in-session (create forms/fields/queries, wire dependencies) instead of a
manual UI round-trip. It authenticates with the `B6PT_TOKEN`
([Prerequisites](#prerequisites)) — a **separate** credential from the `b6p` CLI.

- **Terminal CLI:** registers globally at user scope (persists across all workspaces) when the `claude` binary is on PATH.
- **No CLI / containment / team-shared:** falls back to a per-workspace `.mcp.json` with a runtime-expanded `${B6PT_TOKEN}`.
- **Desktop app:** add it as a claude.ai custom connector.

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
| `/bspecs-feedback` | Propose a change to the plugin itself as a prefilled GitHub issue — the plugin is a read-only shared install, so lasting fixes land upstream in this repo. |

---

## For maintainers

**Distribution.** The plugin lives in `plugin/`; the repo-root
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) is the
`bluestep` marketplace and lists it (`source: ./plugin`). There is **no npm
publish and no binary build** — the marketplace is a plain git repo tracking
this repo's default branch. The npm CLI that previously scaffolded these files
(`cli.js`/`src/*`) is retained but **dormant** (unpublished, unsupported). See
[`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md)
and
[`docs/decisions/content-sanitization-for-public-tooling.md`](docs/decisions/content-sanitization-for-public-tooling.md).

**Releasing.** Merging a PR to `main` does **not** ship it to installed users.
The `version` in
[`plugin/.claude-plugin/plugin.json`](plugin/.claude-plugin/plugin.json) is the
update signal: Claude Code caches each install by that version and **skips the
plugin on update when the version is unchanged**. Merged `plugin/**` changes stay
dormant until a version bump ships them.

1. Bump `version` in `plugin/.claude-plugin/plugin.json` (semver — patch = fix, minor = feature, major = breaking).
2. Merge the bump to `main`. Users get everything since the previous version on their next `autoUpdate` or manual `/plugin marketplace update`.
3. Tag and push so a GitHub Release is recorded (and admins can pin to it):
   ```sh
   git tag plugin-v0.8.0 && git push origin plugin-v0.8.0
   ```
   `.github/workflows/publish.yml` cuts the Release for the tag. **Use the
   `plugin-vX.Y.Z` namespace** — the plain `vX.Y.Z` tags (`v0.2.0`..`v0.15.0`)
   belong to the frozen npm-package history and must not be reused.

CI fails any PR that changes `plugin/**` without a version bump (the
`plugin-version-bump` job), so a release can't be silently forgotten. Repo-only
changes (docs, CI, this README, the dormant CLI) don't touch `plugin/**`, need no
bump, and don't affect installs.

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
