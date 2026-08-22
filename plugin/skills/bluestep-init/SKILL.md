---
name: bluestep-init
description: Set up BlueStep (B6P) tooling in a project — new or existing — and activate the always-on platform rules. Non-destructive and idempotent — writes any missing per-project files (AGENTS.md with the rules, a one-line CLAUDE.md bridge, README.md, package.json, .gitignore, .prettierrc), skips files that already exist, guides git init, then walks the enablement steps for whichever agent tool you are running in (Claude Code, Cursor, Codex). Use it to bootstrap a new project or to activate the BlueStep rules in an existing repo that doesn't have the project AGENTS.md yet.
allowed-tools: Read Write Edit AskUserQuestion Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(date:*) Bash(mkdir:*)
---

# /bluestep-init — Bootstrap a BlueStep project

This skill sets up a BlueStep project in-session — either in the **current directory** or in a **new subfolder** — by writing the genuinely per-project files (an `AGENTS.md` carrying the always-on rules, a one-line `CLAUDE.md` that imports it, plus `README.md`, `package.json`, `.gitignore`, `.prettierrc`), guiding `git init`, and then walking the **enablement** steps for the tool you are running in. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

The scaffold steps are **identical on every tool**. Only the last part (enablement: registering the marketplace, installing/enabling the plugin, trusting hooks) differs, and each tool has its own subsection below.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped. That makes it just as much an **activation** step for an existing repo as a bootstrap step for a new one — a plugin can't ship always-on context, so the project `AGENTS.md` written here is what makes the Tier-1 platform rules always-on.

## Collecting answers — use the picker, not a written questionnaire

