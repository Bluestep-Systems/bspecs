---
name: repo-setup
description: "Audit or create a repo's agent setup — the AGENTS.md rules file, the CLAUDE.md bridge, and a skill per repo workflow. Use this whenever the question is whether a repo's rules still match what it actually builds, tests and deploys: a command CI runs that the rules never mention, a command in the rules that no longer exists, rules that live only in CLAUDE.md so Cursor and Codex see nothing, or a repo with no AGENTS.md at all. Reach for it after a repo gains a test framework, a CI check, a deploy step or a new package, and when opening a repo nobody has set up for agents yet. `--check` reports drift and writes nothing; without it, missing files get created and existing files are never touched."
allowed-tools: Read Write Glob Grep AskUserQuestion Bash(ls:*) Bash(basename:*) Bash(mkdir:*) Bash(test:*) Bash(git:*) Bash(wc:*) Bash(head:*) Bash(sed:*) Bash(cat:*) Bash(python:*)
---

# /repo-setup — audit or write this repo's agent setup

## When to run this

- **The repo has no `AGENTS.md`.** Nothing tells an agent how to build, test or ship it, so every
  session works it out again from scratch.
- **The repo has one, and you want to know if it is still true.** Run `--check`. Drift is normal and
  invisible: CI gains a step, a script gets renamed, and the rules file says what used to be right.
- **The repo just gained something** — a test framework, a CI check, a deploy path, a package in a
  monorepo. `--check` names what the setup does not mention yet.

Shared rules can only say what is true of every repo. The build command, the test command and the
release path are true of *this* one, so they have to live in a file the repo keeps.

## Two modes

| | Writes | Use it for |
| --- | --- | --- |
| `/repo-setup` | Creates missing files. **Never touches a file that exists** — there is no `--force`. | A repo with no setup, or one that has gained something the setup lacks. |
| `/repo-setup --check` | Nothing at all. | Finding out whether the setup still matches the repo. This is the mode you will use most. |

Existing files are never rewritten because they are meant to be hand-edited after generation.
Overwriting them would destroy the reason they exist.

## Steps

### 1. Stop if this is not your repo type

Run `ls -d U*/ 2>/dev/null` and look for a `b6p` config. A BlueStep component workspace uses
`/b6p-setup` from `bluestep-tools`, which writes the `b6p` rule set instead of the `core` one —
say so and stop. Doing this first costs one command and saves writing the wrong rules.

### 2. Read the repo — cheaply

A generator that costs more than the file it writes is not worth running. Use the shell for each of
these. Do not open source files at all, and do not read a whole file to find one line.

| Looking for | Where |
| --- | --- |
| Commands | `package.json` scripts, `build.gradle`, `pom.xml`, `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod` |
| The sequence that actually gates a merge | `.github/workflows/*.yml` — grep `run:` |
| Generated or vendored directories | `.gitignore` |
| Release or deploy path | workflow names, a `deploy`/`release` script, a publish step |
| Commit and PR conventions | `.github/PULL_REQUEST_TEMPLATE*`, `CONTRIBUTING.md`, recent `git log --oneline -20` |
| Anything with a security edge | a secrets or test-data policy, a `SECURITY.md`, an existing rule about what must not go in code |
| What is already set up | `AGENTS.md`, `CLAUDE.md`, `.claude/skills/`, and nested `AGENTS.md`/`CLAUDE.md` deeper in the tree |

Prefer the CI workflow over the script list when they disagree: CI is the sequence that has to pass.
A gate that only runs on deploy still counts — a session can pass every local command and still
break the release.

If the repo has no build, no tests and no release, say so and stop. A generated file that says
nothing costs every session and teaches nothing.

### 3. Decide where each thing goes

Four destinations, and the test is *when* the thing is true:

1. **True every turn, and no hook can check it** → the root rules file (step 4). Keep it short. The
   test is "would removing this cause a mistake?"
