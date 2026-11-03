---
description: "No real client or contact data in anything committed: use placeholders, keep real data in .claude/scratch/. How the write-time, pre-commit and optional pre-push checks work, what to do when one blocks, and how to clean up a leak that already landed"
---

# Client data in project files

Debugging a component often means looking at real records. That data stays in the session or in
`.claude/scratch/`. It never goes into a file that gets committed: docs, spec and quick-task files,
code comments, README examples, test fixtures. Once it is in git history it is in every clone, and
getting it out is expensive.

## The rule

- In committed files, use placeholders: `<client A>`, `<contact B>`, Jane Doe, John Doe, phone
  numbers in the 555-01xx range, emails at `example.com` (`name@example.com`).
- Record ids are fine: a platform record id, a form or field id, a `U######` folder. They point at a
  record without saying who it is.
- Real data you need while debugging (a sample record, a pasted query result) goes in
  `.claude/scratch/` at the project root. It is git-ignored and no check reads it.

## The three checks

All three use one detector, `phi-detect.sh`. It finds phone numbers written with separators or
parentheses (555 numbers and toll-free numbers pass), email addresses outside
`example.com/.org/.net`, `.test`, `.invalid`, `.example` and the vendor's own domain, and
record titles shaped like two or three capitals in parentheses followed by "Last, First". Found
values are printed cut to two characters, so a block message never repeats the data.

| Check | Where it runs | What it reads |
|---|---|---|
| Write-time hook | The `phi-guard` plugin, when installed: opt-in, installed once per machine (`/b6p-setup` offers it). Claude Code runs it on every Edit/Write in a B6P project; Cursor and Codex run it through their generated wrappers, but may not see every write there. | The text being written. Blocks the write; the agent rewrites it. |
| `pre-commit` | Every tool and hand edits, once `/b6p-setup` has set `core.hooksPath` in this clone. | Only the lines the commit adds. Data already in history does not block later commits. |
| `pre-push` | Same hooks path. The regex runs again (it catches commits made with `--no-verify`); the model review runs only if turned on. | Only the lines the pushed commits add. |

All three skip `.claude/scratch/`, `declarations/`, `.build/`, `static/assets/`, `node_modules/`,
lockfiles, binary files and `.phi-allow` itself. The git hooks are separate from the plugin: they
live in `scripts/hooks/`, committed, so teammates without `phi-guard` get the same gate.

### The optional pre-push model review

A regex cannot see a name, a street address or a birth date in free text. The model review can:

```sh
git config bluestep.phiReview true    # turn it on for this clone
git config bluestep.phiReview false   # turn it off again
```

It is per clone, like `core.hooksPath`: each person turns it on for themselves. On push it sends
the added lines, prefixed with `file:line`, to `claude -p` on Haiku, run from a temp folder with no
tools and no project settings. A finding blocks the push and prints only `file:line kind`. The data
goes to the same provider the session already uses, so nobody new sees it.

It is a second opinion, so it never stops a push for its own failures: when `claude` is missing,
not logged in, errors out or times out (60 seconds), or the added lines are over about 100 KB,
it prints a warning and the push goes through. The regex in `pre-commit` and `pre-push` is the
required gate.

## When a check blocks

1. **Replace the value with a placeholder.** This is the answer almost every time.
2. **Move real data to `.claude/scratch/`** if you still need it for debugging.
3. **`phi-ok` on the line**, only for test data that just looks real (a made-up number in a
   fixture). It is never a way to get real data through. Every check, the model review included,
   skips a line that contains it.
4. **`.phi-allow` at the project root**, committed, for public values that belong to the org: its
   front-desk number, its own email domain. One entry per line:

   ```text
   # lines starting with # are comments
   (212) 555-0100
   domain:yourorg.example
   ```

   (Both sample values pass anyway; they only show the format.) A plain line is a literal allowed
   anywhere, written exactly as it appears in the files. `domain:<d>` allows emails at `<d>` and
   its subdomains. A line with just `*` turns every check off for the project; use it only when a
   project truly holds no client data.
5. **`git commit --no-verify` / `git push --no-verify`** skip the git hooks. Last resort, for a
   broken hook on a line you know is safe. Whatever it lets through is in history for good.

To scan the whole project, not just new lines:

```sh
sh scripts/hooks/phi-check.sh --all
```

It checks every tracked file and prints a count per file. This is how a project finds old leaks.

## Cleaning up a leak that already landed

- **Fix the source.** Replace the data with placeholders and commit.
- **Compiled output.** If the text was in a component's TypeScript, it is also inside
  `draft/.build/*.js`, and stays there until the component is published and pulled again. See
  [build sourcemap embeds source](../gotchas/build-sourcemap-embeds-source.md).
- **History.** The old commits still hold the data, in every clone and on the remote. Rewriting
  history (`git filter-repo`, or a new repo started from one clean commit) is a decision for the
  people who own the repo. Point it out; do not do it on your own.

## What the checks miss

Names, addresses and other details written as plain prose look like any other text to a regex.
Only the model review, when it is on, and a person reading the diff catch those. Write
placeholders from the start rather than counting on a check to catch you.
