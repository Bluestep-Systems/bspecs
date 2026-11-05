# Gotchas — builds, copies, reloads and saves

Prefix `G`.

---

### G-169 — Code copied from one component repo into another has to be fixed in every copy, and a later fix to the source does not reach the copies

What looks right: copying `gql.ts`, `Alert` or `Checkbox` from one component repo into a new one
is a one-time step (each repo holds its own copy, no shared code). What happens: the source keeps
changing after the copy. A CSRF fix (G-155) had to be made twice, once in each repo that held the
file; shared UI parts changed after another repo had already planned to copy them. A copy taken before such a fix carries the old bug.
How to tell: diff the copy against its source (`git diff --no-index <source> <copy>`). What to do:
copy at the moment of building, not at planning; write the source commit in the copied file's first
comment; before each publish, run `node "${CLAUDE_PLUGIN_ROOT}/tools/copies.mjs" <repo>` and carry
over any fix.
Carrying a source fix into a copy that was changed on purpose: say the copy adds an `X-Request-Id`
to each write, and the source then gave every read a 20 s deadline (G-235) and rewrote the same
`gql()`. `git merge-file -p <copy> <source@copy commit> <source@new commit>` carries it, with any
conflict settled by hand; afterwards `git diff --no-index <source> <copy>` shows only the deliberate
hunks. A new file the source now imports (a deadline helper) comes along whole with its own row in the
README's *Copied* table, so `copies.mjs` tracks it too. Do not re-copy such a file over the copy:
the deliberate difference would be lost.
A copy that takes only part of a source file (the generic third of a data module, or a helper with
another file's function written in) is still listed in the *Copied* table with its source and commit
and a note of what was taken, so `copies.mjs` still flags a later fix to the source.
**Applies to:** any BlueStep One component

### G-200 — A `role="status"` box mounted with its words already in it may not be read out

What looks right: give a notice `role="status"` and a screen reader announces it. What happens: a live region announces changes to content it already holds; a box that appears with its text in the same render is often skipped (NVDA and VoiceOver differ), so the user is not told that something is being updated. This follows the ARIA live-region rule; it has not been checked with a screen reader. A kit-style `Alert` that gives every non-destructive notice `role="status"` has this shape. A notice swapped in for a dialog's fields with its words in it (a rights refusal, say) should be `role="alert"`, with focus on *Cancel*. How to tell: with NVDA on, do a save that starts a background update with a notice, and listen for the notice. What to do, if it is skipped: keep an empty `role="status"` region mounted from the start (an `sr-only` line) and put the words into it, with the visible box drawn without a role.
**Applies to:** any BlueStep One component

### G-222 — One save can write two versions when a POST_SAVE formula writes the entry, so the next write takes its version from the answer

What looks right: a save moves `rowVersion` by one, so the next write sends `expectedVersion + 1`. What happens: when a POST_SAVE formula changes the row, its write is a second version. Seen on release 26.10.13.00 with a POST_SAVE formula that writes another field of the same entry: one `updateFormRow` at `expectedVersion` 5 answered `rowVersion` 7; a save where the formula changes nothing went 5 to 6. The answer's `rowVersion` is the last one (7), so take it from there; a version guessed as +1 is refused `CONCURRENT_MODIFICATION`. Not the same as a formula recalculating an entry outside a save, which moves no `rowVersion`; a post-save's write inside one does.
**How to tell.** 1. On a test org, find a form with a POST_SAVE formula that writes the entry, and read an entry's `rowVersion`. 2. Send one `updateFormRow` that changes a value the formula reacts to: the answer's `rowVersion` is up by 2. 3. Read the row's `history`: two versions, the second made by that formula (the formula's id).
**Applies to:** any BlueStep One component

### G-229 — A custom component build can sit *Queued* for over a minute and then fail with "source fetch answered 404"; the same commit builds at once on a second try

What looks right: *Build the draft branch* finishes in about 10 s. What happens: the build stays *Queued* (a page reload still shows it) for about 90 s to 4 minutes, then turns *Failed*, "build job failed"; *Builder output* reads `build failed unexpectedly: Error: source fetch answered 404 at fetchSource (main.mjs:356)`, then `could not report the failure: Error: result post answered 404`. The same happens through the gateway's `graphql_mutation` `buildCustomComponent`: `customComponentBuild` reads `QUEUED`, then `FAILED` with the same two 404s in its `log`. The commit was pushed and nothing is wrong with it: a second build usually reads `SUCCEEDED` within 20 s, and `publishCustomComponent` answers the commit's sha at the first call. Once, three builds of the same commit in a row failed the same way; signing out and in again and running *Build* and *Publish* from the component's *Build* tab worked. Whether the new session fixed it, or the time that passed did, is not known. The likely cause is a job that waited past the life of its source link, a builder-side matter. How to tell: open *Builder output*; a 404 on the source fetch is the builder's, a TypeScript error is ours. What to do: build once more before reading the code; if a second try fails the same way, sign out and in again before the third; if it still fails, report it to the platform team.
**Applies to:** any BlueStep One component

### G-230 — Above several units, a page that lists their records but reads one unit's setup applies the wrong setup to the other units' records

