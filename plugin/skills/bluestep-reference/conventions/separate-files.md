---
description: "Don't pile CSS/HTML/JS into app.ts — use the dedicated files (styles.css, index.html, script.ts) that the pulled folder already has"
---

When a BlueStep pull contains dedicated files (`styles.css`, `index.html`, `script.ts`, etc.) alongside `app.ts`, put each kind of content in the file that is named for it. Do not dump all CSS and HTML into a single giant `B.out = ` template literal in `app.ts`.

**Why:** The folder layout exists precisely so concerns are separated — CSS in `styles.css`, markup in `index.html`, client interactivity in `script.ts`. Stuffing everything into `app.ts` defeats the structure and makes the code unmaintainable. The user has called this out multiple times.

**How to apply:**

- Before writing or modifying a BlueStep file, list the folder contents and identify which dedicated files exist.
- Route content to its natural file: CSS → `styles.css`, markup template → `index.html` (or a separate template file), client-side JS → `script.ts`, server-side logic → `app.ts`.
- For merge reports **with a `static/` bundle**: `static/styles.css` and `static/.build/script.js` load automatically while `B.out` renders the page body — leave CSS in `styles.css`; do **not** read or `B.net.fetch` your own stylesheet to inline it. See [merge report static index](../reference/merge-report-static-index.md).
- For older merge reports **without** a `static/` bundle: the server-side TS can read sibling files via `B.io.fromInputStream(...)` (or the appropriate API) and inject them into `B.out` — investigate the existing API rather than inlining.
- For endpoints with `static/` folders: HTML/CSS/JS load from their own files; `app.ts` is the request handler only.
- If unsure how multiple files relate in a given BlueStep component type, check [api patterns](../reference/api-patterns.md) and look at how other working components are organized.

**Repeated offense — do not do this again.**
