---
name: project-init
description: Set up one BlueStep (B6P) project — new or existing — in the current directory or a new subfolder. Non-destructive and idempotent — writes any missing per-project files (a short AGENTS.md with the always-on platform rules, a one-line CLAUDE.md bridge, README.md, package.json, .gitignore, .prettierrc), skips files that already exist, guides git init, and on Claude Code writes the project settings that enable the bluestep-tools plugin. Run it once per project; the once-per-machine setup (b6p CLI, plugin install, platform token) is /b6p-init.
allowed-tools: Read Write Edit AskUserQuestion Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(date:*) Bash(mkdir:*) Bash(command:*) Bash(test:*)
---

# /project-init — Set up one BlueStep project

This skill sets up a BlueStep project in-session — either in the **current directory** or in a **new subfolder** — by writing the genuinely per-project files (a short `AGENTS.md` carrying the always-on rules, a one-line `CLAUDE.md` that imports it, plus `README.md`, `package.json`, `.gitignore`, `.prettierrc`), guiding `git init`, and on Claude Code writing the project settings file that enables the plugin. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

It is **per project**. Everything that is done **once per machine** — installing the `b6p` CLI and authenticating it, registering the marketplace and installing the plugin, trusting hooks on Codex, setting the platform token — is `/b6p-init`. This skill only checks those at the end and points there when something is missing.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped. That makes it just as much an **activation** step for an existing repo as a bootstrap step for a new one — a plugin can't ship always-on context, so the project `AGENTS.md` written here is what makes the always-on platform rules reach every session.

**The shipped `AGENTS.md` is short on purpose** (about 40 lines). It carries only what must be true in every turn: the platform rules no hook enforces, how to read the workspace, the spec/quick-task routing rule, and the compaction rule. Everything else — the `B` API, the module tree, the per-component import model, the push modes — is in the `bluestep-reference` skill and the `/b6p-*` skills, which the agent reads when the task needs them. Do not pad the file back out.

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

For each template under `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/`, write into the **target directory** chosen in step 1:

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

#### An existing long `AGENTS.md` from an earlier template

Projects set up before plugin 0.33.0 carry the old 140-line `AGENTS.md` (recognisable by its `## Critical rules (always apply)` heading and the `## Skill quick reference` table). It still works, but it costs about 4 K tokens on every turn for content the plugin now serves on demand. Offer the swap once and perform it **only** if the user agrees:

1. Diff the existing file against the old template shape: any line that is **not** template text is a project-specific rule. List those lines to the user.
2. Write the new short `AGENTS.md` from the template, then append the project-specific lines under `## Platform rules` (or a `## Project rules` heading if they are not platform rules).
3. Show the result before saving. Never drop a project-specific line silently.

If the user declines, leave the file exactly as it is and say so.

### 4. Guide `git init`

If the target directory is not already a git repo, run `git init` in it (or tell the user to). A git repo matters because the spec-execute implementer agent reviews its work via `git diff` — without a repo there is no baseline diff to review.

### 5. Claude Code only — write the project settings

In the target directory, create `.claude/` if needed, then write `.claude/settings.json` with **exactly** this shape (skip if it already exists). No `hooks` block and no `SessionStart` sync — hooks come from the plugin. `autoCompactWindow` makes Claude Code compact at 400 K tokens instead of near the 1M limit on Fable / `opus[1m]` sessions; it is a no-op on 200 K models. Measured on real sessions it is the single largest quota saving available, and compaction keeps CLAUDE.md, the plan, and recently edited files.

```json
{
  "autoCompactWindow": 400000,
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

- **If it was skipped**, call that out: an existing `settings.json` may not register the marketplace / enable the plugin, so the marketplace + `enabledPlugins` block may need to be merged in by hand.
- This file is what enables the plugin **for this project**. Enabling it at user scope instead is possible but loads the B6P skills, hooks and gateway MCP into every non-B6P session on the machine, so prefer the project file. On a fresh clone Claude Code offers the one-time install on the folder-trust prompt, or the user runs `claude plugin install bluestep-tools@bluestep`.
- Plugin-bundled surfaces (MCP servers, hooks) load at session start: after enabling, Claude Code needs a fresh session or `/reload-plugins`.

### 6. Check the once-only setup

Run these checks and report, but **do not perform the setup here** — it is `/b6p-init`'s job:

- `command -v b6p` → if missing, the `b6p` CLI binary is not installed (or not on PATH).
- `test -n "$B6PT_TOKEN"` → if empty, the platform gateway MCP will not come up.
- Whether the `bluestep-tools` plugin is enabled in the tool you are running in (the `/b6p-*` skills being invocable is the tell).

If any of the three is missing, end the report with: "Run `/b6p-init` once on this machine to finish the setup." Do not block on it — the files written here are useful regardless.

### 7. Report written vs. skipped

List which files were written and which were skipped because they already existed. If anything was skipped, tell the user that those files were left untouched — to adopt the pristine tooling version, rename/move the local copy and re-run `/project-init`. If a populated `CLAUDE.md` was found, state which of the two outcomes happened (migrated with the user's agreement, or left as-is).

### 8. If a new subfolder — point the user at it

When the project was set up in a **new subfolder**, the current session is still rooted in the parent, so tell the user (and repeat it in the final summary):

> Project created in `./<name>`. Open that folder as a new session in your agent tool (or reopen your workspace rooted there) to work in it — the `bluestep-tools` skills and hooks apply to whichever folder the session is opened in.

## Done

Summarize: the files written vs. skipped (and, if a populated `CLAUDE.md` or an old long `AGENTS.md` was found, what happened to it), the target directory, that `git init` ran, whether the Claude Code project settings were written, and which once-only items `/b6p-init` still has to cover on this machine. If a new subfolder was created, repeat the "open a session in `./<name>`" instruction. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
