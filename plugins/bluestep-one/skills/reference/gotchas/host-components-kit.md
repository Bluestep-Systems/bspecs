# Gotchas — host, components, kit

Prefix `G`.

---

### G-91 — A host save that resolves may have saved only part of the values: nulls are dropped in silence, and links are never written

What looks right: `host.formEntries.save(entryId, values)` resolved, so every value is saved.
What happens, per the host's code:

- **A value set to `null` is dropped** before the write, since `updateFormRow` cannot set a field
  to null. The save resolves and the field keeps its old value.
- **A relationship value is skipped**: a link never goes out through the host's save. The built-in
  entry screen saves through the same path, so on a form turned on for BlueStep One the built-in
  screen cannot set a link either.
- **A refused field rejects the whole save** with the server's words, and nothing is saved. An
  unknown field is `PRECONDITION` "Unknown or non-editable field."; a field without Edit Value
  rights is `FORBIDDEN` "<Label>: you do not have Edit Value privileges.". The error is
  `host.isRefused(e)` with `e.code`. Older hosts stripped the refused field, saved the rest and
  resolved as if all was saved; when every field was stripped they returned the known state.
  Classify a refusal by its code. A text fallback written for the older words ("You do not have
  [..] privileges") does not match the current ones, so a copy that keeps one should match both.
- **Without `expectedVersion` the save is last-writer-wins**, and an awaited write never times out:
  it waits while the host holds it offline.
- **A create** through the host was an empty `createFormRow` followed by that save, so the form's
  after-save formulas could first run on an empty row (suspected, from the code). The built-in
  entry screen now sends one `createFormRow` with the typed values; whether the host API's own
  create changed too was not checked.

`/gql` itself writes links: put the target entry's id as a plain string in `fieldValues`, inside
`createFormRow` or `updateFormRow`, and the form's formulas then copy the names into the text
fields. A link written over `/gql` must name an entry the field offers, on every write path.

**How to tell.** On a test org, through the host: 1. As a user who may only read a field, save a
new value into it: per the host's code, the save rejects with `FORBIDDEN` and the server's words
(not run live). 2. Save `null` into a
field that holds a value, then read the entry with `{ fresh: true }`: the old value is still there.
3. Save a relationship value the same way: the link is unchanged.

What to do: re-read after a save and compare the fields sent; clear a value with the field's empty
value, not `null`; let a formula or a `/gql` call write links; always pass `expectedVersion`.

**Applies to:** any BlueStep One component

### G-150 — The kit's radio group selects whatever an arrow key lands on, so a type picker with side effects runs them for every option passed

What looks right: swapping a select for the kit's radio group (`B6pRadioGroup`), same
`onValueChange`. What happens: Radix `RadioGroup` moves the selection with the arrow keys and fires
`onValueChange` on each item reached. An option with side effects runs them whenever the keyboard
passes over it on the way to another option. Take a picker whose second option clears other
values the user set: going from the first option to the third by keyboard clears them on the way. A select changes only on the pick. Driven by a browser automation tool, an arrow sometimes
moves the focus without picking, so a scripted check can miss it.

**How to tell.** On a test component, put the option with side effects in the middle of a radio
group, focus the option before it and press the arrow key twice: the side effect has run.

What to do: keep an option with side effects at an end of the group, or make its change undoable
until the user confirms: a move onto the option keeps what it changed, and the move off puts it
back.

**Applies to:** any BlueStep One component

### G-153 — The kit's popover is non-modal by default, so Tab past the last box inside drops the focus at the end of the page

What looks right: `B6pPopover` around a list of checkboxes as an inline picker (the kit also has a
multi-select field, G-159). What happens: a non-modal Radix popover closes when focus leaves it and
does not hand the focus back to its trigger. A keyboard user who Tabs past the last box lands at
the end of the document, and the next field is no longer the next stop.

**How to tell.** Open the picker with the keyboard, Tab past the last box, and see where the focus
is.

What to do: pass `modal` (it is in `PopoverProps`, `types/ui.d.ts`). Tab then cycles inside, and
Escape or closing returns the focus to the trigger.

**Applies to:** any BlueStep One component

### G-156 — The kit's buttons force every icon inside them to 16 px, so a size class on the icon loses

What looks right: `<Loader2 className="h-3.5 w-3.5" />` inside a `B6pButton` (or an `asChild` link
drawn as one). What happens: the button's classes carry `[&_svg]:size-4`, a descendant selector
that beats the icon's own size classes, so the icon draws at 16 px. The host's own "Restoring…"
loader is 16 px for this reason. A canvas drawn with the kit has the same rule, so a 14 px icon
written inside a kit button in the canvas source reads 16 px in the export too: a design check
reads it against 16.

What to do: set the size inline, `width` and `height` in `style`.

**How to tell.** 1. On a test org, place a component that puts a `Loader2` with `h-3.5 w-3.5`
inside a `B6pButton`, and read the icon's computed width: 16 px. 2. Search the host's served
`/one/assets/primitives-*.js` for `[&_svg]:size-4`. 3. An inline `width` and `height` on the icon
win.

**Applies to:** any BlueStep One component

### G-157 — The host's stylesheet has no `motion-reduce:` variant, so a component's reduced-motion classes do nothing

What looks right: `className="animate-spin motion-reduce:animate-none"`. What happens: the host's
Tailwind build (v4.3.3) ships only the classes its own code uses, as with the palette variables. It
has `animate-spin` and `sr-only` but no `motion-reduce:` variant, so the reduced-motion class does
nothing. Its only motion rule is the host's own mark, one
`@media (prefers-reduced-motion:no-preference){.motion-safe\:animate-[bs-mark-bloom_2.4s_ease-in-out_infinite]...}`.

The kit's own parts animate too, with classes a caller cannot switch off by class.
`PopoverContent` carries `data-[state=open]:animate-in … zoom-in-95` and the matching
`animate-out` classes, and `B6pSkeleton` carries `animate-pulse`.

What to do: read `matchMedia("(prefers-reduced-motion: reduce)")` once in the component and leave
the animation class off. For a kit part, pass `style={{ animation: still ? "none" : undefined }}`;
an inline `animation` beats the classes.

**How to tell.** 1. On a test org, fetch the host stylesheet `/one/assets/index-*.css` and search
it for `motion-reduce`, `motion-safe` and `prefers-reduced-motion`: `motion-reduce` is not there,
`animate-spin` is, and the other two appear only in the host's mark rule. 2. Turn on reduced motion
in the OS and open a kit popover: it is expected to still zoom in (not tried).

**Applies to:** any BlueStep One component

### G-159 — A field type missing from `@bluestep/ui` may be in `@bluestep/form-kit`, which the host serves to components too

What looks right: read `@bluestep/ui`'s export list, find no multi-select, build one from
`B6pPopover` and checkboxes, and ask for the kit to export it. What happens: the host shares a
second package, `@bluestep/form-kit`, whose exports include `MultiSelectField`, `SelectField`,
`LookupBox`, `FieldWrapper` and `FormRenderer` (`types/form-kit.d.ts`). Its fields take the form's
own field definition (`MultiSelectField({ field, value, onChange, error })`, `field` an `ApiField`
of type `multi-select`, from `host.forms.get`), so they draw like the built-in forms.

Finding the kit's field is not the same as being able to use it. `MultiSelectField` draws by the
field's legacy *Display as* (`format`): `checkboxes` (legacy's default for this kind) lays every
option out inline, `listbox` draws a sized list box, `lookup` a type-to-find box. Only a field with
no format gets the chip popover. And every kit field comes inside `FieldWrapper`, with its own
label, required mark and help, in a cell three grid rows tall. So a checkbox multi-select
(`RelateMultiSelectCheckBoxesField`, which the host maps to `multi-select` with format
`checkboxes`) draws every option inline, not a closed select, and a screen that draws its own
labels shows two.

