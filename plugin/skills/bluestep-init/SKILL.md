---
name: bluestep-init
description: Set up BlueStep (B6P) tooling in a project — new or existing — and activate the always-on platform rules. Non-destructive/idempotent: writes any missing per-project files (CLAUDE.md, README.md, package.json, .gitignore, .prettierrc) and a plugin-enabling .claude/settings.json, skips files that already exist, then guides git init. Use it to bootstrap a new project or to activate the BlueStep rules in an existing repo that doesn't have the project CLAUDE.md yet.
allowed-tools: Read Write Edit AskUserQuestion Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(date:*) Bash(mkdir:*)
---

# /bluestep-init — Bootstrap a BlueStep project

This skill sets up a BlueStep project in-session — either in the **current directory** or in a **new subfolder** — by writing the genuinely per-project files (a project `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `.prettierrc`) and a `.claude/settings.json` that enables the `bluestep-tools` plugin, then guiding `git init`. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped. That makes it just as much an **activation** step for an existing repo as a bootstrap step for a new one — a plugin can't ship always-on context, so the project `CLAUDE.md` written here is what makes the Tier-1 platform rules always-on.

## Collecting answers — use the picker, not a written questionnaire

Every choice below is asked with the **`AskUserQuestion`** tool so the user clicks an option instead of typing free-form answers to a list. The tool always offers an "Other" escape for a custom value, so use it even where the natural answer is a name. The **only** value asked as plain text is a brand-new subfolder's name (it has no presets). Ask one thing at a time; never dump a numbered list of questions for the user to answer by hand.

## Steps

### 1. Choose the target location

Detect the current directory's basename first: `basename "$PWD"`.

Ask with `AskUserQuestion`:

- **Question:** "Where should I set up the BlueStep project?"
- **Options:**
  - `Current directory (<basename>)` — *(recommended)* set up right here.
  - `New subfolder` — create a new folder here and set the project up inside it.

Resolve the target:

- **Current directory** → target dir is `.`; `PROJECT_NAME` = `<basename>`.
- **New subfolder** → ask the user for the folder name (this is the one free-text value — ask directly, since a new name has no presets). Then `mkdir -p "<name>"`. Target dir is `<name>`; `PROJECT_NAME` = `<name>`.

Record **`SCAFFOLD_DATE`** = today's date (`date +%Y-%m-%d`) — do not ask.

### 2. Client / organization

Ask with `AskUserQuestion`:

- **Question:** "Client / organization for this project?"
- **Options:**
  - `Set later` — *(recommended)* write the placeholder `BlueStep Client`; editable anytime in `CLAUDE.md`.
  - `Same as project name (<PROJECT_NAME>)` — for internal/solo projects.
  - *(Other)* — the user types the real client name.

Set `CLIENT_NAME` from the choice (`BlueStep Client` for "Set later").

> There is **no project-description prompt** — it was removed by design (the description is rarely known at init time and is better filled in later).

### 3. Write the per-project files into the target directory

For each template under `${CLAUDE_PLUGIN_ROOT}/skills/bluestep-init/templates/`, write into the **target directory** chosen in step 1:

| Template | Written to (relative to target dir) |
|---|---|
| `CLAUDE.md.template` | `CLAUDE.md` |
| `README.md.template` | `README.md` |
| `package.json.template` | `package.json` |
| `.gitignore.template` | `.gitignore` |
| `.prettierrc.template` | `.prettierrc` |

For each one:

1. **Read** the template.
2. **Substitute** the `{{VAR}}` placeholders: `{{PROJECT_NAME}}`, `{{CLIENT_NAME}}`, `{{SCAFFOLD_DATE}}`. (Only `CLAUDE.md`/`README.md`/`package.json` carry placeholders; the other two copy verbatim. There is no `{{PROJECT_DESCRIPTION}}`.)
3. **Skip if it already exists.** Before writing, check whether the destination file is already present. If it is, **do not overwrite it** — report it as skipped and move on.
4. **Write** the result, stripping the trailing `.template` from the name.

### 4. Write `.claude/settings.json`

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

### 5. Report written vs. skipped

List which files were written and which were skipped because they already existed. If anything was skipped, tell the user that those files were left untouched — to adopt the pristine tooling version, rename/move the local copy and re-run `/bluestep-init`. Call out `.claude/settings.json` specifically if it was skipped: an existing one may not register the marketplace / enable the plugin, so the plugin block may need to be merged in by hand (this only matters for teammates/CI if the plugin is already enabled globally via Claude's plugin settings).

### 6. Guide `git init`

If the target directory is not already a git repo, run `git init` in it (or tell the user to). A git repo matters because the spec-execute implementer agent reviews its work via `git diff` — without a repo there is no baseline diff to review.

### 7. (Optional) Set up the platform MCP token

The BlueStep platform MCP is reached through a **single bundled gateway** at
`https://gateway.bluestep.net/mcp` that surfaces every org you are allowed to reach. It ships **inside the
`bluestep-tools` plugin** (as the plugin's `bluestep-gateway` MCP server) and **auto-registers** as soon as
the plugin is enabled and the `$B6PT_TOKEN` environment variable is set — there is **no per-org connect
flow, no `claude mcp add`, and no hand-edited `.mcp.json`**. The only thing a user does is set the token
once.

> **Fresh-session caveat.** Plugin-bundled MCP tools register at **session start**. After enabling the
> plugin or setting the token, they appear only in a **new** session (or after `/reload-plugins`), not the
> current one.

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

**2. Put it in the environment Claude Code runs in** (this differs by OS):

- Linux / WSL / macOS, **launched from a terminal**: add `export B6PT_TOKEN="b6pt_…"` to your shell
  profile (`~/.bashrc` / `~/.zshrc`), then open a new terminal.
- Windows: `setx B6PT_TOKEN "b6pt_…"` (User scope), then restart the terminal / Claude Code. (`setx`
  reaches both terminal- and GUI-launched processes.)
- macOS / Linux, **launched from the GUI** (Spotlight / Dock / app icon): GUI apps do **not** read your
  shell profile, so an `export` in `.zshrc` will **not** reach a GUI-launched Claude Code. Either launch
  from a terminal, run `launchctl setenv B6PT_TOKEN "b6pt_…"` (macOS; clears on logout), or set it in the
  `env` block of `~/.claude/settings.json` (user home, never committed — or a gitignored
  `.claude/settings.local.json`; **never** the committed project `.claude/settings.json`) — a config file,
  so it works regardless of launch method or OS.

Then start a fresh session — the bundled gateway picks up the token automatically.

**Never** ask the user to paste the token into the chat, and never write the literal token into a file. The
bundled `.mcp.json` references `${B6PT_TOKEN}` — never the literal value.

#### Security & token handling

The `b6pt_` token is a **bearer credential for a global super-user** — whoever holds it can act as the user
across every org. Handle it accordingly, and be honest with the user about its limits.

- **Not encrypted at rest.** The token lives in plaintext in the `B6PT_TOKEN` env var (shell profile /
  Windows user env). It is user-private and uncommitted, but readable by any process running as the user.
  Claude Code has no encrypted-header MCP mechanism, so plaintext-user-private is the floor. This is a
  *separate* credential from the b6p CLI's encrypted `~/.b6p/` WebDAV creds.
- **Recommend an expiry + least-privilege scopes at creation.** The Access Tokens screen has Scopes and
  Expires columns; a never-expiring, unscoped global-super token is the riskiest shape. Setting an expiry
  and scopes — and questioning whether it needs to be a global-super token at all — reduces risk more than
  anything about where the token is stored.
- **Never print, echo, or leak the token.** Never paste it into chat, never write the literal value into a
  committed file, never send it anywhere other than the gateway's `Authorization` header over HTTPS (which
  the bundled `.mcp.json` does via `${B6PT_TOKEN}`). It grants global admin — a leaked value is a full
  platform compromise. If exposed, tell the user to **Revoke** it on that same screen and **rotate**.

> **Desktop-app note.** Plugin-bundled MCP is account-managed via claude.ai, not local `.mcp.json`, so
> desktop-app users may need to add the gateway **once** as a claude.ai custom connector (URL
> `https://gateway.bluestep.net/mcp`, Authorization `Bearer <b6pt_ token>`) rather than relying on the
> bundle. That is one gateway connector now — **not** one per org.

### 8. If a new subfolder — point the user at it

When the project was set up in a **new subfolder**, the current session is still rooted in the parent, so finish by telling the user:

> Project created in `./<name>`. Open that folder as a new Claude Code session (or reopen your workspace rooted there) to work in it — the `bluestep-tools` skills and hooks apply to whichever folder the session is opened in.

### 9. (Optional) plugin availability, b6p on PATH, and the MCP token

- If the plugin is enabled globally (via Claude's plugin settings / Customize), the skills and hooks are already available in every session — the `.claude/settings.json` block above mainly declares the dependency for teammates and CI. If it is **not** globally enabled, Claude Code offers a one-time install on the next folder-trust prompt, or the user can run `claude plugin install bluestep-tools@bluestep`.
- If you can tell `b6p` is not on PATH, note that it is a standalone binary installed separately (not an npm dependency) — install the b6p-cli binary from its release, and run `b6p auth set` once per machine, before using the `/b6p-*` skills.
- The **platform MCP** (the bundled `bluestep-gateway` server) authenticates with a **separate** credential from the b6p CLI: a global `b6pt_` access token, created once in the BlueStep UI and stored in the `B6PT_TOKEN` environment variable (step 7). It is *not* the same as the `b6p auth set` WebDAV credentials.

## Done

Summarize: the files written vs. skipped, the target directory, that `.claude/settings.json` enables the plugin, that `git init` ran, and whether the `$B6PT_TOKEN` was already set or still needs setup (the platform MCP gateway is bundled with the plugin and auto-registers once the token is set — no per-org connect step). If a new subfolder was created, repeat the "open a session in `./<name>`" instruction. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
