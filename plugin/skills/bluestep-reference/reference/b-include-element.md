---
description: "`<b-include>` is a browser custom element that fetches HTML from a URL and renders it inline — client-side `<jsp:include>`/SSI for dynamic async content; trusted-template only (neutralized in user-supplied HTML)"
---

`<b-include>` is a **browser custom element** (defined in `dom.ts:432-560`) that
**fetches HTML from a URL and renders it inline** — think client-side `<jsp:include>`
/ server-side-include for the browser. Use it for dynamic, async page fragments.

**Syntax** — must use an explicit closing tag (it is **not** self-closing):
```html
<b-include src="/path/to/fragment.jsp"></b-include>
```

**Attributes**

| Attribute     | Values                | Purpose |
| ------------- | --------------------- | ------- |
| `src`         | URL                   | Content to fetch. **Reactive** — changing it re-fetches automatically. |
| `run-scripts` | `"true"` \| (omit)    | When `"true"`, `<script>` tags in the fetched HTML are re-inserted so the browser executes them. Default: scripts are inert. |
| `csrf`        | `"true"` \| `"false"` \| (omit) | Force CSRF handling. Omit for auto-detect: same-origin → `csrf.fetch`, cross-origin → plain fetch. |

**Examples**
```html
<!-- Basic same-origin include (CSRF token auto-attached) -->
<b-include src="/shared/content/fragment.jsp"></b-include>

<!-- Include a fragment and run its <script> tags -->
<b-include src="/path/with/scripts.html" run-scripts="true"></b-include>

<!-- Cross-origin with forced CSRF off (remote must send CORS headers) -->
<b-include src="https://other.example.com/widget" csrf="false"></b-include>
```

**Behavior**
- Shows a spinner while loading; shows an error box with a **"Reload"** link on failure.
- Re-setting `src` aborts the in-flight request and re-fetches.
- Removal from the DOM aborts any pending request.
- Drivable from JS via properties: `el.src`, `el.runScripts`, `el.csrf`.

**Security — trusted templates only.** `<b-include>` is **neutralized in user-supplied
content** by `HTMLFilter.java:46` (rewritten to `<xxb-includexx>`) to prevent injection.
Only use it in **trusted templates**, never in user-editable HTML. The Zesty editor
whitelists it as `b-include[src|run-scripts|csrf]` (`zesty3.ts:130`).

**Recipe — lazy-loading merge-report sections.** A common trusted-template use: a parent
merge report resolves each sibling section's `contentOnlyUrl()` (the report body without
page chrome) and emits `<b-include src="…" run-scripts="true">` per section. Each section
then fetches and renders independently in the browser, each with its own spinner — so a
heavy section doesn't block the lighter ones. `run-scripts="true"` is needed so the
fetched section's own `<script>` tags execute. Resolve each `contentOnlyUrl()` through an
**imported primary-form FormEntry** — `optApplicable*` returns empty unless called on the
target report's primary form (see the primary-form hard rule in
[merge-report-urls](merge-report-urls.md)).

For the server-side config alternative (a merge report that lazy-loads after the page),
see [merge-report-async-loading](merge-report-async-loading.md).
