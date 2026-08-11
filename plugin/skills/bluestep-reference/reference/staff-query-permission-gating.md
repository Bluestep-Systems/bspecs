---
description: "Reusable BlueStep permission-gating concept — match current user to a staff record via a query, read a per-staff SingleSelect permission, emit capability flags to gate a merge-report UI (fail-closed, super-user override); plus the authoring side: a permission/security query carries exactly one display column, the staff Full Name field, set at CREATE and resolved by name"
---

Reusable **permission-gating framework** for merge-report widgets ([merge report memo json](merge-report-memo-json.md) / [multi entry in multi entry](multi-entry-in-multi-entry.md)). A per-staff SingleSelect permission field drives what each user can do.

**Setup:** A query of staff (e.g. `allStaffFormerAndActive`, "All Staff Former and Active, Top Level Down") whose records carry a **SingleSelect permission field** on a Permissions form. For example the field might be `permissions.someCapability` with option labels: **`No Access`**, **`Reader Access`**, **`Author Access`**, **`Editor Access`** (labels matter exactly — match the option *displayName*, not a guessed word).

**Server resolution (fail-closed), order matters:**
1. `!B.optUser.isPresent()` → `none` (hidden).
2. `u.isGlobalSuper()` → full (Editor) — **checked FIRST**, because super users have no BaseRecord and would otherwise fail the staff lookup. ("Super user" = BlueStep global super, not an option value.)
3. Match user→staff: `const id = u.primaryId();` then guard `allStaffFormerAndActive.meetsCriteria(id)` (optById THROWS if criteria fails) → `const f = allStaffFormerAndActive.optById(id); if (f.isPresent()) staff = f.get();`. Not found → `none`.
4. Read label: `staff.forms.permissions.<field>.opt().map(o => o.displayName()).orElse('')`, then `switch`: `Reader Access`→reader, `Author Access`→author, `Editor Access`→editor; **`No Access` / null / anything unmatched → `none`** (fail closed).

Server emits capability flags, not raw data: `{ canView, canAdd, canEditDelete, currentUser }`. Mapping: reader→view only; author→view+add; editor/super→view+add+edit/delete. Even the top-level catch emits a safe no-access payload.

**Client enforcement:**
- **ALWAYS hide the memo field row first**, in every branch — even when the whole table is hidden (the hidden JSON must never be visible).
- `!canView` → render nothing, never touch the memo.
- Gate the New Entry button on `canAdd`; the Actions column + edit/delete on `canEditDelete`.
- Wire `submitForm` hook + `syncToField()` **only when canAdd||canEditDelete** — Readers/No-Access never write to the memo (not even the canonicalization pass).

**API facts used:** `B.optUser` is `Optional<User>` (use `isPresent()`/`get()`, NOT `orElse(null)` — null isn't assignable to `User`). `user.isGlobalSuper()`, `user.primaryId()` (BaseRecord id, falls back to user id), `user.fullName()`. RecordQuery `meetsCriteria(id)` + `optById(id): Optional<Record>`. SingleSelectField `.opt(): Optional<OptionItem>`, `OptionItem.displayName()` = label text. See also [singleselect null copy](singleselect-null-copy.md), [id full vs short](id-full-vs-short.md).

## Authoring side — creating the permission query

**Every permission/security query carries EXACTLY ONE display column: the staff `Full Name` field.**
This is the shape of the pattern, not a stylistic preference — a permission query answers "is this user
in this set?", so one human-readable identifying column *is* the whole display. Verified 8-for-8 in a
behavioral org across the Reader/Author/Editor triads, the Standard Report gates, and the boolean
variant. Give a new permission query that one column and nothing else.

⚠️ **Resolve the field BY NAME (`Full Name`), never by a remembered id.** A topId such as
`1000101__GID_185145` is **per-org** — it is an example, not a constant, and copying one between orgs
points the column at nothing (or at the wrong field). Look the form/field up in the target org with the
read-only discovery tools, then build the column from what came back:

```
displayColumns: [{ formId: "<staff form topId>", fieldId: "<Full Name field topId>", sortOrder: 1 }]
```

**Set it at CREATE.** Column edits on an existing view/query cannot be made through MCP at all — they
die on the AI-tools DELETE guard and can only be fixed by hand in the platform UI. Then **read the
created query back** and assert it is complete: non-empty `displayFields` **and** non-empty
`searchComponents`, plus the expected `recordTypes` and `mustHave`/`mustNotHaveCategories`. An empty
`searchComponents` on a permission query **fails open** — it admits every record passing the category
filter, i.e. everyone. Full rules, quirks and the `DisplayColumnInput` field list:
[../conventions/mcp-platform-authoring.md](../conventions/mcp-platform-authoring.md).

**Caveat (always flag this):** this gates the UI only. The memo is a real field on the form, so a No-Access/Reader user could still see/alter it via the form or devtools unless that field's own BlueStep view/edit permissions are locked. True data security needs form-level field permissions, not just the merge report.
