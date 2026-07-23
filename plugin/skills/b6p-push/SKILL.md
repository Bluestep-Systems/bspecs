---
name: b6p-push
description: Push local changes for a component back to the BlueStep platform. Use when the user is ready to deploy local edits.
allowed-tools: Bash(b6p:*) Bash(git:*) Bash(test -f *)
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

### 3. Choose the push mode (this also confirms the push)

**Snapshot is the recommended default.** A **snapshot** (`--snapshot --message`) records a restorable, versioned server-side history entry; a **plain push** overwrites the draft with no history. Recommend the snapshot — but **never** push without an explicit selection: snapshot is *pre-marked*, never *pre-executed*.

Show the one-line diff scope from step 2, then use **two** `AskUserQuestion` prompts:

1. **"Push mode?"** — options `Snapshot (Recommended)` and `Push Only`. (AskUserQuestion auto-adds an "Other" choice, so don't author a third.) Selecting an option is the confirmation to push; if the user cancels, do not push.
2. If the user chose **Snapshot**, a second prompt — **"Snapshot message?"** — with:
   - `Use recommended title (Recommended)` — pre-fill this with a concise commit-style one-liner you draft from the diff (imperative, scoped, reusing the repo's commit-message habit). Put the drafted title in the option label so the user sees what they're accepting.
   - `Let me write my own` — the user supplies the message as free text via the auto-added "Other" choice.

   If the user chose **Push Only**, skip straight to step 4.

If the user picks "Other" on push mode, treat it as a free-text instruction (e.g. "just plain push") rather than forcing it into the two canned options.

### 4. Run the push

**Snapshot push** (the recommended default — when the user chose Snapshot in step 3):

```
b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts" --snapshot --message "<summary>"
```

**Plain push** (when the user chose Push Only):

```
b6p --yes push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call will hang. Always include it.

> **Warning — stale client JS.** If you edited `draft/static/script.ts`, verify `draft/static/script.js` was regenerated/updated **before** pushing. `b6p push` does **not** transpile `static/script.ts` → `static/script.js`, so a push after editing only the `.ts` silently ships stale client JS. Keep the compiled `.js` in sync with the `.ts`. (Detail: the `bluestep-reference` `conventions/single-script.md` caveat.)

#### Fallback: a component that was never pulled via the CLI (`--root`)

`b6p push --file <path>` fails with `Missing metadata` when the component has **no local sync metadata** (it was never pulled through the CLI, so there is nothing to derive the destination URL from). Push it explicitly instead:

```
b6p --yes push <target-url> --root "U######/<ComponentName>" [--snapshot --message "<summary>"]
```

- `--root` points at the component's **root** — the folder that *contains* `draft/`, **not** `draft/` itself. Pointing at `draft/` gives `Draft folder not found: .../draft/draft`.
- There is no local metadata to derive `<target-url>` from, so source it from the org's platform MCP: `lookup_script_by_name` → use the returned `webDavUrl`. (Only when connected; otherwise ask the user for the WebDAV URL.)
- The push-mode choice from step 3 **still applies** — carry `--snapshot --message "<summary>"` if the user chose Snapshot (the recommended default). Do **not** trial-and-error the argument shape: guessing can land on a plain push with **no** snapshot, defeating the user's explicit choice.

### 5. Report

- The platform compiles after receiving the push. Surface any compile errors the CLI reports.
- If the push was a **snapshot**, confirm that a versioned history entry was recorded (with the message used) — otherwise note that no server-side history was recorded.
- Remind the user to verify behaviour on the platform itself — there is no local compile to fall back on.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push without showing the user the diff and getting an explicit push-mode selection (step 3). Snapshot is *recommended and pre-selected*, never pushed automatically.
- Do NOT snapshot silently or automatically. Recommending a snapshot is not the same as performing one: the push happens only on the user's explicit selection for *this* push — this skill never turns pushes into snapshots on its own (e.g. it does not auto-snapshot on task completion, and `/spec-execute` offers no snapshot mid-task).
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