What to do: before hand-building a field or deciding "the kit has no …", grep both
`types/ui*.d.ts` and `types/form-kit.d.ts`. Before swapping to a kit field, read the field's
`format` and check whether the screen draws its own labels.

**How to tell.** 1. On a test org, in a signed-in tab, read `window.__FEDERATION__.__SHARE__`:
`@bluestep/form-kit` is shared beside `@bluestep/ui`. 2. Grep `types/form-kit.d.ts` for
`MultiSelectField`. 3. Read the field's `format` from `host.forms.get`: `checkboxes` means the kit
draws it inline.

**Applies to:** any BlueStep One component

### G-188 — A composed page is already wrapped in `PageContent`: a page component that draws its own doubles the padding

What looks right: the canvas draws each screen as `B.PageContent` holding `B.PageContentTitle` and
the body, so the component returns the same. What happens: the host's composed page returns
`<PageContent><RouteBreadcrumb /><div className="space-y-6">…the page's title row and its placements…</div></PageContent>`.
A tile placed on a page already sits in the 7xl column with 24 × 32 px inside, 24 px between
children and the breadcrumb above. A `PageContent` of the component's own adds a second padding and
a second centred column inside the first.

**How to tell.** On the live page, measure the tile's left edge against the breadcrumb's: they line
up when the component draws no `PageContent`.

