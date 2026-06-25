# Design — `bspecs init` (install into current directory) + `bspecs new`

**Status:** Approved

## Files / areas affected

- **`cli.js`** — arg parsing gains `new` and `init` verbs; bare invocation prints help. Help
  text and the post-scaffold `outro` updated. Routes `init` to a new `init()` entry point.
- **`src/prompts.js`** — add `runInitPrompts()`: asks client name + optional description (no
  folder-name prompt, no existing-folder rejection, no git prompt). `runPrompts()` (for `new`)
  is unchanged.
- **`src/scaffold.js`** — add exported `init(answers)` alongside `scaffold(answers)`. Reuses
  the existing private helpers (`checkPrettierOnPath`, `installDependencies`, the auth
  reminder). Adds the non-destructive copy + `package.json` merge + skipped-file report.
- **`src/utils.js`** — `copyTemplateTree()` gains a `skipExisting` option and an optional
  `collect` accumulator so a tree copy can report what it wrote vs skipped. `mergePackageJson()`
  added here (or in scaffold.js — see Approach). No change to `enumerateClaudeTargets`.
- **Docs** — repo `README.md`, repo `CLAUDE.md` (the `node cli.js` / "Running / testing"
  section), `CHANGELOG.md`, and the `TODO.md:11` `init`/`doctor` note. The scaffolded
  `templates/root/README.md.template` references the b6p workflow, not the `bspecs` command
  itself — check, but it likely needs no change.

## Approach

`bspecs init` is "scaffold, but never overwrite, into cwd, then merge the manifest and report
collisions." It deliberately reuses the existing scaffold machinery rather than forking it:

1. **Arg parsing (`cli.js`).** `parseArgs` recognizes three positional verbs:
   `new` → `{ mode: 'new' }`, `init` → `{ mode: 'init' }`, `sync` → `{ mode: 'sync', silent }`.
   `-v`/`-h` unchanged. **Any unrecognized/missing verb → `{ mode: 'help' }`** (bare `bspecs`
   prints help). `new` calls the existing `runPrompts()` + `scaffold()` path verbatim — that
   path is not refactored, only the *trigger* changes from "no args" to "`new`".

2. **Prompts (`runInitPrompts`).** Mirrors `runPrompts` minus the folder question:
   - `projectName` is **not** prompted — it defaults to `basename(process.cwd())` (used only
     for the `PROJECT_NAME` template var and lock metadata).
   - prompt `clientName` — **optional**, no required-validation; shown with a placeholder, and
     if the user presses Enter without typing it falls back to `'BlueStep Client'`.
     `projectDescription` (optional, as in `new`).
   - **no** `initGit` prompt (init never runs `git init` — an existing project owns its VCS).
   - final confirm: `Install bspecs tooling into <cwd>?`.
   Returns `{ projectName, clientName, projectDescription }`.

3. **Non-destructive copy (`copyTemplateTree({ skipExisting: true, collect })`).** Extend the
   existing `walk()` so that when `skipExisting` is set and the destination file already
   exists, it is **not** written; the absolute path is pushed to `collect.skipped`. Otherwise
   it writes (same `{{VAR}}` substitution, `.template` stripping, `.sh` chmod) and pushes to
   `collect.written`. This keeps a single copy implementation for both modes; `scaffold()`
   simply doesn't pass `skipExisting`, so its behavior is byte-identical to today.

4. **`package.json` merge.** `package.json` is the **one** exception to copy-if-missing. In
   `init()` the root tree is copied with `package.json.template` **excluded** from the generic
   walk (new `exclude` option, matched on the source-relative path). Then:
   - if `cwd/package.json` does **not** exist → write the rendered template normally (record as
     written).
   - if it **exists** → `mergePackageJson()`: parse both, add any `devDependencies` key present
     in the template but missing on disk (notably `@bluestep-systems/b6p-cli`); add the `b6p`
     entry to `scripts` only if `scripts.b6p` is absent. **Never** change an existing value
     (version pins, name, etc. are preserved). Re-serialize with 2-space indent + trailing
     newline. Report this file as **"merged"**, distinct from "added" and "skipped".

5. **Lock.** Reuse the existing `writeBspecsLock(cwd, vars)` **unchanged**. It records the
   *rendered* template hash for every `.claude/**` target. That is exactly what makes a
   collided `.claude` file safe under later `bspecs sync`: the user's on-disk bytes differ from
   the recorded template hash → sync classifies it "locally modified" → never clobbers it.
   Files we wrote match the template hash → sync keeps maintaining them. (Root files like
   `CLAUDE.md`/`package.json` are not in `SYNC_TARGETS`, so sync never touches them anyway.)

