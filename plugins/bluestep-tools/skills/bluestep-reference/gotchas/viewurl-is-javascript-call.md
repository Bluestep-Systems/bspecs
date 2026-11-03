---
description: "entry().viewUrl() returns javascript:submitForm('Relate','commit','<url>'), not a URL — as an href it silently ignores target='_blank' and clicking it COMMITS the enclosing form; unwrap the real URL with a regex before rendering"
---

# `entry().viewUrl()` is a `javascript:` call, not a URL

`entry().viewUrl()` on a form entry does not return a navigable URL. It returns:

```text
javascript:submitForm('Relate','commit','<real-url>')
```

A `javascript:` href **executes in the current document** instead of navigating, so rendering it
as a link's `href`:

- silently ignores `target="_blank"` — the link can never open a new tab;
- breaks ctrl-click and right-click "Open in new tab";
- **commits the enclosing form when clicked** — a real side effect for what looks like a plain
  "view the source record" affordance.

The failure is expensive to diagnose because it presents as ordinary same-tab navigation — the
obvious suspects (click interceptors, iframe nesting, `<base target>`) are all wrong, and a
published `target="_blank"` that can never work looks like a rendering bug. Reading the live
`href` in the DOM shows the cause immediately.

The declarations won't warn you either: the `B.d.ts` doc comment for `viewUrl()` describes a plain
relative URL and even shows it dropped straight into markup — the `javascript:` wrapper is runtime
behavior the type docs don't mention.

## The fix — unwrap before rendering

Match the wrapper and take the inner URL, passing anything else through untouched so a future
platform change that returns a real URL keeps working:

```typescript
const raw = entry.viewUrl();
const m = /^javascript:submitForm\((?:[^,]*,){2}\s*'([^']+)'\s*\)\s*;?$/.exec(raw);
const href = m ? m[1] : raw;
```

(Verified live 2026-08 against a page of rendered entry links.)

## Debugging rule

When a rendered link behaves oddly — wrong tab behavior, unexpected form submits — **read the
live `href` in the DOM first**, before theorizing about click handlers or embedding context.
