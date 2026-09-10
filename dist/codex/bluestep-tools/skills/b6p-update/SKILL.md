---
name: b6p-update
description: Bring existing BlueStep (B6P) projects up to the current bluestep-tools release — swap an outdated always-on rules file for the current short one, move rules into AGENTS.md where they belong, and reconcile project settings, keeping every project-specific rule. Decides what it can on its own and asks only when the choice is genuinely the user's; runs on the current project or sweeps every project on the machine. Use this skill whenever the user has just updated or installed a new bluestep-tools version, asks whether a project is up to date or behind, wonders why a project's rules file is so long or what it costs per turn, wants their other B6P projects brought in line with one they already fixed, or is told by another skill that a project carries an older setup — even when they do not name this skill.
---

# /b6p-update — bring existing projects up to the current release

`/project-init` writes the current files into a project the first time. This skill is for every project set up **before** the current release, still carrying the files an older one wrote.

Read `migrations/index.md` (relative to this file) on every run. It is the catalogue of what a project can be behind on, and it changes from release to release — so what you migrate comes from there, not from memory.

**Why a project cares.** An always-on rules file is re-read on **every turn** of every session in that project, and most of what an older one carries is now served on demand by the `bluestep-reference` skill and the `/b6p-*` skills. So the file is paying, all day, for content that a task can fetch when it actually needs it.

## Decide what you can. Ask only what is genuinely the user's.

A question the user cannot answer better than you is not a safety measure — it is a delay they have to read. Most of what this skill does has one correct answer, and stopping to confirm it teaches people to click past the prompts that matter.

Use this test:

| Situation | What to do |
|---|---|
| The old file is **entirely template text** — no project rules were ever added | **Just do it.** There is nothing to decide. Swap it and say so in the report. |
| The old file **has project-specific lines** | Decide where each goes, show one table, take **one** approval for that project. |
| Settings keys are **missing and purely additive** — nothing conflicts | **Add them** and say which. |
| A settings key **already has a different value** | Ask. Their value may be deliberate. |
| Both `AGENTS.md` and the tool's bridge file hold real rules | Ask. Only they know which is the real one. |
| You cannot tell whether a line is a project rule or template text | **Keep it.** No question — mark it kept in the table and move on. |
| Something outside every catalogued migration looks wrong | **Say so, change nothing.** Not a question, a note. |

The pattern: **the default is always the safe one**, so an unanswered question would resolve the same way anyway. Ask when two options are both legitimate and nothing in the project tells you which.

## How to word what you show

Everything the user reads should be plain. They are deciding about their own project, not reviewing your internals.

- **Never show a migration id.** `rules-template` means nothing to them. Say "rules file is out of date". The catalogue gives each migration the sentence to use.
- **No internal vocabulary** in anything the user reads: no "detector", "catalogue", "asset", "migration", "template version N".
- **Short sentences, one idea each.** Name the file, say what happens to it, say what it costs.
- **Numbers over adjectives.** "136 lines, about 3 K tokens every turn" beats "a large file".
- **When you ask, offer concrete actions**, not abstractions: "Keep the ClickUp rule as-is" — not "retain project-specific content".

## Guardrails

1. **Nothing is written before the user has seen what would change.** For a project with real decisions in it, that means the table and an approval. For a project where every line is template text, the report is enough — but it still comes before the write, per project.
2. **Never drop a project's own line silently.** Every line either survives, or is named in the table with what replaced it. When unsure, keep it.
3. **Never commit and never stage.** Edits outside the session root are left as uncommitted changes in that repo, and the report says where each diff is waiting — a commit in a repo the user is not looking at is the one change they cannot see coming.
4. **Only touch what a matched migration names.** No opportunistic tidying, nothing outside the project directory. Anything else you notice is a note in the report.

## Modes

Infer the mode; ask only if the request truly does not say.

- **`here`** — the current directory only. The default when the request names one project ("update this project", "is this one current?").
- **`all`** — sweep the B6P projects on the machine. The default when the request is about more than the current directory ("check all my projects", "bring everything up to date").

## Steps

### 1. Find the projects

**`here`:** the target is the current directory. Go to step 2.

**`all`:** take the union of two sources.

1. **The tool's own list of opened directories.** Read `references/project-index.md` for the section covering the tool you are running in — where the list lives, how to read it safely, and how complete it is.
2. **Subfolders of the session root.** List the immediate subfolders of the current directory. A workspace whose subfolders are each a project has never opened most of them as their own session, so no tool's list finds them.

Then, in this order:

