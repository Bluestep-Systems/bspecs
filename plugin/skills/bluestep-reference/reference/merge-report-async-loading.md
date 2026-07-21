---
description: A Data Merge Report's "Asynchronous Loading" option makes it lazy-load AFTER the rest of the page resolves instead of as part of the initial request; in BSJS this was an `async` metadata property rather than the checkbox
---

A BlueStep **Data Merge Report** has an **"Asynchronous Loading"** checkbox under
*Advanced Usage Options* (Step 3 of the merge-report edit wizard). Turning it on
makes the merge report **resolve in a lazy-load rather than as part of the initial
page request** — the rest of the page renders first, then the merge report loads
in separately so a heavy merge doesn't slow everything else down.

This is **not a new feature**. It maps directly to the underlying DB object and has
existed for a long time. **BSJS had no toggle** — you set an `async` property in the
component metadata, which inserted a layer of indirection over that same DB object.
Removing that BSJS layer is what surfaced the plain checkbox; it only *looks* new to
anyone who previously only used BSJS.

**Parent → child behavior.** When a merge report calls another async merge report,
the **parent's HTML resolves first**, the page loads, and then each async child
loads separately — so a parent merge report that fans out to N children can give
each child its own independent loader. (The resident-med report does exactly this:
a nasty merge that renders per resident, switched to async, **loads in batches of
3 at a time**.)

**Good use cases:** heavy/slow merges; merge reports embedded on a form; a parent
merge report aggregating several child merge reports; query-driven layouts where
displayed merge-report fields can stream in after the header data.

**Gotcha — script timing.** Because the content is no longer present at initial page
load, any page script that **expects the async merge report's DOM/data to already be
there will break**. If you have client code depending on the merge report, gate it on
the async content actually arriving rather than on initial `DOMContentLoaded`.

**Obsolete hack.** Older setups added a marker like
`htmlCode += '<span id="formFooter"></span>'` to force the async merge report to load
properly. With the current setup this should **no longer be necessary** — don't carry
it forward into new code.

**Client-side async embed (`contentOnlyUrl()` + `<b-include>`).** The server-side
checkbox above is not the only way to get per-section lazy load. A parent merge report
can drive it from the client: for each sibling section, resolve that section's
`contentOnlyUrl()` (the report body without page chrome) and emit
`<b-include src="…" run-scripts="true">`. Each section then fetches and renders
independently in the browser, with its own spinner — heavy sections don't block the
lighter ones. Resolve each `contentOnlyUrl()` through an **imported primary-form
FormEntry** (`optApplicable*` returns empty unless called on the target report's
primary form — see the primary-form hard rule in
[merge-report-urls](merge-report-urls.md)). See
[b-include element](b-include-element.md) for the `<b-include>` attributes.

For dynamic async content driven from the client (rather than this server-side
config), see [b-include element](b-include-element.md). Related merge-report detail:
[merge-report-static-index](merge-report-static-index.md),
[merge-report-memo-json](merge-report-memo-json.md).
