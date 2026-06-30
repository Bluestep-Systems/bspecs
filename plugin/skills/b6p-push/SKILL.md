---
name: b6p-push
description: Push local changes for a component back to the BlueStep platform. Use when the user is ready to deploy local edits.
allowed-tools: Bash(b6p:*) Bash(git*) Bash(test -f *)
---

# /b6p-push — Push a component to BlueStep

## How `b6p push` actually works

`b6p push` is most reliably driven by `--file <path>`, which tells the CLI to derive the destination DAV URL from the sync metadata it recorded for that component when it was pulled:

```
b6p push --file <path-inside-component>
```

Any file inside the component works as the `--file` argument; the CLI walks up to find the component root and looks up its recorded sync metadata.

## How to invoke `b6p`

`b6p` is a standalone binary on the system `PATH` (the b6p-cli standalone artifact, installed separately from bspecs). Invoke it directly as `b6p`. If `b6p` is not found, the user has not installed the b6p-cli binary yet — point them at its release/install instructions.

## Steps

### 0. Auth preflight (do this first, before any `b6p` call)

`b6p` stores BlueStep platform credentials globally in `~/.b6p/`. On a machine that has never run `b6p auth set`, the first `push` prompts for credentials **interactively** — a prompt you (Claude) cannot answer, so the call hangs silently. `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-credentials* one.

Before running the push, check that credentials exist:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints `OK` → credentials are set, continue.
- If it prints nothing (file absent) → STOP. Do **not** run the push. Tell the user:
  > `b6p` has no BlueStep platform credentials on this machine yet, so the push would hang on an interactive prompt I can't answer. Run `b6p auth set` once (it stores credentials globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-push <component>`.

### 1. Identify the component

If `$ARGUMENTS` contains a component path (relative to the project root), use it. Otherwise ask the user which component to push.

### 2. Pre-flight checks

- Run `git status` to surface what changed and flag anything unexpected.
- Briefly summarise the diff scope: "X files changed in `U######/<Component>/draft/`".
- Confirm the component was pulled with `b6p` (so its sync metadata is recorded) — `--file` resolves the destination URL from that metadata. If the component was never pulled here, pull it first.

### 3. Confirm with the user

Show the summary and ask:
> Push `<ComponentName>` now?

Do not push without explicit confirmation.

### 4. Run the push

```
b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call will hang. Always include it.

### 5. Report

- The platform compiles after receiving the push. Surface any compile errors the CLI reports.
- Remind the user to verify behaviour on the platform itself — there is no local compile to fall back on.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push without showing the user the diff and getting confirmation.
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-push <component>`.
- **Any other error** (network, auth, conflict, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.
