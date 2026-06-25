# Requirements — `bspecs init` (install into current directory)

**Status:** Approved

## Context

Today `bspecs` only scaffolds a **new** subdirectory: `runPrompts` rejects any project
name that already exists ([src/prompts.js:30](../../../src/prompts.js#L30)) and
`scaffold()` always writes into `join(process.cwd(), answers.projectName)`
([src/scaffold.js:37](../../../src/scaffold.js#L37)). That leaves no path for a user
who **already has a project** and just wants the Claude Code tooling (skills, hooks,
agents, instructions, spec-templates, conventions) dropped into it.

The closest existing capability is `bspecs sync` ([src/sync.js](../../../src/sync.js)),
which adds missing `.claude/**` files and skips locally-modified ones — but it
**requires a `bspecs.lock`** to already exist, so it cannot bootstrap a project that has
no bspecs footprint. This feature fills that gap: a non-destructive first install into
the current directory that also writes the lock, after which `bspecs sync` takes over for
ongoing maintenance.

Requested by the user. Naming note: [TODO.md:11](../../../TODO.md#L11) had tentatively
reserved `bspecs init` / `bspecs doctor` for a *deprioritized environment-validation*
command (Node version + auth check). The user has chosen to use `bspecs init` for **this**
feature instead; that TODO item must be updated to reflect the repurposing.

The verb set is being made explicit to match industry convention (`git init`, `npm init`,
`shadcn init` all mean "set up in the current directory"). The result is a three-verb CLI:

- **`bspecs new`** — scaffold a brand-new project in a new subdirectory (this is today's bare
  `bspecs` behavior, now given an explicit `new` verb).
- **`bspecs init`** — install the tooling into the **current** directory, non-destructively
  (this feature).
- **`bspecs sync`** — update infrastructure files in an already-scaffolded project (unchanged).

Bare `bspecs` (no recognized verb) now prints help rather than silently scaffolding, so the
action is always explicit.

## Goals

- As a user, I want an explicit `bspecs new` verb for scaffolding a brand-new project, so the
  three actions (`new`, `init`, `sync`) are symmetric and self-documenting, and bare `bspecs`
  shows help instead of silently scaffolding.
- As a developer with an existing project, I want to run `bspecs init` in that project's
  directory so that the full Claude Code tooling is installed **in place**, without
  creating a new subdirectory.
- As that developer, I want the install to be **strictly non-destructive** — any file that
  already exists is left exactly as-is — so I never risk losing local work.
- As that developer, I want `@bluestep-systems/b6p-cli` wired into my **existing**
  `package.json` (merged into `devDependencies`) so `npx b6p` works without me hand-editing
  the manifest.
- As that developer, I want a **clear end-of-run report of every file that was skipped
  because it already existed**, with guidance to rename/move the colliding files and re-run
  `bspecs init` if I want the full, unmodified tooling — so a pre-existing file with a
  tooling-relevant name (e.g. an old `CLAUDE.md`, `.prettierrc`, or `.claude/settings.json`)
  doesn't silently leave the tooling half-wired.
- As that developer, after `bspecs init`, I want `bspecs sync` to work normally (a valid
  `bspecs.lock` is written) so future tooling updates flow in automatically.

## Acceptance criteria

- [ ] `bspecs new` scaffolds a brand-new project in a subdirectory — byte-for-byte the same
      result as today's bare `bspecs`. Bare `bspecs` (no recognized verb) now prints help.
- [ ] `bspecs init` is recognized as a new mode in `cli.js` arg parsing, and both `new` and
      `init` are documented in the `-h` help text.
- [ ] Running `bspecs init` installs the entire template tree (root files + `.claude/**` +
      `.claude/templates/` module files) into the **current working directory** — not a new
      subdirectory.
- [ ] Files that **do not** already exist are written (with `{{VAR}}` substitution and
      `.template` extension stripping, identical to a normal scaffold). `.sh` hooks are made
      executable.
- [ ] Files that **already exist** are never overwritten or modified (except `package.json`,
      see below) — their on-disk bytes are untouched.
- [ ] If `package.json` already exists, `@bluestep-systems/b6p-cli` is merged into its
      `devDependencies` (and prettier if the template declares it), preserving all existing
      fields, key order where practical, and the file's formatting as closely as practical.
      If it does **not** exist, the template `package.json` is written as a normal new file.
- [ ] `init` prompts for the template variables it needs (client name, optional description)
      but **not** a project folder name, and does not validate-against-existing the way the
      new-project flow does. The project name defaults to the current directory's basename.
      Client name is **optional**: pressing Enter without typing defaults it to
      `'BlueStep Client'`.
- [ ] After a successful run, a `bspecs.lock` exists at `.claude/bspecs.lock` that is valid
      for `bspecs sync` (same shape as the scaffold-time lock). The lock records the **rendered
      template hash** for every `.claude/**` target (identical to the normal scaffold's
      `writeBspecsLock`). This is precisely what makes a skipped/collided file safe: on a later
      `bspecs sync`, the user's on-disk content differs from the recorded template hash, so sync
      classifies it as "locally modified" and never clobbers it. (Files we *did* write match the
      template hash, so sync keeps maintaining them on version bumps.)
- [ ] At the end of the run, the CLI prints a summary listing **every skipped (already
      existing) file**, and instructs the user that to receive the pristine tooling version of
      those files they should rename/move the local copies and re-run `bspecs init`.
- [ ] `git init` is **not** run by default in `init` mode (an existing project typically
      already has git); the one-time `b6p auth set` reminder and prettier-on-PATH warning still
      print as in the normal scaffold.
- [ ] `node cli.js -h` and `node cli.js -v` continue to work unchanged.

## Out of scope

- Merging/patching the **contents** of any existing file other than `package.json`
  (e.g. appending to an existing `.gitignore`, or deep-merging `.claude/settings.json`).
  Existing files are skipped wholesale and reported; the user resolves collisions by
  rename-and-rerun.
- The deprioritized environment-validation / `doctor` behavior (Node version check, auth
  status). This feature only borrows the `init` name; it does not implement validation.
- Changing how `bspecs sync` itself works (sync already handles "add missing / skip
  modified" once a lock exists).
- An interactive collision-resolution flow (per-file overwrite prompts). Reporting +
  rerun is the chosen UX.

## Open questions

- None blocking. (Command name, file scope, and `package.json` handling were resolved with
  the user up front.)
