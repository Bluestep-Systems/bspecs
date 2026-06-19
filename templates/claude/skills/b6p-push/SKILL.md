---
name: b6p-push
description: Push local changes for a component back to the BlueStep platform. Use when the user is ready to deploy local edits.
allowed-tools: Bash(npx b6p *) Bash(git*)
---

# /b6p-push — Push a component to BlueStep

## How `b6p push` actually works

`b6p push` is most reliably driven by `--file <path>`, which tells the CLI to derive the destination DAV URL from the local file's metadata (via `.b6p_metadata.json`):

```
b6p push --file <path-inside-component>
```

Any file inside the component works as the `--file` argument; the CLI walks up to find `.b6p_metadata.json`.

## How to invoke `b6p`

`b6p` ships as a devDependency of this project (`@bluestep-systems/b6p-cli`). Always invoke it with `npx b6p`, which resolves `node_modules/.bin/b6p` cross-platform — no global install, no shell or PATH detection. If `node_modules` is missing, the user has not run `npm install` yet (see the "Install dependencies" section of the project's `README.md`).

## Steps

### 1. Identify the component

If `$ARGUMENTS` contains a component path (relative to the project root), use it. Otherwise ask the user which component to push.

### 2. Pre-flight checks

- Run `git status` to surface what changed and flag anything unexpected.
- Briefly summarise the diff scope: "X files changed in `U######/<Component>/draft/`".
- Confirm `.b6p_metadata.json` exists inside the component — without it, `--file` cannot derive the destination URL.

### 3. Confirm with the user

Show the summary and ask:
> Push `<ComponentName>` now?

Do not push without explicit confirmation.

### 4. Run the push

```
npx b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call will hang. Always include it.

### 5. Report

- The platform compiles after receiving the push. Surface any compile errors the CLI reports.
- Remind the user to verify behaviour on the platform itself — there is no local compile to fall back on.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than `npx b6p`.
- Do NOT push without showing the user the diff and getting confirmation.
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the project's dependencies are not installed. Do NOT retry. Tell the user:
  > `b6p` could not be resolved. Run `npm install` in the project root (see the "Install dependencies" section of this project's `README.md`), then retry `/b6p-push <component>`.
- **Any other error** (network, auth, conflict, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.
