# Gotchas — /gql writes

Prefix `G`.

---

### G-317 — A save built from the fields that show can clear a link the server filled after the last save

What looks right: the save sends what each showing field holds, and "only a change is sent" keeps
the rest. What happens: take a parent form where one choice hides a relationship field, and the
save sends that hidden field empty to let go of any link. A child entry's own create then fills
that link on the server. The next save of the parent, for any small edit, compares "" with the
stored id, sees a change and unlinks the child. If the screen opens a new child whenever the link
is empty, it now opens a second one.

**How to tell.** Read the save's edits for any field sent empty when hidden, and ask whether the
server can fill that field after the save that hid it.

What to do: send the clearing value only when the user made that change in this visit (compare
against the value as read, not against "hidden means empty").

**Applies to:** any BlueStep One component

### G-321 — `updateFormRow` on a stale `expectedVersion` is accepted when it changes no field

What looks right: a write with an `expectedVersion` older than the row is refused, so a refusal
means someone wrote in between. What actually happens: a write whose values equal the row's
answers the row's current `rowVersion`, writes nothing and is not refused, whatever
`expectedVersion` it carries. Only a write that changes a field is refused, with
`CONCURRENT_MODIFICATION` and `extensions.currentVersion` ("This Relate Form Entry is at version 4,
not the expected 3"). A resend under the same `X-Request-Id` gets the first answer again.

**How to tell.** On a test entry, sign the row over `/gql` (version 3 to 4). Send the same
`fieldValues` again with `expectedVersion: 3` and a new request id: the answer is version 4, and
`history` has no new version. Send one changed text field with `expectedVersion: 3`: refused.

What to do: do not read "no refusal" as "the version was current". A save that must not land on a
moved row compares the row it reads back.

**Applies to:** any BlueStep One component

### G-329 — a field the form read names `__GID_` is refused under its `___` spelling in a write

What looks right: a field's id has two spellings that mean the same field (`<n>___<n>` and
`<n>__GID_<n>`, G-316), and most fields are written as `<n>___<n>`, so a write can build every key
that way from the field's number. What happens: when the form's `children` read gives a field as
`<n>__GID_<n>`, a `createFormRow` that sends it as `<n>___<n>` is refused whole: "Unknown or
non-editable field." (`PRECONDITION`, `createFormRow` null). The same write with the `__GID_`
spelling lands. Other keys of the same write that the form read gives as `___` are accepted as
`___`.

**How to tell.** On a test org, read a form's fields:
`remoteObjects(ids: ["<form id>"]) { ... on RelateForm { children { items { ... on RelateFieldWrapper { topId formulaId } } } } }`.
Find a field whose `topId` reads `__GID_`. Send a `createFormRow` on a test record with that field
under the `___` spelling (refused), then under the read's own spelling (lands).

What to do: write every key exactly as the field read gave it (a field map by `formulaId`), never
rebuilt from a number.

**Applies to:** any BlueStep One component

### G-331 — a multi-select's change is missing from the version's `changes` in `history`

What looks right: `history` lists, for each version, the fields that changed and the formulas that
ran in that save (`viaFormulas`), so a screen or a probe can tell what a save wrote from the version's
`changes`. What happens: a save that changed only a multi-select (an array of option ids, moved
from one option to another, read back changed) makes a version whose `changes` is empty, while its
`viaFormulas` are listed. A save of a multi-select and a number lists only the number, and a create
that copies a multi-select forward leaves it out of its changes too.

**How to tell.** On a test entry, change only a multi-select with `updateFormRow`, read the field
back (changed), then read `history(id:, first: 2)` with
`changes { ... on FieldChange { field { topId } } }`: the new version lists no change.

What to do: to prove what a save did to a multi-select, read the field back; do not rely on
`changes`.

**Applies to:** any BlueStep One component
