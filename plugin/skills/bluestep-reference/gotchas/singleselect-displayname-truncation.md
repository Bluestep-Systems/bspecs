---
description: "Platform runtime bug: the BSJS OptionItem string chain (optSelected().get().displayName(), toString(), metaData().options(), optionsByName() keys) can return an option's display name truncated by one trailing character while storage, native form rendering, and MCP reads are all clean; correct known labels by export value"
---

# SingleSelect `displayName()` can drop the last character

On some option lists, every **BSJS** read of an option's display name comes back truncated by
exactly one trailing character — a stored `1. Yes` reads as `1. Ye`:

- `field.optSelected().get().displayName()` → `"1. Ye"`
- `field.optSelected().get().toString()` → `<span …>1. Ye</span>`
- `field.metaData().options().get(i).displayName()` → `"1. Ye"`
- `field.optionsByName()` — the map **key** itself is truncated

Meanwhile the stored data is clean: the MCP `get_option_list` read returns the full name verbatim,
and the platform's native form rendering shows it correctly. Only the BSJS `OptionItem` string
chain is affected — and it can hit one item of a list while a sibling item on the same list reads
fine. (Verified live 2026-08 on two-item Yes/No lists whose items carry `cssStyle` values —
observed shape, not a confirmed cause.)

## Diagnosis

Every BSJS path fails identically, so switching accessors proves nothing — don't burn time on
"bypass" attempts. Instead compare against storage: read the option list via `get_option_list`
(or the platform option-list editor). If storage is clean and every BSJS read is short by one
character, it's this bug — not bad data, and not your code.

## Workaround — key on the export value

Export values are unaffected, so correct known labels by export value after reading:

```typescript
if (exp === "1" && /^1\. Ye$/i.test(label)) label = "1. Yes";
else if (exp === "0" && /^0\. N$/i.test(label)) label = "0. No";
```

This targets two-item Yes/No lists — the only place the bug has been observed. Broader recovery
needs a per-option-list lookup of the stored names; see
[option-list-export-values](../reference/option-list-export-values.md) for reading items with
their export values. The underlying runtime fix is platform work — this page exists so the
symptom isn't misdiagnosed as data corruption or a code defect.
