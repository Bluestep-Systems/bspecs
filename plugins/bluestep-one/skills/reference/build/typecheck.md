# The type check, the copies check and the required-fields check

Load before a push to `draft`, and when a check fails.

## Type check

`node "${CLAUDE_PLUGIN_ROOT}/tools/typecheck.mjs" <repo>` type-checks a component repo with its own
gitignored `node_modules/typescript` (7.x), exactly as the editor does. Exit 0 is green. Run it
against freshly downloaded types (`types.md`) before every push that may be published.

- **Why it matters.** `@bluestep/ui` is a federation share, not a bundled dependency, so a renamed
  export builds green, publishes green, and renders *Element type is invalid* on the page.
- **`--files <path>...`** checks only those files (relative to the repo) and what they import,
  through a temporary `tsconfig` that extends the repo's. Use it while tasks run in parallel, so one
  task's half-written file does not fail another's check. Give it `src` files only: the repo has no
  `@types/node`, so a test file gives TS2591 on `node:test` and TS5097 on a `.ts` import. The whole
  repo is checked before every push.
- **While one file does not parse, type errors elsewhere go quiet.** Fix a syntax error first and
  run it again.
- Never run `tsc` by hand in a component workspace; this script is the check.

Tests run with `node --test` in the repo. In a test, `await import("../src/rules/x")` with no
extension, after `register("./stubs/loader.mjs")`, loads under `node --test` and avoids TS5097.

## Copies check

Repos share no code: a file copied from another repo gets no fix from its source until someone
carries it over. `node "${CLAUDE_PLUGIN_ROOT}/tools/copies.mjs" <repo>` reads the table under a
heading starting *Copied* in the repo's README and, for each copy, says whether the source changed
since the copy's commit. Exit 0 when every source is unchanged, 1 when one changed or could not be
checked, 2 when the README has no such table. Run it before every publish.

```
## Copied from other repos

| Copy | Source | Source commit |
| --- | --- | --- |
| `src/data/gql.ts` | `<other repo>/src/data/gql.ts` | `abc1234` |
```

## Required-fields check

A write over `/gql` skips the form's required fields, and the platform then refuses every later
save of that entry. A component that keeps its own hand-typed list of required fields drifts from
the form: a field marked required in Build saves empty. So the required fields are read from the
form definition (`host.forms.get`, each field's `required`) on every load, never typed by hand.

`node "${CLAUDE_PLUGIN_ROOT}/tools/required.mjs" <repo>` looks in `src` for form writes, outside
comments: `createFormRow`, `updateFormRow`, the `setFieldData(field: …)` mutation (a React state
setter of that name is not one), `formEntries.create(`, `.submit(`, `.save(`, `.draftSession(` and
`useFormDraft(`. A repo with none passes. A repo with one passes when it either:

- checks every write with `host.formEntries.validate(`, the host's own check against the
  definition: each file that writes calls it, or is imported by a file that does; or
- carries the shared module `src/data/required.ts` **unchanged** and imports a value from it in
  `src`, and has a **coverage test**: a test file (under `test/`, `tests/` or next to the code in
  `src/`) that imports the screen's policy
  (a module holding a `: RequiredPolicy =` value) and calls `uncovered(`, so a field newly marked
  required on the captured form fails the test until the policy decides it (`own`: the screen
  checks it; `exempt`: never asked, and why).

The module is a copy like any other: a row of the README's *Copied* table names its source and
commit. The check fails when the copy differs from the source at that commit, or the source changed
since (carry it over, as for any copy). The repo that holds the source has no row; run the check
there with `--source <that repo>/src/data/required.ts`. `--source` on a repo's own module counts
only when its README lists no row for the module and another repo of the workspace copies it from
there, so it is no way around a copy that drifted. Exit 0 passes, 1 names what is missing,
2 is a usage error or a repo with no `src`. It is gate 3b of `/bluestep-one:build`, and it has no
"named as not needed" way out: a form write that checks no required field is the defect.
