---
name: b6p-audit
description: Compare a local component's state against what lives on the BlueStep platform, listing files that differ. Use when the user wants to know if they (or someone else) changed something on the platform side, or before a push to be sure nothing unexpected will be overwritten.
---

# /b6p-audit — Compare local vs. platform

## What this does

Runs `b6p audit`, which fetches the component's current state from the BlueStep platform and lists files where local content differs from platform content. **Read-only** — it does not modify anything.

Use this **on demand**, not as a pre-flight before every push. The user decides when to run it; typical triggers are:

- "I want to push but I'm not sure if someone else changed this module"
- "I haven't touched this in a week, what's different on the platform?"
- "I want to verify my local state matches platform before starting work"

For a push that immediately follows, the user can ask you to chain `/b6p-audit` then `/b6p-push`; do not auto-chain it yourself.

## How to invoke `b6p`

`b6p` is a standalone binary on the system `PATH` (the b6p-cli standalone artifact, installed separately from bspecs). Invoke it directly as `b6p`. If `b6p` is not found, the user has not installed the b6p-cli binary yet — point them at its release/install instructions.

Always pass `--yes` so b6p does not show interactive prompts that Claude cannot answer.

## Steps

### 0. Auth preflight (do this first, before any `b6p` call)

`b6p` stores BlueStep platform credentials globally in `~/.b6p/`. On a machine that has never run `b6p auth set`, the first `audit` prompts for credentials **interactively** — a prompt you (Claude) cannot answer, so the call hangs silently. `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-credentials* one.

Before running the audit, check that credentials exist:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints `OK` → credentials are set, continue.
- If it prints nothing (file absent) → STOP. Do **not** run the audit. Tell the user:
  > `b6p` has no BlueStep platform credentials on this machine yet, so the audit would hang on an interactive prompt I can't answer. Run `b6p auth set` once (it stores credentials globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-audit <component>`.

### 1. Identify the component

If `$ARGUMENTS` contains a component path (e.g. `U######/Combined Scheduler`), use it. If empty, ask the user which component to audit.

Confirm the component was pulled with `b6p` (so its sync metadata is recorded) — without that, audit cannot determine the destination URL. If it was never pulled here, pull it first.

### 2. Run the audit

Pass `--json` so the result is parseable, and `--file` to specify a file inside the component:

```
b6p --yes --json audit --file "U######/<ComponentName>/draft/scripts/app.ts"
```

The CLI walks up from `--file` to find the component root, then compares each file against the platform.

### 3. Parse and summarise

Read the JSON output. The shape is:

```json
{
  "changedFiles": ["draft/scripts/app.ts", "draft/info/metadata.json (new)", ...],
  "baseUrl": "<DAV URL>"
}
```

- If `changedFiles` is empty: tell the user "Local is in sync with the platform."
- If non-empty: list each path and note which side has the newer version when you can tell (a `(new)` suffix means the file exists on the platform but not locally; otherwise the file exists on both sides with different content).

### 4. Suggest a next step (do not auto-execute)

Based on the result, suggest:

- **In sync** → "Local is in sync. You can `/b6p-push <component>` safely if you have local changes."
- **Platform has changes you don't** → "Platform has changes not present locally. Consider `/b6p-pull` to sync before continuing work, especially if you're about to push."
- **You have local changes the platform doesn't** → "These changes exist only locally. They'll be pushed when you run `/b6p-push`."
- **Both sides changed** → "Both sides have diverged. Pulling would overwrite your local changes; pushing would overwrite the platform. You probably want to decide file-by-file — open each one and merge manually before pushing."

Never auto-pull or auto-push from inside this skill. The user drives the next step.

## What this skill must NOT do

- Do NOT pass `--pull` to `b6p audit` (that flag would auto-sync; we want read-only).
- Do NOT chain into `/b6p-pull` or `/b6p-push` without the user asking.
- Do NOT invoke `b6p` any way other than the bare `b6p` binary, and never without `--yes`.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions).
- **Any other error** (network, auth, etc.) — the audit command is read-only so failures are usually transient. Surface the raw error to the user; suggest retrying or using `b6p auth set` if it looks like an auth issue.
