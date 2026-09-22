---
description: "How to build a consolidated, one-row-per-entry Relate Report across multi-entry form entries, and the browser-driving mechanics for authoring one through the wizard UI"
---

# Relate consolidated entry reports

A **consolidated entry listing** shows one row per multi-entry form *entry*, pulled across every
record in scope — e.g. "every failed item, across all records, in one exportable table." The
obvious artifacts for this both fail in ways that look like bugs rather than a wrong choice. Everything
below comes from one live build-out (2026-09) and has not been re-run since.

## Artifact choice

- A **Multi-Entry Form Report (MEFR)** has no standalone run surface. Opening it directly (its id
  on `queryview.jsp`) returns a platform error — it only renders embedded on a record, or as a
  form's default report. Building one expecting "a report" is a dead end.
- A **record-level Relate query** lists one row per record, with drill-down into the entries — not
  a consolidated, one-row-per-entry listing.
- The artifact that actually consolidates is a **Relate Report** (class `1000018`, `reportview.jsp`,
  Add → New Report). Point its display columns at fields on a multi-entry form and each row is one
  entry, consolidated across every record in scope, with Export/Print/PDF built in. A record-level
  search criterion on the multi-entry form (e.g. "Status Is Any Of Failed") prunes which *records*
  are included; rows still render one per entry.

## Building it — the 5-step wizard

1. **Name & Record Types** — `privateView` radio, plus record-type checkboxes.
2. **Record Categories & Units** — unit scoping: displayed unit / a specific unit / the user's unit,
   with an include-subunits option.
3. **Search Criteria** — the record-level filter described above.
4. **Display Columns** — picked per field. The `[Merge Reports]` form option here lists merge
   reports, not MEFRs — don't look for the multi-entry form's MEFR in that list.
5. **Destination + Group By/Totals**.

## Browser-driving mechanics

Useful when an agent is driving the platform UI directly (no MCP authoring path covers this
wizard):

- The "Set Value" popup for an option-list search criterion stores the **option item's topId**, not
  its export value or label.
- That popup opens via `doPopup`/`window.open`, which embedded agent browsers commonly block. The
  workaround that worked in that build-out: call `updateValueShow('searchValue[N]', '<optionItemTopId>', '<display
  label>')` directly on the wizard page. It sets the hidden input and updates the UI exactly like
  the popup would.
- `add3()` — the "add another column/criteria row" control — is a server-side form submit, not a
  DOM operation. It navigates the page and kills any in-flight page script; don't call it and then
  expect earlier script state to still be there.

## Why this is UI work, not an MCP call

An MCP-created option-list search criterion is a known gap: it's accepted and read back
successfully, but execution then fails with an opaque error, and there is no repair path once
created. A consolidated, option-list-filtered entry report is UI work end to end today — this
wizard map is what makes that UI work executable, by a human or by an agent driving the browser.

## Not to be confused with

- [multi entry in multi entry](multi-entry-in-multi-entry.md) — a different problem: letting one
  form *entry* hold many sub-notes, stored as JSON in a single memo field. That's about data shape
  inside one entry; this file is about listing entries across records.
- Iterating multi-entry form entries in code — see the MEF section of
  [api-patterns](api-patterns.md). That's a code-side read of entries for a formula/endpoint, not a
  human-facing exportable report.
- Reading multi-entry entries through an MCP-created `List` view and `relateQuery` — see
  [relate-query-over-mefr](../gotchas/relate-query-over-mefr.md). That's a paged, programmatic
  read path for code; it does not produce a Report artifact with Export/Print/PDF.
