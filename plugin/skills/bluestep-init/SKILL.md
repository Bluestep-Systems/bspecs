---
name: bluestep-init
description: Bootstrap a new BlueStep (B6P) project in the current directory — the project-setup entry point. Writes the per-project CLAUDE.md, README.md, package.json, .gitignore, .prettierrc, and a plugin-enabling .claude/settings.json, then guides git init. Use when starting a new BlueStep project or setting up tooling in an empty/existing directory.
allowed-tools: Read Write Edit Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(date:*)
---

# /bluestep-init — Bootstrap a BlueStep project

This skill sets up a BlueStep project in the **current directory** in-session: it writes the genuinely per-project files (a project `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `.prettierrc`) and a `.claude/settings.json` that enables the `bluestep-tools` plugin, then guides `git init`. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped (mirroring the old `init` behavior).

## Steps

### 1. Gather project values

Ask the user conversationally for these template values:

- **`PROJECT_NAME`** — default to the current directory's basename (`basename "$PWD"`). Confirm or override.
- **`CLIENT_NAME`** — the client/organization this project is for.
- **`PROJECT_DESCRIPTION`** — a one-line description. **Optional** — may be left empty.

Also capture **`SCAFFOLD_DATE`** = today's date (`date +%Y-%m-%d`) — do not ask, just record it.

Ask the optional values only once; if the user skips one, substitute an empty string for it.

### 2. Write the per-project files from the bundled templates

For each template under `${CLAUDE_PLUGIN_ROOT}/skills/bluestep-init/templates/`:

| Template | Written to |
|---|---|
| `CLAUDE.md.template` | `CLAUDE.md` |
| `README.md.template` | `README.md` |
| `package.json.template` | `package.json` |
| `.gitignore.template` | `.gitignore` |
| `.prettierrc.template` | `.prettierrc` |

For each one:

1. **Read** the template.
2. **Substitute** the `{{VAR}}` placeholders with the gathered values: `{{PROJECT_NAME}}`, `{{CLIENT_NAME}}`, `{{PROJECT_DESCRIPTION}}`, `{{SCAFFOLD_DATE}}`. (Only `CLAUDE.md`/`README.md`/`package.json` carry placeholders; the other two copy verbatim.)
3. **Skip if it already exists.** Before writing, check whether the destination file is already present. If it is, **do not overwrite it** — report it as skipped and move on.
4. **Write** the result to the project root, stripping the trailing `.template` from the name (`CLAUDE.md.template` → `CLAUDE.md`, etc.).

Report which files were written and which were skipped.

### 3. Write `.claude/settings.json`

Create `.claude/` if needed, then write `.claude/settings.json` with **exactly** this shape (skip if it already exists). Note: **no `hooks` block and no `SessionStart` sync** — hooks come from the plugin.

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

### 4. Guide `git init`

If the directory is not already a git repo, run `git init` (or tell the user to). A git repo matters because the spec-execute implementer agent reviews its work via `git diff` — without a repo there is no baseline diff to review.

### 5. Note the one-time plugin install

Enabling a plugin via project settings is **not silent**. Tell the user:

> The `bluestep-tools` plugin is enabled in `.claude/settings.json`, but Claude Code does not auto-install it silently. On the next folder-trust prompt Claude Code will offer to install it — or you can run `claude plugin install bluestep-tools@bluestep` now. Until it is installed, the `/b6p-*`, `/spec-*`, and other skills will not be available.

### 6. (Optional) b6p on PATH

If you can tell that `b6p` is not on PATH, note that the `b6p` CLI is a standalone binary installed separately (not an npm dependency) — install the b6p-cli binary from its release before using the `/b6p-*` skills, and run `b6p auth set` once per machine.

## Done

Summarize: the files written vs. skipped, that `.claude/settings.json` enables the plugin (pending the one-time install confirmation), and that `git init` ran. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
