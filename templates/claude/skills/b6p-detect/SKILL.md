---
name: b6p-detect
description: Detect where `b6p` is installed on this machine and persist the result so the other /b6p-* skills know how to invoke it. Use when b6p was installed (or re-installed in a different location) after this project was scaffolded.
allowed-tools: Bash(bash -lc *) Bash(wsl bash -lc *)
---

# /b6p-detect — Detect and register the b6p install location

## When to use this

You normally do NOT need to invoke this. `bluestep-init` runs the same detection at scaffold time and writes `.claude/b6p-env.json`. The other `/b6p-*` skills also auto-detect on first use if the file is missing.

Use `/b6p-detect` only when:

- You installed `b6p` after running `bluestep-init` and the other skills are still failing for some reason.
- You re-installed `b6p` in a different location (e.g. moved from WSL nvm to a Windows-native install, or vice versa) and want to refresh the registered prefix.
- You're debugging and want to confirm which `b6p` Claude is actually using.

## Steps

### 1. Probe shell candidates

Try shell prefixes in order until one finds `b6p`. The list depends on the host platform.

**On Linux/macOS:**
1. `<user-shell> -lc "command -v b6p"` — clean (no banners) but doesn't load .zshrc/.bashrc.
2. `<user-shell> -ic "command -v b6p"` — interactive, loads .zshrc/.bashrc where nvm usually lives. May print banners (silence stderr).
3. Fall back to `/bin/bash -lc` and `/bin/bash -ic` if user-shell is unusual.

Where `<user-shell>` is `$SHELL` if it ends in bash/zsh/sh/fish, else `/bin/bash`.

**On Windows:**
1. `where b6p` — Windows-native install on PATH.
2. `wsl zsh -lc "command -v b6p"`, then `-ic`.
3. `wsl bash -lc "command -v b6p"`, then `-ic`.

First match wins. Use that prefix in the persisted file.

If all probes fail, STOP and tell the user:

> `b6p` is not installed anywhere I can reach. See the "Install the b6p CLI" section of this project's `README.md` for one-time setup. Re-run `/b6p-detect` after installing.

### 2. Capture the install path

For the winning prefix, also run `<prefix> "command -v b6p"` and capture the printed path (e.g. `/home/fchazarreta/.nvm/versions/node/v24.15.0/bin/b6p`). Useful for the user to verify which install you found.

### 3. Write `.claude/b6p-env.json`

Overwrite (or create) the file with this shape:

```json
{
  "shellPrefix": "bash -lc",
  "location": "native",
  "detectedAt": "<ISO timestamp>",
  "detectedBy": "/b6p-detect skill",
  "binaryPath": "/home/fchazarreta/.nvm/versions/node/v24.15.0/bin/b6p"
}
```

The other `/b6p-*` skills read `shellPrefix` from this file on every invocation, so the change takes effect immediately.

### 4. Report

Tell the user:

> Detected `b6p` at `<binaryPath>` via prefix `<shellPrefix>`. Wrote `.claude/b6p-env.json`. Future `/b6p-pull`, `/b6p-push`, and `/b6p-audit` calls will use this prefix.

If this overwrote a previous file, note what changed (old vs new prefix).

## What this skill must NOT do

- Do NOT install `b6p`. Installation belongs in docs, not in a skill. See the project's `README.md`.
- Do NOT modify any file other than `.claude/b6p-env.json`.
- Do NOT auto-run any `b6p` subcommand after detection — the user drives what comes next.
