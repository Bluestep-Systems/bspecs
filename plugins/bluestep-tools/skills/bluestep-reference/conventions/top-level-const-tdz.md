---
description: "BlueStep endpoint/merge-report scripts run top-down — declare every const/let ABOVE the entry try block or they are in TDZ when the request handler fires"
---

In BlueStep endpoint / merge-report scripts, declare every `const` and `let` ABOVE the top-level entry block (the `try { ... }` that runs the request handler). Do not interleave constants with helper functions further down the file.

**Why:** A typical BlueStep endpoint looks like:

```ts
const A = 1;        // initialized
const B = "x";      // initialized
try {               // runs synchronously at load time
  handleChat(...);  // → calls persistAuditTurn() → reads C
} catch (...) { ... }

function handleChat() { ... persistAuditTurn() ... }
function persistAuditTurn() { return { v: C }; }  // C is read here

const C = 1;        // ← TDZ: not yet initialized when handleChat ran above
```

The function declarations hoist, so `handleChat` and `persistAuditTurn` are *callable* from the try block. But `const`/`let` initializations execute in source order. By the time `handleChat` runs (during the try block), any `const` below the try is still in its temporal dead zone — referencing it throws `ReferenceError: C is not defined` (BSJS surfaces this exact wording).

Seen in practice on an audit-log endpoint: `AUDIT_DATA_VERSION` was declared next to `persistAuditTurn` (mid-file) instead of with the other top-of-file constants. Symptom: the response succeeded but `auditError: AUDIT_DATA_VERSION is not defined`.

**How to apply:**

- Group all `const`/`let` declarations at the top of the file, above the entry `try { ... }` block — even ones that are conceptually "module-scoped helpers."
- Function declarations are fine wherever — they hoist with their body.
- If you must declare a constant near a related function for readability, inline its value at the call site instead, or wrap it in a getter `function VERSION() { return 1; }`.
- This isn't BlueStep-specific JS semantics — it's standard ES2015 TDZ. But it bites BlueStep specifically because the entry-point pattern is "top-of-file try block runs immediately on load," which is unusual outside this platform.

**Merge-report client-bundle variant:** The same trap applies in `static/script.ts` because the file initializes `let state = createEmptyState();` at top level. `createEmptyState` is a function declaration (hoisted), but anything its body reads must already be initialized. Putting the constants it references far below the state initializer broke the whole merge report — the script threw `ReferenceError` at module load, the app `<div>` was never mounted, and the raw JSON memo field showed through underneath. Symptom: "the entire merge report is not there and I can see the raw json in the memo field." Fix: move any `const` referenced by `createEmptyState` (or anything else that runs at module load) ABOVE the `let state = createEmptyState()` line.
