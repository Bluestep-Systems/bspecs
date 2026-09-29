---
name: b6p-audit
description: Compare a local component's state against what lives on the BlueStep platform, listing files that differ. Use when the user wants to know if they (or someone else) changed something on the platform side, or before a push, to see what changed there before the push stops to ask about it.
allowed-tools: Bash(b6p:*) Bash(test -f *)
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

Always pass `--yes` so b6p does not stop at a question you cannot answer; it prints each question it answered, with the answer, on stderr — those lines are not errors.

## Steps

### 0. Auth preflight (do this first, before any `b6p` call)

With no access token stored in `~/.b6p/`, the audit asks for one — a question you cannot answer, and `--yes` does not — and exits `1` naming it. Check first:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints nothing (file absent) → STOP. Do **not** run the audit. Tell the user:
  > `b6p` has no BlueStep platform access token on this machine yet, so the audit would stop at a question I can't answer. Run `b6p auth set` once in your own terminal (it stores the token in `~/.b6p/`, once per machine), then retry `/b6p-audit <component>`.
- If it prints `OK` → continue. This only rules out a missing file: `secrets.enc` holds every secret under its own key, so it can exist without an access token, and then the audit stops at `Enter your access token` and exits `1`. Relay that message and give the same `b6p auth set` instruction; do not retry.

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
  "changedFiles": ["draft/scripts/app.ts", "draft/static/script.ts (new)", ...],
  "baseUrl": "<DAV URL>"
}
```

- If `changedFiles` is empty: tell the user "Local is in sync with the platform."
- If non-empty: list each path and note which side has the newer version when you can tell (a `(new)` suffix means the file exists on the platform but not locally; otherwise the file exists on both sides with different content).
- Say what `/b6p-push` would do with each. A file that **changed on the platform** since the last push or pull from here (or was never synced from this machine) makes the push **stop before uploading anything** and ask whether to overwrite it. A file changed **only locally** uploads without a question. A `(new)` file is **kept** by the push: it is listed as a platform-only file, and deleting it takes the user's yes to a separate question. So deleting a file locally and pushing does not remove it from the platform.

### 4. Suggest a next step (do not auto-execute)

Based on the result, suggest:

- **In sync** → "Local is in sync. You can `/b6p-push <component>` safely if you have local changes."
- **Platform has changes you don't** → "Platform has changes not present locally. Consider `/b6p-pull` to sync before continuing work, especially if you're about to push."
- **You have local changes the platform doesn't** → "These changes exist only locally. They'll be pushed when you run `/b6p-push`."
- **Both sides changed** → "Both sides have diverged. `/b6p-push` will stop and ask before overwriting the platform copies, and a pull keeps the files you edited here instead of taking the platform copy (when this machine has a sync record for them) — neither merges. Decide file by file: open each one and merge by hand before pushing."

Never auto-pull or auto-push from inside this skill. The user drives the next step.

## What this skill must NOT do

- Do NOT pass `--pull` to `b6p audit` (that flag would auto-sync; we want read-only).
- Do NOT chain into `/b6p-pull` or `/b6p-push` without the user asking.
- Do NOT invoke `b6p` any way other than the bare `b6p` binary, and never without `--yes`.

## If the CLI fails

Three distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions).
- **Exit `1` naming a question it could not answer** (`Enter your access token`) — not a tool failure: relay the message and tell the user to run `b6p auth set`, then retry. It can happen even when the step-0 check printed `OK`.
- **Any other error** (network, a real auth rejection by the platform, etc.) — the audit is read-only, so failures are usually transient. Surface the raw error to the user and suggest retrying.
