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

`b6p` stores a BlueStep platform **access token** globally in `~/.b6p/` (since b6p-cli 0.6.0 / core 0.5.0 — bearer auth replaced the old username + password, with **no** migration path, so every pre-0.6.0 user is re-prompted once). Without a stored token the first `push` prompts for one **interactively** — a prompt you (Claude) cannot answer. The CLI now **fails loudly**: it names the prompt it could not answer and exits `1`. (Before 0.6.0 it hung, then drained and exited `0` having done nothing — so an old "it succeeded" is not evidence the push happened.) `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-token* one.

Before running the push, check for the secrets store:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints nothing (file absent) → STOP. Do **not** run the push. Tell the user:
  > `b6p` has no BlueStep platform access token on this machine yet, so the push would stop at an interactive prompt I can't answer. Run `b6p auth set` once (it stores the token globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-push <component>`.
- If it prints `OK` → continue, but treat this as a **negative check only**. `secrets.enc` holds every secret under its own key, so a machine that authenticated before 0.6.0 has the file *without* an access token in it — the preflight passes and the push still stops at `Enter your access token` and exits `1`. That failure is self-describing: surface it verbatim and give the user the same `b6p auth set` instruction rather than retrying.

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

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call fails with exit `1` naming that prompt. Always include it.

> **Warning — stale client JS.** If you edited `draft/static/script.ts`, verify `draft/static/script.js` was regenerated/updated **before** pushing. `b6p push` does **not** transpile `static/script.ts` → `static/script.js`, so a push after editing only the `.ts` silently ships stale client JS. Keep the compiled `.js` in sync with the `.ts`. (Detail: the `bluestep-reference` `conventions/single-script.md` caveat.)

