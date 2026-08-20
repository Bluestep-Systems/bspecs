---
description: "How a component ACQUIRES the stable name code resolves it by: the FID=<name> alternate identifier (formulas/reports/queries), the field's dedicated Formula ID property, and the ON_DEMAND Identifier — three different mechanisms; which one resolves what"
---

# `FID=<name>` and friends — how a component gets its code-facing name

The runtime docs consume FIDs everywhere — `entry.fields.<name>`, the bare query variable, the
`__FID_<name>` id encoding, `runFormula("<name>")` — but a component only answers to a name it was
**given**. There are **three different naming mechanisms**, and they are not interchangeable.

## The taxonomy — which mechanism resolves what

| Mechanism | Set where | Resolves |
| --- | --- | --- |
| **`FID=<name>` alternate identifier** — a key/value entry (key `FID`) in the object's alternate-identifier / custom-lookup list | platform UI (the object's Alt IDs / custom lookup properties), or the MCP `altIds` param | name-addressability of **formulas, merge reports, and queries**: the `__FID_<name>` full-id encoding, `B.find.mergeReport("…__FID_<name>")`, `optApplicable*("FID", "<name>")` custom-prop lookups (args = alt-id key, value), `.altIds()` walks — and observed live making `runFormula("<name>")` resolve (2026-08) |
| **Field `formulaId`** — a dedicated "Formula ID" property on **fields** | field CREATE (or a repair UPDATE) — the `formulaId` param on the MCP `field` tool | the field's **property key in the generated BSJS declarations** (`entry.fields.<name>`, `readonly <name>:` in `declarations/`) |
| **ON_DEMAND `Identifier`** (`uniqueId`) — a required, plain single-value text field on ON_DEMAND formulas | platform UI only ("Edit Formula Options"; no MCP parameter exists) | the platform's documented key for **scheduling** the on-demand formula from other code |

Three consequences of "three different things":

- An `altIds` `FID=` entry on a **field** does **not** set `formulaId` — the field stays out of the
  declarations (`formulaId: null`) and the tool warns about it. Repair: a `field` UPDATE setting
  `formulaId`. (verified 2026-08 — see the quirks in
  [conventions/mcp-platform-authoring.md](../conventions/mcp-platform-authoring.md))
- An `altIds` entry keyed `uniqueId` does **not** set the ON_DEMAND `Identifier` — it just appends
  an unrelated alt-id while the required field stays blank (false success; same quirks list).
  Setting the Identifier is a UI step.
- `runFormula("<name>")` resolution has been observed to work off a `FID=<name>` alt-id (a target
  with no alt-id resolved to nothing; adding `FID=<name>` made it resolve, 2026-08), while the
  platform's own UI describes the ON_DEMAND `Identifier` as the scheduling key. Until the platform
  documents the lookup order: **always fill the required `Identifier`** (the formula is incomplete
  without it), and give the formula a matching `FID=<name>` alt-id — keep the two the same string.

## Concrete example

On the platform, add alternate identifier `FID=clientHeader` to a merge report. Its full id then
carries the encoding — `530024__FID_clientHeader` — and code resolves it by that name:

```typescript
B.find.mergeReport("530024__FID_clientHeader").viewUrl()      // full-id lookup
formEntry.optApplicableBsJsMergeReport("FID", "clientHeader") // custom-prop lookup: (alt-id key, value)
```

## Where the runtime surfaces are documented

- Field/form access by FID string and the bare top-level query variable:
  [api-patterns](api-patterns.md).
- The `__FID_<name>` encoding, `.altIds()`, and `optApplicable*` lookups:
  [merge-report-urls](merge-report-urls.md).
- Invoking an on-demand formula by name (`runFormula` / the `FormulaScheduler` builder):
  [bsjs-development.md](../bsjs-development.md) → "OnDemand / Field Formula".