What to do: draw only `PageContentTitle` and the body, in a column with gap 24 (as `PageContent`
spaces its children). In a design check, the canvas's `PageContent` row is then a **Keep**: the
host draws it.

**Applies to:** any BlueStep One component

### G-207 — The host's `ApiFormDef.recordType` is the form's first attached type, which may hold none of the form's records

What looks right: `records.list(form.recordType)` with `form` from `forms.listAll()`, to find the
record a form's entries are on; the declaration says "The record type this form is attached to".
What happens: the host fills it with the form's first attached type, and `ApiFormDef` has a single
`recordType` and no list. Take a form attached to two record types, the first with a few records
and the second with most of them: the list reads the first type, and a link to an entry on a
record of the second says it "could not be opened".

**How to tell.** On a test org, take a form attached to more than one record type.
`/gql` `relateForms(count: 2000) { items { id recordTypes { id } } }` gives the form's whole list,
and `listRecordsOfType(recordTypeId:, start: 0, count: 500)` on each says where a record is.
Compare with `forms.listAll()`'s `recordType`: only the first.

What to do: take the form's record type ids from `/gql` (`recordTypes { id }`), match each against
`records.listTypes()` by `toString()` (a host key's string is the `/gql` id), and look the record up
in every one. The whole list on `ApiFormDef` has been asked for.

**Applies to:** any BlueStep One component

### G-244 — A host entry search on the session's unit with `includeSubUnits: false` misses the entries of records in the units under it

What looks right: a page finds an entry's host key with
`formEntries.listAcrossUnit(form, { unit: { unitId: <session's unit>, includeSubUnits: false } })`,
since a unit's entries are on its own unit. What happens: a page on a unit above several units
lists the entries of records that live in the units under it, and the search reads only entries
on records of the top unit itself. The entry is not among the rows, so the screen says it could not
be opened, with no read failing. With `includeSubUnits: true` the same read answers several times
as many rows, the entry among them.

**How to tell.** On a test org with a top unit over sub-units, as a user on the top unit, read over
`/gql`:
`formEntries(formId: "<form id>", unitId: "<top unit id>", includeSubUnits: false, start: 0, count: 50) { totalSize rows { formEntry { id } } }`,
then the same with `true`. An entry on a record of a sub-unit is only in the second answer.

What to do: search with `includeSubUnits: true`. The list stays newest first, so a recent entry is
still near the top. See also G-230.

**Applies to:** any BlueStep One component

### G-245 — A copy of the read deadline covers only the reads its source makes: the copy's own host reads and its own `fetch` calls still hang

What looks right: copy the read-deadline helpers (P-54: `withDeadline`, the host wrapper `readDeadlineHost`, the `/gql` helper's deadline) whole from another component, wire the wrapper in the copy's factory, and every read of the copy has its 20 s deadline (G-235). What happens: the fix reaches only what the source itself reads. The host wrapper races just the host methods on its list of reads (the source's own: `records.get`, `forms.listAll`, …) and passes every other member through untouched, and the `/gql` helper covers only requests sent through it. If the copy also reads `records.listTypes` and `records.list`, or sends its own `fetch("/gql", { method: "HEAD" })` for the server's clock, those still hang after a plain copy. A cached answer that hung holds every later click that waits on it.

**How to tell.** In the copy, list the host reads it calls
(`grep -rnoE "host\.(session|records|forms|formEntries|sites|components)\.[a-zA-Z]+\(" src`)
against the wrapper's list, and list every `fetch(` outside the `/gql` helper. To see the hang
live: wrap `window.fetch` so it never answers one of the screen's POSTs, remount the screen by hash
navigation, and watch the reads abort at about 20 s and the screen show its load-failed notice;
remove the wrapper and *Try again* draws the screen.

What to do: add the copy's own reads to the wrapper's list (typed against the host's declarations,
so a wrong name fails the type check) and note it as the copy's one change in its header and the
README's *Copied* table. Wrap a direct `fetch` in
`withDeadline(fetch(url, { signal: own.signal }), <deadline ms>, callerSignal, () => own.abort())`.
Also: a test that asserts a read's `fetch` got the caller's own `AbortSignal` fails after the
change, since a read now gets a signal of its own that the caller's abort fires; rewrite it to
check that.

**Applies to:** any BlueStep One component

### G-318 — A dialog that swaps its fields for a notice after an async read leaves focus on the dialog box, not on a control

What looks right: the kit's dialog (Radix) puts focus on its first control when it opens, so a
dialog is keyboard-ready. What happens: the dialog opens while its read is still loading and
focuses the first field it has. When the read comes back refused and the fields are replaced by a
notice, the focused control is unmounted and Radix's focus scope moves focus to the content box
itself. A keyboard or screen-reader user is left on no control, and *Cancel*, the one thing left to
do, is not reached first. The same happens when a footer swaps its buttons with no read at all:
while it works every button is held, and the focused button goes.

**How to tell.** On a test org, as a user refused the dialog's read, open the dialog and check
`document.activeElement` after the notice shows: without a focus move it is expected on the
dialog's content box.

What to do: when a dialog's controls go away, move focus yourself to the action that is still
there (a ref on *Cancel* and an effect on the state, or the first action still offered). With that
move, focus lands on *Cancel*.

**Applies to:** any BlueStep One component

### G-319 — `formEntries.openNewEntry` returns nothing: the component cannot tell the entry opened, and may be gone the moment it returns

What looks right: asking the host to open a form's new entry answers whether it opened, so the
caller can say so or fall back. What happens: `openNewEntry(formDefId, recordId): void` answers
nothing and carries nothing to the entry it opens. The host navigates, and the calling component
may be unmounted before its next line runs.

**How to tell.** Read the declaration (`types/component-host.d.ts`, `openNewEntry`), then in a
component call it and log after it: the log may run or not, and no value says the entry opened.

What to do: put everything the next screen needs where it can find it before the call
(`sessionStorage`, keyed by something both screens know before the entry exists, such as the
record id and the form; the new entry has no key yet); make the call the last thing the handler does; check
what can be checked first (the form is in `forms.listAll()`); and say "asked" rather than "opened".

**Applies to:** any BlueStep One component

### G-320 — A kit dialog opened without a `DialogTrigger` drops focus to the page when it closes

What looks right: the kit's dialog (Radix) gives focus back to whatever opened it, so a confirm
opened from a button returns to that button. What happens: Radix returns focus only to its own
`DialogTrigger`. A dialog driven by `open` state from a plain button has none; its
`onCloseAutoFocus` prevents the default and focuses a null trigger, so focus lands on `body` after
Escape, the cancel button or the action.

**How to tell.** On a test component, open a `B6pDialog` from `open` state with a plain button,
press Escape, and read `document.activeElement`: `BODY`. With the fix below, it is the button.

What to do: give `B6pDialogContent` an `onCloseAutoFocus` that calls `preventDefault()` and moves
focus itself (to the opener, or to what the action opened). It runs after the dialog is gone and
the page is no longer hidden, so the move holds.

**Applies to:** any BlueStep One component

### G-322 — `records.navConfig` and `records.navContainers` answer empty without a record id

What looks right: the host's docs say to pass a `recordId` "when the structure varies by record",
so a call with the type alone should give the type's navigation. What actually happens: for a type
whose navigation is built per record, both answer nothing (`navConfig`: `items: []`, `groups: []`;
`navContainers`: no containers), with no error. With any record of the type they give the full
tree. A component that reads "the module is missing" from the empty answer offers its set-up on a
false reading, and one that looks for a folder finds none and hides it.

**How to tell.** 1. On a test org, from a placed component's host, call `records.listTypes()` and
take a type whose navigation is built per record. 2. Call `navConfig(type.id)` and
`navContainers(type.id)`: empty. 3. Take a record from `records.list(type.id, { count: 1 })` and
pass its id as the second argument: the groups and the containers come.

**Applies to:** any BlueStep One component

### G-323 — `components.list()`'s `name` is the display name, not `component.json`'s name

What looks right: find your own component in `components.list()` by the `name` your
`component.json` declares (`my-widget`). What actually happens: `name` is the library's display
name (`My Widget`), so the match finds nothing. The federation name is on `remote.name`
(`my-widget`), which built-ins do not have. Match on `remote.name`.

**How to tell.** On a test org, call `host.components.list()` and find your component: `name` is
the display name, `source` is "tenant-local", and `remote` is
`{ name: "my-widget", entry: "/component/my-widget/<sha>/remoteEntry.js" }`.

**Applies to:** any BlueStep One component

### G-332 — the host's `formEntries.delete` deletes the entry but runs none of the form's delete formulas, so its children stay

What looks right: a component that deletes an entry with the host's `formEntries.delete(entryId)`
gets what Manage's delete does, the form's delete formulas included (say a formula that deletes the
entry's child entries). What happens: the entry is deleted with no formula run
(`deletedChildren` shows it with `viaFormulas: []`), and its child entries stay, orphaned, long
after. `/gql`'s `deleteFormRow(id)` on the same kind of entry runs the formula inside the call
(`viaFormulas` lists it), and the children go with it; with a few dozen children the call can take
close to 20 s. A sign over `setFieldData` runs no formula either.

**How to tell.** On a test record, make an entry whose form has a delete formula that removes its
children. Delete it with `host.formEntries.delete` from a component, then read the children with
`formRows` (still there) and the entry with `deletedChildren(parentId: <record>, formId: <form>)`
(`viaFormulas` empty). Make another and delete it with `deleteFormRow`: the children are gone, and
`deletedChildren` lists them with the formula.

What to do: delete with `deleteFormRow` wherever the form has delete formulas.

**Applies to:** any BlueStep One component

### G-333 — another form's fields drawn in a block keep their `shownWhen`, and the kit hides them all

What looks right: a component picks a few fields out of another form's definition
(`host.forms.get`) and hands them to `FormRenderer` as a small form of their own, the way a Manage
merge report shows another form's fields on an entry. Unit tests built from the `/gql` field list
pass. What happens: on the source form those fields sit inside grouping sections (say *Detail*
under the boolean *Show details?*), so the host's definition gives each one a `shownWhen` naming
the grouping field. The grouping field is not in the block, its value is never true, and
`FormRenderer` hides every picked field. The block draws its heading over an empty grid, with no
error and nothing in the console.

**How to tell.** Open an entry with the block on a test record and check the block's DOM (the
block's `section` → `.grid` with no children). Then read the picked fields' `formLayout` rows over
`/gql`:
`remoteObjects(ids: [<form id>]) { ... on RelateForm { formLayout { kind depth parentFieldId field { id } } } }`.
A `depth` above 0 under a `GROUPING_FIELD` is the cause.

What to do: drop `shownWhen` and `groupDepth` from the fields you pick, so they draw flat as the
merge report draws them, and test with a field that carries a `shownWhen`.

**Applies to:** any BlueStep One component
