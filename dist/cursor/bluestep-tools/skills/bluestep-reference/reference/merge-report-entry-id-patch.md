---
description: "Inline-embedded BSJS MergeReport with a static/ bundle can't read entryId from the page URL — patch it server-side: app.ts reads formEntry.topId() and emits a B.out script that sets data-entry-id on the mount before the client's boot() fires"
---

# entryId patch for inline-embedded MergeReports with a `static/` bundle

## The problem

When a BSJS MergeReport is embedded via inline `.resolve()` from a Relate section-form
MERGE_REPORT field template, the outer page URL is the **record's own view page** — not the
component's own URL. The client bundle's `boot()` therefore cannot read `entryId` from
`window.location.search` and renders a "missing data-entry-id" error.

## The patch

Have the server hand the id to the client through the DOM. In `scripts/app.ts`:

```typescript
// topId is a METHOD, not a property — call it with parens.
const entryId = sectionEntry.topId();
B.out = `<script>(function(){
  var r = document.getElementById('<mount-id>');
  if (r) { r.setAttribute('data-entry-id', '${entryId}'); }
})();</script>`;
```

The client's `boot()` then reads `data-entry-id` off its mount element instead of the URL.

## Why the ordering works

`B.out` is injected **after** `static/index.html` in the DOM (see
[merge-report-static-index](merge-report-static-index.md)), and the client's `boot()` is
`DOMContentLoaded`-gated — so the attribute is set before boot fires. Verified live 2026-08.

## When you need this

Any BSJS MergeReport with a `static/` bundle that is embedded **inline** rather than viewed at its
own URL — including the RelateScript-caller case where the client-side async-embed recipe is
unavailable (see the caller-context caveat in
[merge-report-async-loading](merge-report-async-loading.md)).
