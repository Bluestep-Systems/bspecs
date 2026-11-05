# Gotchas — reports, pages, search, nav

Prefix `G`.

---

### G-121 — A component that declares only form slots cannot be placed on a page

What looks right: a component that already renders on a form (`slots: ["form-entry", "form-list"]`) can also be dropped on a composite page, where its page mode shows. What happens: every composed page (the Dashboard and composite pages) offers the one region `"dashboard"`, and the library picker shows a component there only when its `slots` are undeclared, empty or include `"dashboard"`; a component that names only form slots is left out of the picker by default. The library also has an "include other regions" toggle that lists such a component on an off-region card, but the default picker still hides it, and whether a component toggled in that way can then be placed has not been seen. How to tell: in Build, add a tile to a composite page and look for the component. What to do: add `"dashboard"` to `component.json`'s `slots` and render the page mode when the context is a page (no `region`).
**Applies to:** any BlueStep One component

### G-122 — A page context names the page, never a form, and `listAcrossUnit`'s filter operations are described only in prose

What looks right: a component placed on a page gets the form it works on from its context, as it does on a form, and filters entries with the operators of the GraphQL filter. What happens: a page context (`ApiPageContext`) carries `path`, `pageId`, `navPageId`, `nav` and `trail`, no form id; and `ApiEntryFilter.operation` is typed `string` with no list of accepted values. Its comment describes them in prose: the operator the field advertises (`>=`, `CONTAINS`, `!CONTAINS`, `SOUNDX`), and no value with `=` means is-empty. How to tell: read the two types in the downloaded `component-host.d.ts`. What to do: find the form by its alias in `forms.listAll()`, and check the filter on live data before relying on it. For a *Signature* field's emptiness the server filter takes the `d`-prefixed operators (G-171); otherwise a component can send `"=" on a yes/no field and re-check in the browser each row it gets back, but rows the server leaves out cannot be re-checked.
**Applies to:** any BlueStep One component

### G-246 — A draft kept by row id outlives the row it was made for: once the page sends drafts of rows that changed hands, a re-read's fresh `rowVersion` hides the overwrite

