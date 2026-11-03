---
description: "BlueStep pages use jQuery — never define a global $ function or variable in merge-report scripts or you silently break Save and all page interactivity"
---

Never define a global function or variable named `$` in BlueStep merge-report scripts. BlueStep loads jQuery, and the entire page (form submission, change management, modals, navigation) depends on `$` being jQuery. Overwriting it with a `querySelector` wrapper silently breaks the Save button and all page interactivity.

**Why:** This caused a hard-to-diagnose bug where Save did nothing — jQuery's `$` was replaced by a plain `querySelector` helper, breaking `submitForm` and all BlueStep internals.

**How to apply:** Use `qs()` (or another non-colliding name) for `querySelector` helpers. Also avoid overwriting other common globals like `el` if they might collide with BlueStep or library internals.
