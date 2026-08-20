---
name: b6p-pull
description: Pull a B6P component from the BlueStep platform into the local workspace using its DAV URL, and scaffold draft/README.md if missing. Use when the user wants to bring a component down for the first time or re-sync after platform edits.
allowed-tools: Bash(b6p:*) Bash(test -f *)
---

# /b6p-pull — Pull a component from BlueStep

## How `b6p pull` actually works

`b6p pull` takes a **DAV URL** as its primary argument, NOT a display name:

```
b6p pull [options] <formula-url>
```

The user copies the DAV URL from the component's page in the BlueStep platform UI. You cannot discover or infer it. There is no fallback that takes a name.

A first pull creates the `U######/<ComponentName>/` folder (creating the U-folder if it does not exist), populates `declarations/` and `draft/`, and records the component's sync metadata.

Two re-pull behaviors to know (verified 2026-08):

- **A re-pull never renames the local folder.** If the component was renamed on the platform, the CLI keeps pulling into the folder it first created — don't read the folder name as the component's current display name; `draft/info/metadata.json` (when present) or the platform is authoritative.
- **A re-pull overwrites the local `draft/README.md` with the platform's copy** — see the ephemerality warning in step 5.

## How to invoke `b6p`

`b6p` is a standalone binary on the system `PATH` (the b6p-cli standalone artifact, installed separately from bspecs). Invoke it directly:

```
b6p <args>
```

If `b6p` is not found, the user has not installed the b6p-cli binary yet — point them at its release/install instructions.

## Steps

### 0. Auth preflight (do this first, before any `b6p` call)

`b6p` stores BlueStep platform credentials globally in `~/.b6p/`. On a machine that has never run `b6p auth set`, the first `pull` prompts for credentials **interactively** — a prompt you (Claude) cannot answer, so the call hangs silently. `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-credentials* one.

Before running the pull, check that credentials exist:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints `OK` → credentials are set, continue.
- If it prints nothing (file absent) → STOP. Do **not** run the pull. Tell the user:
  > `b6p` has no BlueStep platform credentials on this machine yet, so the pull would hang on an interactive prompt I can't answer. Run `b6p auth set` once (it stores credentials globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-pull <DAV URL>`.

### 1. Get the DAV URL

- If `$ARGUMENTS` looks like a URL (starts with `http://` or `https://`), use it.
- If `$ARGUMENTS` is empty or looks like a display name (no scheme), STOP and ask the user:
  > I need the **DAV URL** of the component, not its name. Copy it from the component's page in the BlueStep platform UI and paste it here.
- Do NOT guess the URL. Do NOT try to derive it from another component's recorded metadata.

### 2. Run the pull

```
b6p --yes pull "<DAV URL>"
```

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call will hang. Always include it.

Capture the output — it prints the local path where the component landed.

### 3. Locate the component folder

Parse the CLI output, or scan for the most recently modified `U######/<Name>/` directory under the project root. Confirm:

- `declarations/` is populated
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

b. **Scaffold from the template.** Read `component-readme-template.md` (the module README skeleton bundled alongside this skill, in the same directory as this `SKILL.md`). Fill it in using inference from the code:

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

e. **Warn that the scaffolded README is ephemeral until pushed.** The CLI overwrites the local `draft/README.md` with the platform's copy on **every** pull — the do-not-overwrite rule below binds this skill, not the CLI underneath it. A freshly scaffolded README must therefore be **pushed before the next pull**, or that pull silently reverts it to the platform stub. Say this in the step-6 report whenever the README was just scaffolded. (The silent overwrite is tracked upstream as a b6p-cli bug.)

### 6. Report

Print a summary:

```
Pulled: U######/<ComponentName>/
Type:   <Endpoint|MergeReport|...>
README: <created from scaffold — push it before the next pull, or the CLI reverts it to the platform copy | preserved (already substantive)>

Next: read draft/README.md, then start editing. For a new feature use /spec-create.
```

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT accept a display name as a substitute for the DAV URL.
- Do NOT overwrite a substantive `draft/README.md`.
- Do NOT speculate beyond what the code shows when filling Overview/Behavior — if uncertain, ask.
- Do NOT scaffold a SPEC.md anywhere — the SPEC concept lives only under `.claude/specs/<feature>/` for new work, never per component.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry, do NOT try alternative invocations. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-pull <DAV URL>`.
- **Any other error** (network, auth, lock, etc.) — `b6p` ran but the call failed. The VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Tell the user to use it via the editor UI rather than retrying the CLI in a loop.
