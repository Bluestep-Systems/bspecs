---
name: b6p-push
description: Push local changes for a component back to the BlueStep platform. Use when the user is ready to deploy local edits.
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

### 3. Choose how the change goes out (this also confirms the push)

**What the two modes actually do** (verified live on bkplayground — a plain push skips the TypeScript build entirely; only a snapshot transpiles and ships the compiled `app.js`):

- **Publish** (`--snapshot --message`) — compiles the code, updates the **live** version, and records a restorable snapshot the user can roll back to.
- **Save draft only** (plain push) — uploads the draft source as-is; does **not** compile and does **not** change the live version. Rarely what the user wants.

Publishing is the recommended default — but **never** push without an explicit selection: it is *pre-marked*, never *pre-executed*.

Most users are non-technical, so present the choice in **plain language — avoid the words "snapshot" and "push" in what they see.** Show the one-line diff scope from step 2, then ask **two** structured questions with clickable options (`AskUserQuestion` in Claude Code) — one at a time, never as a numbered list to answer by hand:

1. **"How should this change go out?"** — two options, plus an "Other" escape (`AskUserQuestion` adds "Other" automatically in Claude Code, so don't author a third option there; where the tool doesn't auto-add one, add it yourself):
   - `Publish — make it live (Recommended)` — description: "Compiles your code and updates the live version everyone sees, and saves a restore point you can roll back to." → runs `--snapshot --message`.
   - `Save draft only — not live yet` — description: "Uploads your work to the server without compiling or making it live. Use only if you're not ready for it to go live." → plain push.

   Selecting an option is the confirmation to push; if the user cancels, do not push.
2. If the user chose **Publish**, a second prompt — **"Describe this change"** (it becomes the restore-point label) — with:
   - `Use suggested description (Recommended)` — pre-fill this with a concise plain-language summary you draft from the diff. Put the drafted text in the option label so the user sees what they're accepting.
   - `Let me write my own` — the user supplies the description as free text via the "Other" escape.

   If the user chose **Save draft only**, skip straight to step 4.

If the user picks "Other" on the first prompt, treat it as a free-text instruction rather than forcing it into the two options.

### 4. Run the push

**Publish** (the recommended default — when the user chose "Publish — make it live"):

```
b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts" --snapshot --message "<description>"
```

**Save draft only** (when the user chose "Save draft only"):

```
b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call will hang. Always include it.

> **Warning — stale client JS.** If you edited `draft/static/script.ts`, verify `draft/static/script.js` was regenerated/updated **before** pushing. `b6p push` does **not** transpile `static/script.ts` → `static/script.js`, so a push after editing only the `.ts` silently ships stale client JS. Keep the compiled `.js` in sync with the `.ts`. (Detail: the `bluestep-reference` `conventions/single-script.md` caveat.)

#### Fallback: a component that was never pulled via the CLI (`--root`)

`b6p push --file <path>` fails with `Missing metadata` when the component has **no local sync metadata** (it was never pulled through the CLI, so there is nothing to derive the destination URL from). Push it explicitly instead:

```
b6p --yes push <target-url> --root "U######/<ComponentName>" [--snapshot --message "<description>"]
```

- `--root` points at the component's **root** — the folder that *contains* `draft/`, **not** `draft/` itself. Pointing at `draft/` gives `Draft folder not found: .../draft/draft`.
- There is no local metadata to derive `<target-url>` from, so source it from the org's platform MCP: `lookup_script_by_name` → use the returned `webDavUrl`. (Only when connected; otherwise ask the user for the WebDAV URL.)
- The choice from step 3 **still applies** — carry `--snapshot --message "<description>"` if the user chose Publish (the recommended default). Do **not** trial-and-error the argument shape: guessing can land on a plain draft-only push that never compiles or goes live, defeating the user's explicit choice.

### 5. Report

- **Publish** runs the TypeScript build and ships the compiled output — surface any compile diagnostics the CLI reports. **Save draft only** does not compile at all. Exception: `Cannot find name`/`never` walls about a third-party client-side global are advisory-only, not a failed push — detail: the `bluestep-reference` skill's `gotchas/third-party-lib-type-noise.md`.
- If the user **published**, confirm the live version was updated and a restore point recorded (with the description used). If they **saved a draft only**, tell them plainly it is **not live yet** — they must publish to make it live.
- Remind the user to verify behaviour on the platform itself.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push without showing the user the diff and getting an explicit selection (step 3). Publish is *recommended and pre-selected*, never performed automatically.
- Do NOT publish silently or automatically. Recommending it is not the same as doing it: the push happens only on the user's explicit selection for *this* push — this skill never publishes on its own (e.g. it does not auto-publish on task completion, and `/spec-execute` offers no publish mid-task).
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Two distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-push <component>`.
- **Any other error** (network, auth, conflict, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.

### Gotcha: empty `outDir` in a `static/` sub-project aborts the push

A fresh `b6p pull` of a component with a `static/` bundle can leave `draft/static/tsconfig.json` with `"outDir": ""` (an empty string). A later push then aborts in the local pre-push build of the `static/` sub-project with a bare, unhelpful error such as:

```
Build folder doesn't exist (this is fine)
outDir not specified
```

**Workaround:** set `draft/static/tsconfig.json` `"outDir"` to `"."` (any non-empty value works), then push again. This is a local build-tool satisfier only — it does **not** affect what deploys. (The real fix is tracked upstream in the b6p CLI; treat this as a temporary gotcha.)
