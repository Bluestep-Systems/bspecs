---
description: "Parameterized data-endpoint + dashboard framework — one endpoint serves per-entity/date-range JSON via URL params, a thin-server dashboard fans out throttled parallel fetches; reference architecture for client-fed analytics dashboards"
---

A reference architecture for a dashboard that pulls per-entity, per-date-range data from a single parameterized JSON endpoint. Two components, server-thin/client-fat: a **data endpoint** (the service) and a **MergeReport dashboard** (the consumer/UI).

> This is a **related but different build model**: a `B.out` JSON island + endpoint on a **platform-compiled** bundle, NOT an off-platform Vite bundle. For the off-platform Vite/Preact SPA model, see [vite spa merge report](vite-spa-merge-report.md).

## Endpoint: parameterized data service
`scripts/app.ts` reads a few URL params and returns JSON. The point of the pattern: **one endpoint, many shapes of data via params.**

- `entityid` — which entity (accept short id OR full `Class___Short`; resolve via the query's `optById(id)`).
- `startdate` / `enddate` — ISO `YYYY-MM-DD` window. Per-entry filtering can use a plain string compare (`dateStr < startDate || dateStr > endDate`) since ISO sorts lexically. A top-level query instead uses `addSearch(<form>,<field>,'>=', MM/dd/yyyy)` — note the **format flip to MM/dd/yyyy** for `addSearch` (see [date format](../conventions/date-format.md)), wrapped in try/finally with `clearSearchAndSort()`.
- `action` — the response-mode discriminator: e.g. `daily` (default; per-day buckets), `weekly` (aggregated week rows), or `full` (daily buckets + weeks). One endpoint, several payload shapes.

Response envelope is always `{ success, ...keys, ... }` with `sendError(status, msg)` emitting `{ success:false, error }`. Missing params → 400 with a list of which were missing. Whole body in try/catch → 500. Reads via a query/field manifest (each query lists the exact fields to load). `config.json`: `transactionReadonly:false`, a generous `transactionTimeout`, and a small `sandbox`. Output via `response.out(JSON.stringify(...))` (see [endpoint output channel](endpoint-output-channel.md)).

> Older components may still use a legacy `objects/imports.ts` `require` manifest; configure new components' form-imports on the platform instead (see [api-patterns](api-patterns.md#query-access-patterns)).

## Merge report: dashboard consumer
`scripts/app.ts` (server) emits **only a roster** — a `<script type="application/json">` of `{entityId, label, group}` for every entity in scope — plus the mount div, a charting CDN, and `.build/script.js`. No per-entity data server-side; `record.id().toString()` (the full form) is the wire id the endpoint expects.

`static/script.ts` (client) is where the framework lives:
- On load, pick a sensible default window (e.g. the last few full weeks); date inputs + an Apply button let the user change it.
- A loader builds one fetch task per roster entry and runs them through `runWithConcurrency(tasks, 10)` — a **throttled parallel pool (10 concurrent)** with a progress bar. This is the key pattern: the dashboard makes N calls to the same endpoint, one per entity, varying `entityid` but sharing the date window.
- Per-entity fetchers build `/<endpoint>?entityid=…&startdate=…&enddate=…&action=…`. An overview-level action drives the summary widgets (status bars, lines, doughnuts, a sortable table with sparklines); a detail-level action is **lazy-fetched** only when an entity is opened, and cached in a `state.byEntity` map.
- Changing the date range clears caches and refetches.

## The reusable framework, in one line
A stateless endpoint keyed by `(entity id, date range, action)` returning a `{success,...}` JSON envelope; a thin server that ships only an entity roster; a fat client that fans out throttled-parallel per-entity fetches over a user-chosen window, caches by id, and lazy-loads detail. Build on [merge report memo json](merge-report-memo-json.md)-style server-thin/client-fat, but feed the client from a params endpoint instead of a hidden memo.
