# bluestep — BlueStep tooling marketplace for AI coding agents

A public **plugin marketplace** for BlueStep (B6P) development, serving **Claude Code, Cursor and
OpenAI Codex**. This repo *is* the marketplace — three of them, one per tool, all built from the
same source. It ships **`bluestep-tools`** (for BlueStep component workspaces) and lists
**`core-tools`** (for every other repo).

## Get started

Open your AI coding agent (Claude Code, Cursor or Codex) in any folder, paste this, press enter:

> Set up the BlueStep developer tooling on this machine. Work it out by checking, not by asking me.
> 1. Find out which agent tool you are running in (Claude Code CLI, the Claude desktop app, Cursor,
>    or Codex) and whether the `bluestep-tools` plugin from the `Bluestep-Systems/bspecs` marketplace
>    is already installed.
> 2. If it is not: on the Claude Code CLI run `claude plugin marketplace add Bluestep-Systems/bspecs`
>    and then `claude plugin install bluestep-tools@bluestep --scope user`. On Codex run
>    `codex plugin marketplace add Bluestep-Systems/bspecs` and tell me to install bluestep-tools from
>    it, trust its hooks, and copy its three subagents from the installed plugin's `agents/` folder
>    into `~/.codex/agents/`. On the Claude desktop app or Cursor you cannot install it yourself: give
>    me the exact clicks (desktop app: Customize → Plugins → + → Add marketplace → From repository
>    `https://github.com/Bluestep-Systems/bspecs` → Browse plugins → install bluestep-tools; Cursor:
>    Plugins → Add Marketplace → Import from Repo → `https://github.com/Bluestep-Systems/bspecs` →
>    install bluestep-tools).
> 3. Check whether the `b6p` command is on my PATH and, if it is, that `b6p --version` is 0.8.0 or
>    later. If it is missing or older and Node.js is installed, run
>    `npm i -g @bluestep-systems/b6p-cli@latest` (if my old `b6p` is a downloaded binary, give me
>    the new download instead); if Node is not installed, give me the download
>    link `https://github.com/Bluestep-Systems/b6p-cli/releases` for my OS (binaries exist for macOS
>    arm64 and Windows x64 — on Linux, WSL or an Intel Mac tell me to install Node first).
> 4. Tell me to run `b6p auth set` in my own terminal — never ask me for the token.
> 5. Finish with one line: start a **new** session in the folder where my BlueStep work will live,
>    and there type `/b6p-setup`.

What the agent will hand back to you, and why:

- **The install click**, on the Claude desktop app and Cursor — plugins there are installed from a
  screen the agent cannot reach. On the Claude Code CLI and Codex it runs the commands itself.
- **`b6p auth set`** — the BlueStep access token for the `b6p` CLI is typed by a person, once per
  machine. The agent never sees it.
- **A new session** — a plugin's skills only exist in sessions started after the install.

Then, in the folder where your BlueStep work will live (an empty folder is fine):

## Set up a project

```
/b6p-setup
```

One run does everything that is done once: checks the machine (the `b6p` CLI and its login, the
plugin for the tool you are in, the optional platform token), writes the project files that are
missing (a short `AGENTS.md` with the always-on platform rules, a one-line `CLAUDE.md` bridge for
Claude Code, `README.md`, `package.json`, `.gitignore`, `.prettierrc`, and on Claude Code the project
settings), and brings a project set up by an older release up to date, keeping every rule of yours.
It asks nothing on a fresh folder and reports nothing to do on a second run. `/b6p-setup --all`
sweeps every BlueStep project on the machine.

If you want it to get on with it, paste this instead:

> Run /b6p-setup for this folder. Decide everything the skill says you can decide, and ask me only
> what it says is mine — a rules file with my own lines in it, a populated CLAUDE.md, a settings
> value that differs, a folder that is not clearly a BlueStep workspace. For anything only I can run
> (`b6p auth set`), give me the exact command and carry on with the rest; the platform token is
> optional, skip it unless I ask. Finish by telling me how to pull my first component.

**You will rarely need to type it.** The first time you ask the agent to pull a component, plan a
feature or fix a bug in a folder that is not set up — no rules file, a rules file from before the
version marker, or one on an older template — the skill you asked for runs the setup as its first
step and then does what you asked. On Claude Code, a session opened in a folder that holds components
but no rules file at all starts with a one-line offer to set it up.

