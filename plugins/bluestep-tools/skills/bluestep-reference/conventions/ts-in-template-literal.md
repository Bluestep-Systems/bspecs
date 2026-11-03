---
description: "BlueStep merge reports emit HTML+CSS+JS via a B.out template literal; the inline <script> inside that string must be plain JS — any TypeScript syntax ships verbatim to the browser and breaks parsing, and backslash escapes are cooked before shipping (\\s becomes s) so embedded regexes must be double-escaped"
---

BlueStep merge reports emit their entire frontend as a single template literal:

```ts
B.out = `
<style>...</style>
<div>...</div>
<script>
(function() {
  // ← this code is a STRING; the TS compiler does NOT process it
})();
</script>
`;
```

Use plain ES2015+ JavaScript only inside the template literal. The TypeScript compiler only processes code *outside* the literal. Anything between the opening backtick and closing backtick is treated as a plain string and shipped to the browser verbatim, so TS syntax there fails to parse as JavaScript.

**Common leaks that break the inline script:**

- Type annotations: `var parts: string[] = [];` → `:` is invalid in JS at that position → `SyntaxError`.
- `as` casts: `(x as any).foo` → invalid here.
- Generics: `Foo<T>` → parsed as a `<` comparison, then garbage.
- `interface`/`enum` declarations.
- **An UNESCAPED backtick or `${` anywhere inside the literal — INCLUDING inside `//` or `/* */`
  comments.** (Escaped forms — `` \` `` and `\${` — are legal and ship the literal character.)
  A stray backtick closes the literal early and TypeScript misparses the rest of the **file**
  (a cascade of bogus diagnostics — `"," expected`, `Cannot find name 'B'` — far from the real
  cause); an unintended `${` interpolates server-side where you meant literal text. Shipped in
  practice: comments quoting words in backticks inside the client literal broke the transpile,
  and `b6p push --snapshot` still printed "Snapshot complete" (emit continues through errors),
  deploying a broken `app.js`.
- **Regex escapes are consumed by the template literal itself.** The literal cooks backslash
  escapes before the browser ever sees the string: an unrecognized escape like `\s` becomes plain
  `s`, so `.replace(/\s+$/, '')` in the source ships as `.replace(/s+$/, '')` — a regex that
  strips trailing **"s" characters**. Likewise `\d` → `d`, `\w` → `w`, `\.` → `.` (matches any
  character), and `\b` becomes a literal **backspace character**, not a word boundary.
  **Double-escape every regex escape the literal carries to the browser** (`\\s`, `\\d`, `\\w`,
  `\\b`, `\\.`). Shipped in practice: option labels arrived one character short (`"1. Yes"` →
  `"1. Ye"` — the de-escaped trim regex ate trailing "s") and was misdiagnosed as a platform
  truncation bug while storage, the native render, MCP reads, and every server-side value were
  clean. When client-side data is subtly wrong but every server-side read of the same value is
  clean, check the emitted JS for de-escaped regexes before suspecting the platform.

**Symptom:** the dashboard sits forever on the initial "Loading…" because the bootstrap script never executes. `tsc` passes clean because the *source* file's TS is valid. No console error from the fetch — it never started. For the stray-backtick variant, the tell is instead a **diagnostic cascade in the source file** whose first error sits at (or just after) the literal.

**How to apply:** When writing or editing the `B.out` template-literal block, keep the inline `<script>` JS-only — type your helper functions and outer code in TS all you want:

- No `: Type` annotations on variables or params.
- No `as Type` casts.
- No `interface`/`enum`/`type` declarations.
- Use `var` (or `let`/`const`) without type info.
- **Zero UNESCAPED backticks inside the literal — comments included** (quote words in comments
  with single quotes; if the client script genuinely needs a backtick, escape it: `` \` ``).
  Every unescaped `${` must be an **intentional server-side interpolation** — ship a literal `${`
  to the browser as `\${`; a `${` inside a comment is always a bug.
- Be especially careful when porting helper code that was originally TS.

Quick lint after big edits (comment contents count too, not just code):

```js
const inner = txt.slice(txt.indexOf('B.out = `') + 9, txt.lastIndexOf('`;'));
[...inner.matchAll(/\b(var|let|const)\s+\w+\s*:\s*[A-Za-z\[\]<>{}|]+\s*=/g)]; // TS leaks — any match = bug
[...inner.matchAll(/(?<!\\)`/g)];   // UNESCAPED backticks — any match = bug
[...inner.matchAll(/(?<!\\)\$\{/g)]; // review list: every hit must be an INTENDED server-side interpolation
[...inner.matchAll(/(?<!\\)\\[sdwb.]/gi)]; // single-escaped regex escapes — each ships de-escaped (\s → s); double-escape as \\s
// The ${ scan is a review list, not pass/fail — a hit inside a comment is by definition
// unintended (fix it); hits in code are fine only if the interpolation is deliberate.
```

Seen in practice on a dashboard merge report: a `var parts: string[] = [];` in inlined Gantt code froze the entire dashboard.

Related: [single script](single-script.md) — BlueStep only compiles root `static/script.ts`, not subdirs. Merge reports inline their JS into `scripts/app.ts`'s string output instead — a different file but the same class of "TS doesn't process this content" problem.
