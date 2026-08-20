---
description: "MCP get_script/read_script_draft error with 'FormulaModelRemote cannot be cast to … UserCodeScript' on legacy RelateScript formulas — the error means 'this is RelateScript', not 'missing'; read the source via the editformuladetails.jsp wizard instead"
---

# Reading legacy RelateScript formula source

## The failure

The gateway MCP script-source tools `get_script` and `read_script_draft` handle **BSJS
UserCodeScripts only**. On a legacy **RelateScript** formula they error with (verified 2026-08):

```
class myassn.relate.FormulaModelRemote cannot be cast to ... UserCodeScript
```

Read that error as **"this formula is legacy RelateScript"** — not as missing, broken, or
permission-denied. MCP cannot read RelateScript source at all; do not retry other script readers.

## The workaround — read it through the formula edit wizard

In the browser, on the formula's `editformuladetails.jsp` page (the "Edit Formula Options" step):

1. The page initializes a **3-step wizard** whose step URLs sit in hidden inputs
   `__wzURL0` / `__wzURL1` / `__wzURL2`.
2. Run `submitWizard(2, "autoNamedForm0")` (in the page's JS context) to advance to the
   `editformula.jsp` **code step**.
3. Read the source from the `#formula` textarea.

This is **non-destructive**: wizard navigation POSTs to session state only — it does not commit
the formula. Verified live while porting a RelateScript formula to BSJS (2026-08).

Relevant during RelateScript → BSJS migration work, where reading the legacy source is the first
step. The MCP tool set itself is catalogued in
[conventions/mcp-platform-authoring.md](../conventions/mcp-platform-authoring.md).
