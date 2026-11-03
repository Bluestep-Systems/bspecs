# bluestep-tools

The BlueStep (B6P) development plugin for **Claude Code, Cursor and OpenAI Codex**, for BlueStep
component workspaces. It is one of the plugins in the `bluestep` marketplace; the
[repo README](../../README.md) lists the others and has the machine setup prompt.

## Get started

Paste the prompt under **Get started** in the [repo README](../../README.md#get-started) into your AI
coding agent (Claude Code, Cursor or Codex), in any folder. It installs this plugin, offers
[`phi-guard`](../phi-guard/README.md) if the machine works on projects with client data, checks the
`b6p` CLI and the platform token, and hands back the few steps only you can do.

Then, in the folder where your BlueStep work will live (an empty folder is fine):

## Set up a project

```
/b6p-setup
```

One run does everything that is done once: checks the machine (the `b6p` CLI and its login, the
plugin for the tool you are in, the platform token and a live call to the gateway MCP), writes the project files that are
missing (a short `AGENTS.md` with the always-on platform rules, a one-line `CLAUDE.md` bridge for
Claude Code, `README.md`, `package.json`, `.gitignore`, `.prettierrc`, and on Claude Code the project
settings), and brings a project set up by an older release up to date, keeping every rule of yours.
It asks nothing on a fresh folder and reports nothing to do on a second run. `/b6p-setup --all`
sweeps every BlueStep project on the machine.

If you want it to get on with it, paste this instead:

> Run /b6p-setup for this folder. Decide everything the skill says you can decide, and ask me only
> what it says is mine — a rules file with my own lines in it, a populated CLAUDE.md, a settings
> value that differs, a folder that is not clearly a BlueStep workspace. For anything only I can run
> (`b6p auth set`, setting `B6PT_TOKEN`), give me the exact command and carry on with the rest. Tell
> me plainly if the gateway MCP did not answer. Finish by telling me how to pull my first component.

**You will rarely need to type it.** The first time you ask the agent to pull a component, plan a
feature or fix a bug in a folder that is not set up — no rules file, a rules file from before the
version marker, or one on an older template — the skill you asked for runs the setup as its first
step and then does what you asked. On Claude Code, a session opened in a folder that holds components
but no rules file at all starts with a one-line offer to set it up.

The platform token (`B6PT_TOKEN`) is **required**: the bundled gateway MCP, the plugin's main tool
for reading and building on the platform, does not start without it. The CLI stores its own copy
(`b6p auth set`), but the same `b6pt_` token works for both. `/b6p-setup` walks you through it and
calls the gateway to prove it answers. Windows: `setx B6PT_TOKEN "b6pt_…"` at User scope, then fully restart the app — a
variable exported in a shell never reaches a GUI-launched app.

## Requirements

- **git** — every tool downloads the plugin with git, and on Windows the hooks run in Git Bash.
- **The `b6p` CLI, 0.8.1 or later, on PATH** — the `/b6p-*` skills call a bare `b6p`. With Node.js:
  `npm i -g @bluestep-systems/b6p-cli@latest`; without it, a binary from
  `https://github.com/Bluestep-Systems/b6p-cli/releases` (macOS arm64 and Windows x64).
- **`B6PT_TOKEN`** in your environment, for the bundled gateway MCP (see above).

## Keeping it updated

Claude Code: `/plugin marketplace update` (or turn on auto-update; the desktop app's marketplace
settings have **Sync automatically**). Cursor: imported marketplaces refresh from this repo on push.
Codex: update from the plugins screen or CLI, and **re-trust the hooks** after any release that
changes one — the [changelog](CHANGELOG.md) says which; an untrusted hook does nothing, silently.

Updating the plugin changes the skills, hooks and reference; it never rewrites the files
`/b6p-setup` put in your project. The next time you pull, plan or fix something in that project, the
setup step notices the old template (or a rules file from before the marker) and runs the update —
asking only if the file has lines of yours; or run `/b6p-setup` there yourself.

Internal staff may get the plugin pre-enabled through managed settings (`extraKnownMarketplaces`
plus `enabledPlugins`) instead of installing it by hand.

## Sharing it with your team

Commit the `AGENTS.md`, the `CLAUDE.md` bridge and, on Claude Code, the `.claude/settings.json`
that `/b6p-setup` writes: the rules and the marketplace registration then travel with the repo. The
plugin install itself is per machine — each teammate pastes the [Get started](../../README.md#get-started)
prompt once. Your project's `README.md` (also written by `/b6p-setup`) carries the install commands
and clicks, since Claude Code shows no hint when the plugin is missing.

## What you get

BlueStep developers work in local copies of components whose source of truth lives on the platform.
`bluestep-tools` packages the team's shared practice into a versioned plugin — one source, three
generated outputs — so everyone gets the same reviewed conventions with no per-project copying and no
drift.

- **Spec-driven workflow** — `/spec-create` → `/spec-execute` → `/spec-status`, plus `/quick-task` for small changes.
- **Platform sync** — `/b6p-pull`, `/b6p-push`, `/b6p-audit`; the agent usually runs these for you. `/b6p-push` tells you what a push will overwrite and delete on the platform before it goes.
- **Setup** — `/b6p-setup` (machine, project and update in one run) and `/bluestep-vite-report` (scaffold an off-platform Vite/Preact merge report).
- **Platform authoring** — the bundled `bluestep-gateway` MCP server (auto-registers once the plugin is enabled and `$B6PT_TOKEN` is set) lets the agent create and wire platform objects in-session.
- **Subagents** — `b6p-task-implementer` (isolated task execution), `b6p-commenter` (component README), `b6p-code-review` (report-only review).
- **Guardrail hooks** — block hand-edits to platform-generated files (`declarations/`, `B.d.ts`, …), and on Claude Code ask before a browser script changes data on an org. Claude Code blocks; Cursor is wired to block too (`preToolUse`, not yet confirmed on a live seat, and not on Windows); Codex runs them only once trusted. On Claude Code a session canary warns once if no JSON parser is on PATH, offers setup in a folder that holds components but no rules file, and says so when a project runs the git client-data check but `phi-guard` is not installed.
- **Client-data check in git** — `/b6p-setup` copies `pre-commit` and `pre-push` hooks into the project's `scripts/hooks/` (committed, so they work in every tool and for hand edits), and can turn on an optional model review of each push. How it works and what to do when it blocks: `bluestep-reference` → `conventions/client-data.md`. The check on an agent's writes as they happen is the separate, opt-in [`phi-guard`](../phi-guard/README.md) plugin.
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

The Get started prompt gives the agent these; they are here for the record.

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

**Cursor.** Git must be installed first: without it the plugin page shows `Failed to resolve git ref
"main" … spawn git ENOENT` (install Git, then fully restart Cursor). Connect GitHub to Cursor too (the
**Connect GitHub** button in the sidebar): without it the import adds nothing and shows no error, even
though the repo is public. Then Plugins → **Add Marketplace → Import from Repo** → `https://github.com/Bluestep-Systems/bspecs`
→ install **bluestep-tools** (enable it on the Manage screen if it is off). Open your project folder
first — skills and hooks are workspace-coupled. Updates arrive on their own. The edit guardrail runs
on Cursor's `preToolUse` event, wired to block before the edit lands (not yet confirmed on a live
seat; on Windows the `.sh` wrapper does not run under PowerShell, so there it does not protect). Do not judge the install by
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

## What is in this folder

- `skills/` — `/b6p-setup`, the `/b6p-*` platform CLI skills, the `/spec-*` workflow, `quick-task`,
  `task-comment`, `bspecs-feedback`, `bluestep-vite-report`, and `bluestep-reference` (the on-demand
  platform reference).
- `agents/` — the three BlueStep subagents.
- `hooks/` — `block-generated-files.sh`, `tab-guard.sh` (Claude Code only) and the session
  `canary.sh` (Claude Code only), wired in `hooks.json`.
- `.mcp.json` — bundles the `bluestep-gateway` MCP server.
- [`CHANGELOG.md`](CHANGELOG.md) — this plugin's release history.

The Cursor and Codex copies of this plugin are generated from this folder; never edit them by hand.

---

## For maintainers

Releasing, the three marketplaces, the generator and the feedback pipeline are the same for every
plugin in this repo, so they live in the [repo README → For maintainers](../../README.md#for-maintainers).
What is specific to this plugin:

- Its version is `version` in [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json); it is
  tagged `bluestep-tools-vX.Y.Z`, and its releases are the repo's "Latest". Tags from before the
  `plugins/` layout are `plugin-vX.Y.Z` and count as released versions of this plugin.
- `crossTool` is on, so a change under `tools/gen-cross-tool/` needs a bump here too.
- If a release changes a hook, say so in the [changelog](CHANGELOG.md) entry — Codex users must
  re-trust hooks after a hook-changing update or the guardrails silently stop running.
- This README ships with the plugin: editing it needs a version bump like any other file in this
  folder.