The platform token (`B6PT_TOKEN`) is **optional**: only platform authoring over the bundled gateway
MCP needs it, and it is a separate credential from the `b6p` CLI's. `/b6p-setup` walks you through it
when you want it. Windows: `setx B6PT_TOKEN "b6pt_…"` at User scope, then fully restart the app — a
variable exported in a shell never reaches a GUI-launched app.

## Keeping it updated

Claude Code: `/plugin marketplace update` (or turn on auto-update; the desktop app's marketplace
settings have **Sync automatically**). Cursor: imported marketplaces refresh from this repo on push.
Codex: update from the plugins screen or CLI, and **re-trust the hooks** after any release that
changes one — the changelog says which; an untrusted hook does nothing, silently.

Updating the plugin changes the skills, hooks and reference; it never rewrites the files
`/b6p-setup` put in your project. The next time you pull, plan or fix something in that project, the
setup step notices the old template (or a rules file from before the marker) and runs the update —
asking only if the file has lines of yours; or run `/b6p-setup` there yourself.

## Sharing it with your team

Commit the `AGENTS.md`, the `CLAUDE.md` bridge and, on Claude Code, the `.claude/settings.json`
that `/b6p-setup` writes: the rules and the marketplace registration then travel with the repo. The
plugin install itself is per machine — each teammate pastes the prompt above once. Your project's
`README.md` (also written by `/b6p-setup`) carries the install commands and clicks, since Claude Code
shows no hint when the plugin is missing.

## What you get

BlueStep developers work in local copies of components whose source of truth lives on the platform.
`bluestep-tools` packages the team's shared practice into a versioned plugin — one source, three
generated outputs — so everyone gets the same reviewed conventions with no per-project copying and no
drift.

