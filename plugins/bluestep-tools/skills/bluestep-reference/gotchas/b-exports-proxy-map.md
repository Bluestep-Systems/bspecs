---
description: "B.exports is a Java-side proxy map, not a plain JS object — array .push() on a read-back value fails at runtime; store structures as JSON strings (primitives round-trip)"
---

`B.exports` looks like a plain JS object but is backed by a **Java-side proxy map** (observed as `ProxyJavaMap` in a Graal stack trace). Values written to it are marshalled across the JS↔Java boundary, so a value read *back* is a Java host object, not the JS value you put in.

- **The trap:** the common accumulate pattern

  ```js
  B.exports.k = B.exports.k || [];
  B.exports.k.push(v);
  ```

  type-checks locally but **fails at runtime on the platform**. After a prior write, reading `B.exports.k` back returns a Java host object rather than a JS array, so `.push()` doesn't exist on it:

  ```
  TypeError: invokeMember (push) on ...ProxyJavaMap... failed due to: Unknown identifier: push
  ```

- **Nothing local catches this.** Editing, `tsc`, and the `b6p push` transpile step all pass — only an actual platform run reproduces the failure. Don't trust a clean local build here.

- **Scope of what's confirmed:** only the array `.push()` path was reproduced live. Object bracket-assignment on a read-back value (e.g. `B.exports.k[prop] = v` after a prior write) was **not** confirmed to have the same issue — treat it as suspect but unproven.

- **Confirmed safe workaround — store the accumulator as a JSON string**, not a live array/object:

  ```js
  const raw = B.exports.k;
  const existing = raw ? JSON.parse(raw) : [];
  existing.push(v);
  B.exports.k = JSON.stringify(existing);
  ```

  You mutate a genuine local JS array, then serialize it back to `B.exports` as a string on each write.

- **Rule of thumb:** primitives (a plain boolean flag, a number, a string) round-trip through `B.exports` cleanly; structures (arrays/objects) do **not** — serialize them to JSON on write and parse on read.
