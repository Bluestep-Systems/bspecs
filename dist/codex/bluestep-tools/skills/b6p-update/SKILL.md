---
name: b6p-update
description: Bring existing BlueStep (B6P) projects up to the current bluestep-tools release — swap an outdated always-on rules file for the current short one, move rules into AGENTS.md where they belong, and reconcile project settings, keeping every project-specific rule. Reports first and applies only what the user picks; runs on the current project or sweeps every project on the machine. Use this skill whenever the user has just updated or installed a new bluestep-tools version, asks whether a project is up to date or behind, wonders why a project's rules file is so long or what it costs per turn, wants their other B6P projects brought in line with one they already fixed, or is told by another skill that a project carries an older setup — even when they do not name this skill.
---

# /b6p-update — bring existing projects up to the current release

`/project-init` writes the current files into a project the first time. This skill is for every project set up **before** the current release, still carrying the files an older one wrote.

Read `migrations/index.md` (relative to this file) on every run. It is the catalogue of what a project can be behind on, and it changes from release to release — so what you migrate comes from there, not from memory.

**Why a project cares.** An always-on rules file is re-read on **every turn** of every session in that project, and most of what an older one carries is now served on demand by the `bluestep-reference` skill and the `/b6p-*` skills. So the file is paying, all day, for content that a task can fetch when it actually needs it.

## Guardrails — every migration, no exceptions

1. **Report before you write**, and wait for the user's picks. These are their repos, often several at once; a sweep that starts editing is a sweep nobody can review. `all` never means "update everything now".
2. **Never drop a line silently.** Show the project-specific lines, carry them over, and *then* propose cuts one chunk at a time with a reason each, for the user to accept or keep. A rule that vanishes in a migration is a rule nobody knows they lost.
3. **Never commit and never stage.** Edits outside the session root are left as uncommitted changes in that repo, and the report says where each diff is waiting — a commit in a repo the user is not looking at is the one change they cannot see coming.
4. **Only touch what a matched migration names.** No opportunistic tidying, nothing outside the project directory. A diff that holds surprises is a diff people stop reading.

## Modes

Ask which mode when the user has not said. Default to `here` when the request named a single project ("update this project", "is this one current?").

- **`here`** — the current directory only.
- **`all`** — sweep the B6P projects on the machine, from the list of directories this tool has opened plus a scan of the session root. Every supported tool keeps such a list, but they differ in where they live and in how complete they are, so `all` reaches further on some tools than others — `references/project-index.md` has the details and step 1 says when to read it.

## Steps

### 1. Find the projects

**`here`:** the target is the current directory. Go to step 2.

**`all`:** take the union of two sources.

1. **The tool's own list of opened directories.** Read `references/project-index.md` for the section covering the tool you are running in — where the list lives, how to read it safely, and how complete it is. The three supported tools store it in three unrelated shapes, and the guidance there is what keeps this step from turning into a hunt through someone's application data.
2. **Subfolders of the session root.** List the immediate subfolders of the current directory. A workspace whose subfolders are each a project has never opened most of them as their own session, so no tool's list finds them.

Then, in this order:

1. **Normalise and dedupe.** Every one of these lists holds one directory under more than one spelling — drive-letter case, `/` versus `\`, UNC versus `wsl:` prefixes, percent-encoded `file://` URIs, or simply one entry per past session. Decode to plain paths, lower-case the drive letter, convert separators to `/`, strip a trailing `/`, then dedupe. Skip this and the report lists the same project three times, which reads as three projects to fix.
2. **Drop what is not there.** `test -d` each one; these lists record what was opened, and folders get renamed and deleted afterwards. Drop paths with a worktree segment (`.claude/worktrees/`) — they are checkouts of a project already in the list.
3. **Keep only B6P projects.** A directory qualifies when it holds a `U######/` unit folder, when its rules file carries a `<!-- bluestep-tools rules-template N -->` marker, or when a migration's detector claims it (step 2). Report what you dropped as a count, not a list.

Say what you searched and what you found ("14 opened directories plus 9 subfolders, 6 B6P projects after deduping"), and where the list is a recently-opened one rather than a full history, say that too — the user is the only one who knows whether a project the sweep could not see still matters.

### 2. Detect what each project is behind on

Run every detector in the catalogue against each target — **read only, write nothing in this step**. Then read **only** the asset files whose detector matched; an unmatched asset describes a project that is not in front of you, and summarising one you have not read is how a report acquires changes nobody asked for.

Alongside the detectors, gather what the matched migrations need:

| Context | How | Why it matters |
|---|---|---|
| Size of any always-on file a matched migration touches | `wc -l` and byte size | Step 4 quotes this. Every number about a user's files is measured from the files — there is no default to fall back on, and a number from memory would be a number about somebody else's project. |
| Tracked in git | `git -C <dir> rev-parse --git-dir` | An untracked project has no diff to review, so say the change cannot be undone with git and offer to keep a `.bak` copy. |
| Which tool this session is | — | Some migrations are per-tool; the catalogue says which. |

### 3. Report, and wait

One row per project, one line each:

| Project | Behind on | Files | Would change |
|---|---|---|---|
| `acme-portal` | nothing | rules file 41 lines / 3.9 KB | nothing |
| `northwind-intake` | `rules-template` | rules file 136 lines / 12.5 KB | swap the rules file, 4 chunks to sort |
| `riverside-forms` | `rules-file-bridge`, `project-settings` | rules in the bridge file, 88 lines | move rules to `AGENTS.md`, then 2 settings keys |

End with what the user can pick: all of them, some of them, or none. **Wait for the answer.**

If the user picks nothing, stop there and say the report repeats — nothing records a decline, so running this again shows the same table.

### 4. Say what it costs, at the moment you offer the change

Before the first change to an always-on file, in plain words, with **N measured from the file you just read**:

> This file is read on every turn. Today it costs about **N K tokens a turn**. The shared part is now served by the plugin on demand, and the change keeps every project rule or leaves it one pointer away. Fixes to the shared rules then reach you on a plugin update instead of drifting in a copy.

A rough N is right: bytes ÷ 4 ÷ 1000, rounded to one figure, and say "about". Skip the percentage and the monthly total — the per-turn number is the one someone can feel, and a projection invites an argument about the projection instead of a decision about the file.

### 5. Apply, one project at a time

Run each project's matched migrations in catalogue order, following each asset's own steps. Show the result of each before saving. Where content moves into another file, write that file in the same change so no pointer dangles.

Then move to the next project. One project, shown, saved, reported — a batch of writes across several repos is a batch the user has to unpick in several places.

### 6. Report, and leave the diffs alone

Close with: which projects changed and how (lines before, lines after), which were skipped and why, which chunks the user chose to keep, and the path of every repo left holding an uncommitted diff. Where a project is not a git repo, say so — the `.bak` copy from step 2 is the only way back.

## Done

One table, the user's picks applied, every project rule either kept or one pointer away, and a reviewable diff in each repo that changed. Re-running reports nothing to do for a project already current.

## Adding a migration in a later release

Add one file under `migrations/` and one row to `migrations/index.md` — the procedure above is release-agnostic and stays as it is. Give the migration a detector that reads the project (a marker, a heading, a missing key) rather than a release number, so it stays true however far behind a project has drifted, and a **remove when** condition so the catalogue does not accumulate steps that can no longer fire. If a migration needs something the procedure above cannot express, that is a gap worth reporting with `/bspecs-feedback` rather than a special case worth adding here.
