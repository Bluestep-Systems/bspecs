# Type-check diagnostics on a publish (read by `/b6p-push` step 5 when `typeCheckDiagnostics` is above `0`)

A publish runs the TypeScript build in the CLI and type-checks `scripts/app.ts` **with** the component's `declarations/` wired in — a real type-check, not a syntax pass. The code is live either way: `typeCheckDiagnostics` above `0` means it went out without passing, and the CLI prints each diagnostic. Treat them as real; do not wave them through. A correctly pulled component reports `0`.

- **`Cannot find name` on a platform global or an imported query/field name** (`B`, your query-group consts, …) — the declaration is genuinely missing: the `declarations/` were not pulled, or the name was never imported into *this* component (rule 8: never fabricate references). Re-pull the component, or add the import on the platform and pull again. A `/// <reference … />` directive is not the fix — the build already wires the declarations in.
- **`Cannot find name` on one of your own symbols** — an ordinary type error in your source; fix it.
- **A stray unescaped backtick** inside a `B.out` template literal cascades into bogus `Cannot find name` diagnostics and produces a genuinely broken `app.js` — rule it out with the `bluestep-reference` skill's `conventions/ts-in-template-literal.md`.
- **Client-bundle diagnostics are advisory.** A MergeReport `static/` bundle can use browser-only third-party globals it declares nowhere (GridStack, Swal); those print only with `--verbose`, are left out of `typeCheckDiagnostics`, and never fail the push. See the `bluestep-reference` skill's `gotchas/third-party-lib-type-noise.md`.
- **Re-pushing does not clear real diagnostics** — they are deterministic. Fix the cause, then publish again.
