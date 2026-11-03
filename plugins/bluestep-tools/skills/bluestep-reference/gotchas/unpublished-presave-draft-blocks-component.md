---
description: "A BsJs component embedded on a form cannot be exercised while that form's pre-save formula has unpublished draft changes -- saving fails with a bare, prefix-less storage error that looks like a defect in the component under test"
---

# Unpublished pre-save formula draft blocks the component under test

## Symptom

While testing a BsJs component that lives on a form (a merge report, a section renderer, anything
embedded in the page), saving fails with a generic error: "There was a problem storing the data."
No section name, no detail. The failure looks like a bug in the component you're working on.

## Cause

The form's pre-save formula has unpublished draft edits -- someone has it open mid-edit and hasn't
published or snapshotted it. The platform can't persist the record while the formula is in that
state, and this has nothing to do with the component under test; its code can be correct and still
fail to save. If only one of several similar components is being exercised when someone else's
formula edit lands, the failure correlates with just that one and reads as specific to it. Observed
twice on the same platform (2026-09) -- the second time the correlation was convincing enough that
a change was designed, approved, and published live before the real cause (formula draft state,
not the component) was found.

## How to tell it apart from an abort

Check whether the error message has a section prefix. A formula that deliberately rejects a save
with `sendMessage`/`throw` reports a business-rule failure and names the section it came from --
see [send message abort](../reference/send-message-abort.md) for what happens once a formula
decides to abort. A bare, prefix-less "problem storing the data" is a different class: the platform
couldn't persist the record at all, before any business-rule check ran. No prefix means check
publish state, not abort logic.

## Fix

Publish or snapshot the pre-save formula. If you don't own it, ask whoever does, and ask again if
anyone has touched it since -- draft state can change between checks. Before blaming the component,
confirm the exact error text (prefixed or not) and whether the component's own code actually
differs between a working run and a failing one. A save failure that clears with no code change
needs an explanation, not a shrug -- it can recur.

## Related

[send message abort](../reference/send-message-abort.md) covers what happens once a formula
decides to abort a save and whether its message reaches the UI. This gotcha covers a save that
fails before that logic ever runs, because the formula itself isn't in a publishable state.
