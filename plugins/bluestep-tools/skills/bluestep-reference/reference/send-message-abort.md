---
description: B.net.sendMessage(msg, abort) aborts saves — but for pre-delete formulas, the message does NOT surface in the UI
---
In BSJS, the relatescript-style `sendMessage(msg, abort)` is on `B.net`:

```typescript
B.net.sendMessage(message: string | Java.Throwable, abort?: boolean): void
```

Per the docstring, `abort=true` rolls back the entire transaction; the message is supposed to display in red at the top of the page, contingent on returning the user to "the edit screen" — i.e. the message-rendering path is coupled to the standard Relate edit return.

## Pre-delete limitation (confirmed)

For **pre-delete formulas**, the abort works (DB transaction rolls back, deletion is prevented) but **the message never surfaces in the UI**. Tested all three patterns:

1. `B.net.sendMessage(msg, true)` — aborts cleanly, no UI message, no log entry
2. `throw 'msg'` — aborts, no UI message, no log entry either
3. `B.net.response.redirect(setupRoles.viewUrl())` THEN `B.net.sendMessage(msg, true)` — aborts, no UI message

The user just sees BlueStep's generic "Problem storing the data" error, with no detail about why.

Hypothesis: pre-delete has no edit-screen return (delete isn't an edit), and BSJS's message-rendering layer doesn't have a fallback path for delete operations.

## What works for pre-delete

- **Aborting the deletion** — any of `sendMessage(_, true)`, `throw msg`, or both — works fine.
- **NOT surfacing a custom message** — appears to be a real BSJS gap, not a code-side bug.

## Recommended UX workaround for pre-delete

Don't rely on the abort message. Instead, show the relevant info (e.g. linked records that prevent deletion) **on the entry's view page itself** via a separate display formula or banner, so admins see the explanation before they attempt deletion.

## What works elsewhere

- **Pre-save (form-attached post-save)** — `throw msg` aborts AND logs the message as a `PolyglotException` (e.g. a multi-select error in a role-propagation formula logs this way).
- **Endpoints / OnDemand / Scheduled** — full UI control, including HTTP responses.
- **Linking specific forms in HTML messages** — `formEntry.editUrl()` (inherited from `BaseObject`) returns a relative URL to edit that form.
