---
name: b6p-setup
description: Set up, check, or bring up to date the BlueStep (B6P) tooling for this machine and this folder in one run — the b6p CLI and its login, the bluestep-tools plugin for the agent tool you are in (Claude Code, Cursor, Codex), the optional platform token, and the project files (a short AGENTS.md with the always-on platform rules, the CLAUDE.md bridge, README, package.json, .gitignore, .prettierrc, Claude Code project settings) — writing what is missing and migrating what an older release wrote, keeping every project rule. Use it on a new machine, in a new or existing project folder, after a plugin update, when someone asks whether a project is set up or up to date, or when another skill finds the folder unprepared; `--all` sweeps every B6P project on the machine. Idempotent — a second run reports nothing to do.
---

# /b6p-setup — this machine and this folder, ready

One procedure for everything that is done once: once per machine (step 1) and once per folder (step 2), plus the migrations a project set up by an older release still needs (inside step 2). The `/b6p-pull`, `/b6p-push`, `/spec-create` and `/quick-task` preflights run the same steps when they find the folder unprepared, then continue with the user's request; running this by hand is for looking under the hood or for `--all`. **Check first, act only on what is missing, and decide what you can.**

## Decide what you can. Ask only what is genuinely the user's.

A question the user cannot answer better than you is not a safety measure — it is a delay they have to read. Most of what this skill does has one correct answer, and stopping to confirm it teaches people to click past the prompts that matter.

| Situation | What to do |
|---|---|
| A file or key is **missing** and adding it conflicts with nothing | **Just do it.** Say what you wrote. |
| The old rules file is **entirely template text** — no project rules were ever added | **Just do it.** Swap it and say so in the report. |
| The old rules file **has project-specific lines** | Decide where each goes, show one table, take **one** approval for that project. |
| A settings key **already has a different value** | Ask. Their value may be deliberate. |
| Both `AGENTS.md` and the tool's bridge file hold real rules | Ask. Only they know which is the real one. |
| The folder is not empty and shows no sign of being a BlueStep workspace | Ask once (step 2a) — three options, no free text. |
| You cannot tell whether a line is a project rule or template text | **Keep it.** Mark it kept in the table and move on. |
| Something a person must do (install a binary, type a credential, click in a GUI) | Give the exact command or click, then continue with everything else. |
| Something outside every catalogued migration looks wrong | **Say so, change nothing.** A note, not a question. |

Everything the user reads is plain: name the file, say what happens to it, say what it costs. Never a migration id or internal vocabulary (detector, catalogue, asset). Numbers over adjectives — "136 lines, about 3 K tokens every turn". Offer concrete actions, not abstractions. Ask as structured questions with clickable options where the tool has them (`AskUserQuestion` in Claude Code), one at a time, never a written questionnaire.

## Guardrails

