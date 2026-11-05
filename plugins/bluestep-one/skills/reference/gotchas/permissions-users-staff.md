# Gotchas — permissions, users, staff

Prefix `G`.

---

### G-239 — A staff user may be refused a form a screen reads beside its main data, so the screen must not fail whole on that refusal

What looks right: a side read is part of the screen's load, and a failed read fails the load so nothing shows half loaded. What happens: a staff role may not see the side read's form, so that read answers `FORBIDDEN` "You do not have View Value privileges for this Relate Form." and the whole screen shows "could not be loaded. Try again." With the side read answered empty, the screen loads with no other error. The fix: turn only a `forbidden` side read into no data. That is only half the answer. Say the side read gives each card a location: that user then sees no location on any card, and a sort by location sorts by name, while Manage's report for the same user shows every location and sorts by it (a Manage report reads the form whatever the viewer's view rights). Compare what the old page shows the same user.
**How to tell.** 1. On a test org, use *Temporary login* in BlueStep One's Dev Tools as a staff user with no View Value right on the side form, and read that form with `formEntries`: `FORBIDDEN`. 2. Open the screen: with the fix it loads with no side data; without it, it fails whole. 3. Compare Manage's matching report for the same user: it shows the side data.
**Applies to:** any BlueStep One component

### G-262 — A *Temporary login* can switch the user of an open BlueStep One tab without loading the page again, so what the page held for the last user is still there

What looks right: after a *Temporary login* as another user, the BlueStep One tab is a fresh page for that user. What happens: the tab's document can be the one loaded while signed in as the first user (`new Date(performance.timeOrigin)` is older than the login, navigation type `reload`). Its header then reads the second user's name, and its `/gql` reads run as the second user; yet a `fetch` wrapper put into that document as the first user is still in place. A second wrapper put in as the second user recorded one write twice, at the same millisecond. How to tell: `new Date(performance.timeOrigin)` is older than the login. What to do: on a live check, read `performance.timeOrigin` before putting in a hook, or reload first (G-231 for which build loads). In a component, nothing kept in module scope may belong to one user. A component may keep the CSRF token (a stale one gets a bare 403 and one retry with a fresh one), the form model or a cached field there; check whether each holds anything per user.
**Applies to:** any BlueStep One component

### G-265 — A signed-out session's save comes back as FORBIDDEN, word for word a rights refusal, so a screen that reads FORBIDDEN as "no rights" turns read only and drops what was typed

Fixed on the server since release 26.10.26.01: signed out, an `updateFormRow` answers `UNAUTHENTICATED` "You are not signed in. Sign in and try again.", and the `B6P-CSRF-TOKEN` changes on sign-in. On those releases, signed out comes only from `UNAUTHENTICATED`, and a `FORBIDDEN` is a rights refusal again. A component reads `UNAUTHENTICATED` as signed out and keeps the entry editable. How the host's own pages read the new answer was not checked.
On an org before 26.10.26, the trap still holds. What looks right: a write refused with `extensions.code` `FORBIDDEN` and "You do not have [Edit Value] privileges for this Relate Form." means the user lacks the right, so the screen says so and stops offering the edit. What happens: after a sign-out in another tab the session lives on as anonymous with the same CSRF token, and the server gives that exact answer, HTTP 200, to the signed-out user. A screen that maps it to "You don't have permission to change this." turns read only and the typed value is gone; BlueStep One's own "Your session ended" never comes up. What to do there: on a `FORBIDDEN`, before treating it as rights, ask who the session is (`host.session.authState()`, or `{ user { id } }` on `/gql`); if anonymous, say the session ended and to sign in again, and keep the entry and what was typed as they are, so a save after signing in goes through.
**To see it again.** On a test org, as any user, open an entry and type a change; in a second tab open `https://<org host>/shared/login/logout.jsp`; back in the first, *Save*. From release 26.10.26.01 on, the `/gql` answer is `UNAUTHENTICATED`. Before that, it is HTTP 200 with `FORBIDDEN`, and `{ user { id } }` answers `null`.
**Applies to:** any BlueStep One component