1. **Normalise and dedupe.** Every one of these lists holds one directory under more than one spelling — drive-letter case, `/` versus `\`, UNC versus `wsl:` prefixes, percent-encoded `file://` URIs, or simply one entry per past session. Decode to plain paths, lower-case the drive letter, convert separators to `/`, strip a trailing `/`, then dedupe. A real index held 45 entries for 31 directories.
2. **Drop what is not there.** `test -d` each one; these lists record what was opened, and folders get renamed and deleted afterwards. Drop paths with a worktree segment (`.claude/worktrees/`).
3. **Keep only B6P projects.** A directory qualifies when it holds a `U######/` unit folder, when its rules file carries a `<!-- bluestep-tools rules-template N -->` marker, or when a migration's detector claims it (step 2). Report what you dropped as a count, not a list.

**Expect surprises and report them plainly.** A sweep routinely finds more than the user has in mind: separate clones of one project under different paths, and projects they had forgotten. Two clones of the same project are worth calling out on their own line — whichever one pushes last can silently overwrite the other.

### 2. Work out what each project needs

Run every detector in the catalogue against each target — **read only, write nothing in this step**. Then read **only** the asset files whose detector matched.

**Work cheap first.** For each project, diff the rules file against the legacy template before reaching for `git log -p --follow`. The diff answers "is any of this the project's own?" in one command, and for a file that is pure template text — which is the common case — that is the whole answer. Walk the history only when the diff leaves something genuinely ambiguous. History-walking every project multiplies the cost of a sweep for an answer you usually already have.

Also gather, per project:

| Context | How | Why it matters |
|---|---|---|
| Size of any always-on file a matched migration touches | `wc -l` and byte size | Step 3 quotes this. Every number about a user's files is measured from the files — a number from memory would be a number about somebody else's project. |
| Tracked in git | `git -C <dir> rev-parse --git-dir` | An untracked project has no diff to review, so say the change cannot be undone with git and offer to keep a `.bak` copy. |
| Which tool this session is | — | Some migrations are per-tool; the catalogue says which. |

### 3. Report what you found, and get the go-ahead for the list

One row per project. Use the catalogue's plain sentence, never a migration id:

| Project | Status | File today | What would change |
|---|---|---|---|
| `acme-portal` (this project) | up to date | `AGENTS.md`, 41 lines | nothing |
| `northwind-intake` | rules file out of date | `AGENTS.md`, 136 lines, ~3 K tokens a turn | swap to the short file — every line in it is template text, nothing of yours to keep |
| `riverside-forms` | rules in the wrong file, settings missing 2 keys | `CLAUDE.md`, 154 lines, ~3.5 K tokens a turn | move your rules into `AGENTS.md`, then swap; add the 2 settings keys |

Say in one line what the "what would change" column already implies: which projects have decisions in them and which are straightforward. Then ask **once** which projects to do.

If the user picks nothing, stop and say the report repeats — nothing records a decline, so running this again shows the same table.

### 4. Say what it costs, once, before the first change

In plain words, with **N measured from the file you just read**:

> This file is read on every turn. Today it costs about **N K tokens a turn**. The shared part now comes from the plugin when a task needs it, so the swap keeps every project rule of yours or leaves it one pointer away. Later fixes to the shared rules reach you on a plugin update instead of going stale in a copy.

Round N to one figure and say "about". Skip percentages and monthly totals — the per-turn number is the one someone can feel, and a projection invites an argument about the projection instead of a decision about the file.

Say this once for the run, not once per project.

### 5. Apply, one project at a time

Run each project's matched migrations in catalogue order, following each asset's own steps.

- **Nothing to decide** (every line is template text, settings additions are purely additive): apply it, then report what you did in two lines — what changed, and lines before and after. Do not ask.
- **Real decisions** (the project has its own lines to sort): show that project's table, take one approval, then write.

Where content moves into another file, write that file in the same change so no pointer dangles. Then move to the next project — one project, written, reported, before the next.

### 6. Close out

Say, in a short table: which projects changed and their lines before and after, which were skipped and why, which of the user's own lines were kept, and **the path of every repo now holding an uncommitted diff**. That last one matters most — those diffs are in repos the user is not looking at, and they are easy to lose.

Add any notes from guardrail 4 at the end, clearly separated as things you did not touch.

Finish with what a re-run would say.

## Done

Every project the user picked is current, every project rule of theirs is kept or one pointer away, and each changed repo holds a diff they can read. Re-running reports nothing to do for a project already current.

## Adding a migration in a later release

Add one file under `migrations/` and one row to `migrations/index.md` — the procedure above is release-agnostic and stays as it is. Give the migration a detector that reads the project (a marker, a heading, a missing key) rather than a release number, a **plain sentence** for the report, and a **remove when** condition so the catalogue does not accumulate steps that can no longer fire. Say in the asset which of its steps have one correct answer and which are genuinely the user's, so the procedure above knows when to ask. If a migration needs something the procedure cannot express, that is a gap worth reporting with `/bspecs-feedback` rather than a special case worth adding here.
