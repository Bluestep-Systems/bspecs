---
description: BlueStep endpoints are reached at /b/<alias>, not the /files/{id}/draft/ path — the alias is configured per-endpoint and is the URL to give users for testing
---
BlueStep endpoint scripts have a configured **friendly URL** at `/b/<alias>` that is what users actually hit in the browser. The `/files/{id}/draft/` path is the editor view, not the runtime endpoint.

Example: an endpoint script named "Sprint Maestro" (file id `<fileID>`) is exposed at `https://<org>.bluestep.net/b/sprints?action=team`, not `https://<org>.bluestep.net/files/<fileID>/draft/?action=team`.

The alias is set per-endpoint in BlueStep admin and is not derivable from the script name alone — also not necessarily plural-vs-singular consistent (Sprint Maestro → `sprints`).

**Symptom of a wrong alias:** the URL returns HTTP 500 with body literally just `Error` (BlueStep's generic page for "no endpoint at that path"). Status 500 + "Error" is NOT necessarily a script-side crash — first verify the alias before debugging the script.

**How to apply:**
- When reporting test URLs to the user, ask what the friendly alias is — do not guess from the script name or fall back to the `/files/.../draft/` URL.
- The DAV `url` the CLI recorded for the component is the editor URL, not the runtime URL.
- If the user reports "500 / Error" on an endpoint, ask them to confirm the alias before adding script-side error handling.
