# Rules

Prefix `R`.

---

### R-13 — Never put private entry data in a component's placement props, or a secret in a component repo: every signed-in user of the tenant can read both

Since server release 26.09.22.00, custom components, their placements and the placements' anchors
are readable by everyone signed in to the tenant, and the server refuses per-component grants. The
change made components render for staff users. So placement props, their history and the
component's git repo are open to every staff user. What to do: keep private data in form entries,
which keep their own rights, and keep keys in a Secret field or a server store, never in props or
source.
**How to tell.** On a test org, sign in as a plain staff user (not Super) and read a placement over `/gql` with `remoteObjects(ids: ["<placement id>"])`: the `CustomComponentPlacement` answers with its props. So anything put in props or in a component repo is open to every staff user.
**Applies to:** any BlueStep One component

### R-16 — Pick one data path per piece of data, the host or raw `/gql`, and never pass a key from one to the other

Host keys (`ApiRecordId` and the entry keys) are opaque `SystemKey` objects with `toString()` and `equals()`. A component cannot build one from a raw id: a hand-made key is refused at runtime ("expected a key obtained from this host, got a foreign object"). A raw `/gql` id cannot be handed to the host either. The two meet only through `toString()`: a host key's string is the `/gql` id. A component may read units, sites and counts through the host and do every form-row read and write over `/gql` (CSRF token from a `HEAD`, then a same-origin `POST`), because the host cannot name what it needs. A converted screen decides per data path: the host when its contract covers the read or write (it brings the offline queue, `expectedVersion` and the conflict pill), `/gql` when it does not (fields outside the summary fields, which a read returns only when they are named by id; signatures; option values, which are the option's id, not its export value or label). A `/gql` write gives up the queue and the pill, so it passes `expectedVersion` itself where the mutation takes one, and re-reads after.
**How to tell.** Read the host contract in the downloaded `component-host.d.ts`: host keys are opaque `ApiRecordId` / entry keys, the header says you never construct one, and no constructor from a `/gql` id exists.
**Applies to:** any BlueStep One component

### R-18 — Branch on a refusal's `extensions.code`, never on its text: server refusals carry no ids

No GraphQL refusal names an id. A field is named by its label, an object by its kind ("this Relate Form Entry"), and a batch item by its position; the ids go only to the server log. On release 26.10.13.00, a `PRECONDITION` refusal named the field by its label and gave no id. The texts also change wording between releases. BlueStep One's own host already broke on this: its save matched an id inside the refusal text (G-91). So converted code decides by `extensions.code` (`FORBIDDEN`, `PRECONDITION`, `CONCURRENT_MODIFICATION`, `NOT_FOUND`, `INTERNAL`) and its typed extras (`currentVersion`, `maxLength`, `reason`), and shows `message` to the user as it comes (a failed `/gql` call can answer an HTTP error or even 200 with a JSON `errors` body; its kind is in the error's extensions, not in the status). Never parse the message for an id or a field name; to know which field was refused, send fewer fields or check them before the write.
**How to tell.** On a test org, over `/gql`, send a write refused for each reason (a stale `expectedVersion`, an unknown field key, a form the user may not edit) and read each error: `extensions.code` is `CONCURRENT_MODIFICATION`, `PRECONDITION` or `FORBIDDEN`, and no `message` names an id.
**Applies to:** any BlueStep One component

### R-54 — A read or save refused for rights gets words saying what to do instead, never a generic *Try again*

A component's error state offers *Try again* for a read or a write that failed, but a `FORBIDDEN` (missing rights) or a signed-out answer (G-265) fails the same way every time, so *Try again* is a button that only fails again. On a rights refusal, show words that say what the viewer can do instead ("You can't add a new contact. Pick one already in the list."), keep only *Close* or *Cancel*, and keep *Try again* for timeouts, network failures and version conflicts. Test the error mapping: each refusal kind maps to its words and its buttons.
**Applies to:** any BlueStep One component

### R-55 — The design check lists every control that starts slow work and checks, live, what it shows while it waits and when it fails

The canvas draws still states, and the design check writes one row per thing the canvas draws (`build/design-check.md` step 5), so a pending or failure state is checked only where someone thought to list it. Step 4's fetch wrapper reaches loading and error states *of a screen*, not of each control. This lets a control ship with no sign that a click took. Two examples: a *Try again* with no running state (a click looked lost), and an icon in a table row that opened another entry after a few seconds of lookups with nothing drawn, while the other links in the same row had P-34's opening mark. The audit had a row for the icon's look, one for what the rows open (naming the links but not the icon), and one for pending states (buttons only).
The rule: before the design check's verdicts, list in `design-audit.md` every control that starts slow work: opens another screen (`openEntry`, `openNewEntry`, a lookup before it), reads (a tab, a dialog that loads, a *Try again*, a reread), saves or deletes. Give each one row with two checks, both live: (1) **while it waits**, with the operation held by the fetch wrapper: a visible sign on or beside the control itself (P-34's mark, a loader in the icon's place, the button's working words), clicks held without losing focus (P-70), and a polite status for a screen reader; (2) **when it fails**, with the operation failed: words near the control saying what failed and whether the work in hand is blocked (P-71), and no generic *Try again* on a refusal (R-54). Build the list from the code (every `onClick` that awaits or navigates), not from the canvas, since the canvas does not draw these states. A control with no sign in (1) is a **Fix**, never a **Keep**.
**Applies to:** any BlueStep One component

### R-56 — Put what a component lets an org change in its settings, so Build's AI can change it; write a tool of its own only for what no setting can hold

A BlueStep One component can be changed from Build in Edit mode in two ways. Its **settings** (the props an admin sets on a placed component) are picked up by Build's default AI tool with no code: an admin or the agent can change them in words. A **tool of its own**, registered by the component, covers behavior a setting cannot hold (for example, drag and drop of tiles in a grid). A component converted from Manage only has to reproduce Manage's behavior, so the build tends to give it neither, and then the org cannot change it except in code. So when building a component, put in settings what an org would sensibly change (labels, defaults, which parts show, thresholds, filters), and add a tool of its own only for what does not fit a setting. Aim for both, settings and tools, as the standard. It is a short ask in the build prompt, not a separate piece of work; on a converted component it does not hold up a release. Not yet tried live: Build's default tool changing a setting.
**Applies to:** any BlueStep One component
