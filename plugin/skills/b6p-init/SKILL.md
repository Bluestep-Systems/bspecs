---
name: b6p-init
description: One-time BlueStep (B6P) tooling setup for this machine and the agent tool you are running in — install the b6p CLI binary and authenticate it, register the bluestep marketplace and install the bluestep-tools plugin (Claude Code, Cursor, Codex), trust the hooks on Codex, and set the B6PT_TOKEN that the platform gateway MCP needs. Idempotent — checks each item and skips what is already done. Run it once per machine; the per-project files are /project-init.
allowed-tools: Read AskUserQuestion Bash(b6p:*) Bash(claude:*) Bash(command:*) Bash(test:*) Bash(ls:*)
---

# /b6p-init — Once-per-machine BlueStep setup

This skill covers everything that is done **once on a machine**, for the agent tool you are running in, and never again per project: the `b6p` CLI and its credentials, the marketplace + plugin install, hook trust where the tool needs it, and the platform token for the gateway MCP. The per-project files (`AGENTS.md`, the `CLAUDE.md` bridge, `README.md`, `package.json`, Claude Code's project settings) are `/project-init`; run that in each project afterwards.

Every step below is a **check first, then act only if missing**. Nothing here is destructive, and every item can be skipped and finished later. Ask choices as structured questions with clickable options where the tool supports them (`AskUserQuestion` in Claude Code); never a written questionnaire.

## 1. The `b6p` CLI

`b6p` is a **standalone binary** installed separately on the machine — never an npm dependency of a project.

- Check: `command -v b6p`. Present → say so, move on.
- Missing → tell the user to install it from the b6p-cli release (`https://github.com/Bluestep-Systems/b6p-cli/releases`: `b6p-windows-x64.exe`, `b6p-macos-x64`, `b6p-macos-arm64`; or `npm i -g @bluestep-systems/b6p-cli` on a machine that has Node). Do not install it yourself.

Then the credentials: `b6p` needs a BlueStep **access token** stored in `~/.b6p/` (once per machine). The first command on a machine without one stops at an interactive prompt the agent cannot answer and exits `1`, so the user runs this once, in their own terminal:

```
b6p auth set
```

Upgrading from a pre-0.6.0 `b6p` re-prompts once — bearer auth replaced the old username + password. This CLI token is a **different credential** from the `B6PT_TOKEN` in step 3; setting one does nothing for the other.

## 2. Plugin enablement — follow the subsection for the tool you are running in

Each tool has its own marketplace and install flow. **Do the subsection for the tool you are running in, and skip the others** — but mention in the summary that the other subsections exist, so the user can hand them to a teammate on a different tool.

### Claude Code

Two scopes:

- **Once per machine (this skill):** the plugin is installed at **user scope** — `claude plugin marketplace add Bluestep-Systems/bspecs`, then `claude plugin install bluestep-tools@bluestep` (the README's step 1; internal staff usually get both through managed settings). If this skill is running, that part is already done on this tool; confirm the marketplace is registered with `claude plugin marketplace list` so updates arrive. A user-scope install loads the B6P skills, hooks and gateway MCP in every session on the machine, B6P project or not. That is by design: the skills are what run `/project-init` in a new, empty folder. The cost elsewhere is a few slash-menu entries, the MCP connection, and two hooks that act only on platform-generated declaration files and on `tsc`.
- **Per project (`/project-init`):** writes the project's `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`) so the setup travels with the repo: a teammate who clones is offered the plugin on folder trust, and CI sees the dependency. It does not replace the install above.

Plugin-bundled surfaces (MCP servers, hooks) load at session start: after enabling, use a fresh session or `/reload-plugins`.

**Desktop-app note.** Plugin-bundled MCP is account-managed via claude.ai, not local config, so desktop-app users may need to add the gateway **once** as a claude.ai custom connector (URL `https://gateway.bluestep.net/mcp`, Authorization `Bearer <b6pt_ token>`) rather than relying on the bundle. That is one gateway connector — **not** one per org.

### Cursor

Enablement is UI-driven; there is no settings file to write. Tell the user:

1. **Add the marketplace:** Cursor → plugins → **Add Marketplace → Import from Repo**, with the bspecs repo URL `https://github.com/Bluestep-Systems/bspecs`. A marketplace source must be a **committed git repo** (this one is — a plain local folder does not resolve unless it is a git repo with a commit).
2. **Install `bluestep-tools`** from that marketplace, and enable it on the Manage screen if it is not on by default.

Worth saying out loud:

- **Skills and hooks are workspace-coupled.** Open the project folder before installing/using them — an empty window shows only user-global surfaces (the MCP server), and a project-scoped install needs an open workspace.
- **Updates** arrive by themselves: an imported marketplace refreshes from the repo, so a new plugin version shows up without re-importing.
- If Claude Code on the same machine already has the `bluestep` marketplace registered, Cursor may have imported it on its own — the skills can appear in the slash menu before you do anything.

### Codex

1. **Add the marketplace:** `codex plugin marketplace add Bluestep-Systems/bspecs` (CLI), or add the same repo from the plugins screen in the desktop app.
2. **Install `bluestep-tools`** from it.

Then two steps that are easy to miss and that the tooling genuinely depends on:

- **Trust the hooks — they silently do nothing until you do.** Open the plugin's page and use **Review → trust** on its hooks (`/hooks` in the CLI). An untrusted hook produces no error and no log; the guardrails simply never run. **Re-trust is required after any release that changes a hook definition**, so re-check this after a plugin update.
- **Subagents do not come from the plugin on Codex.** A plugin cannot register them there, so the three BlueStep subagents (TOML, underscore names — `b6p_task_implementer`, `b6p_commenter`, `b6p_code_review`; hyphens are not valid agent names on Codex) have to be copied by hand from the installed plugin's `agents/` folder into `~/.codex/agents/` — once per machine, covers every project. (A project's own `.codex/agents/` also works, but then it is a per-project step.) This skill tells the user to do that; it does not copy the files yet. Until the copy is done, say plainly that delegation is unavailable on Codex and the spec skills run in-session instead of handing work to a subagent. Do not pretend a subagent exists.

The gateway MCP server ships with the plugin and comes up once the token below is set — note that GUI apps only see the environment they were launched with, so a token set in a shell session does not reach them.

## 3. Platform token — `B6PT_TOKEN` (all tools)

The BlueStep platform MCP is reached through a **single bundled gateway** at
`https://gateway.bluestep.net/mcp` that surfaces every org you are allowed to reach. It ships **inside the
`bluestep-tools` plugin** (as the plugin's `bluestep-gateway` MCP server) and **auto-registers** as soon as
the plugin is enabled and the `$B6PT_TOKEN` environment variable is set — there is **no per-org connect
flow and no hand-edited MCP config**. The only thing a user does is set the token once. The token is
**tool-independent**: it lives in the OS environment, so the same one serves every tool on the machine.

> **Fresh-session caveat.** Plugin-bundled MCP servers register when a session **starts**. After enabling the
> plugin or setting the token, the gateway tools appear only in a **new** session — and for a GUI-launched
> app that means quitting and reopening the app entirely, not just opening a new tab or window.

This step is **optional and non-destructive** — a project is often created before the token exists, so it
must be skippable. **First check whether the token is already set:**

```
test -n "$B6PT_TOKEN" && echo OK
```

- Prints `OK` → the token is already set; say so and move on. Note that the bundled gateway will register
  in the next fresh session; nothing more to do here.
- Prints nothing → offer the two one-time setup steps below (do not force them).

> **Access reality.** The `b6pt_` token requires super-user access (**Super tab → Global Users → Access
> Tokens**). If Organization Admin shows **no "Super" tab**, you can't self-create a token — **request a
> token / MCP enablement from BlueStep** rather than hunting for the screen. (A later 404 for a specific org
> = that org doesn't expose `/mcp`; see `conventions/mcp-platform-authoring.md`, don't retry.)

If you **do** have super-user access, the happy path is:

**1. Create the token (once, in any org — it works globally):**
BlueStep UI → **Tools → Organization Admin → Super tab → Global Users →** find yourself → edit (pencil) →
**Access Tokens → Create New Token**. Copy the `b6pt_…` value.

**2. Put it in the environment your agent tool runs in** (this differs by OS):

- Linux / WSL / macOS, **launched from a terminal**: add `export B6PT_TOKEN="b6pt_…"` to your shell
  profile (`~/.bashrc` / `~/.zshrc`), then open a new terminal.
- **Windows**: `setx B6PT_TOKEN "b6pt_…"` — **User scope** — then **fully restart the app** (quit it, don't
  just open a new terminal or window). A variable exported in a shell session never reaches a
  GUI-launched app; only the persisted User-scope variable does, and only for processes started after it
  was set.
- macOS / Linux, **launched from the GUI** (Spotlight / Dock / app icon): GUI apps do **not** read your
  shell profile, so an `export` in `.zshrc` will **not** reach them. Either launch from a terminal, run
  `launchctl setenv B6PT_TOKEN "b6pt_…"` (macOS; clears on logout), or set it in a user-level config the
  tool reads (Claude Code: the `env` block of `~/.claude/settings.json` in your home dir, never committed —
  or a gitignored `.claude/settings.local.json`; **never** the committed project settings file).

Then start a fresh session — the bundled gateway picks up the token automatically.

**Never** ask the user to paste the token into the chat, and never write the literal token into a file. The
bundled MCP config references the `B6PT_TOKEN` env var — never the literal value.

### Security & token handling

The `b6pt_` token is a **bearer credential for a global super-user** — whoever holds it can act as the user
across every org. Handle it accordingly, and be honest with the user about its limits.

- **Not encrypted at rest.** The token lives in plaintext in the `B6PT_TOKEN` env var (shell profile /
  Windows user env). It is user-private and uncommitted, but readable by any process running as the user.
  No agent tool offers an encrypted-header MCP mechanism, so plaintext-user-private is the floor. This is a
  **separate credential from the b6p CLI's**, set up independently: the CLI stores its own platform access
  token, encrypted, in `~/.b6p/` via `b6p auth set` (bearer since b6p-cli 0.6.0), while this one lives in the
  `B6PT_TOKEN` env var and authenticates the gateway MCP. Both are now bearer tokens, so keep them straight —
  configuring one does nothing for the other.
- **Recommend an expiry + least-privilege scopes at creation.** The Access Tokens screen has Scopes and
  Expires columns; a never-expiring, unscoped global-super token is the riskiest shape. Setting an expiry
  and scopes — and questioning whether it needs to be a global-super token at all — reduces risk more than
  anything about where the token is stored.
- **Never print, echo, or leak the token.** Never paste it into chat, never write the literal value into a
  committed file, never send it anywhere other than the gateway's `Authorization` header over HTTPS (which
  the bundled MCP config does via the env var). It grants global admin — a leaked value is a full platform
  compromise. If exposed, tell the user to **Revoke** it on that same screen and **rotate**.

## Done

Summarize, item by item: `b6p` present or still to install; `b6p auth set` done or still to run; which tool's enablement subsection you walked and what is left for the user to click (on Codex: hook trust and the agents copy); whether `$B6PT_TOKEN` was already set or still needs setup (the gateway MCP auto-registers in the next fresh session once it is). Then point at `/project-init` for each project, and `/b6p-pull <DAV URL>` after that.
