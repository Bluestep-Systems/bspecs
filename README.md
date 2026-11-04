# bluestep — BlueStep tooling marketplace for AI coding agents

A public **plugin marketplace** for BlueStep (B6P) development, serving **Claude Code, Cursor and
OpenAI Codex**. This repo *is* the marketplace — three of them, one per tool, all built from the
same source in `plugins/`. Each plugin is installed on its own and released on its own: the one for
BlueStep component workspaces, an opt-in check that keeps client data out of committed files, base
tooling for every other repo, and the BlueStep One team tooling, which lives in its own repo.

## Plugins

Add the marketplace once per machine, then install the plugins you need:

- **Claude Code CLI:** `claude plugin marketplace add Bluestep-Systems/bluestep-ai`
- **Claude desktop app:** Customize → Plugins → **+** → Add marketplace → From repository →
  `https://github.com/Bluestep-Systems/bluestep-ai` → Browse plugins
- **Cursor:** connect GitHub first (without it the import silently adds nothing), then Plugins →
  Add Marketplace → Import from Repo → `https://github.com/Bluestep-Systems/bluestep-ai`
- **Codex:** `codex plugin marketplace add Bluestep-Systems/bluestep-ai`

| Plugin | For whom | Claude Code | Cursor | Codex | Docs |
| --- | --- | --- | --- | --- | --- |
| **`bluestep-tools`** | Anyone working in a BlueStep component workspace | `claude plugin install bluestep-tools@bluestep --scope user` | install **bluestep-tools** | install **bluestep-tools**, trust its hooks, copy its subagents | [README](plugins/bluestep-tools/README.md) |
| **`phi-guard`** | Machines that work on B6P projects with client data (opt-in) | `claude plugin install phi-guard@bluestep --scope user` | install **phi-guard** | install **phi-guard**, trust its hook | [README](plugins/phi-guard/README.md) |
| **`core-tools`** | Every repo that is not a BlueStep component workspace | `claude plugin install core-tools@bluestep --scope user` | not yet | not yet | [README](plugins/core-tools/README.md) |
| **`one-tools`** | Teams moving a Manage system into BlueStep One; needs bluestep-tools and core-tools | `claude plugin install one-tools@bluestep --scope user` | not listed | not listed | in its own repo (staff access) |