What looks right: every write carries `expectedVersion`, so a draft made before someone else signed the row fails with a conflict instead of writing over theirs (P-38). What happens: the page keeps drafts in a map by row id across re-reads (after each save run), and builds each write from the row *as read now*, so the version sent is the fresh one. As long as the save only walked unsigned rows, a row signed meanwhile simply left the walk and its draft was never sent. Once the save also sends something on signed rows (a field that stays open after signing), the old draft of a row someone else signed meanwhile came with it: its text fields, its numbers and even its signature (the initial draft's `signed` is false, so a ticked draft reads as a change) would have been written over the other person's work, with the right version and no card showing the draft. How to tell: list what the save walks against where the draft map is pruned; any section that holds rows another user can change between two reads is exposed. What to do: send from a signed row only the fields that row still takes, and drop drafts that no longer apply on every re-read and at the start of every save (a signed row keeps only a draft of its still-open fields; a row the page no longer draws loses its draft, so the footer never counts what nobody can see). See also G-240.
**To see it again.** Write unit tests for the draft logic: a draft entered on a row that was signed meanwhile is dropped (its text fields, its numbers, its signature), and a signed row sends nothing but its still-open fields. Take out the branch that checks whether the row is signed: the tests fail.
**Applies to:** any BlueStep One component

### G-247 — A list that ignores the page's filter must open a page that ignores it too

What looks right: a cross-cutting list (items due, say) lists every open item of the unit whatever the page's view filter (a pick, a search) says, so an item is never hidden from whoever has to do it, and a row opens the record's page the way a card does. What happens: the record's page still passed its day through the viewer's filter, so with a filter on, a row of the list opened a page with no row for that item and no line saying why; the test written with it asserted exactly that. How to tell: for every list built across a filter, follow its rows to the page they open and check that page's own filters. What to do: carry what the list promised into the page it opens (the page keeps an open item whatever the filter hides), and test the open path, not only the list.
**To see it again.** Write a unit test that sets a view filter that hides an item, opens that item from the cross-cutting list, and checks that the opened page shows it.
**Applies to:** any BlueStep One component

### G-253 — A hand-made nav bar finds its pages by the page's nav `_id`, so a page replaced or rebuilt under another `_id` leaves a dead tile on the bar, with no error

What looks right: a hand-made bar shows a tile for a page because the page sits under its section. What the code does: such a bar (a RelateScript merge report) hard-codes each tile and finds its page with `siteNav.lookup("_id", "<nav id>")`; the label and URL come from the page found. A BlueStep One page put in place of a Manage page without that nav `_id` is not reached from the bar, which keeps the tile with no label and no link (an icon with an empty link). So the bar does not drop a tile whose page is missing; it leaves a dead one, with no error. The bar may have no `usedBy`, so the graph does not show where it is drawn (often a dashboard's alternate merge report). A link script beside it can have a branch that looks for a page by a `_pageName` no page has, so that link goes nowhere. A new tile added to a bar reaches a template-fed org only when the bar is copied too. What to do: when a BlueStep One page replaces a page such a bar reaches, give it the nav `_id` the bar looks up, or change the bar, which is structure and goes through whoever owns the org's structure; and do not link to a dead branch.
**To see it again.** On a test org, over `/gql` from a signed-in tab, read the bar's code (`remoteObjects(ids: ["<merge report id>"]) { ... on RelateMergeReport { modifyDateMillis formula } }`, search `siteNav.lookup`) and the `altIds` of the page it should reach; `children(parentId: "<section id>")` lists a section's pages. Then, as Super, open the dashboard that draws the bar in a site copy that has the page and in one that does not, and compare the tile.
**Applies to:** any BlueStep One component

### G-260 — "By number when both are digits, else as text" is no order: a code column that mixes the two sorts in a circle

What looks right: a column that holds mostly numbers and some text, such as a reference-number column, sorts with "compare as numbers when both are digits, else as text", so 9 comes before 10. What happens: that rule is not transitive. "2" < "10" as numbers, "10" < "1a" as text, "1a" < "2" as text, so the three go round in a circle, and `Array.prototype.sort` gives an order that depends on where the rows started. What to do: say where text goes against a number, as a rule of its own: for example, every all-digit value goes before any text, numbers by value (without leading zeros, by length then digits, so long numbers lose nothing) and text by the list's collator.
**To see it again.** Sort `["2", "10", "1a"]` and `["1a", "10", "2"]` with the two-case rule: the outputs differ (`[2, 10, 1a]` and `[10, 1a, 2]`).
**Applies to:** any BlueStep One component

### G-290 — A list built from the day's entries can offer records that a Manage page leaves out; Manage's list pages loop over a query

What looks right: a BlueStep One list that groups the day's entries by record lists the records the
Manage page it replaces lists. What happens: a Manage list page usually loops over an import that
is a query (a record type, categories a record must have, categories it must not have), and the
query decides which records show. A list read from `formEntries` across the unit has no such check:
any record that has an entry that day shows, including records the query leaves out (an inactive
category, say). Formulas can keep making entries for such records, so this is likely, not rare.
Two pages can also import queries under the same name that differ (one answers only the unit's
own records, the other the unit and the units under it); only the query's `uses` tells them apart.
A spec that says "the same records as screen X" delivers this only if screen X filters too.

What works: run the query the Manage page loops over, for the unit, over `/gql`
(`relateQuery(id: "<query alias>", unit, start, count) { totalSize rows { record { id } } }`, the
same scope as `formEntries` with that unit), and keep only those records' entries. `Record.categories`
also reads (`{ id displayName }`), but category ids differ by org; the query's alias does not.

**How to tell.** On a test org, from a signed-in tab, read the query's rules with
`remoteObjects(ids: ["<query id>"]) { ... on RelateQuery { uses { description uses { topId displayName } } } }`,
then the day's entries (`formEntries` on the form, its date field `=` today, `unitId` the unit) and
the `categories` of each `record.id`: any record outside the query's rules is one the list should
not offer.

**Applies to:** any BlueStep One component

### G-294 — A page that reloads its day on a unit change or a new local date unmounts the screen holding unsaved drafts, with no question

What looks right: the leave dialog and the `beforeunload` guard cover every way out of a screen with unsaved rows. What happens: *Back*, *Cancel*, a link and a reload ask; but a unit change from the host (`host.session.onUnitChange`) or the local date passing (checked on the minute or on tab focus) calls the load's `retry()`, the state goes to loading, the screen unmounts and its drafts go without a word. This is read from code; it has not been seen on screen. How to tell: edit a row without saving, switch unit in the host (or wait past the org's local midnight), and the typed values are gone. What to do: keep the screen mounted while it holds drafts (reload under it), or ask first; until then, the component's README names the gap (beside the host menu's own).
**To see it again.** The steps under *How to tell*, as an admin on a test org.
**Applies to:** any BlueStep One component

### G-326 — `moveChildren` with `afterId` puts the item before it, and never moves an item to another container

Looks right: `moveChildren(containerId, itemIds, afterId)` reads as "put these after that one", and as a way to move items into a container. Actually: the two anchors are named the other way round. The SDL says `beforeId` is "the item the moved items should land after" and `afterId` "the item the moved items should land before", and a lone anchor can tie with a neighbour and break arbitrarily. Seen on a site's top menu: a lone `afterId: <item>` sent the item to the very start, a lone `beforeId: <item>` to the very end, and `afterId` on another item to the start again. On a sub-menu, placing each item "after" the previous one in turn gave the exact reverse order. Naming an item of another container did nothing (the result listed the container unchanged). What works: pass **no anchor**, with `itemIds` = the container's complete membership in the wanted order (a full reorder; every id must be a current child, a partial list interleaves). To move an object, update it with `parents: [{topId: <new container>}]` (`updateSection`, `updateSubMenuModule`, …): the parent is replaced, `parentsSize` stays 1, and it lands last. How to tell: `children(parentId)` after each call.
**Applies to:** any BlueStep One component
