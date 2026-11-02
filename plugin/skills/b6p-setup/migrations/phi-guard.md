# Migration `phi-guard` — the git check for client data

**Says to the user:** "commits are not checked for client data" (never installed), "the
client-data check is out of date" (an older copy), or "this clone does not run the client-data
check" (the files are committed, by a teammate or an earlier run, but git here is not pointed at
them). One line per project, whichever applies.

**What it fixes.** The plugin's write-time hook only sees what an agent writes. Hand edits, other
tools and pasted files reach git without it. This migration puts the same check in front of every
commit and push: four small scripts in the project's `scripts/hooks/`, committed, so teammates
without the plugin get the same gate. What the checks catch, what to do when one blocks and how to
clean up an old leak are in the `bluestep-reference` skill → `conventions/client-data.md`. Point
there; do not restate it.

## Detect

Read-only and cheap: file tests, line 2 of four files, two `git config` reads, one
`git check-attr`.

1. **A B6P workspace that is a git work tree.** `git rev-parse --is-inside-work-tree` fails → say
   "commits are not checked — the folder is not a git repo" and stop this migration. Do not run
   `git init` here; step 2b owns that, and a sweep never does it.
   `git rev-parse --show-toplevel` is not the project folder (the repo starts higher up) → say so
   and change nothing: the hooks would govern folders outside this project.
2. **The copies.** The shipped version is the `N` in `# bluestep-tools phi-guard N`, on line 2 of
   `${CLAUDE_PLUGIN_ROOT}/skills/b6p-setup/assets/phi-guard/phi-check.sh`. Read it from there,
   never from this file. All four copies carry the same marker on line 2: `scripts/hooks/phi-check.sh`,
   `pre-commit`, `pre-push` and `phi-detect.sh`. Detects when any of the four is missing, has no
   marker, or has a marker below the shipped `N`. A copy **above** the shipped `N` came from a
   newer plugin: leave every copy alone and say "this project's client-data check is newer than
   your plugin — update the plugin".
3. **The hooks in this clone.** `core.hooksPath` is per clone, so committed files are not enough.
   Wired means either:
   - `git config core.hooksPath` is `scripts/hooks` (ignore a leading `./` and a trailing `/`; an
     absolute path to `<top>/scripts/hooks` counts too), or
   - the hooks git does run here call our scripts: `pre-commit` mentions
     `scripts/hooks/phi-check.sh` or `scripts/hooks/pre-commit`, **and** `pre-push` mentions
     `scripts/hooks/pre-push`. Those hooks live in the `core.hooksPath` folder when one is set,
     otherwise in `git rev-parse --git-path hooks` (right for worktrees too). `*.sample` files do
     not count.

   Anything else detects.
4. **The scratch folder.** `git check-ignore -q --no-index .claude/scratch/probe` fails → detects.
   This reads every ignore rule, so a broader line such as `.claude/` already covers it.
5. **Line endings.** `git check-attr eol -- scripts/hooks/pre-commit` does not print `eol: lf` →
   detects. Without it, a Windows clone with `core.autocrlf=true` checks the scripts out with CRLF
   and `sh` fails on them, so the check breaks for that teammate.

## Steps

### 1. Copy or refresh the four files (performed)

From `${CLAUDE_PLUGIN_ROOT}` into `scripts/hooks/`, creating the folder if needed:

| Copy | From |
|---|---|
| `scripts/hooks/phi-check.sh` | `skills/b6p-setup/assets/phi-guard/phi-check.sh` |
| `scripts/hooks/pre-commit` | `skills/b6p-setup/assets/phi-guard/pre-commit` |
| `scripts/hooks/pre-push` | `skills/b6p-setup/assets/phi-guard/pre-push` |
| `scripts/hooks/phi-detect.sh` | `hooks/lib/phi-detect.sh` |

Copy byte for byte; nothing in them is filled in. Then `chmod +x` all four: git skips a hook file
that is not executable. A refresh is a plain overwrite of all four, so they never mix versions.
If `git diff scripts/hooks/` then shows more than the shipped change (someone edited a copy), say
so in the report; the old text is still in git.

Skip this step in the per-clone case, when all four copies are current.

### 2. Ignore `.claude/scratch/` and pin line endings (performed)

Only when step 4 of the detector matched. Append to `.gitignore`, creating it if missing, with a
blank line before when the file does not end in one:

```gitignore
# Real client data while debugging — never committed (bluestep-reference → conventions/client-data.md)
.claude/scratch/
```

When detector 5 matched, append the same way to `.gitattributes`, creating it if missing:

```gitattributes
# The client-data hooks run under sh, which fails on CRLF line endings
scripts/hooks/* text eol=lf
```

