---
name: project-init
description: Set up one BlueStep (B6P) project — new or existing — in the current directory. Non-destructive and idempotent — writes any missing per-project files (a short AGENTS.md with the always-on platform rules, a one-line CLAUDE.md bridge, README.md, package.json, .gitignore, .prettierrc), skips files that already exist, guides git init, and on Claude Code writes the project settings that enable the bluestep-tools plugin. Asks nothing on a fresh folder; the only questions are offers for files from an older setup. Run it once per project; the once-per-machine setup (b6p CLI, plugin install, platform token) is /b6p-init.
allowed-tools: Read Write Edit AskUserQuestion Bash(git:*) Bash(ls:*) Bash(basename:*) Bash(mkdir:*) Bash(command:*) Bash(test:*)
---

# /project-init — Set up one BlueStep project

This skill sets up a BlueStep project in-session, in the **current directory**, by writing the genuinely per-project files (a short `AGENTS.md` carrying the always-on rules, a one-line `CLAUDE.md` that imports it, plus `README.md`, `package.json`, `.gitignore`, `.prettierrc`), guiding `git init`, and on Claude Code writing the project settings file that enables the plugin. The shared tooling — skills, subagents, hooks, and the BlueStep reference — comes from the `bluestep-tools` plugin, not from files written here.

It is **per project**. Everything that is done **once per machine** — installing the `b6p` CLI and authenticating it, registering the marketplace and installing the plugin, trusting hooks on Codex, setting the platform token — is `/b6p-init`. This skill only checks those at the end and points there when something is missing.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped. That makes it just as much an **activation** step for an existing repo as a bootstrap step for a new one — a plugin can't ship always-on context, so the project `AGENTS.md` written here is what makes the always-on platform rules reach every session.

**The shipped `AGENTS.md` is short on purpose** (about 40 lines) and carries a version marker on its third line, `<!-- bluestep-tools rules-template 2 -->`, so a later update skill can tell which template a project has without pattern-matching headings. Never strip it; bump it in the template only for a change that warrants swapping existing files, not for wording fixes. It carries only what must be true in every turn: the platform rules, how to read the workspace, the spec/quick-task routing rule, and the compaction rule. Everything else — the `B` API, the module tree, the per-component import model, the push modes — is in the `bluestep-reference` skill and the `/b6p-*` skills, which the agent reads when the task needs them. Do not pad the file back out.

## Questions — only when a decision is needed

On a fresh directory this skill asks **nothing**: the project name is the folder name, and there is no client, organization or description prompt (they were removed because nobody used them — a heading is not where anyone learns the client). The only question is the one offer in step 2 for a file from an older setup, the `CLAUDE.md` migration; the long-`AGENTS.md` swap moved to `/b6p-update`. Ask each as a **structured question with clickable options** where the tool supports them (`AskUserQuestion` in Claude Code), one at a time; never a written questionnaire.

## Steps

### 1. Resolve the target and the project name

The target is the **current directory**. `PROJECT_NAME` = `basename "$PWD"`.

If the user's request named a new subfolder ("set up a project called X in here"), `mkdir -p "<name>"`, use it as the target and as `PROJECT_NAME`, and finish with step 7. Do not ask about this otherwise — people open the folder they want first.

### 2. Write the per-project files into the target directory

For each template directly under `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/` (not the `legacy/` folder, which is a reference for the swap below and is never written), write into the **target directory**:

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
2. **Substitute** the one placeholder, `{{PROJECT_NAME}}`. (Only `AGENTS.md`/`README.md`/`package.json` carry it; the other three copy verbatim. There is no client or description placeholder.)
3. **Skip if it already exists.** Before writing, check whether the destination file is already present. If it is, **do not overwrite it** — report it as skipped and move on. This includes `AGENTS.md`: an existing one is left exactly as it is.
4. **Write** the result, stripping the trailing `.template` from the name.

#### An existing `CLAUDE.md` is never overwritten

Projects bootstrapped before the `AGENTS.md` split keep their rules in `CLAUDE.md`. That must keep working. Look at what the existing file contains:

- **Already a bridge** (nothing but a comment and an `@AGENTS.md` import) → nothing to do; report it as skipped.
- **Populated** (it carries real rules) → **never overwrite it, never delete it, and never move its content on your own.** Offer the migration and perform it **only** if the user explicitly agrees:
  1. Move the file's content into `AGENTS.md` — only if `AGENTS.md` does not already exist. If both exist and both have content, show the user what is in each and let them decide; never merge or clobber silently.
  2. Replace `CLAUDE.md` with the one-line bridge from `CLAUDE.md.template`.

  If the user declines, says nothing, or you are unsure, **leave both files exactly as they are** — Claude Code keeps reading the populated `CLAUDE.md` and the project keeps working. Say so in the report, and note the consequence: agents that only read `AGENTS.md` (Cursor, Codex) will not see those rules until the migration happens.