2. **True only inside one package or directory** → a **nested `AGENTS.md`** in that directory.
   Agents read the nearest file in the tree and the closest one wins, so a rule that only applies
   under `src/test/` costs nothing in sessions that never go there. In a monorepo this is the
   difference between a short root file and a long one.
3. **True only sometimes** → a skill (step 5). Build and release procedures, a debugging recipe, a
   budget check. This is most of what you found.
4. **A hook could enforce it deterministically** → name it in the report as a hook candidate. Do
   **not** write one; this plugin ships none, and an unverified hook is worse than a rule, because
   a rule that is not enforced at least does not claim to be.

### 4. Write the rules file — only if the repo has none

Check **both** names before writing either. This is the step where a wrong call does real damage.

- **Neither `AGENTS.md` nor `CLAUDE.md` exists** → write both. `AGENTS.md` from
  `${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates/AGENTS.md.template`, and `CLAUDE.md` from
  `templates/CLAUDE.md.template` verbatim.
- **`AGENTS.md` exists** → skip it. Write the bridge only if `CLAUDE.md` is missing entirely, so the
  existing rules also reach Claude Code.
- **`CLAUDE.md` has real rules in it and there is no `AGENTS.md` → write neither.** This is the case
  that looks additive and is not: a fresh `AGENTS.md` beside a populated `CLAUDE.md` leaves the repo
  with two rules files, and each tool reads a different one. Report it, and offer the migration —
  move the content into `AGENTS.md`, leave the one-line bridge behind, change no wording — **only**
  with an explicit yes. If the user declines or says nothing, leave both files exactly as they are.
- **`CLAUDE.md` is only a bridge** (a comment and `@AGENTS.md`) → treat the pair as present.

Two things about the shape. `AGENTS.md` is the [agents.md](https://agents.md) convention, read
natively by Cursor, Codex and most agents; its sections are free-form, so use the template's and add
one when the repo has something to say there. `CLAUDE.md` is **not** part of that convention — it is
a Claude Code bridge, because Claude Code does not read `AGENTS.md` on its own. That is the only
reason both files exist.

Keep the root file **under 80 lines**. It names its rule set on one line and does not repeat it: the
`core` rule set lives in `lane/core.md` in this plugin, one copy. A repo that copied it in would be
back to the drift the pointer exists to avoid.

### 5. Write a skill per workflow — the missing ones only

For each item sorted into "sometimes", write `.claude/skills/<kebab-name>/SKILL.md` from
`${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates/SKILL.md.template`.

- **Skip any name that already exists.** Do not diff it, do not improve it.
- Skip anything the rules file already covers. Two copies of a command is how one goes stale.
- One workflow per skill, and a `description` that says **when** to use it — that line is the only
  part loaded every session, so it decides whether the skill is ever picked. Lead with the trigger,
  not the mechanism.
- Keep the `description` a double-quoted string, escaping any `"` or `\` inside it with a `\`. An
  unquoted `: ` in it (`Usage: /x`) makes the frontmatter fail to parse, and the skill then loads
  with no description, so it is never offered.
- Name real commands, not paraphrases. If you did not verify a command exists, leave it out.

### 6. Report, then stop

A table with one row per file: `created`, `skipped (exists)`, `blocked` with the reason, or — in
check mode — `would create`. Then the drift, which is the part worth reading:

- Something the repo has that the setup never mentions — a test framework, a CI or deploy gate, a
  package with no nested file. Name it, and name the file that should carry it.
- A command in the rules file that no longer exists. Say which. Do not fix it; a hand-edited file is
  the user's.
- Hook candidates from step 3.

Stop there. Do not start using the setup you just described.

## What this does not do

- **No hooks and no settings.** Claude Code's `.claude/settings.json` is the user's; permissions and
  env vars are their call, not a generator's.
- **No rewriting, and no `--force`.** Marked regions inside the file were considered and rejected:
  markers in a file we want short and readable are not worth it.
