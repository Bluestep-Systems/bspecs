---
description: "BlueStep's server-side build compiles only root static/script.ts to .build/script.js — subdirectory .ts files are NOT compiled"
---

> This rule is the **platform-compiled** path and does **not apply to a Vite bundle** — a Vite bundle bundles off-platform, so the platform compiler never runs (nothing here about "only root `static/script.ts` compiles" is in force). See [vite spa merge report](../reference/vite-spa-merge-report.md).

Keep all BlueStep merge-report client code in ONE file: `static/script.ts`. BlueStep compiles only the root `static/script.ts` → `.build/script.js`. It does NOT recursively compile `static/util/*.ts`, `static/pages/*.ts`, etc. — even though a `tsconfig.json` with `"include": ["**/*.ts"]` suggests it should.

Symptom when you get this wrong: silent 404s on every subdirectory `.build/*.js`, producing a completely blank page (no errors — the scripts just don't load).

**Why:** Seen in practice while building a dashboard merge report. A modular architecture with `util/escape.ts`, `util/dates.ts`, `pages/overview.ts`, etc. produced an empty `.build/` and a blank page. Consolidating everything into a single `static/script.ts` fixed it immediately.

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