Ask every choice below as a **structured question with clickable options** where the tool supports them (`AskUserQuestion` in Claude Code), so the user clicks an option instead of typing free-form answers to a list. Always keep an "Other" escape for a custom value (`AskUserQuestion` adds one automatically in Claude Code; add it yourself where the tool doesn't) — so use the picker even where the natural answer is a name. The **only** value asked as plain text is a brand-new subfolder's name (it has no presets). Ask one thing at a time; never dump a numbered list of questions for the user to answer by hand.

## Steps

### 1. Choose the target location

Detect the current directory's basename first: `basename "$PWD"`.

Ask (structured question, clickable options — per the picker rule above):

- **Question:** "Where should I set up the BlueStep project?"
- **Options:**
  - `Current directory (<basename>)` — *(recommended)* set up right here.
  - `New subfolder` — create a new folder here and set the project up inside it.

Resolve the target:

- **Current directory** → target dir is `.`; `PROJECT_NAME` = `<basename>`.
- **New subfolder** → ask the user for the folder name (this is the one free-text value — ask directly, since a new name has no presets). Then `mkdir -p "<name>"`. Target dir is `<name>`; `PROJECT_NAME` = `<name>`.

Record **`SCAFFOLD_DATE`** = today's date (`date +%Y-%m-%d`) — do not ask.

### 2. Client / organization

Ask (structured question, clickable options — per the picker rule above):

- **Question:** "Client / organization for this project?"
- **Options:**
  - `Set later` — *(recommended)* write the placeholder `BlueStep Client`; editable anytime in `AGENTS.md`.
  - `Same as project name (<PROJECT_NAME>)` — for internal/solo projects.
  - *(Other)* — the user types the real client name.

Set `CLIENT_NAME` from the choice (`BlueStep Client` for "Set later").

> There is **no project-description prompt** — it was removed by design (the description is rarely known at init time and is better filled in later).

### 3. Write the per-project files into the target directory

For each template under `${CLAUDE_PLUGIN_ROOT}/skills/bluestep-init/templates/`, write into the **target directory** chosen in step 1:

| Template | Written to (relative to target dir) |
|---|---|
| `AGENTS.md.template` | `AGENTS.md` |
| `CLAUDE.md.template` | `CLAUDE.md` |
| `README.md.template` | `README.md` |
| `package.json.template` | `package.json` |
| `.gitignore.template` | `.gitignore` |
| `.prettierrc.template` | `.prettierrc` |

`AGENTS.md` carries the rules; `CLAUDE.md` is a one-line bridge (a comment plus `@AGENTS.md`) that carries no rules of its own. **Write both regardless of which tool you are running in** — `AGENTS.md` is read natively by Cursor, Codex, and most other agents, and the bridge is what makes the same rules reach Claude Code (which does not read `AGENTS.md` on its own). A teammate on another tool then gets the same project.

For each one:

1. **Read** the template.
2. **Substitute** the `{{VAR}}` placeholders: `{{PROJECT_NAME}}`, `{{CLIENT_NAME}}`, `{{SCAFFOLD_DATE}}`. (Only `AGENTS.md`/`README.md`/`package.json` carry placeholders; the other three copy verbatim. There is no `{{PROJECT_DESCRIPTION}}`.)
3. **Skip if it already exists.** Before writing, check whether the destination file is already present. If it is, **do not overwrite it** — report it as skipped and move on. This includes `AGENTS.md`: an existing one is left exactly as it is.
4. **Write** the result, stripping the trailing `.template` from the name.

#### An existing `CLAUDE.md` is never overwritten

Projects bootstrapped before the `AGENTS.md` split keep their rules in `CLAUDE.md`. That must keep working. Look at what the existing file contains:

- **Already a bridge** (nothing but a comment and an `@AGENTS.md` import) → nothing to do; report it as skipped.
- **Populated** (it carries real rules) → **never overwrite it, never delete it, and never move its content on your own.** Offer the migration once and perform it **only** if the user explicitly agrees:
  1. Move the file's content into `AGENTS.md` — only if `AGENTS.md` does not already exist. If both exist and both have content, show the user what is in each and let them decide; never merge or clobber silently.
  2. Replace `CLAUDE.md` with the one-line bridge from `CLAUDE.md.template`.

  If the user declines, says nothing, or you are unsure, **leave both files exactly as they are** — Claude Code keeps reading the populated `CLAUDE.md` and the project keeps working. Say so in the report, and note the consequence: agents that only read `AGENTS.md` (Cursor, Codex) will not see those rules until the migration happens.

Ask the migration question one question at a time, with clickable options where the tool supports structured questions.

### 4. Guide `git init`

If the target directory is not already a git repo, run `git init` in it (or tell the user to). A git repo matters because the spec-execute implementer agent reviews its work via `git diff` — without a repo there is no baseline diff to review.

### 5. Note whether `b6p` is on PATH

If you can tell `b6p` is not on PATH, note that it is a standalone binary installed separately (not an npm dependency) — install the b6p-cli binary from its release, and run `b6p auth set` once per machine, before using the `/b6p-*` skills.

### 6. Report written vs. skipped

List which files were written and which were skipped because they already existed. If anything was skipped, tell the user that those files were left untouched — to adopt the pristine tooling version, rename/move the local copy and re-run `/bluestep-init`. If a populated `CLAUDE.md` was found, state which of the two outcomes happened (migrated with the user's agreement, or left as-is).

### 7. If a new subfolder — point the user at it

When the project was set up in a **new subfolder**, the current session is still rooted in the parent, so tell the user (and repeat it in the final summary):

> Project created in `./<name>`. Open that folder as a new session in your agent tool (or reopen your workspace rooted there) to work in it — the `bluestep-tools` skills and hooks apply to whichever folder the session is opened in.

## Enablement — follow the subsection for the tool you are running in

The scaffold above is the same everywhere. Getting the `bluestep-tools` plugin itself live is not: each tool has its own marketplace and install flow. **Do the subsection for the tool you are running in, and skip the others** — but mention in the summary that the other subsections exist, so the user can hand them to a teammate on a different tool.

### Claude Code

In the target directory, create `.claude/` if needed, then write `.claude/settings.json` with **exactly** this shape (skip if it already exists). No `hooks` block and no `SessionStart` sync — hooks come from the plugin.

```json
{
  "permissions": {
    "allow": [
      "Edit(**/*.md)",
      "Bash(git:*)",
      "Bash(b6p:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Edit(.claude/specs/**)",
      "Write(.claude/specs/**)"
    ]
  },
  "extraKnownMarketplaces": {
    "bluestep": {
      "source": {
        "source": "github",
        "repo": "Bluestep-Systems/bspecs"
      }
    }
  },
  "enabledPlugins": ["bluestep-tools@bluestep"]
}
```

- **If it was skipped**, call that out: an existing `settings.json` may not register the marketplace / enable the plugin, so the marketplace + `enabledPlugins` block may need to be merged in by hand. This only matters for teammates and CI if the plugin is already enabled globally in the user's own plugin settings.
- If the plugin is enabled globally (via Claude Code's plugin settings / Customize), the skills and hooks are already available in every session — the settings block above mainly declares the dependency for teammates and CI. If it is **not** globally enabled, Claude Code offers a one-time install on the next folder-trust prompt, or the user can run `claude plugin install bluestep-tools@bluestep`.
- Plugin-bundled surfaces (MCP servers, hooks) load at session start: after enabling, use a fresh session or `/reload-plugins`.
- **Desktop-app note.** Plugin-bundled MCP is account-managed via claude.ai, not local config, so desktop-app users may need to add the gateway **once** as a claude.ai custom connector (URL `https://gateway.bluestep.net/mcp`, Authorization `Bearer <b6pt_ token>`) rather than relying on the bundle. That is one gateway connector — **not** one per org.

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
- **Subagents do not come from the plugin on Codex.** A plugin cannot register them there, so the three BlueStep subagents have to live in the project's `.codex/agents/` instead (as TOML, with underscore names — `b6p_task_implementer`, `b6p_commenter`, `b6p_code_review`; hyphens are not valid agent names on Codex). Writing them is **not** part of this skill yet — until it is, tell the user that delegation is unavailable on Codex and the spec skills run in-session instead of handing work to a subagent. Do not pretend a subagent exists.

The gateway MCP server ships with the plugin and comes up once the token below is set — note that GUI apps only see the environment they were launched with, so a token set in a shell session does not reach them.

## Platform token — `B6PT_TOKEN` (all tools)

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

Summarize: the files written vs. skipped (and, if a populated `CLAUDE.md` was found, what happened to it), the target directory, which tool's enablement subsection you walked and what is left for the user to click, that `git init` ran, and whether `$B6PT_TOKEN` was already set or still needs setup (the platform MCP gateway is bundled with the plugin and auto-registers once the token is set — no per-org connect step). If a new subfolder was created, repeat the "open a session in `./<name>`" instruction. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
