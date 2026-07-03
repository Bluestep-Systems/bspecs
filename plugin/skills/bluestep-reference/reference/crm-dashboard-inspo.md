---
description: "Multi-page dashboard SPA pattern — server flattens forms to a JSON payload island, a single client bundle renders a tabbed SPA; reference for any data-dense MergeReport dashboard"
---

A reusable **multi-page dashboard SPA** pattern for a data-dense MergeReport: a thin server that flattens form data into one JSON payload, and a fat single-file client bundle that renders a tabbed single-page app. Server-thin/client-fat.

> This is a **related but different build model**: a `B.out` JSON island + endpoint on a **platform-compiled** bundle, NOT an off-platform Vite bundle. For the off-platform Vite/Preact SPA model, see [vite spa merge report](vite-spa-merge-report.md).

**Architecture (the pattern to reuse):**
- `scripts/app.ts` (server): iterates the top-level query ONCE, flattens each record plus its sub-form entries into plain `*Lite` objects (one flat type per sub-form), builds a `{meta, ...collections}` payload, and emits it as `<script id="data" type="application/json">…</script>` alongside an empty `<div id="app">` mount. **Escape the JSON before embedding** — `.replace(/</g, '\\u003c')` — so a stray `</script>` in the data can't break out of the tag.
- `static/script.ts` (client): reads the JSON payload, renders the SPA — a global filter bar + tab dispatch (`renderActiveTab`) + one page renderer per tab + a shared detail modal.
- **Single-file client bundle**: BlueStep compiles ONLY `static/script.ts` → `.build/script.js`. Any `static/util/*.ts`, `static/pages/*.ts`, `static/types.ts` files are source-of-record copies, NOT compiled — all live code must be inlined into `script.ts`. (Confirms [single script](../conventions/single-script.md).)
- `static/index.html`: load a charting library (e.g. Chart.js) from a CDN, then `.build/script.js`, then `styles.css`.

**Reusable techniques:** canonical-vs-observed dropdown merging (`mergeUnique`); per-entity try/catch so one bad record doesn't kill the whole report; weighted rollups by a categorical confidence/status; HTML funnels, donuts, stacked bars, heatmaps, age histograms; CSV export; detail modal keyed by record id.

**Server field-read helpers worth copying:** `formatDate(field)` (DateField→LocalDate.format, falls back to LocalDateTime.toLocalDate), `readSingleSelect(field)` (`field.opt().map(v=>v.displayName()).orElse('')`), multi-select via `field.selectedNames().toArray()`.

**CAUTION when reusing on a different report:** a dashboard reads fields from ITS OWN context — field keys, sub-form names, and whether a field is a text mirror vs a relationship differ per component. Always build a new report's metrics against that component's own `declarations/index.d.ts`, not by assuming the field names from the report you copied the pattern from.
