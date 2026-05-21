---
name: b6p-push
description: Push local changes for a component back to the BlueStep platform. Use when the user is ready to deploy local edits.
allowed-tools: Bash(wsl bash -lc *) Bash(bash -lc *) Bash(git*)
---

# /b6p-push — Push a component to BlueStep

## How `b6p push` actually works

`b6p push` is most reliably driven by `--file <path>`, which tells the CLI to derive the destination DAV URL from the local file's metadata (via `.b6p_metadata.json`):

```
b6p push --file <path-inside-component>
```

Any file inside the component works as the `--file` argument; the CLI walks up to find `.b6p_metadata.json`.

## Detecting the shell environment

Same rule as `/b6p-pull`:

1. Run `uname -s`.
2. If `Linux` → invoke as `bash -lc 'b6p ...'`.
3. Otherwise → invoke as `wsl bash -lc 'b6p ...'`.

The `-lc` is required so nvm/PATH load — the `require-wsl-for-b6p` hook enforces this.

## Steps

### 0. Detect environment

Run `uname -s` once; use the result to choose between `bash -lc` and `wsl bash -lc` for the push command.

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
<prefix> 'b6p push --file "U######/<ComponentName>/draft/scripts/app.ts"'
```

Where `<prefix>` is `bash -lc` (inside WSL) or `wsl bash -lc` (from Windows). Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

### 5. Report

- The platform compiles after receiving the push. Surface any compile errors the CLI reports.
- Remind the user to verify behaviour on the platform itself — there is no local compile to fall back on.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` without `bash -lc` (or `wsl bash -lc` on Windows).
- Do NOT push without showing the user the diff and getting confirmation.
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found: b6p`** — the CLI is not installed on this machine. Do NOT retry. Tell the user:
  > `b6p` is not installed. See the "Install the b6p CLI" section of this project's `README.md` for one-time setup. Once installed, retry `/b6p-push <component>`.
- **Any other error** (network, auth, conflict, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.
