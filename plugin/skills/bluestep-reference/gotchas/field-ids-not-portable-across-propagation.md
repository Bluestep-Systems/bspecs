---
description: "A form propagated from a Config org to descendant client orgs does not carry matching field ids — a field built before a descendant org existed tends to share its id there, anything built after very likely diverges, and any match should be treated as coincidence, not something to rely on"
---

# Field ids are not portable across org propagation

## Symptom

The same form, propagated from a Config org down to several descendant client orgs, holds
different field ids for the same field depending on which org you read it from. Platform work
written against one org's ids (a topId gathered while testing in org A) silently targets the
wrong field — or no field — when pointed at org B.

## Cause

Propagation does not guarantee matching ids across orgs. A field created on the form **before**
a descendant org existed tends to carry the same id in that org. A field created **after** the
descendant org existed is very unlikely to match. Confirmed live (2026-09): on a form shared by
two descendant orgs, one of the form's oldest fields carried the same id in both, while two
newer fields on the same form carried different ids per org. Older orgs are more likely to show
matching ids simply because more of the form's fields predate them — treat any match as
coincidence, not as something to build on. Assume divergence by default.

## Rule

- **BsJs code is insulated** — it reaches fields by formulaId through the generated
  `declarations/` types (e.g. `record.fields.someField`), which resolve per org at compile/run
  time. This gotcha does not touch that path.
- **Platform work is not insulated.** Field creation, wiring, and any gateway MCP call that
  takes a topId must re-resolve every id against the specific org being targeted. Never carry an
  id gathered in one org into a call against another org, upstream or downstream in the
  propagation chain — resolve by name in the org you are actually operating on.

## Related

The per-org, non-portable nature of topIds is also the reason resolution has to happen by name
rather than by carrying an id across orgs — see the `formId`/`fieldId` resolution rule in
[mcp platform authoring](../conventions/mcp-platform-authoring.md).