1. **Nothing is written before the user has seen what would change** — for a project with real decisions, the table and an approval; for one where every line is template text, the report is enough, but it still comes before the write.
2. **Never drop a project's own line silently.** Every line survives, or is named in the table with what replaced it. When unsure, keep it.
3. **Never commit and never stage.** Edits land as uncommitted changes and the report says where each diff is waiting.
4. **Only touch what a matched migration or a missing file names.** Nothing outside the project directory (user- and machine-scope settings are step 1's, and step 1 only reports and hands over commands). No opportunistic tidying.
5. **Never ask for a credential in chat and never write one into a file.** `b6p auth set` and the platform token are typed by the user, in their own terminal or environment.

## Step 1 — This machine, this tool

- **The `b6p` CLI** is a standalone binary, never a project dependency. `command -v b6p` → present, move on. Missing → if Node is on the machine, `npm i -g @bluestep-systems/b6p-cli` is the install; otherwise give the download link `https://github.com/Bluestep-Systems/b6p-cli/releases` for the user's OS. Say which; do not download binaries yourself.
- **Its login.** `test -f ~/.b6p/secrets.enc && echo OK`. Prints `OK` → move on (a machine that authenticated before b6p-cli 0.6.0 can hold the file without a token; if a later pull still stops at `Enter your access token`, the same command fixes it). Nothing → the user runs `b6p auth set` once, in their own terminal; the first `b6p` command would otherwise stop at a prompt no agent can answer. This is a **different credential** from the platform token below.
- **The plugin, for the tool you are in.** Read **only** the file for your tool: `references/enablement-claude-code.md` (relative to this file), `enablement-cursor.md` or `enablement-codex.md`. If this skill is running, the plugin is installed on this tool; what remains is what that file says to confirm (marketplace registered, hooks trusted and subagents copied on Codex). Mention in the report that the other two files exist for a teammate on another tool.
- **The platform token `B6PT_TOKEN`** — optional; only platform authoring over the gateway MCP needs it. `test -n "$B6PT_TOKEN" && echo OK`. Prints `OK` → move on. Nothing → offer the setup from `references/platform-token.md` (where to create it, how to put it in the environment per OS, why a GUI app needs a full restart); do not force it. A project is often set up before the token exists.

## Step 2 — This folder

### 2a. What is it?

`PROJECT_NAME` is `basename "$PWD"` (or the new subfolder the user named — `mkdir -p` it and finish with the "open a session there" line). Then:

- **Empty**, or holds a `U######/` unit folder, or has an `AGENTS.md` carrying `<!-- bluestep-tools rules-template N -->` → a BlueStep workspace. Go to 2b.
- Its **immediate subfolders** hold `U######/` (a parent of workspaces) → 2c.
- **Non-empty with none of those** (a plain TypeScript or Java repo, a tooling repo) → ask "This folder has files but nothing that marks it as a BlueStep workspace. What is it?" with exactly these three options, in this order: **Set it up as a BlueStep project** (2b); **Opt this repo out of the plugin** — on Claude Code merge `"enabledPlugins": { "bluestep-tools@bluestep": false }` into its `.claude/settings.json` (create the file with just that key if absent, never touch other keys), write nothing else, say the B6P skills, hooks and gateway MCP stay out of this repo from the next session, then go to the report; **Not a BlueStep repo** → name core-tools' `/repo-setup` for its agent setup and stop.

### 2b. A BlueStep workspace — write what is missing, then bring it up to date

**Files.** For each template directly under `templates/` (never `legacy/`, which exists for the diff below): `AGENTS.md.template → AGENTS.md`, `CLAUDE.md.template → CLAUDE.md`, `README.md.template → README.md`, `package.json.template → package.json`, `.gitignore.template → .gitignore`, `.prettierrc.template → .prettierrc`. Substitute `{{PROJECT_NAME}}` (only `AGENTS.md`, `README.md`, `package.json` carry it). **Skip any file that already exists** — report it as skipped, never overwrite. One exception to the order: if `CLAUDE.md` exists and holds more than the one-line import, do **not** write `AGENTS.md` from the template yet — the populated-`CLAUDE.md` bullet below and the `rules-file-bridge` migration decide what goes into it first. Write `AGENTS.md` and the one-line `CLAUDE.md` bridge **regardless of the tool you are in**: `AGENTS.md` is read natively by Cursor, Codex and most agents; the bridge is what makes the same rules reach Claude Code. The shipped `AGENTS.md` is short on purpose (under 50 lines — quote `wc -l` of the template, not this number) and carries its version marker on line 3 — never strip it, never pad the file back out.

- A **populated `CLAUDE.md`** (real rules, not a bridge) is never overwritten, deleted or moved on your own. Offer the migration — content into `AGENTS.md` (only if that does not already exist with content; if both have content, show both and let them decide), then the bridge — and do it only on an explicit yes. Declining leaves both files as they are; say that agents that read only `AGENTS.md` will not see those rules until then.
- **`git init`** if the folder is not a repo — run it yourself (it only creates `.git/`; never inside a folder that already belongs to another repo) and say so in the report. The implementer subagent reviews its work with `git diff`, so a repo is what gives it a baseline.
- **Claude Code only — project settings.** Write `.claude/settings.json` with exactly this content, skipping if it exists (the `project-settings` migration compares key by key against it, so the literal block is the source of truth):

  ```json
  {
    "autoCompactWindow": 400000,
    "permissions": {
      "allow": ["Edit(**/*.md)", "Bash(git:*)", "Bash(b6p:*)", "Bash(ls:*)", "Bash(cat:*)", "Edit(.claude/specs/**)", "Write(.claude/specs/**)"]
    },
    "extraKnownMarketplaces": {
      "bluestep": { "source": { "source": "github", "repo": "Bluestep-Systems/bspecs" } }
    }
  }
  ```

  `autoCompactWindow` compacts at 400 K instead of near the 1 M limit — the single largest quota saving measured, a no-op on 200 K models. **No `enabledPlugins` key**: the plugin is enabled at user scope (step 1), and a project-level `true` with no user-scope install loads nothing while looking enabled. No `hooks` block — hooks come from the plugin. If the file exists and holds a `true` (or the older array shape), the `project-settings` migration below decides what to do with it. This file makes the marketplace travel with the repo; nothing in it loads the plugin by itself, and Claude Code shows no "plugin missing" hint for a project that lists none — the project's `README.md` carries the install step for teammates.

**Bring it up to date.** Read `migrations/index.md` — the catalogue of what a project can be behind on; it changes from release to release, so what you migrate comes from there, never from memory. Run **every** detector against this folder, read-only. A fresh folder detects nothing. Then read **only** the asset files whose detector matched and follow each one's steps, in catalogue order, applying the table above: template-text-only swaps and purely additive keys are performed and reported; a project with its own lines gets its table and one approval. Work cheap first — diff the rules file against `templates/legacy/AGENTS.md.v1.template` before reaching for `git log -p --follow`; walk history only when the diff leaves something ambiguous. Measure what you quote (`wc -l`, `wc -c`; tokens ≈ bytes ÷ 4, rounded to the nearest thousand); before the first change that touches an always-on file, say once what it costs: "This file is read on every turn. Today it costs about **N K tokens a turn**. The shared part now comes from the plugin when a task needs it, so the swap keeps every project rule of yours or leaves it one pointer away." Round N, say "about", no percentages. An untracked project has no diff to review — say the change cannot be undone with git and offer an `AGENTS.md.bak`; if taken, name it in the report as the user's to delete (it is not gitignored).

### 2c. A parent of workspaces

Never write platform rules at the parent: a root `AGENTS.md` governs every subfolder, B6P or not. Offer, in one question that names the subfolders, to run all of 2b — files, Claude Code settings and the migration check — **inside each subfolder that holds `U######/`**, each with its own `PROJECT_NAME` (agents read the nearest rules file, so each gets its own). Write nothing at the parent unless the user asks for the opt-out there. Say that opening each subfolder as its own session is the layout the tooling assumes.

## Step 3 — `--all`: every B6P project on this machine

Take the union of the tool's own list of opened directories — `references/project-index.md` says where each tool keeps it, how to read it safely and how complete it is — and the immediate subfolders of the session root. Normalise and dedupe (drive-letter case, `/` vs `\`, UNC vs `wsl:` prefixes, percent-encoded `file://` URIs; one real index held 45 entries for 31 directories), drop what `test -d` cannot find and any `.claude/worktrees/` path, keep only B6P workspaces (a `U######/` folder, a rules-file marker, or a migration's detector claiming it), and report the dropped count. Expect surprises: separate clones of one project under different paths get their own line — whichever pushes last silently overwrites the other. Then one table — project · status · file today (lines, ~tokens a turn) · what would change — say which rows have decisions in them, ask **once** which projects to do, and run 2b on each, one project written and reported before the next. If the user picks nothing, stop and say the report repeats.

## Step 4 — Report

One short table: files written / skipped — on Claude Code a fresh folder gets seven, the six templates plus `.claude/settings.json` — (and why: they existed — to adopt the shipped version, move the local copy aside and re-run), migrations applied with lines before and after, which of the user's own lines were kept, **the path of every repo now holding an uncommitted diff**, and what this machine still lacks with the exact command or click for each (`b6p` install, `b6p auth set`, the token, Codex hook trust / agents copy). Then: plugin-bundled surfaces load at session start, so anything enabled needs a fresh session. Finish with `/b6p-pull <DAV URL>` to bring down the first component — or, for a new subfolder, "open `./<name>` as its own session first". A re-run of `/b6p-setup` here reports nothing to do.

## Adding a migration in a later release

Add one file under `migrations/` and one row to `migrations/index.md`: a detector that reads the project (a marker, a heading, a missing key — never a release number), a plain sentence for the report, a "remove when" condition, and a note of which steps have one correct answer. This procedure does not change. If a migration needs something the procedure cannot express, report the gap with `/bspecs-feedback` rather than special-casing it here.