### 3. Point git at the hooks

- **No `core.hooksPath`, and no `pre-commit` or `pre-push` in `git rev-parse --git-path hooks`**
  (`*.sample` files do not count) → `git config core.hooksPath scripts/hooks`. One correct answer,
  performed.
- **A `core.hooksPath` of its own, or existing hook files** → **ask** one question: add our check
  to your hooks, or skip. Never replace or move a user's hook. On yes, put these lines right after
  the first line (the `#!` line) of each hook, so they run before anything in it can exit or read
  its input. Git runs hooks from the top of the work tree, so the relative paths hold.

  `pre-commit`:

  ```sh
  sh scripts/hooks/phi-check.sh --staged || exit 1
  ```

  `pre-push` (git hands the ref list on standard input once; this keeps a copy for the rest of the
  hook). Insert it without the indent shown here: the closing `PHI_REFS` must start at column 0,
  or the rest of the hook is swallowed into the here-document:

  ```sh
  phi_refs=$(cat)
  printf '%s\n' "$phi_refs" | sh scripts/hooks/pre-push "$@" || exit 1
  exec <<PHI_REFS
  $phi_refs
  PHI_REFS
  ```

  A hook name that has no file in that folder gets a new one: `#!/bin/sh` plus the lines above,
  then `chmod +x`. A hook that is not a shell script (Python, Node), or a folder a hook manager
  regenerates, cannot take these lines: skip it, show the user the lines and name the file their
  tool says to edit. On skip, say the consequence in one line — commits from this clone are not
  checked — and that the next run asks again.

### 4. Scan what is already there (first install only)

When this run created `scripts/hooks/phi-check.sh` (not on a refresh, not in the per-clone case),
run it once:

```sh
sh scripts/hooks/phi-check.sh --all
```

It exits 1 when it finds anything; that blocks nothing here. Report **only** the summary it ends
with — the number of findings and the count per file — and never copy the per-line output, cut
short as it is, into the chat or the report. Findings → say this is how old leaks show up, and
point to `conventions/client-data.md` → "Cleaning up a leak that already landed". Do not clean
anything up in this run. No summary line at all means the scan could not run: give its error
message in one line and move on.

### 5. The pre-push model review (a separate question, default no)

Ask only when `git config --get bluestep.phiReview` prints nothing. One question, **No** first:

> Also check pushes with a model? On each push it sends only the lines your new commits add to
> Claude Haiku, through the same login and provider this session already uses, to look for names
> and addresses a pattern cannot see. When Claude is not installed or not logged in, it warns and
> lets the push through.

Yes → `git config bluestep.phiReview true`. No, or no answer → `git config bluestep.phiReview
false`, which records the choice so it is not asked again. Either way, say how to change it:
`git config bluestep.phiReview true` / `false`.

### 6. Tell the user what to commit

The agent does not commit or stage (guardrail 3). The report says the new or refreshed files are
waiting as a diff, and that they must be committed for teammates to get the check. On Windows, git
may not record the executable bit, so commit them with:

```sh
git add --chmod=+x scripts/hooks/
```

Then: each teammate runs `/b6p-setup` once in their own clone (or `git config core.hooksPath
scripts/hooks` by hand); committed files alone check nothing.

## In a `--all` sweep

The sweep runs this migration like any other, project by project. The files, `.gitignore` and the
scan belong to the project; `core.hooksPath` and the review setting belong to the clone the sweep
found on this machine, so a sweep sets them there. In the sweep table, a project with its own hooks
path or hook files is a row with a decision in it; the hooks question and the review question are
asked when that project's turn comes, never batched across projects.

## Example report lines

> `riverside-forms` — commits are now checked for client data: added `scripts/hooks/` (4 files),
> `.claude/scratch/` to `.gitignore` and an LF rule to `.gitattributes`, and pointed git at the
> hooks. A scan of the files already
> committed found 3 possible matches in 2 files (`docs/intake-notes.md`: 2, `README.md`: 1). How
> to clean them up: `bluestep-reference` → `conventions/client-data.md`. Commit `scripts/hooks/`
> with `git add --chmod=+x scripts/hooks/`.

> `harbor-portal` — the client-data check was out of date: refreshed the 4 files in
> `scripts/hooks/`. Nothing else changed.

> `maple-scheduling` — this clone did not run the client-data check: the files were already
> committed; pointed git at them here. Model review on push: off.

> `oak-reports` — this project has its own git hooks; you chose to skip, so commits from this
> clone are not checked. The next run asks again.

## Remove when

Never as a whole. Like `project-settings`, it carries the version refresh: every later change to
the four scripts reaches projects through the marker check above.