On the Claude desktop app, install each one from **Browse plugins** instead; plugins there are
managed by your claude.ai account, so the CLI commands do not apply. The per-tool details (VS Code,
JetBrains, Cursor's git requirement, Codex's subagent copy) are in the
[bluestep-tools README](plugins/bluestep-tools/README.md#install-details-per-tool).

## Get started

For BlueStep work, open your AI coding agent (Claude Code, Cursor or Codex) in any folder, paste
this, press enter:

> Set up the BlueStep developer tooling on this machine. Work it out by checking, not by asking me;
> the one question to ask me is in step 3.
> 1. Find out which agent tool you are running in (Claude Code CLI, the Claude desktop app, Cursor,
>    or Codex) and whether the `bluestep-tools` plugin from the `bluestep` marketplace
>    (`Bluestep-Systems/bluestep-ai`; an older install may show the repo's old name, `bspecs`, which
>    is the same marketplace) is already installed. Check `git --version` too: the tools download the plugin with git, and on
>    Windows its hooks run in Git Bash. If git is missing, tell me to install it (Windows: Git for
>    Windows from `https://git-scm.com/download/win`, default options) and fully restart the app.
> 2. If it is not: on the Claude Code CLI run `claude plugin marketplace add Bluestep-Systems/bluestep-ai`
>    and then `claude plugin install bluestep-tools@bluestep --scope user`. On Codex run
>    `codex plugin marketplace add Bluestep-Systems/bluestep-ai` and tell me to install bluestep-tools from
>    it, trust its hooks, and copy its three subagents from the installed plugin's `agents/` folder
>    into `~/.codex/agents/`. On the Claude desktop app or Cursor you cannot install it yourself: give
>    me the exact clicks (desktop app: Customize → Plugins → + → Add marketplace → From repository
>    `https://github.com/Bluestep-Systems/bluestep-ai` → Browse plugins → install bluestep-tools; Cursor:
>    Connect GitHub first (without it the import silently adds nothing) → Plugins → Add Marketplace → Import from Repo → `https://github.com/Bluestep-Systems/bluestep-ai` →
>    install bluestep-tools).
> 3. If the `phi-guard` plugin from the same marketplace is not installed, offer it in one line and
>    ask me whether this machine works on projects with client data: phi-guard blocks an agent's
>    Edit or Write that looks like real client data (phone numbers, email addresses, record titles);
>    it is installed once per machine, acts only in BlueStep projects, and can be turned off for one
>    project. If I say yes: on the Claude Code CLI run
>    `claude plugin install phi-guard@bluestep --scope user`; on Codex tell me to install phi-guard
>    from the marketplace and trust its hook; on the Claude desktop app give me the clicks
>    (Customize → Plugins → Browse plugins → phi-guard → Install); on Cursor tell me to install
>    phi-guard from the imported marketplace. If I say no, skip it.
> 4. Check whether the `b6p` command is on my PATH and, if it is, that `b6p --version` is 0.8.1 or
>    later. If it is missing or older and Node.js is installed, run
>    `npm i -g @bluestep-systems/b6p-cli@latest` (if my old `b6p` is a downloaded binary, give me
>    the new download instead); if Node is not installed, give me the download
>    link `https://github.com/Bluestep-Systems/b6p-cli/releases` for my OS (binaries exist for macOS
>    arm64 and Windows x64 — on Linux, WSL or an Intel Mac tell me to install Node first).
> 5. Tell me to run `b6p auth set` in my own terminal — never ask me for the token.
> 6. Check whether `B6PT_TOKEN` is set (`test -n "$B6PT_TOKEN" && echo OK`). The plugin's gateway MCP
>    needs it. If it is missing, tell me where to create my `b6pt_` token (BlueStep → Tools →
>    Organization Admin → Super tab → Global Users → my account → Access Tokens; if I have no Super
>    tab, I ask BlueStep for one) and how to set it for my OS (Windows: `setx B6PT_TOKEN "b6pt_…"`;
>    macOS/Linux: my shell profile). The same token works for `b6p auth set`. Never ask me for it.
> 7. Finish with one line: fully quit and reopen the app, start a **new** session in the folder
>    where my BlueStep work will live, and there type `/b6p-setup` — it checks that the gateway
>    answers.

What the agent will hand back to you, and why:

- **The install click**, on the Claude desktop app and Cursor — plugins there are installed from a
  screen the agent cannot reach. On the Claude Code CLI and Codex it runs the commands itself.
- **One question**: whether the machine works on projects with client data, which decides whether
  it installs `phi-guard`. Its [README](plugins/phi-guard/README.md) says what it covers and how to
  turn it off for one project.
- **`b6p auth set`** — the BlueStep access token for the `b6p` CLI is typed by a person, once per
  machine. The agent never sees it.
- **The platform token** — `B6PT_TOKEN`, set once per machine in your environment. The bundled
  gateway MCP, the plugin's main tool for reading and building on the platform, does not start
  without it. The agent never sees it.
- **A new session** — a plugin's skills and its gateway only exist in sessions started after the
  install (and, for a GUI app, after the token is set and the app is reopened).

Then set up your project with `/b6p-setup`: the
[bluestep-tools README](plugins/bluestep-tools/README.md#set-up-a-project) covers it, what you get,
and how to keep it updated.

---

## For maintainers

**Layout and distribution.** Each plugin is a folder under `plugins/<name>/` with its own
`.claude-plugin/plugin.json`. This repo doubles as **three marketplaces**, one per tool:
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) for Claude Code (one entry per
`plugins/<name>/`, plus one-tools as a GitHub-source entry),
[`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) for Cursor and
[`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json) for Codex — the latter two
are **generated**, and serve the trees under `dist/cursor/<name>/` and `dist/codex/<name>/`,
emitted from `plugins/**` by `tools/gen-cross-tool/` (`npm run gen`, from PowerShell or Git Bash on
a Windows checkout). The output is committed because git-based marketplace imports need it in the
tree, and never hand-edited — CI regenerates and diffs. There is **no npm publish and no binary
build** — each marketplace is a plain git repo tracking this repo's default branch. The npm CLI
that once scaffolded these files has been deleted; its old `vX.Y.Z` tags stay (see **Tags**). See
[`docs/decisions/plugin-distribution.md`](docs/decisions/plugin-distribution.md),
[`docs/decisions/cross-tool-plugin-output.md`](docs/decisions/cross-tool-plugin-output.md),
[`docs/decisions/setup-consolidation.md`](docs/decisions/setup-consolidation.md),
and
[`docs/decisions/content-sanitization-for-public-tooling.md`](docs/decisions/content-sanitization-for-public-tooling.md).

**`crossTool`.** Each manifest carries `"crossTool": true` or `false`. With `true`, the generator
emits that plugin for Cursor and Codex and lists it in their marketplaces (bluestep-tools,
phi-guard). With `false`, it is Claude Code-only: nothing under `dist/` and no generated
marketplace entry (core-tools, until its `lane/`, `docs/` and `tools/` folders are emitted too).

**Releasing.** Merging a version-bumped PR to `main` **is** the release — the tag and GitHub
Release are automated, one version stream per plugin. The `version` in
`plugins/<name>/.claude-plugin/plugin.json` is that plugin's single update signal for every tool
it ships to: the generated manifests mirror it, and each tool caches installs by it and **skips the
plugin on update when it is unchanged**. Merged changes stay dormant until a version bump ships them.

1. Bump `version` in the manifest of each plugin you changed (semver — patch = fix, minor =
   feature, major = breaking). Bump it for **any** change that alters what the plugin ships: every
   file in its folder counts, its README included, except its own `CHANGELOG.md`. A change under
   `tools/gen-cross-tool/` needs a bump of **every** plugin with `crossTool` on (a plugin whose
   output did not change gets a harmless no-op update).
2. Add the entry to that plugin's `CHANGELOG.md`
   ([bluestep-tools](plugins/bluestep-tools/CHANGELOG.md),
   [core-tools](plugins/core-tools/CHANGELOG.md); phi-guard's first release is described in its
   README). If the release changes a **hook**, say so — Codex users must re-trust hooks after a
   hook-changing update or the guardrails silently stop running.
3. Run `npm run gen` and commit the regenerated `dist/` and marketplace manifests alongside the
   source change; `npm run test:hooks` after touching a hook. The `cross-tool-drift` CI job
   regenerates and fails the PR on any diff, so stale output can't merge.
4. Merge to `main`. Done: users get everything since the previous version on their next update
   (Claude Code `autoUpdate` / `/plugin marketplace update`, Cursor marketplace auto-refresh, Codex
   update), and `.github/workflows/release-tag.yml` pushes a `<name>-vX.Y.Z` tag for each plugin
   whose version has none yet **and** creates its GitHub Release — no terminal step.

**Tags.** Each plugin has its own namespace, `<name>-vX.Y.Z` (`bluestep-tools-v0.42.0`,
`core-tools-v0.5.0`, `phi-guard-v0.1.0`). Only bluestep-tools releases are marked "Latest". The
`plugin-vX.Y.Z` tags from before the `plugins/` layout belong to bluestep-tools: they count as its
released versions and start its release notes until its first `bluestep-tools-v*` tag exists. The
plain `vX.Y.Z` tags (`v0.2.0`..`v0.15.0`) belong to the frozen npm-package history and must not be
reused. A Release's notes run from the plugin's previous tag, so the **first release of a new
plugin** has notes that cover only the PR that added it.

Manual tagging still works and simply pre-empts the automation for that plugin
(`git tag core-tools-v0.5.1 && git push origin core-tools-v0.5.1` —
`.github/workflows/publish.yml` cuts the Release for a human-pushed tag; both paths produce the
same Release shape).

CI's `plugin-version-bump` job fails a PR that changes `plugins/<name>/**` (other than that
plugin's `CHANGELOG.md`) without bumping that plugin, or `tools/gen-cross-tool/**` without bumping
every `crossTool` plugin, and fails a version whose tag already exists. Repo-only changes (docs,
CI, this README) need no bump and don't affect installs — and a merge to `main`
without a version change creates no tag and no Release, which is correct: nothing shipped.

**Adding a plugin.** Create `plugins/<name>/` with a `.claude-plugin/plugin.json` (`name` equal to
the folder, a `version`, `crossTool`), a README and, from its second release, a `CHANGELOG.md`; add
an entry to the `plugins[]` array in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
(`name`, `source: ./plugins/<name>`, `description`) — CI fails a folder with no entry, or an entry
whose name differs. Run `npm run gen`, and add a row to the [Plugins](#plugins) table above.

**Feedback pipeline.** `/bspecs-feedback` POSTs to a public BlueHQ intake
endpoint that files a ClickUp task on AI.List **and** a routed GitHub issue via
a GitHub App, links the two, and returns both URLs — no GitHub Actions, no repo
secret, no submitter account. The reporter's email is required at filing: when
the task is later closed with a `resolution` set, the endpoint emails the
reporter what happened (a `resolution-note` verbatim, an AI-drafted summary, or
generic wording) and comments the sent email back on the task. Setup and
credentials live on BlueHQ — see
[`docs/bluehq-feedback-endpoint-setup.md`](docs/bluehq-feedback-endpoint-setup.md).

**Proposing changes.** Found something that should improve across all BlueStep
projects — a skill, hook, reference rule, or subagent? Use the `/bspecs-feedback`
skill, or open an issue/PR in this repo. Once merged and released,
`/plugin marketplace update` propagates it.