| Plugin | What it's for | Install |
| --- | --- | --- |
| **`bluestep-tools`** | BlueStep component workspaces: the `/spec-*` workflow, `/b6p-*` platform-sync skills, BlueStep subagents, a guardrail hook, the bundled gateway MCP and an on-demand platform reference. | `bluestep-tools@bluestep` |
| **`core-tools`** | Every other repo: the `core` rule set, `/task`, `/plan`, `/repo-setup`. Source: [`Bluestep-Systems/bluestep-ai`](https://github.com/Bluestep-Systems/bluestep-ai). | `core-tools@bluestep` |

Once `bluestep-tools` is enabled:

- **Spec-driven workflow** — `/spec-create` → `/spec-execute` → `/spec-status`, plus `/quick-task` for small changes.
- **Platform sync** — `/b6p-pull`, `/b6p-push`, `/b6p-audit`; the agent usually runs these for you. `/b6p-push` tells you what a push will overwrite and delete on the platform before it goes.
- **Setup** — `/b6p-setup` (machine, project and update in one run) and `/bluestep-vite-report` (scaffold an off-platform Vite/Preact merge report).
- **Platform authoring** — the bundled `bluestep-gateway` MCP server (auto-registers once the plugin is enabled and `$B6PT_TOKEN` is set) lets the agent create and wire platform objects in-session.
- **Subagents** — `b6p-task-implementer` (isolated task execution), `b6p-commenter` (component README), `b6p-code-review` (report-only review).
- **Guardrail hook** — blocks hand-edits to platform-generated files (`declarations/`, `B.d.ts`, …). Claude Code blocks; Cursor warns after the edit; Codex runs it only once trusted. On Claude Code a session canary warns once if no JSON parser is on PATH and offers setup in a folder that holds components but no rules file.
- **On-demand reference** — `bluestep-reference`, a BsJs/RelateScript/platform reference the agent reads one file at a time, only when a task calls for it.
- **Feedback** — `/task-comment` (ClickUp implementation comment), `/bspecs-feedback` (propose a plugin change upstream; you get an email when it is closed).

A plugin cannot ship *always-on* context, which is why `/b6p-setup` writes the platform rules into
your project's own `AGENTS.md` (with the one-line `CLAUDE.md` bridge for Claude Code). Everything
deeper is read on demand.

### The tools, and when to use each

| Command | Use it to | When |
| --- | --- | --- |
| `/b6p-setup` | Check the machine, write the missing project files, bring an old project up to date; `--all` for every project on the machine. | A new machine, a new or existing folder, after a plugin update — or never, because the skills below run it for you. |
| `/bluestep-vite-report` | Scaffold an **off-platform** Vite/Preact single-page-app merge report (a bundled `static/index.html` deployed via deploy-lib). | A merge report that needs a real SPA build rather than the hand-written `static/script.ts` path. |
| `/spec-create` | Plan a feature — `requirements.md`, then `design.md`, then `tasks.md`, with approval between each. | A non-trivial change worth designing before coding. |
| `/spec-execute` | Implement **one** approved task and tick it; delegates to `b6p-task-implementer` by default, `--inline` to stay in the session. | After `/spec-create`, once per task. |
| `/spec-status` | Progress across all specs in `.claude/specs/`. | A quick tally of what is in flight. |
| `/quick-task` | A short workflow for a small, clearly scoped change or bug — one living doc, no three-phase spec. | Small fixes; escalates to `/spec-create` if the scope grows. |
| `/b6p-pull` · `/b6p-push` · `/b6p-audit` | Bring a component down · push local edits back (publish or draft, your choice, with what it will overwrite and delete stated first) · list what differs (read-only). | Usually the agent's call, as part of its workflow. |
| `/task-comment` · `/bspecs-feedback` | Draft a ClickUp implementation comment · send a plugin-change request upstream. | After shipping · whenever the tooling itself should change. |

| Agent | What it does | How it fires |
| --- | --- | --- |
| `b6p-task-implementer` | Implements one approved spec task in an isolated context and returns a summary. | Automatically, as `/spec-execute`'s default path. |
| `b6p-commenter` | Fills in a component's `draft/README.md` from the code. | On demand; suggested at a `/spec-execute` STOP. |
| `b6p-code-review` | Report-only review grouped Critical / Warnings / Suggestions. | On demand; suggested at a `/spec-execute` STOP. |

Platform authoring goes through the bundled `bluestep-gateway` MCP server — no per-org connect step,
one global token — following `bluestep-reference`'s `conventions/mcp-platform-authoring.md`.
Component sync (`/b6p-*`) stays on the `b6p` CLI; MCP owns only what the CLI cannot do.

## Install details per tool

Prompt 1 above gives the agent these; they are here for the record.

**Claude desktop app (Mac/Windows).** Customize (left sidebar) → **Plugins** → under Personal plugins
**+** → **Add marketplace** → **From repository** → `https://github.com/Bluestep-Systems/bspecs` →
Done → **Browse plugins** → **bluestep-tools** → **Install**. Turn on **Sync automatically** in the
marketplace's settings so releases install on their own. Plugins on the desktop app are managed by
your claude.ai account, not by local files.

**Claude Code CLI.** `/plugin marketplace add Bluestep-Systems/bspecs` then
`/plugin install bluestep-tools@bluestep` — or from a shell, `claude plugin marketplace add …` and
`claude plugin install bluestep-tools@bluestep --scope user`. **VS Code extension:** `/plugins` →
Marketplaces → add `Bluestep-Systems/bspecs` → Plugins → install **bluestep-tools** → restart or
`/reload-plugins`. JetBrains has no plugin GUI: use the CLI in its terminal.

**Cursor.** Plugins → **Add Marketplace → Import from Repo** → `https://github.com/Bluestep-Systems/bspecs`
→ install **bluestep-tools** (enable it on the Manage screen if it is off). Open your project folder
first — skills and hooks are workspace-coupled. Updates arrive on their own. The edit guardrail runs
as a post-edit advisory on Cursor (it has no blocking pre-edit event). Do not judge the install by
the plugin page's skill count; the composer's slash menu with your project open is the truth.

**Codex.** `codex plugin marketplace add Bluestep-Systems/bspecs`, install **bluestep-tools** from it,
start a fresh session. Then two steps the tooling depends on: **trust the hooks** (plugin page →
Review → trust, or `/hooks` in the CLI — an untrusted hook does nothing, silently, and needs
re-trust after any release that changes one), and **copy the three subagents** from the installed
plugin's `agents/` folder (the same files are in this repo under `dist/codex/bluestep-tools/agents/`)
into `~/.codex/agents/` (Codex plugins cannot register them; without the copy the spec skills run
in-session instead of delegating).

**Verify**, on any tool: in a fresh session the `bluestep-tools` skills appear in the slash menu, and
with `B6PT_TOKEN` set the plugin page shows `bluestep-gateway` connected.

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
[`docs/decisions/setup-consolidation.md`](docs/decisions/setup-consolidation.md),
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
[What you get](#what-you-get) table above when you do.

**Proposing changes.** Found something that should improve across all BlueStep
projects — a skill, hook, reference rule, or subagent? Use the `/bspecs-feedback`
skill, or open an issue/PR in this repo. Once merged and released,
`/plugin marketplace update` propagates it.
