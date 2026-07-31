---
description: "Reading multi-entry form data through a Relate query created via the MCP `view` tool has four traps — maxRows: 0 means literally zero rows (and is the default), recordTypes must be the record's BASE type, list_views(formId:) can't prove absence, and relateQuery can't execute an EntityList"
---

# Relate query over a multi-entry form — four traps

Creating a Relate query (DB view) over a multi-entry form via the MCP `view` tool and reading it
with `graphql_query { relateQuery(...) }` fails in ways that look like a platform limitation rather
than a config mistake — a healthy-looking view (columns come back correctly) that returns
`totalSize: 0` against a form holding hundreds of entries. All four traps observed live (2026-07,
plugin 0.14.0); together they produced the wrong conclusion "a Relate query cannot read MEFR
entries."

1. **`maxRows: 0` means literally ZERO rows — and it is the default.** The `view` tool's own
   inputSchema says "Maximum rows to return (0 = unlimited, default 0)" (still says so as of
   2026-07-31); it behaves as a literal zero-row cap, so the naive create silently produces a query
   that returns nothing. Working views use **`maxRows: -1`**. The schema text is served by the
   platform, so this file is the only place the correction can reach the reader.
2. **`recordTypes` is required, and it must be the record's BASE type — not the category the form
   reports.** `relateForm { recordTypes }` can return a *category*; the query needs the base record
   type of the records holding the entries. Wrong value or omitted → zero rows.
3. **`list_views(formId:)` cannot prove absence.** The formId filter misses views whose relationship
   to the form is `primaryForm`, and (verified live 2026-07-31) it also **omits EntityList/MEFR
   views** of the form while returning its `List` views. To check whether a view/MEFR already
   exists, call `list_views` **without** the formId filter and match by name/type.
4. **Use `List`, not `EntityList`, for data reads.** A `List` view over a multi-entry form yields
   one row per entry (verified on a six-figure-row form, `count` honored). `relateQuery` **cannot
   execute an EntityList view at all** — it throws a `Cannot cast AssociationSQLKey<Association> to
   BaseKey<Entity>` error, with and without `unit`. Note the distinction: the **EntityList MEFR**
   created by `create_mefr` is the vehicle for **wiring a script import** (the query-group recipe
   in `conventions/mcp-platform-authoring.md`); a **`List` view** is the vehicle for **reading
   entry data** via `relateQuery`. Different jobs — the two rules do not contradict.

## The working recipe

Create with the `view` tool: `viewType: "List"`, `maxRows: -1`, `recordTypes: [<base record type
topId>]`, plus display columns. Read with:

```graphql
{ relateQuery(id: "<view topId>", count: 50, start: 0,
              filter: { fieldId: "...", operation: EQUALS, value: "..." },
              sort:   { fieldId: "...", direction: ASCENDING }) {
    totalSize
    # plus the row/field selections your read needs
} }
```

`relateQuery` over a `List` view is the **only paged, value-bearing read path** for multi-entry
form entries: `formRows` ignores both `limit` and `offset` (always returns the full set) and
exposes no field values on its rows.
