---
description: "The client build (run by the b6p CLI on a snapshot push) only ever compiles root static/script.ts to .build/script.js — subdirectory .ts files are NOT compiled and never load at runtime"
---

> This rule is the **CLI-compiled** path and does **not apply to a Vite bundle** — a Vite bundle is built by Vite, so the CLI's `static/` build never runs (nothing here about "only root `static/script.ts` compiles" is in force). See [vite spa merge report](../reference/vite-spa-merge-report.md).

Keep all BlueStep merge-report client code in ONE file: `static/script.ts`. Only the root `static/script.ts` → `.build/script.js` ever gets compiled and loaded (the build runs in the b6p CLI at `b6p push --snapshot` and covers only that root file). Nothing recursively compiles `static/util/*.ts`, `static/pages/*.ts`, etc. — even though a `tsconfig.json` with `"include": ["**/*.ts"]` suggests it should.

Symptom when you get this wrong: silent 404s on every subdirectory `.build/*.js`, producing a completely blank page (no errors — the scripts just don't load).

**Why:** Seen in practice while building a dashboard merge report. A modular architecture with `util/escape.ts`, `util/dates.ts`, `pages/overview.ts`, etc. produced an empty `.build/` and a blank page. Consolidating everything into a single `static/script.ts` fixed it immediately.

**Caveat — only a snapshot push compiles `static/script.ts`:**

- `b6p push --snapshot` compiles `static/script.ts` → `static/.build/script.js` in the CLI and uploads both (b6p-cli 0.6+; verified 2026-09-04 on two orgs — a component with no `.build/` folder at all had one, with the emitted JS, on the platform right after the publish). Its diagnostics are advisory and never fail the push.
- A **plain** `b6p push` compiles nothing. When the `.ts` is newer than its `.build` output the CLI prints a `Stale client bundle` warning and uploads as-is, so a draft-only push after editing only the `.ts` leaves the old client JS in place — no error, the change just never reaches the browser until the next publish.
- The platform serves the emitted `.build/script.js` verbatim; it does not rebuild it. Treat "I edited `static/script.ts` and saved a draft" as **not** having deployed any client change.
- Observed shape can differ from the `.build/script.js` claim above: on at least one component the compiled `static/script.js` sat **directly beside** `script.ts` with **no `.build` subfolder** for static assets. Take this as an observed variation in layout, not a contradiction of the compilation description — the compiled artifact exists, but its path and whether anything regenerates it are not guaranteed.
- **Workaround seen in the field:** hand-port the edit into the compiled `static/script.js` and push that file explicitly — e.g. `b6p push --file <path-to>/static/script.js`. This is a gotcha/stopgap; the real fix (having push transpile the `.ts`) is tracked upstream in the b6p CLI.

**How to apply:**

- Put all merge-report client code in one file: `static/script.ts`.
- Use banner comments to organize logical sections (TYPES, UTILITIES, COMPONENTS, PAGES, ENTRY POINT).
- `static/index.html` should load only `styles.css`, any CDN scripts (e.g. Chart.js), and `.build/script.js`.
- Server endpoint code follows the same rule: `scripts/app.ts` is the only runtime-loaded entry. Confirmed on server-side endpoints — a sibling `scripts/runAction.ts` containing runtime functions compiled to its own `.build/scripts/runAction.js`, but BlueStep never loaded it, so `handleRunAction is not defined` at runtime.

**Exception — pure type files are safe to keep separate:**

- A `scripts/types.ts` that contains ONLY `interface`/`type`/type-alias declarations (zero runtime emit) can live alongside `app.ts`. TypeScript sees it at compile time; no JS is emitted for it; BlueStep has nothing to load or miss. Verified in practice.
- The moment you add a runtime value (a `const`, `function`, or `class` that emits), it becomes invisible unless merged into `app.ts`.

**Gotcha — module-level `const` + top-level dispatcher = temporal dead zone (TDZ) errors:**

- If `scripts/app.ts` starts with a top-level `try { ... switch(action) { case "x": handleX(); } }` and `handleX` references a `const` declared *later* in the same file, Graal.js throws `ReferenceError: X is not defined` at runtime. Function declarations hoist; `const` bindings do NOT. See [top level const tdz](top-level-const-tdz.md).
- Fix: put all module-level constants ABOVE the top-level dispatcher block. Seen in practice with constants like `MAX_PAGE_SIZE`, `OPS_BY_TYPE`, etc.

If the architecture is genuinely too big for one file, concatenate at author time (source section comments, clear banners) rather than relying on module resolution — BlueStep's compiler does not do it for you.
