---
name: bluestep-init
description: Bootstrap a new BlueStep (B6P) project — in the current directory or a new subfolder — as the project-setup entry point. Writes the per-project CLAUDE.md, README.md, package.json, .gitignore, .prettierrc, and a plugin-enabling .claude/settings.json, then guides git init. Use when starting a new BlueStep project or setting up tooling in an empty/existing directory.
allowed-tools: Read Write Edit AskUserQuestion Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(date:*) Bash(mkdir:*)
---

# /bluestep-init — Bootstrap a BlueStep project

This skill sets up a BlueStep project in-session — either in the **current directory** or in a **new subfolder** — by writing the genuinely per-project files (a project `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `.prettierrc`) and a `.claude/settings.json` that enables the `bluestep-tools` plugin, then guiding `git init`. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped.

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

### 7. If a new subfolder — point the user at it

When the project was set up in a **new subfolder**, the current session is still rooted in the parent, so finish by telling the user:

> Project created in `./<name>`. Open that folder as a new Claude Code session (or reopen your workspace rooted there) to work in it — the `bluestep-tools` skills and hooks apply to whichever folder the session is opened in.

### 8. (Optional) plugin availability and b6p on PATH

- If the plugin is enabled globally (via Claude's plugin settings / Customize), the skills and hooks are already available in every session — the `.claude/settings.json` block above mainly declares the dependency for teammates and CI. If it is **not** globally enabled, Claude Code offers a one-time install on the next folder-trust prompt, or the user can run `claude plugin install bluestep-tools@bluestep`.
- If you can tell `b6p` is not on PATH, note that it is a standalone binary installed separately (not an npm dependency) — install the b6p-cli binary from its release, and run `b6p auth set` once per machine, before using the `/b6p-*` skills.

## Done

Summarize: the files written vs. skipped, the target directory, that `.claude/settings.json` enables the plugin, and that `git init` ran. If a new subfolder was created, repeat the "open a session in `./<name>`" instruction. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
