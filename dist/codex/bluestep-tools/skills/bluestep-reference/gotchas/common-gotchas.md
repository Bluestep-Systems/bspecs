# Common Gotchas

A quick anti-pattern checklist for BlueStep.js. Each entry is the sharp edge plus a pointer to the file that owns the full pattern — scan it when debugging a silent failure or before writing new component code. The detailed patterns live in the linked reference files (reachable from the skill index, `SKILL.md`); this file is the warning list, not a second copy.

## Field access — Java optionals, not JS

JavaScript optional chaining (`?.`) does **not** work against Java optionals, and `field.val()` may throw when the field is empty. Use `field.opt().orElse(default)` (or `.opt().isPresent()` / `.get()`). Java collections (query results) have **no** `.filter` / `.map` — use `.forEach`, or convert to an array first.

→ Full optional and collection patterns: [api-patterns](../reference/api-patterns.md#working-with-java-optionals).

## Server vs client separation

`scripts/app.ts` runs on the server (has `B`, no DOM); `static/script.js` runs in the browser (has the DOM, no `B`). DOM access in server code, or `B` in client code, throws `not defined`. A file only runs if it is an automatic entry point or is explicitly imported — an unimported file never executes.

→ Full execution model and entry points: [file-execution](../reference/file-execution.md).

## Merge report HTML structure

A merge report's `static/index.html` is embedded into an existing page — never emit `<!DOCTYPE html>` / `<html>` / `<head>` / `<body>`, only the content plus `<link>` / `<script>` references. Use `<script type="module">` when the client script uses ES imports, or it throws `Cannot use import statement outside a module`.

→ Detail: [file-execution](../reference/file-execution.md#html-structure).

## Merge report script timing race

`DOMContentLoaded` fires *before* the inline `<script>` that `B.out` emits runs, so client code that reads a `window` global set by that inline script sees `undefined`. Push the value to a queue server-side and drain it from a lazy-init function client-side instead of relying on `DOMContentLoaded`.

→ Full queue / lazy-init pattern: [code-patterns](../reference/code-patterns.md#passing-per-row-data-queue--lazy-init-pattern).

## Query access

A query is only a top-level variable in `app.ts` if it is in the component's platform form-import config (regenerated into `declarations/index.d.ts` on pull); otherwise the variable is `not defined` — configure it on the platform and `b6p pull`. The hand-written `objects/imports.ts` registration is legacy and not used in current modules. For an ad-hoc, read-only query use `B.queries.byFID['fid'].query()`.

→ Full query patterns: [api-patterns](../reference/api-patterns.md#query-access-patterns), [file-execution](../reference/file-execution.md#query-access-pattern).

## Component library

Use the generic component library (`tableF`, `svgF`, …) instead of hand-writing HTML for tables, icons, and other components that already exist.

→ Catalog, registration, and the CSS anti-pattern: [component-library](../reference/component-library.md).

## SweetAlert2 Version Differences

⚠️ **We use SweetAlert2 v8.18.4, NOT v11.** Use the v8 API.

```typescript
// ✅ Correct - v8.18.4 API
Swal.fire({
  onOpen: () => { ... },          // v8 uses onOpen
  // ...
}).then((result) => {
  if (result.value) { ... }       // v8 uses value
  if (result.dismiss) { ... }     // v8 uses dismiss for cancellation
});
```

<details>
<summary>SweetAlert2 v11 API — we do NOT use this (reference only)</summary>

```typescript
// ❌ Wrong - v11 API (we don't use this version)
Swal.fire({
  didOpen: () => { ... },         // v11 uses didOpen
  // ...
}).then((result) => {
  if (result.isConfirmed) { ... } // v11 uses isConfirmed
});
```

</details>

## NPM packages

Arbitrary npm packages are not available — use what the platform provides. Server-side: the `B` object and the Java standard library. Client-side: jQuery, Bootstrap, SweetAlert2 (v8), and the other libraries the platform already ships.

```typescript
// ❌ Wrong - can't use arbitrary npm packages
import axios from 'axios';
import lodash from 'lodash';
```

## TypeScript & Graal limits

`tsconfig.json` runs with `"strict": false`, so the compiler will not catch every null/type error — lean on `.opt().orElse()` and explicit annotations. Server-side runs on GraalVM (not Node), so avoid the newest ECMAScript proposals; test before relying on a new language feature.

→ tsconfig and Graal compatibility: [bsjs-development](../bsjs-development.md#typescript-configuration--graal-compatibility).

## Option matching across fields

Option-list items can have **no export values** — a list can carry only ids and display names.
Matching two fields on the same option list by `exportValue()` then silently fails open:
`'' === ''` matches everything, so a per-option lookup pairs nothing (or the wrong thing) while the
default path still works. **Match by `displayName()` (or the option's id), not `exportValue()`**,
unless export values are known to be populated for that list. (MCP-created/edited option lists
lacking export values is a platform-side gap, tracked separately.)

## Error handling

Always catch errors and surface a user-friendly message rather than letting the failure propagate silently.

→ Try-catch-with-feedback and validation patterns: [code-patterns](../reference/code-patterns.md#error-handling-patterns).
