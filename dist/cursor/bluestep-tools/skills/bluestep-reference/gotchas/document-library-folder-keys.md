---
description: "Folder.subFolders() / subFoldersAsMap() key a subfolder by its name PLUS a trailing slash, so folder.subFolders()[\"Name\"] (no slash) never matches; also, on a record documentLibrary() and recordFiles() return the same root folder"
---

# Document-library subfolder keys carry a trailing slash

`Folder.subFolders()` and `Folder.subFoldersAsMap()` key each child folder by its name **with a
trailing slash appended** — `"Intake Documents/"`, not `"Intake Documents"`. So a lookup by the
bare name silently misses:

```javascript
const root = record.documentLibrary();
root.subFolders()["Intake Documents"];   // undefined — the key is "Intake Documents/"
root.subFolders()["Intake Documents/"];  // the Folder
```

`subFolders()` returns a **plain JS object** (`{[key: string]: Folder}`), so a wrong key is a silent
`undefined`, not an error — the miss looks like "the folder doesn't exist." `subFoldersAsMap()`
returns a `Java.Map<String, Folder>` with the same slash-suffixed keys (`.get(key)` / `.keySet()`).

## Fix

Match on the key you actually have, not the bare name. Either:

- **Strip the trailing slash before comparing** — iterate the keys and compare `key.replace(/\/$/, "")` to the target name; or
- **Use the real slash-suffixed key** — `subFoldersAsMap().get(name + "/")`, or find the matching key first and pass it through unchanged.

Don't hand-build `name + "/"` as a blanket rule without confirming the key shape for your case —
find the matching key by normalizing both sides, then use the map's own key to fetch the `Folder`.

## documentLibrary() and recordFiles() are the same folder

On a record, `BaseRecord.documentLibrary()` and `BaseRecord.recordFiles()` return the **same root
folder** — identical path and identical top-level subfolder set. The declarations bear this out:
both carry the JSDoc "Record Files". Pick either one; you don't need to reconcile two folder trees.
