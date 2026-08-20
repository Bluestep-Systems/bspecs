---
description: "lookupMergeReport / optApplicable* applicability lookups return null/empty for a BSJS MergeReport with NO Primary Form assigned — the applicability tag alone is not sufficient; assign the target form as the report's Primary Form in the platform UI"
---

# BSJS MergeReports need a Primary Form for applicability lookup

## Symptom

`System.lookupMergeReport(key, value)` from a Relate field template — or the BSJS
`optApplicable*` equivalents — returns **null / empty** for a BSJS MergeReport, and the embedding
field renders `[no data]`, **even though the applicability tag (custom property) is correctly set**
on the component.

## Cause

The MergeReport has **no Primary Form assigned**. A missing Primary Form silently blocks the
applicability match — no error, the lookup just finds nothing. The applicability tag alone is
**not** sufficient (verified live 2026-08 during a section-form cutover).

## Fix

Assign the target form as the MergeReport's **Primary Form** in the platform UI (the Merge Report
edit view). Then the tag-based lookup resolves.

## Related

This is the report-side half of the primary-form story. The **caller-side** half — `optApplicable*`
returns empty unless called on a FormEntry of the report's primary form — is the primary-form hard
rule in [merge-report-urls](../reference/merge-report-urls.md). Check both when an applicability
lookup comes back empty: does the report *have* a primary form, and is the calling FormEntry *on*
that form?
