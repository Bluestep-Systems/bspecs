# Gotchas — forms, fields, options, time

Prefix `G`.

---

### G-237 — A screen's windowed read misses entries made outside the window, so read an entry's kind from the entry itself, not from a match to the window

What looks right: tell an entry's kind (two kinds a form keeps apart, say) by matching it to the rows of the screen's windowed read (a date window), which carry the mark. What happens: an entry made outside the window is in the parent's history but not in the windowed read, so a rule built on the match misses it. This bites whenever entries of one kind are made ahead and used later. Read the mark on the entry itself instead: the field on each entry that holds its kind (a select whose export value names it).
**How to tell.** 1. On a test org, make an entry dated before the screen's window and use it now. 2. Read the screen's windowed read: the entry is not there, only in the parent's history. 3. Read the kind field on the history entry: it names the kind.
**Applies to:** any BlueStep One component

### G-254 — A one-to-one relationship is one link read from both sides, so connecting an entry to a second partner silently takes it from the first

What looks right: a picker that connects an existing entry (*Connect to Existing …*) adds a link from the new entry to it, and the entry that already held the link keeps its own. What happens: the two relationship fields, one on each form, are the two ends of one single link, so the new link replaces the old. The picker offered the entry though another entry already held it, and gave no warning. After *Save*, the partner pointed at the new entry and the old holder's relationship field was empty. Child entries made from the old holder then lost what the link drew on their page, while values they had already copied stayed. Read over `remoteObjects`, each side's `value` names the other (`[{id: <n>___<n>}]`), and the old holder's side is `[]`. A side's `valueAsString` is the other entry's display text (a type field's text on one side, a name on the other); read the ids from `value`. How to tell: read the relationship field on every entry of the holding form for the record; at most one shows a given partner. What to do: in BlueStep One, mark in the picker which entry already belongs to another, and say before saving that connecting it moves it (or refuse). A screen built on the link must not assume its entry still has the partner it had when a child entry was made.
**To see it again.** On a test org with a one-to-one relationship pair: connect a partner that entry A already holds to a new entry B, and save. Over `/gql` from a signed-in tab (bluestep-tools' `reference/gql-in-a-tab.md`), read `formRows(id: "<form id>", recordId: "<record id>")` with the relationship `<field id>`, and the partner's own relationship field: A's side is `[]`, B and the partner name each other. `history(id: "<A's entry id>")` shows the version where A lost the link.
**Applies to:** any BlueStep One component

### G-259 — An option list's colors live in each option's `cssStyle`, which a component reading only `displayName` and `value` drops

What looks right: an option is its label and its export value, so `listOptions { items { ... on RelateListItem { topId displayName value optionStatus } } }` reads all of it. What happens: Manage paints options from each item's `cssStyle` (and `cssClass`), set on the option list. A list can give each group of options its own color, and users then read the group by its color, so a BlueStep One picker that drops it loses information they use. A bright color can fail contrast as text on white (4.5 : 1 is the bar for text), so carry the color as a mark beside the label, not as the text color. What to do: read `cssStyle` (and `cssClass`) with every option list a component draws, and check which lists set one.
**How to tell.** On a test org, over `/gql` from a signed-in tab (bluestep-tools' `reference/gql-in-a-tab.md`): `{ remoteObjects(ids: ["<field id>"]) { ... on RelateFieldWrapper { listOptions { items { ... on RelateListItem { displayName value cssClass cssStyle } } } } } }` on a select whose list sets styles. In Manage, open an entry with that select: the options are drawn in those colors.
**Applies to:** any BlueStep One component

### G-264 — A popover of checkboxes in equal columns of a fixed width breaks its labels inside the word, and a scrollbar makes it worse

What looks right: a popover of a set width (30 rem) holding a checkbox group in four `minmax(0, 1fr)` columns; the unit tests pass, since a `.tsx` layout has none (G-154). What happens: each column gets about 100 px, and the kit-style checkbox label wraps anywhere (`overflow-wrap: anywhere`, so a long label never overflows), so a one-word label breaks inside the word. Where the window has less room the popover's height is capped, a vertical scrollbar takes about 15 px from the width, and even short labels break. What to do: size the columns from the labels and the popover from the columns: `repeat(n, minmax(max-content, 1fr))` (equal columns, each as wide as the widest label on one line), the popover `width: max-content` with `max-width: calc(100vw - 2rem)` and `scrollbar-gutter: stable`. Then look at it live with the longest label and with the window short enough to scroll.
**How to tell.** On a test org, put a checkbox group of many short labels in four `minmax(0, 1fr)` columns inside a `min(30rem, …)` popover, and open it in a window short enough to scroll: labels break inside the word. With the CSS above, every label stays on one line.
**Applies to:** any BlueStep One component
