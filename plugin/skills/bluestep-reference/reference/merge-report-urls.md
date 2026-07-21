---
description: BSJS equivalents for relatescript form.System.lookupMergeReport / lookupMergeReportScript and how to get viewUrl/printUrl
---
# BSJS Merge Report URL Lookup

Relatescript provides `form.System.lookupMergeReport("id","x")` and `lookupMergeReportScript("id","x")` returning `{name, label, viewURL, printURL, customProps}`. BSJS splits this across two APIs.

## Direct id lookup (no record applicability filter)

```typescript
// Short id + lang ('js' BSJS, 'rs' relatescript):
B.find.mergeReport("shortId", "js").viewUrl()

// Full id, no lang:
B.find.mergeReport("530024__FID_clientHeader").viewUrl()
```

Returns `MergeReportMetaData` (inherits `viewUrl()`, `editUrl()`, `id()`, `displayName()` from `BaseObject`). No `printUrl()` here.

## Lookup by custom property, scoped to a record's form (true equivalent of `lookupMergeReport`)

```typescript
// BSJS reports (= lookupMergeReportScript):
formEntry.optApplicableBsJsMergeReport("id", "x").get()

// Relatescript reports (= lookupMergeReport):
formEntry.optApplicableMergeReport("id", "x").get()
```

Returns full `MergeReport<T>` with `viewUrl()`, `printUrl()`, `profileUrl()`, `newEntryUrl()`, `copyUrl()`, `editUrl()`, `contentOnlyUrl()`, `profileNewEntryUrl()`, `profileCopyUrl()`, `mergeTagResult()`, `displayName()`, `id()`, `altIds()`, etc.

`contentOnlyUrl()` exists **only** on the full `MergeReport<T>` (reached via `optApplicable*`) — it is **not** on the `MergeReportMetaData` returned by `B.find.mergeReport(id, 'js')`. Use it for the report body without the surrounding page chrome — e.g. the client-side
async-embed recipe in [merge-report-async-loading](merge-report-async-loading.md) and
[b-include element](b-include-element.md).

Also: `applicableBsJsMergeReportResults(...)` returns `{results, message}` for error reporting.

## Primary-form hard rule (`optApplicable*`)

`optApplicableBsJsMergeReport("FID", <id>)` — and the relatescript variant
`optApplicableMergeReport(...)` — returns an **empty Optional** unless the calling
`FormEntry`'s form is the target report's **primary form**. Calling it on the wrong
FormEntry silently yields nothing, not an error.

To embed or look up a **sibling** report whose primary form differs from the current
record's form, import **that** form as a formula dependent and call `optApplicable*`
on **its** FormEntry — never on the current record's FormEntry. Read each report's
primary form from the platform's Usage / Settings report list to know which form to
import.

## Property mapping

| relatescript | BSJS |
|---|---|
| `result.viewURL` | `.viewUrl()` |
| `result.printURL` | `.printUrl()` (only on full `MergeReport`, not metadata) |
| `x.contentOnlyUrl` | `.contentOnlyUrl()` — a **property** in relatescript but a **method** in BSJS; only on full `MergeReport`, not metadata |
| `result.name` | `.displayName()` (or `.id()` for the id) |
| `result.label` | `.displayName()` |
| `result.customProps` | no enumerator — pass as filter args, or walk `.altIds()` |

## Gotchas

- `viewUrl()` is **relative**. For absolute (emails etc.) wrap with `B.toFullyQualifiedUrl(rel)`.
- `B.siteNavigation()` returns `SiteNavItem` (pages) — **does NOT** have `optLookupMergeReport`. The `optLookup*MergeReport` methods are on `RecordNavItem`, obtainable via `record.nav()`, but `record.nav()` is documented as expensive (30+ sec on uncached orgs). Prefer `B.find.mergeReport` or `optApplicableBsJsMergeReport`.
- `B.find.mergeReport(id, 'js')` does NOT filter by record applicability — it's an id lookup. Only `optApplicable*` methods on FormEntry filter by applies-to-this-record.
- Both APIs work in `MergeReportB` and `CommitableB` contexts (read-only).
- **The `BsJs` prefix names the TARGET, not the caller.** Pick `optApplicableMergeReport` if the merge report you're looking up is a relatescript merge report — even when you're calling from a BSJS endpoint. Pick `optApplicableBsJsMergeReport` only if the target itself is a BSJS merge report. Confirmed in practice: looking up a relatescript merge report from a BSJS CommitableB endpoint required `optApplicableMergeReport`, not the BsJs variant.

## Existing examples in pulled code

- `B.find.mergeReport(shortId, 'rs').id()` / `.displayName()` — direct id lookup of a relatescript report.
- `optApplicableMergeReport("id", "<reportId>").get().viewUrl()` — record-scoped applicable lookup.
- `BaseObject.viewUrl()` on a record.

## Declarations source

All in `declarations/B.d.ts`:
- `B.find.mergeReport`: lines 23984-24001
- `MergeReportMetaData`: line 11373
- `MergeReport<T>` (printUrl 8398, profileUrl 8408, newEntryUrl 8413, copyUrl 8423): line 8389
- `BaseObject.viewUrl()`: line 24613
- `FormEntry.optApplicableBsJsMergeReport`: line 7585
- `FormEntry.optApplicableMergeReport`: line 7573
- `RecordNavItem.optLookupBsJsMergeReport`: line 10292