6. **Post-steps.** Reuse `checkPrettierOnPath()` and `installDependencies()` (npm install in
   cwd — installs the user's deps plus the merged b6p-cli devDep) and the existing auth-set
   reminder. **No** `git init`.

7. **Skipped-file report.** After copying, print a summary: counts of added / merged / skipped,
   then the explicit list of skipped paths (project-relative, via `path.relative(cwd, abs)`),
   followed by guidance: *"These files already existed and were left untouched. To install the
   bspecs version of any of them, rename or move your local copy and run `bspecs init` again."*

## Data / control flow

```
bspecs init
  └─ cli.js: mode === 'init' → init(await runInitPrompts())
       ├─ vars = { PROJECT_NAME: basename(cwd), CLIENT_NAME, PROJECT_DESCRIPTION, SCAFFOLD_DATE }
       ├─ collect = { written: [], skipped: [] }
       ├─ copyTemplateTree('root',   cwd,                 vars, { skipExisting, collect, exclude: ['package.json.template'] })
       ├─ copyTemplateTree('claude',  cwd/.claude,         vars, { skipExisting, collect, makeExecutable })
       ├─ copyTemplateTree('module',  cwd/.claude/templates, vars, { skipExisting, collect })
       ├─ handlePackageJson(cwd, vars, collect)   // write-if-missing OR mergePackageJson
       ├─ writeBspecsLock(cwd, vars)              // existing fn, unchanged
       ├─ checkPrettierOnPath(); installDependencies(basename(cwd), cwd)
       ├─ auth-set reminder (log.info)            // existing block
       └─ reportSkipped(collect, cwd)             // added / merged / skipped summary + guidance
```

`bspecs new` flow is unchanged from today's bare `bspecs`: `runPrompts()` → `scaffold()`.

## Edge cases

- **`.claude/bspecs.lock` already present** (project was previously scaffolded/init'd): the lock
  is in `SYNC_TARGETS`? No — it's written by `writeBspecsLock`, not a template file, so it's not
  a copy target. `writeBspecsLock` overwrites it wholesale, which is correct (re-init refreshes
  the lock). Acceptable: re-running `init` is idempotent and re-derives the lock.
- **Existing `package.json` is malformed JSON**: `mergePackageJson` should fail soft — catch the
  parse error, skip the merge, and report `package.json` as skipped with a warning to add the
  b6p-cli devDep manually (don't abort the whole install).
- **Existing `package.json` already has the b6p-cli devDep** (e.g. different version): leave it
  exactly as-is (no merge needed); report as "merged (no change)" or simply not listed.
- **cwd basename has spaces / odd chars**: only feeds `PROJECT_NAME` (a template var) and the
  npm `name` field *if* we wrote a fresh package.json. The template `name` is `{{PROJECT_NAME}}`;
  an invalid npm name in a freshly-written package.json is the user's to fix — acceptable, and
  the common case (init into an existing project) already has its own package.json.
- **Empty cwd** (no existing files): `init` degenerates to a full scaffold-in-place — every file
  is written, nothing skipped, package.json written fresh. Valid outcome.
- **`.sh` hooks** copied via the claude tree must still be chmod'd 0o755 when written (skip when
  the file already existed). The existing `makeExecutable` path handles written files.

## Alignment with existing patterns

- **Single copy implementation.** Extending `walk()`/`copyTemplateTree()` with `skipExisting` +
  `collect` keeps one code path for `new`, `init`, and (already) the lock derivation — no
  parallel tree-walk to drift, consistent with the "derive, don't hardcode" stance behind
  `enumerateClaudeTargets` (CLAUDE.md, `SYNC_TARGETS`).
- **Non-destructive + lock semantics** reuse the exact mechanism `bspecs sync` already relies on
  (template-hash-in-lock ⇒ user edits look "locally modified"). No new concept introduced.
- **Best-effort post-steps.** `installDependencies` / `checkPrettierOnPath` already warn-don't-fail
  (CLAUDE.md "Key behaviors"); `init` inherits that. `mergePackageJson` follows the same ethos
  (fail soft, warn, never abort).
- **ADR?** Decided **no** — the three-verb surface and the collision-report-and-rerun UX are
  captured in this spec and the `CHANGELOG`/`CLAUDE.md` notes; a separate `docs/decisions/`
  entry was deemed unnecessary.

## Risks

- **Breaking change: bare `bspecs` no longer scaffolds.** Anyone scripting bare `bspecs` (or the
  outro/README muscle memory) now gets help. Mitigated by: pre-1.0 (0.11.x), explicit verbs are
  more discoverable, and docs/CHANGELOG call it out. Verified by `node cli.js` (→ help),
  `node cli.js new` (→ interactive), `node cli.js -h`/`-v`.
- **`package.json` merge corrupting a real manifest.** Highest-risk piece. Mitigated by: only
  *adding* missing keys (never editing existing values), fail-soft on parse error, and 2-space
  re-serialization. Verified manually against (a) no package.json, (b) a minimal one, (c) one
  that already has the b6p-cli devDep, (d) malformed JSON.
- **No test suite.** Verification is manual (per CLAUDE.md): scaffold/init into scratch dirs and
  inspect. Concretely:
  - `node cli.js init` into an **empty** scratch dir → full tree, fresh package.json, lock valid,
    zero skips.
  - `node cli.js init` into a dir that **already has** `CLAUDE.md`, `.prettierrc`, and a
    `package.json` → those reported skipped/merged, their original bytes intact (diff), b6p-cli
    appears in devDependencies, everything else added.
  - Re-run `node cli.js init` → idempotent (everything now skipped, lock refreshed).
  - `bspecs sync` after `init` → reports the collided files as "locally modified" (not clobbered)
    and the written ones as up-to-date.
