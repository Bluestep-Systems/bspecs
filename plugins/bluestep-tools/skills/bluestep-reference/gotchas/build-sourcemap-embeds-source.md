---
description: "Compiled draft/.build/*.js files embed the full TypeScript source as a base64 sourcemap, so text removed from the source stays in the repo until a publish rebuilds .build/ and a pull brings it down"
---

# Compiled output keeps text removed from source

## Symptom

You remove something from a component's TypeScript (client data, a secret, an old comment) and
commit. A search of the source finds nothing. The text is still in the repo.

## Cause

Each compiled file in `draft/.build/` ends with an inline sourcemap: a
`//# sourceMappingURL=data:application/json;base64,...` comment that holds the full TypeScript
source it was built from. Until `.build/` is rebuilt, the old source rides along inside the
compiled `.js`, base64-encoded.

Plain-text search does not see it, and neither do the client-data checks: they skip `.build/` and
cannot read base64 anyway.

## Fix

1. Fix the TypeScript source.
2. Publish the component with `/b6p-push`, once the user has chosen to publish (a draft save
   does not rebuild `.build/`). The publish builds fresh `.build/` output from the fixed source.
3. `b6p pull` the component, so the rebuilt `.build/` files land in the project, and commit them.

To confirm, decode the sourcemap of each compiled file and search the result. Older commits still
hold the old `.build/` files; cleaning history is a separate decision (see
[client data](../conventions/client-data.md)).
