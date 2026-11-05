---
name: reference
description: "On-demand reference for building BlueStep One custom components — the type files and a component repo's setup, the type, copies and required-fields checks, build and publish from a signed-in tab, the served and UX checks, the design check, and the rules, patterns and gotchas of the host, the kit, /gql reads and writes, rights, pages and tooling. This file is the manifest, one line per file with a \"Load when\" trigger; read it first, then only the file you need. Use when building, reviewing or planning a BlueStep One component."
---

# BlueStep One reference

Read only the file the task needs. Entries carry ids (`G-`, `R-`, `P-`) in their headings, and
other entries cite them by id; an id is the same in every file. Running a GraphQL call from a
signed-in tab is in the bluestep-tools reference (`/bluestep-tools:bluestep-reference` ›
`reference/gql-in-a-tab.md`).

An entry that says a GraphQL read or write was made "over the gateway" or with `graphql_query` /
`graphql_mutation` was seen before release 26.10.21.02, which took those tools off the gateway. The
same query runs unchanged as a `/gql` POST from a signed-in tab.

## Building and publishing

- [build/types.md](build/types.md) — the seven BlueStep One type files and a component repo's setup. Load when setting up a repo, when a type error says the host lost a member, or before any publish.
- [build/typecheck.md](build/typecheck.md) — the type check, the copies check and the required-fields check. Load before a push to `draft`, and when a check fails.
- [build/publish.md](build/publish.md) — build and publish, from a signed-in tab or the *Build* tab. Load before building or publishing, and when a build fails.
- [build/served-check.md](build/served-check.md) — whether the published commit is the one served. Load after every publish, before any live check.
- [build/ux-check.md](build/ux-check.md) — the measured UX check of the served screen: timings, `/gql` calls, layout shift, errors and duplicate control names against the project's thresholds. Load after the served check, before the live check, and when the UX check stops.
- [build/design-check.md](build/design-check.md) — a canvas export beside the live screen. Load after a UI publish has passed the served check, and when writing a change's `design-audit.md`.

## Rules and patterns

- [rules.md](rules.md) — rules for any component: no private data in placement props or repos, one data path per piece of data, branching on a refusal's code, rights-refusal wording, slow-work states in the design check, settings an org can change. Load when designing a component, and before deciding what a screen may show or do.
- [patterns.md](patterns.md) — patterns for a component's data, saves, states, opening times and tests, plus kit and layout idioms (tables as CSS grids, kit tabs, links and dialogs, focus rings, focus moves) and checking a page at 1440 px. Load when designing a component's data, saves, states, layout or tests.

## Gotchas

- [gotchas/host-components-kit.md](gotchas/host-components-kit.md) — the host contract, custom components and the `@bluestep/ui` and `@bluestep/form-kit` kits: partial host saves, radio groups and arrow keys, focus in dialogs and popovers, icon sizes, missing CSS variants, `PageContent` padding, record types, sub-unit searches, copied read deadlines, `openNewEntry`, `components.list` names, nav reads, deletes, `shownWhen` in blocks. Load when a component reads through the host, places itself, or draws kit parts.
- [gotchas/gql-reads.md](gotchas/gql-reads.md) — reading over `/gql`: CSRF round trips, signature filters, cached host reads, id spellings, option order. Load before writing a `/gql` read.
- [gotchas/gql-writes-and-saves.md](gotchas/gql-writes-and-saves.md) — writing over `/gql`: links a save can clear, stale versions, field-id spellings, `history` changes. Load before writing a `/gql` create or update.
- [gotchas/forms-fields-options-time.md](gotchas/forms-fields-options-time.md) — forms, relationships, option colors and checkbox layouts, windowed reads by date. Load when a screen reads or writes a form, a relationship, a select or a date.
- [gotchas/formulas-save-order.md](gotchas/formulas-save-order.md) — what a PRE_EDIT formula sees in a save. Load when a screen's save must keep a formula's effect.
- [gotchas/manage-walks-and-method.md](gotchas/manage-walks-and-method.md) — copied code, live-region announcements, versions written by post-save formulas, slow or failing builds, multi-unit pages, reloads between builds, read deadlines, unload guards. Load when a build, a reload or a save's version behaves oddly, or when a screen spans several units.
- [gotchas/permissions-users-staff.md](gotchas/permissions-users-staff.md) — rights, staff users, *Temporary login* and signed-out sessions. Load when deciding who may see or do what, or when a save is refused.
- [gotchas/reports-pages-search-nav.md](gotchas/reports-pages-search-nav.md) — placing a component on a page, page contexts, filters, lists built from the day's entries, nav bars and menus, list sorting, drafts across reloads. Load when a component is a page, a list or a nav piece.
- [gotchas/live-checks-probes-testing.md](gotchas/live-checks-probes-testing.md) — a component repo's `.scratch/` folder. Load before a probe, a live check or a fixture capture.
- [gotchas/tooling-windows-b6p.md](gotchas/tooling-windows-b6p.md) — the type check (`--files` on tests, a syntax error hiding type errors), `node --test` and `.tsx`, Node warnings, time zones in tests on Windows. Load when the type check or a component's tests misbehave.
