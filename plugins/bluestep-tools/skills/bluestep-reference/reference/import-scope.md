---
description: BlueStep form/field imports are scoped — a field attaches to the current record (only with a primary form) or to specific named queries, and must be imported on every query whose record type reaches the code
---
# Import Scope — current-record vs. named-query

A form/field import is **scoped**: it does not become globally available just because it exists in `declarations/`. Each import attaches to one of:

- **the current record** — valid **only** when the component has a primary form / record type attached (i.e. it runs *in the context of* a record). No primary form means there is no "current record" to hang the import on, so this scope is unavailable.
- **one or more specific imported queries** — the field is imported *on* a named query (or several), and is only reachable through a record obtained from that query.

## The every-reachable-query rule

A field must be imported on **every** query whose record type reaches the code — not just the one you happen to read at runtime. Two distinct paths make a record type "reach" the code:

1. **Runtime read** — the query you actually iterate/`.get()` and whose entry you call `fields.FID...` on.
2. **Declared parameter type** — any query whose record type is used as a *declared type* (e.g. a function parameter `(rec: Record_<query>) => ...`, a typed variable, or a return type). The compiler resolves `FID` against that record type, so the field must be imported there for the code to typecheck — even if that query is never read at runtime.

Importing the field on only one of these fails:

- import only on the runtime-read query → the code **fails to compile** wherever the declared parameter type is used.
- import only on the parameter-type query → the code **compiles but fails at runtime** when the actual read happens through a record the field was never imported on.

So: if `Record_<queryA>` is read at runtime and `Record_<queryB>` appears as a declared parameter type, `FID` must be imported on **both** `<queryA>` and `<queryB>`.

## Verifying scope against declarations

The scope is **verifiable** — do not assume it. After the import is wired:

- confirm each `FID` appears under **every** query record type (`Record_<query>`) that the code touches, in `declarations/`.
- the `[CODE]` that reads a field should **name which query/record it reads through**, so the reviewer can check that same query carries the field in `declarations/`. A read expressed only as "read `FID`" is unverifiable — pair it with "via `<query>` (`Record_<query>`)".

## Planning checklist

When a task adds a form/field import, state its scope explicitly:

- **current record?** — only if a primary form / record type is attached to the component.
- **which query/queries?** — list every query whose `Record_<query>` reaches the code: the runtime-read one(s) **and** any used as a declared parameter/variable/return type.
- the paired `[CODE]` names the query/record each field is read through, so scope can be verified against `declarations/`.

> Placeholders here (`FID`, `<query>`, `Record_<query>`, `<queryA>`/`<queryB>`) stand in for the real formula id and query names in your component — substitute the actual names from `declarations/` when wiring.
