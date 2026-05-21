---
name: b6p-pull
description: Pull a B6P component from the BlueStep platform into the local workspace using its DAV URL, and scaffold draft/README.md if missing. Use when the user wants to bring a component down for the first time or re-sync after platform edits.
allowed-tools: Bash(wsl bash -lc *) Bash(bash -lc *)
---

# /b6p-pull — Pull a component from BlueStep

## How `b6p pull` actually works

`b6p pull` takes a **DAV URL** as its primary argument, NOT a display name:

```
b6p pull [options] <formula-url>
```

The user copies the DAV URL from the component's page in the BlueStep platform UI. You cannot discover or infer it. There is no fallback that takes a name.

A first pull creates the `U######/<ComponentName>/` folder (creating the U-folder if it does not exist) and populates `declarations/`, `draft/`, and `.b6p_metadata.json`.

## Detecting the shell environment

Before invoking b6p, determine where you are running:

1. Run `uname -s` (in the Bash tool).
2. If output is `Linux` → you are already inside WSL. Invoke b6p as: `bash -lc 'b6p ...'`
3. Otherwise (Darwin/MINGW/etc., or any non-Linux) → you are on Windows. Invoke b6p as: `wsl bash -lc 'b6p ...'`

The `-lc` is required either way: it forces a **login shell** so that nvm (which is where b6p lives) populates PATH. Plain `b6p ...` or `wsl b6p ...` will fail with "command not found" because the login profile never loads. The `require-wsl-for-b6p` hook enforces this shape.

## Steps

### 0. Detect environment

Run `uname -s` once and remember the result. Use it to decide between `bash -lc 'b6p ...'` (inside WSL) and `wsl bash -lc 'b6p ...'` (on Windows) for every b6p invocation below.

### 1. Get the DAV URL

- If `$ARGUMENTS` looks like a URL (starts with `http://` or `https://`), use it.
- If `$ARGUMENTS` is empty or looks like a display name (no scheme), STOP and ask the user:
  > I need the **DAV URL** of the component, not its name. Copy it from the component's page in the BlueStep platform UI and paste it here.
- Do NOT guess the URL. Do NOT try to derive it from `.b6p_metadata.json` of other components.

### 2. Run the pull

Using the shell-prefix decided in step 0:

```
<prefix> 'b6p pull "<DAV URL>"'
```

(So either `bash -lc 'b6p pull "<DAV URL>"'` or `wsl bash -lc 'b6p pull "<DAV URL>"'`.)

Capture the output — it prints the local path where the component landed.

### 3. Locate the component folder

Parse the CLI output, or scan for the most recently modified `U######/<Name>/` directory under the project root. Confirm:

- `declarations/` is populated
- `.b6p_metadata.json` exists at the component root
- `draft/info/metadata.json` and `draft/info/config.json` exist
- `draft/scripts/app.ts` (or whatever `config.json:main` points at) exists

### 4. Identify the component type

Read `draft/info/metadata.json` and `draft/info/config.json`. Signals:

- `httpOption` + `allowedMethods` + a `path` field → **Endpoint**
- `useAsHeaderInRelate` / `useForEditing` / `replaceRelateRecordSummary` + `draft/static/` directory present → **MergeReport**
- `triggerType: "POST_SAVE"` (or comparable) → **Post-Save**
- `triggerType: "SCHEDULED"` → **Scheduled**
- `triggerType: "ON_DEMAND"` → **OnDemand**
- `language: "mjs"` + no triggers + presence of formula configuration → **Formula**

If the signals are ambiguous, read `draft/scripts/app.ts` for comment headers ("// Scheduler MR" etc.) before deciding. If still unsure, ask the user.

### 5. Handle `draft/README.md`

This is the per-module documentation that lives WITH the code (it ships to the platform on push, so anyone who pulls the module gets it).

a. **Check if it already exists and is substantive.** Read `<Component>/draft/README.md`.
   - If file does not exist → proceed to scaffold (step b).
   - If file exists with > 200 characters AND contains at least one `##` heading that is not literally `## Title` → it is substantive. **Leave it alone.** Tell the user: "draft/README.md already exists and looks substantive — leaving it. Read it before editing code."
   - Otherwise (empty, only `# Title`, only boilerplate) → proceed to scaffold (step b), overwriting.

b. **Scaffold from the template.** Read `.claude/templates/README.md` (the module README template scaffolded by bluestep-init). Fill it in using inference from the code:

   - **Title (`# [Component displayName]`):** use `displayName` from `draft/info/metadata.json`.
   - **Type section:** use what you identified in step 4, plus the type-specific details listed in the template's commented hints (paths/methods for Endpoint, etc.).
   - **Overview:** read `draft/scripts/app.ts` (and for MergeReports, also `draft/static/index.html`). Write ONE paragraph describing what the component does at runtime, based on what you actually see in the code. Do NOT speculate beyond what is visible.
   - **Fields used:** scan `draft/scripts/**/*.ts` for patterns like `entry.<name>.val()`, `entry.<name>.set(...)`, `entry.<name>.selectedExportValue()`. List each unique `<name>` with access type (read = `.val()` / `.selectedExportValue()`; write = `.set(...)`). Leave FID and Form columns as `?` — those are only knowable from the platform.
   - **Behavior:** translate the structure of `app.ts` into 2-5 bullets ("Receives an HTTP GET at /audits, queries B.queries.activeAudits, returns JSON list", etc.).
   - **External dependencies:** scan for `B.net.fetch(...)` URLs, library imports beyond the platform globals, and any cross-component calls (e.g., `B.exports.something` or imports from `../OtherComponent/`).
   - **Edge cases / known gotchas:** leave empty with the literal text `_(no inferred gotchas — fill in if you find any)_`. These can only be known by humans.

c. **If you cannot infer the Overview with reasonable confidence** (e.g., `app.ts` only imports things and has no body, or the logic is too sparse to summarize) — STOP and ask the user:
   > I pulled `<ComponentName>` but cannot infer its purpose from the code alone. In one or two sentences, what does this component do? I will use your answer to scaffold `draft/README.md`.
   Then fill the Overview with the user's answer and continue.

d. **Write** the rendered README to `<Component>/draft/README.md`.

### 6. Report

Print a summary:

```
Pulled: U######/<ComponentName>/
Type:   <Endpoint|MergeReport|...>
README: <created from scaffold | preserved (already substantive)>

Next: read draft/README.md, then start editing. For a new feature use /spec-create.
```

## What this skill must NOT do

- Do NOT invoke `b6p` without `bash -lc` (or `wsl bash -lc` on Windows).
- Do NOT accept a display name as a substitute for the DAV URL.
- Do NOT overwrite a substantive `draft/README.md`.
- Do NOT speculate beyond what the code shows when filling Overview/Behavior — if uncertain, ask.
- Do NOT scaffold a SPEC.md anywhere — the SPEC concept lives only under `.claude/specs/<feature>/` for new work, never per component.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found: b6p`** — the CLI is not installed on this machine. Do NOT retry, do NOT try alternative invocations. Tell the user:
  > `b6p` is not installed. See the "Install the b6p CLI" section of this project's `README.md` for one-time setup. Once installed, retry `/b6p-pull <DAV URL>`.
- **Any other error** (network, auth, lock, etc.) — `b6p` is installed but the call failed. The VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Tell the user to use it via the editor UI rather than retrying the CLI in a loop.
