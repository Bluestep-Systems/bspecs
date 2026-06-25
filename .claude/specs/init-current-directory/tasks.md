# Tasks — `bspecs init` (install into current directory) + `bspecs new`

**Status:** Complete

Each task references specific file paths and is sized for one `/spec-execute` invocation.
Order matters — later tasks depend on earlier ones.

## Tasks

- [x] **1. Extend the copy engine to skip-existing and report results.** In `src/utils.js`,
  add to `copyTemplateTree`/`walk` two options: `skipExisting` (when set, an existing
  destination file is left untouched and not rewritten) and `collect` (an accumulator
  `{ written: [], skipped: [] }` into which the **absolute** dest path of each written /
  skipped file is pushed). Also add an `exclude` option (a list of source-relative paths,
  e.g. `['package.json.template']`, matched against the entry path relative to the tree root)
  so a single file can be omitted from the generic walk. Default behavior (no options) must be
  byte-identical to today, so `scaffold()` is unaffected. — files: `src/utils.js`

- [x] **2. Add `mergePackageJson` / package.json handling helper.** Add a helper (in
  `src/utils.js`, exported) that takes the existing on-disk `package.json` content and the
  rendered template content and returns merged JSON text: add any `devDependencies` key present
  in the template but missing on disk (notably `@bluestep-systems/b6p-cli`), and add
  `scripts.b6p` only if absent. Never modify an existing value. Serialize with 2-space indent +
  trailing newline. On malformed existing JSON, signal failure (return null / throw a typed
  error) so the caller can fail soft. — files: `src/utils.js`

- [x] **3. Add `runInitPrompts()`.** In `src/prompts.js`, add `runInitPrompts()` mirroring
  `runPrompts` but: no folder-name prompt (and no existing-folder validation); `clientName` is
  optional with a placeholder, falling back to `'BlueStep Client'` when empty; ask the optional
  `projectDescription`; no `initGit` prompt; final confirm reads `Install bspecs tooling into
  <cwd>?`. Return `{ projectName: basename(cwd), clientName, projectDescription }`. Leave
  `runPrompts` untouched. — files: `src/prompts.js`

- [x] **4. Add `init(answers)` to scaffold.js.** Export a new `init(answers)` that: builds
  `vars` (`PROJECT_NAME = answers.projectName`, etc., `SCAFFOLD_DATE`); creates a
  `collect = { written: [], skipped: [] }`; copies the `root` tree into `process.cwd()` with
  `{ skipExisting, collect, exclude: ['package.json.template'] }`, the `claude` tree into
  `cwd/.claude` with `{ skipExisting, collect, makeExecutable: true }`, and the `module` tree
  into `cwd/.claude/templates` with `{ skipExisting, collect }`; handles `package.json`
  (write-if-missing, else `mergePackageJson` with fail-soft warning, recorded as "merged");
  calls the existing `writeBspecsLock(cwd, vars)`; runs `checkPrettierOnPath()` and
  `installDependencies(basename(cwd), cwd)`; prints the existing auth-set reminder; does **not**
  run `git init`. Reuse the existing private helpers — do not duplicate them. — files:
  `src/scaffold.js`

- [x] **5. Add the skipped/added/merged report.** In `src/scaffold.js` (called at the end of
  `init`), print a summary: counts of added / merged / skipped, then the explicit list of
  skipped files as `path.relative(cwd, abs)`, followed by the guidance line: *"These files
  already existed and were left untouched. To install the bspecs version of any of them, rename
  or move your local copy and run `bspecs init` again."* Only print the skipped list/guidance
  when there is at least one skip. — files: `src/scaffold.js`

- [x] **6. Wire verbs into the CLI.** In `cli.js`, update `parseArgs` so the positional verbs
  are `new` → `{ mode: 'new' }`, `init` → `{ mode: 'init' }`, `sync` → `{ mode: 'sync', silent }`;
  any unrecognized/missing verb → `{ mode: 'help' }`. In `main`, route `new` to the existing
  `runPrompts()` + `scaffold()` + `outro` path, and `init` to `runInitPrompts()` + `init()`.
  Update the `HELP` text to document `new`, `init`, and `sync` (and the `init` client-name
  default), and adjust the `outro`/next-steps wording so it no longer assumes a new subdirectory
  for the `init` path. — files: `cli.js`

- [x] **7. Update docs.** Update the repo `README.md` (usage now `bspecs new` / `bspecs init` /
  `bspecs sync`; bare `bspecs` prints help) and the repo `CLAUDE.md` "Running / testing" section
  (`node cli.js new`, `node cli.js init`). Update the `TODO.md:11` `bspecs init`/`doctor` item to
  note the `init` name is now used for in-place install (the env-validation idea, if kept, needs
  a different name). Add a `CHANGELOG.md` entry covering: new `bspecs init`, the `bspecs new`
  rename, and bare `bspecs` now printing help (call out the bare-invocation behavior change). —
  files: `README.md`, `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`

## Verification

No test suite — confirm manually (per `CLAUDE.md`):

- `node cli.js` → prints help; `node cli.js -h` / `-v` → unchanged.
- `node cli.js new` → interactive new-project scaffold, identical result to the old bare
  `bspecs` (full tree in a new subdir, lock written).
- `node cli.js init` into an **empty** scratch dir → full tree in place, fresh `package.json`,
  valid `.claude/bspecs.lock`, zero skips.
- `node cli.js init` into a scratch dir pre-seeded with `CLAUDE.md`, `.prettierrc`, and a
  minimal `package.json` → those reported skipped/merged, originals byte-intact (`git diff` /
  compare), `@bluestep-systems/b6p-cli` present in `devDependencies`, everything else added,
  guidance printed.
- Re-run `node cli.js init` in that dir → idempotent (all skipped, lock refreshed).
- `node cli.js sync` after `init` → collided files reported "locally modified" (not clobbered),
  written files up-to-date.
- Malformed existing `package.json` → merge fails soft (warn, manual-add reminder), install not
  aborted.

## Wrap-up

- Keep `CLAUDE.md` / `README.md` in sync with the new verb surface (task 7).
- Update the `TODO.md:11` `init`/`doctor` note (task 7).
- Add the `CHANGELOG.md` entry, including the bare-`bspecs` behavior change (task 7).
- No new file added under `templates/claude/instructions/`, so no `index.md` entry is needed.
- No ADR (decided during design).