> **Warning — never-published script.** On a script that has **never been published**, `b6p push --snapshot` reports "Snapshot complete!" but creates **no live version** — every execution then throws `java.nio.file.NoSuchFileException: …/scripts/app` (that ERR-log path, via the gateway MCP's `read_script_log`, is the detection signature). The first publish must be done **once in the platform script editor** ("Snapshot Project"); after that, `--snapshot` pushes work normally. Previously-published scripts are unaffected. Tracked as a b6p-cli bug — until it's fixed, treat a first-ever publish as a UI step. (verified 2026-08)

#### Fallback: a component that was never pulled via the CLI (`--root`)

`b6p push --file <path>` fails with `Missing metadata` when the component has **no local sync metadata** (it was never pulled through the CLI, so there is nothing to derive the destination URL from). Push it explicitly instead:

```
b6p --yes push <target-url> --root "U######/<ComponentName>" [--snapshot --message "<description>"]
```

- `--root` points at the component's **root** — the folder that *contains* `draft/`, **not** `draft/` itself. Pointing at `draft/` gives `Draft folder not found: .../draft/draft`.
- There is no local metadata to derive `<target-url>` from, so source it from the org's platform MCP: `lookup_script_by_name` → use the returned `webDavUrl`. (Only when connected; otherwise ask the user for the WebDAV URL.)
- The choice from step 3 **still applies** — carry `--snapshot --message "<description>"` if the user chose Publish (the recommended default). Do **not** trial-and-error the argument shape: guessing can land on a plain draft-only push that never compiles or goes live, defeating the user's explicit choice.

### 5. Report

**Check the exit code first — it is now load-bearing.** Since b6p-cli 0.6.0 `b6p push` exits `1` when it did not do what was asked, so a zero exit is what confirms the upload happened. Two distinct non-zero cases, neither of which is a CLI malfunction:

- **Nothing was uploaded** (`pushed: false`) — the push found no draft to send. In practice that is a wrong `--root` (see the fallback above) or an empty `draft/`. Before 0.6.0 this printed a success line and exited `0`, so a typo could mark a CI deploy green. Fix the path or the draft and re-run; do **not** fall back to another tool for this.
- **A snapshot shipped without its history entry** (`historyRecorded: false`) — the code *is* uploaded but the restore point was not recorded, so the user has no rollback for this version. Say so plainly and offer to re-run the publish.

`b6p --json push …` prints core's `PushResult` — `{"pushed": true, "historyRecorded": true}` — which tells you which of the two it was without parsing prose. Reach for it when the exit code is non-zero and the message is ambiguous. One shape to expect: if the user cancelled at a target-URL prompt the CLI prints `{"cancelled": true}` and exits `0` — there is no `pushed` key at all, so test for it rather than assuming it is false.

- **Publish** runs the TypeScript build and ships the compiled output — surface any compile diagnostics the CLI reports. **Save draft only** does not compile at all.
- **Reading the diagnostics — benign wall vs. real error.** The CLI transpiles `scripts/app.ts` in isolation, **without** the component's `declarations/`. So a wall of `Cannot find name` errors on **platform globals or imported query/field names** (`B`, your query-group consts, …) means nothing was actually type-checked — the emit still succeeded and the push went through. A **real** error names one of **your own** symbols (a variable or function defined in your source). Three follow-ups:
  - **Mitigation:** add `/// <reference path='../../declarations/index.d.ts' />` at the top of `scripts/app.ts` — the transpile can then resolve the platform names, and the same push reports a clean compilation.
  - **Re-pushing does not clear the noise.** The wall is deterministic — pushing again prints the same errors; only the reference directive above removes them.
  - **Don't conflate the two `Cannot find name` causes.** A stray unescaped backtick inside a `B.out` template literal *also* cascades into bogus `Cannot find name` diagnostics — but those anchor at or after the literal and hit your own symbols too, and the shipped `app.js` is genuinely broken. Rule that out first: the `bluestep-reference` skill's `conventions/ts-in-template-literal.md`. (Walls about third-party client-side globals are a third, benign case: `gotchas/third-party-lib-type-noise.md`.)
- If the user **published**, confirm the live version was updated — **concretely, which build is live**, not by assumption: the new snapshot sits at the top of the component's version / restore-point history with the description just used; for a BSJS formula you can also confirm the running build via the gateway MCP's `read_script_log` — its `console.log` output identifies the build. (`read_script_draft` only confirms the platform received the draft source — a draft is decoupled from the live version, so it can never confirm what is live.) Inner tools are reached through `invoke_org_tool` — see the `bluestep-reference` skill's `conventions/mcp-platform-authoring.md`. If they **saved a draft only**, tell them plainly it is **not live yet** — they must publish to make it live.
- **A stale page render can impersonate a failed publish** (verified 2026-08; distinct from the stale-client-JS warning in step 4). A formula's own on-page output — a message/modal it writes, rendered field output — can be served from a cached, stale page render, so a fully-successful publish can look like the old version is still running. Hard-refresh and **re-trigger** (re-save the record) before doubting the deploy; do **not** re-push or roll back on an unchanged-looking page alone. Run the which-build check above instead.
- Remind the user to verify behaviour on the platform itself.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push without showing the user the diff and getting an explicit selection (step 3). Publish is *recommended and pre-selected*, never performed automatically.
- Do NOT publish silently or automatically. Recommending it is not the same as doing it: the push happens only on the user's explicit selection for *this* push — this skill never publishes on its own (e.g. it does not auto-publish on task completion, and `/spec-execute` offers no publish mid-task).
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Three distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-push <component>`.
- **Exit `1` from the push itself** (`pushed: false` / `historyRecorded: false`) — **not** a CLI failure and **not** a reason to change tools. The CLI ran correctly and is telling you the push did not do what was asked; handle it as step 5 describes (fix the `--root` or the empty draft, or re-run the publish to record the missing restore point).
- **Exit `1` naming a prompt it could not answer** (`Enter your access token`, or any other prompt) — **not** a tool failure. Same handling as above: relay the message, tell the user to run `b6p auth set`, retry. This is the standard post-0.6.0 upgrade path even when the step-0 preflight printed `OK`, so do **not** send them to the VS Code extension for it.
- **Any other error** (network, conflict, a real auth *rejection* by the platform, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.

**Never fall back to the platform's in-browser script/page editor** (`editScript.jsp`) to save the component. It bypasses `b6p`'s recorded sync metadata and diverges local vs platform — the same hazard class as a manual WebDAV upload (see the sync-failure fallbacks in the `bluestep-reference` skill's `b6p-platform.md`). The VS Code extension is the only equivalent fallback. (The one exception is the one-time first-publish "Snapshot Project" step from the step-4 never-published warning — that publishes the already-pushed draft; it does not edit or save source through the editor.)

### Gotcha: empty `outDir` in a `static/` sub-project aborts the push

A fresh `b6p pull` of a component with a `static/` bundle can leave `draft/static/tsconfig.json` with `"outDir": ""` (an empty string). A later push then aborts in the local pre-push build of the `static/` sub-project with a bare, unhelpful error such as:

```
Build folder doesn't exist (this is fine)
outDir not specified
```

**Workaround:** set `draft/static/tsconfig.json` `"outDir"` to `"."` (any non-empty value works), then push again. This is a local build-tool satisfier only — it does **not** affect what deploys. (The real fix is tracked upstream in the b6p CLI; treat this as a temporary gotcha.)