#### An existing long `AGENTS.md` from an earlier template

Projects set up before plugin 0.33.0 carry the old 142-line `AGENTS.md` — recognisable by its `## Critical rules (always apply)` heading and by having no `<!-- bluestep-tools rules-template N -->` marker. It still works, and this skill leaves it exactly as it is: step 2 skips any file that already exists.

**Do not swap it here.** Report it, then point the user at **`/b6p-update`**, which owns that migration: it measures what the file costs per turn, lists the project-specific lines, proposes reasoned cuts chunk by chunk, and can sweep every project on the machine in one pass instead of one `/project-init` run per repo. Say it in one line — "this project has the old long rules file; `/b6p-update` swaps it and keeps your project rules" — and move on.

### 3. Guide `git init`

If the target directory is not already a git repo, run `git init` in it (or tell the user to). A git repo matters because the spec-execute implementer agent reviews its work via `git diff` — without a repo there is no baseline diff to review.

### 4. Claude Code only — write the project settings

In the target directory, create `.claude/` if needed, then write `.claude/settings.json` with **exactly** this shape (skip if it already exists). No `hooks` block and no `SessionStart` sync — hooks come from the plugin. `autoCompactWindow` makes Claude Code compact at 400 K tokens instead of near the 1M limit on Fable / `opus[1m]` sessions; it is a no-op on 200 K models. Measured on real sessions it is the single largest quota saving available, and compaction keeps CLAUDE.md, the plan, and recently edited files. `enabledPlugins` is an **object** keyed by `plugin@marketplace` — Claude Code does not document an array form.

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
  "enabledPlugins": {
    "bluestep-tools@bluestep": true
  }
}
```

- **If it was skipped**, call that out: an existing `settings.json` may not register the marketplace / enable the plugin, so the marketplace + `enabledPlugins` block may need to be merged in by hand. If it has `"enabledPlugins": ["bluestep-tools@bluestep"]` (the array shape an earlier release wrote), offer to change that one line to the object shape above.
- This file is what makes the setup **travel with the repo**: when a teammate clones and trusts the folder, Claude Code registers the marketplace from it and, because the plugin itself is not installed yet, reports it as not installed and shows the `claude plugin install bluestep-tools@bluestep` command to run. There is **no automatic install prompt**; on the desktop app, plugins are managed through claude.ai, so the teammate installs from its Plugins screen. CI sees the dependency the same way. It does not replace the user-scope install from `/b6p-init`, which is what loads the plugin for the person running this skill.
- Plugin-bundled surfaces (MCP servers, hooks) load at session start: after enabling, Claude Code needs a fresh session or `/reload-plugins`.

### 5. Check the once-only setup

Run these checks and report, but **do not perform the setup here** — it is `/b6p-init`'s job:

- `command -v b6p` → if missing, the `b6p` CLI binary is not installed (or not on PATH).
- `test -f ~/.b6p/secrets.enc` → if missing, `b6p auth set` has not been run, and the first `b6p pull` will stop at a prompt the agent cannot answer.
- `test -n "$B6PT_TOKEN"` → if empty, the platform gateway MCP will not come up. This one is **optional** — only platform authoring over MCP needs it — so report it as "not set", not as missing.

If `b6p` or its credentials are missing, end the report with: "Run `/b6p-init` once on this machine to finish the setup." If only `B6PT_TOKEN` is unset, say that `/b6p-init` can set it up whenever platform authoring is needed. Do not block on any of it — the files written here are useful regardless.

### 6. Report written vs. skipped

List which files were written and which were skipped because they already existed. If anything was skipped, tell the user that those files were left untouched — to adopt the pristine tooling version, rename/move the local copy and re-run `/project-init`. If a populated `CLAUDE.md` was found, state what happened to it (migrated with the user's agreement, or left as-is). If an old long `AGENTS.md` was found, say it was left untouched and name `/b6p-update`.

### 7. If a new subfolder — point the user at it

When the project was set up in a **new subfolder**, the current session is still rooted in the parent, so tell the user (and repeat it in the final summary):

> Project created in `./<name>`. Open that folder as a new session in your agent tool (or reopen your workspace rooted there) to work in it — the `bluestep-tools` skills and hooks apply to whichever folder the session is opened in.

## Done

Summarize: the files written vs. skipped (and, if a populated `CLAUDE.md` was found, what happened to it; if an old long `AGENTS.md` was found, that it was left for `/b6p-update`), that `git init` ran, whether the Claude Code project settings were written, and which once-only items `/b6p-init` still has to cover on this machine. If a new subfolder was created, repeat the "open a session in `./<name>`" instruction. Point the user at `/b6p-pull <DAV URL>` to bring down their first component.
