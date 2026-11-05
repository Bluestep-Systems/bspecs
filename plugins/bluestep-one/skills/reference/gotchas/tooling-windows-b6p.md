# Gotchas — tooling

Prefix `G`.

---

### G-151 — One file with a syntax error makes the typecheck report only that error, and every type error elsewhere goes quiet

What looks right: `node "${CLAUDE_PLUGIN_ROOT}/tools/typecheck.mjs" <repo>` lists every error in the repo. What happens: the compiler stops at the parse stage when a file does not parse, and reports only the syntax errors; the type errors in other files are not reported until it parses (checked with TypeScript 7.0.2: of two files, one with a type error and one with a syntax error, only the `TS1109` was reported). A parallel agent's half-written file therefore hides your own type errors, and a green rerun can come only after the other file is fixed. How to tell: the output holds only `TS1xxx` (syntax) codes. What to do: when working beside others, check your own files with `typecheck.mjs --files <path>...`, which writes a temporary `tsconfig` that extends the repo's with a `files` list, then run the full gate once every edit has landed.
**Applies to:** any BlueStep One component

### G-154 — `node --test` cannot load a `.tsx` file, so logic kept in a screen file has no tests

What looks right: a pure helper next to the screen that uses it. What happens: Node cannot load a
`.tsx` file (`ERR_UNKNOWN_FILE_EXTENSION`). The test loader (`test/stubs/loader.mjs`) tries `.ts`
and then `.tsx` for an import with no extension, but Node still fails on the `.tsx` file. So a
helper in a `.tsx` file cannot be imported by a test, and the test run stays green without it.
What to do: put every rule a test should reach in a `.ts` module (`src/rules/*`, say) and keep the
`.tsx` file to drawing.

**How to tell.** In a component repo, add a test that imports a file from `src/**/*.tsx` after
`register("./stubs/loader.mjs")` and run `node --test`: the import fails with
`ERR_UNKNOWN_FILE_EXTENSION '.tsx'`.

**Applies to:** any BlueStep One component

### G-197 — `node --test` prints DEP0205 for the tests' resolve hook on Node 26

What looks right: a warning on stderr during `node --test` means a test is broken. What happens:
Node 26 deprecates `module.register()` and prints "[DEP0205] DeprecationWarning: module.register()
is deprecated. Use module.registerHooks() instead." once per test file that registers the loader.
The hook still runs and every test passes. What to do: read the summary, not stderr. Moving to
`module.registerHooks()` means a synchronous `resolve` and a change to every copy of the loader at
once, so it is a change of its own.

**How to tell.** Run `node --test` on Node 26 in a repo whose tests call `module.register()`: one
DEP0205 warning per such test file, and the summary says `fail 0`.

**Applies to:** any BlueStep One component

### G-198 — On Windows, Node ignores a `TZ` set before it starts; a test must set `process.env.TZ` inside the process

What looks right: run a date test as `TZ=Pacific/Auckland node --test` to see it in another
browser zone. What happens: on Windows the variable set by the shell is not applied, so the test
runs in the machine's own zone and passes for the wrong reason. What to do: assign
`process.env.TZ` in the test, before the dates are made, and put it back after.

**How to tell.** On Windows (seen on Node 26.9.0), `TZ=Asia/Tokyo node -e
"console.log(new Date().getTimezoneOffset())"` prints the machine's offset. Inside the process,
`process.env.TZ = "Asia/Tokyo"` and the same line prints `-540`.

**Applies to:** any BlueStep One component

### G-205 — `typecheck.mjs --files` fails on a component repo's tests, so the gate is the `src` files and the whole-repo run

What looks right: name a task's test files to `--files` beside its sources, so the tests are type-checked too. What happens: the repo has no `@types/node` (a component repo declares no dependencies), so every `node:test` and `node:assert` import gives TS2591, and a `.ts` import path gives TS5097; the whole-repo run passes because its `tsconfig` includes only `src`. How to tell: run `--files` on any `test/*.test.ts`. What to do: give `--files` the `src` files only and let `node --test` check the tests; in a test, `await import("../src/rules/x")` with no extension, after `register("./stubs/loader.mjs")`, loads under `node --test` and avoids TS5097.
`--files` takes paths relative to the component repo (`src/rules/required.ts`); a path from a parent folder (`<repo>/src/…`) fails with "not in …\<repo>".
**Applies to:** any BlueStep One component
