# Gotchas — /gql reads

Prefix `G`.

---

### G-155 — A fresh CSRF `HEAD` before every `/gql` POST doubles every read's round trips

What looks right: mint a token with a `HEAD` for each call, "cheap and stateless". What happens:
each `HEAD` is a full round trip (about 200 ms), so every step of a load chain costs two. A load of
six steps run one after another pays six extra round trips. The server takes the same token again:
one token serves several POSTs in a row, all 200, and every answer carries a new token. A bad token
gets a 403 with the JSON body `{"error":"Invalid or missing CSRF token"}` and no `errors` array
(a bare 403 with no body before release 26.10.13.01).

What to do: keep the token per page (calls made together share one `HEAD`), replace it with the
one an answer carries, and on a 403 with no `errors` array (the server ran nothing) mint a fresh
one and send once more. A 403 with `errors` (`FORBIDDEN`) is a real refusal and is not retried.

**How to tell.** 1. On a test org, in a signed-in tab, time two `HEAD /gql` calls from the console:
each is a full round trip. 2. POST three reads with the first answer's `B6P-CSRF-TOKEN`: all three
answer 200. 3. POST with a made-up token: a 403 with the body above and no `errors` array.

**Applies to:** any BlueStep One component

### G-171 — A `formEntries` filter on a *Signature* field takes the `d`-prefixed operators; a plain `=` answers a bare INTERNAL

What looks right: read the entries still to sign with a `formEntries` filter "*Signature* is
empty", as Manage's list does, written with `=` and an empty value. What happens: `=` with no
value, `<>` with no value and `NOT_EQUALS ""` each answer a bare INTERNAL, with no message to act
on. A *Signature* field's search operators are the `d`-prefixed ones: `d=`, `d<>`, `d>`, `d>=`. With
an empty value, `d=` means IS NULL (unsigned) and `d<>` means IS NOT NULL (signed). A plain `=`
builds an empty SQL segment on the server, which ends as INTERNAL. `QueryFilterInput.operation` is a
free `String!`, so the `d` operators pass the schema.

So "the unsigned entries" can be a server filter:
`{ fieldId: "<signature field id>", operation: "d=", value: "" }`. Always pass a `unitId` too: a
read of a large form with no `unitId` can time out. A PRECONDITION on `=` that names the right
operators, and their documentation, are still owed.

**How to tell.** On a test org, run `formEntries` on a form with a *Signature* field, with a
`unitId` and the filter `{ fieldId: "<signature field id>", operation: "=", value: "" }`, asking
`totalSize`: a bare INTERNAL. The same with `operation: "d="` gives the unsigned count, and `d<>`
the signed count.

**Applies to:** any BlueStep One component

### G-177 — `formEntries.get` without `{ fresh: true }` answers from what the tab already loaded, and a `/gql` write does not refresh it

What looks right: `host.formEntries.get(entryId, recordId)` reads the entry, so its `modifiedAt`
and `modifiedBy` are the last save's. What happens: the host's declarations say a plain `get` may
be answered from what the tab already loaded. A component that writes through `/gql` goes around
that cache, so a "Last modified" line read through the host keeps the first save's time after a
later save. A fresh read fails rather than answer stale, and fails only after 30 s with no answer,
so a fresh `get` inside a screen's load can hold the load that long.

**How to tell.** On a test entry, read `modifiedAt` with `host.formEntries.get`, save a change over
`/gql`, and read it again without `{ fresh: true }`: it may answer the old time (the declarations allow a
cached answer). With `{ fresh: true }`, or with
`formEntries(…) { modifyDate }` over `/gql`: the new time.

What to do: pass `{ fresh: true }` whenever a component reads something its own `/gql` writes may
have changed, and read it again after each such write. Keep a fresh read off the critical path when
it only decorates the screen (treat a failed read as "no line").

**Applies to:** any BlueStep One component

### G-316 — `/gql` names one entry two ways, with and without the form's suffix, so `===` on ids misses a match

What looks right: an entry has one `/gql` id, so two ids are the same entry when they are equal.
What happens: the same entry reads as `<n>___<entry>` (the entry's own id) or
`<n>___<entry>_<form>` (with the form's suffix, as a relationship field's value reads back). A text
field that stores an entry id can hold yet another spelling, with the org's U-number inside:
`<n>_U<org>__<entry>_<form>` on older rows, `<n>___<entry>_<form>` on newer ones. An option id may
read `<n>__GID_<n>` or `<n>___<n>`. A plain `===` between an id the component holds and one a read
answered then says "not the same" for the same entry or option, and a check built on it ("is this
the entry I linked?", "is this option on the list?") fails quietly.

**How to tell.** On a test org, link two entries through a relationship field, read the field's
`valueAsString` (it carries the form's suffix) and compare it with the linked entry's id from
`formRows` on its own form (no suffix).

What to do: compare entry ids with a helper that drops the form's suffix and compares the numbers,
and option ids in their canonical spelling (the option list's), never with `===` on the strings as
read.

**Applies to:** any BlueStep One component

### G-328 — An option list's order over `/gql` is not its sort order: a list can come with sort orders 3, 1, 2

What looks right: `listOptions { items }` answers the options in the order Manage draws them, so a
picker lists them as they come. What happens: the items come in another order than their
`sortOrder`, while Manage's pickers and blocks follow `sortOrder`. A three-option list can come
back with sort orders 3, 1, 2, and in a long list the option with sort order 1 can come ninth.

**How to tell.** On a test org, read a select field's `listOptions { items }` with `sortOrder` on
each item, and compare the answer's order with the sort orders.

What to do: ask for `sortOrder` and sort every option list a screen draws by it (equal sort orders
kept in the answer's order).

**Applies to:** any BlueStep One component