What looks right: the page finds the setup record of the viewer's unit, and every record it lists follows that unit's setup (for example, the choices a select offers, kept on a per-unit setup form). What happens: above several units, the listed records belong to other units, whose setup differs. A record of a child unit offers its own unit's choices (the select's `candidates` carry a `recordId` that names the child unit's setup record), so a choice that exists only in the child's list finds no settings in the page's copy, and a rule tied to that choice (a note it requires, say) is skipped. The fix keeps each choice's `recordId` and, when it is not the unit's record, reads that record's setup. Settings that are not per choice (time zone and the like) still follow the viewer's unit.
**How to tell.** 1. On a test org with a top unit and child units whose setup differs, open the page as a top-unit user and pick a record of a child unit. 2. Open the select: it offers the child unit's choices, not those of the page's setup record. 3. Over `/gql`, read the setup form for both units' records and compare.
**Applies to:** any BlueStep One component

### G-231 — A BlueStep One tab that has loaded one build of a custom component fails to load another build of it until a full reload

What looks right: publish a new build, then route the same tab (by the menu or the address's hash) to the page that places the component; the host loads the new build. What happens: the tab still holds the remote it loaded first. When the editor's preview has loaded a new build over an older one, the console reads "The remote \"<name>\" is already registered", then "shared singleton module @bluestep/ui does not satisfy the requirement … ^1.0.0". A page that then asks for the older build shows "This component couldn't be loaded. Cannot access 'm' before initialization" (`ReferenceError: Cannot access '…' before initialization` in `/component/<name>/<sha>/….js`). F5 loads the new build and the page works. How to tell: the console names two different shas under `/component/<name>/`, or a `before initialization` error comes from the component's chunk. What to do: after a publish, reload the tab (F5) before judging the page; P-37's check of the served sha comes after that reload.
A reload is not always enough after a *Temporary login*. A tab signed in by *Temporary login* before a publish kept loading the old `/component/<name>/<old sha>/remoteEntry.js` over six full reloads in five minutes, while the same session's `/gql` read `remoteObjects(ids: ["<component id>"]) { ... on CustomComponent { publishedSha } }` as the new sha. There was no service worker, Cache Storage or persisted query cache in the tab. So the host holds the component's descriptor for the login session. A new *Temporary login* as the same user, made after the publish, loaded the new sha on the first load. What to do: publish before the temporary login, or log in again after the publish, and check the served sha (P-37) before judging the page.
**Applies to:** any BlueStep One component

### G-235 — A read with no deadline, kept as a promise every screen shares, leaves a screen on its skeleton for the rest of the tab

What looks right: `fetch` answers or fails, so a load that awaits its reads ends ready or in its error state, and *Try again* covers the rest. What happens: a request the network drops without an answer never settles. The host names the case (the load balancer drops the connection or the pod goes away mid-flight, and the socket waits out the OS retransmit budget, minutes) and gives its own writes a 30 s deadline, leaving reads alone. A component whose load waits on several reads, two of them module-level promises shared by every screen in the tab (the CSRF token's `HEAD` and the form model), is exposed: a failure clears either one, a hang never does, so one dropped request keeps every later screen in that tab on its skeleton until a reload. The symptom: a list sits on its skeleton, and a refresh draws it at once. Any other module-level promise (a cached navigation read, say) has the same shape. The host's own pages had the same shape when last checked (a form surface stays on its skeleton with no error, and keeps it after the network is back, until a reload); a host `/gql` call that carries a deadline for every component would fix that, and until it exists each component carries its own.
How to tell: on a test org, reload a page, then in the console `const f = window.fetch; window.fetch = (u, i) => String(u).includes('/gql') ? new Promise(() => {}) : f(u, i);`, open the component's screen (skeleton), run `window.fetch = f`, and open the screen again from the menu, with no reload: still the skeleton, because the shared token `HEAD` never settled. What to do: give every read a deadline (`AbortSignal.timeout` joined with the caller's signal; for example 20 s, with `withDeadline(start(own.signal), <deadline ms>, caller, () => own.abort())`), turn its expiry into the `network` error the screens already word with *Try again*, and drop a shared promise when its deadline passes or it fails, so the next screen asks again (P-54).
**Applies to:** any BlueStep One component

### G-240 — Whether a stale `expectedVersion` on a write that changes nothing is refused differs between forms

What looks right: `updateFormRow` with an old `expectedVersion` is always refused with `CONCURRENT_MODIFICATION`. What happens: on one form, a write whose values equal the row's was accepted at a stale version and answered the current `rowVersion`, writing nothing (G-321); a write that changed a value at the same stale version was refused. On another form, a write that sent only a signature already set, at a stale version, was refused (`CONCURRENT_MODIFICATION`, "This Relate Form Entry is at version 5, not the expected 3", `currentVersion` 5). Which forms do which was not worked out. So a write that relies on the version check to see someone else's change must not read "no refusal" as "the version was current": read the answer's `rowVersion` and the signer.
**How to tell.** On a test org, in BlueStep One tick a Signature field on an unsigned entry and do not save; sign the same entry in Manage; press *Save* in BlueStep One. Read the answer and the row's version. Repeat with a changed value: refused. Try it on the form your component writes.
**Applies to:** any BlueStep One component

### G-295 — A `beforeunload` guard that only calls `preventDefault()` does not ask in Safari or older Chromium

What looks right: `event.preventDefault()` in a `beforeunload` listener makes the browser ask before a reload. What happens: current Chromium and Firefox ask; Safari and older Chromium ask only when `event.returnValue` is also set. This is the browsers' documented behaviour; it has not been tried. How to tell: in Safari, change a form with a leave guard and reload: the page leaves without asking. What to do: set `event.returnValue = ""` after `preventDefault()`, in the source file and in every copy of it (`${CLAUDE_PLUGIN_ROOT}/tools/copies.mjs` flags a copy whose source changed), in one change.
**To see it again.** The steps under *How to tell*.
**Applies to:** any BlueStep One component
