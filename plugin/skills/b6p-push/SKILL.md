---
name: b6p-push
description: Publish a BlueStep (B6P) component's local changes to the platform with the b6p CLI — make it live, deploy it, upload it, ship a fix — or save them as a draft only. Use whenever the user wants local edits of a component on the platform, even without the word "push" ("publish this", "make it live", "deploy my changes", "upload the fix", "put it on the platform"). It shows what changed, asks whether to publish or save a draft, and stops to ask before anything on the platform is overwritten or deleted.
allowed-tools: Bash(b6p:*) Bash(git:*) Bash(test -f *)
compatibility: Needs the b6p CLI 0.8.0 or later on PATH and a b6p access token stored with b6p auth set.
---

# /b6p-push — Publish a component to BlueStep

`b6p push --file <any file inside the component>` finds the destination from the sync metadata the CLI recorded when the component was pulled; it walks up from that file to the component root. `b6p` is a standalone binary on `PATH`, installed separately — invoke it as the bare `b6p`.

## Steps

Copy this checklist and tick it off as you go:

```
- [ ] 0. Preflight: CLI 0.8.0 or later, login stored, folder set up
- [ ] 1. Component identified
- [ ] 2. Diff scope shown
- [ ] 3. User chose Publish or Save draft only (and the description)
- [ ] 4. Push run with --yes --json
- [ ] 5. Result read from the exit code and --json; any question asked; reported
```

### 0. Preflight (before any other `b6p` call)

**CLI version.** Run `b6p --version`; it prints the bare version (e.g. `0.8.0`).

- **0.8.0 or later** → continue.
- **Older** → STOP. Do **not** run the push: on older versions `--yes` overwrites platform edits and deletes platform-only files without asking — the opposite of what steps 4 and 5 promise. Tell the user:
  > Your `b6p` CLI is <version>; this skill needs 0.8.0 or later. Update it — installed with npm: `npm i -g @bluestep-systems/b6p-cli@latest`; a downloaded binary: get the new one from https://github.com/Bluestep-Systems/b6p-cli/releases — then retry `/b6p-push <component>`.
- **Not a version number** (no output, an error, a wrapper's own text) → say so and ask the user which version they have before pushing; do not guess. `command not found` → see "If the CLI fails".

**Login.** With no access token stored in `~/.b6p/`, the push asks for one — a question you cannot answer, and `--yes` does not — and exits `1`. Check first: `test -f ~/.b6p/secrets.enc && echo OK`.

- Nothing printed → STOP, no push. Tell the user:
  > `b6p` has no BlueStep platform access token on this machine yet. Run `b6p auth set` once in your own terminal, then retry `/b6p-push <component>`.
- `OK` → continue. The file can exist without a token in it; then the push stops at `Enter your access token` (exit `1`) — relay it with the same `b6p auth set` instruction; do not retry.

**Setup preflight.** Look at the working directory's rules file. Any of these means the folder is not ready: no `AGENTS.md` at all; an `AGENTS.md` with **no** `<!-- bluestep-tools rules-template N -->` marker (a file from before the marker — version 1); a marker **below** the one in `${CLAUDE_PLUGIN_ROOT}/skills/b6p-setup/templates/AGENTS.md.template`; or a `CLAUDE.md` holding real rules with no `AGENTS.md` beside it. In that case **invoke the `/b6p-setup` skill** (through the Skill tool, so its own tool allowances apply — never re-implement it from memory; its file is `${CLAUDE_PLUGIN_ROOT}/skills/b6p-setup/SKILL.md`) for its step 2, then continue with this request. It performs what has one correct answer and asks only what a file with the user's own lines raises — an old rules file with project rules, a populated `CLAUDE.md`, a folder with no BlueStep signal — and those questions are asked before this request goes on. If `b6p` is missing or older than 0.8.0, or `$B6PT_TOKEN` is unset when a `[PLATFORM]` op needs it, run its step 1 first and hand over the commands only a person can run. Never drop the request: if the user would rather go on without setup, continue and say in the report that `/b6p-setup` is there when they want it. The one exception is the user answering "Not a BlueStep repo" or opting the plugin out — then this request ends with that answer, and say so.

### 1. Identify the component

If `$ARGUMENTS` contains a component path (relative to the project root), use it. Otherwise ask the user which component to push.

### 2. Pre-flight checks

- Run `git status` to surface what changed and flag anything unexpected.
- Summarise the diff scope in one line: "X files changed in `U######/<Component>/draft/`".
- Do not look for the sync metadata yourself: the CLI keeps it outside the component folder. Always run the step-4 `--file` command first — it finds the destination on its own — and use the `--root` fallback only when it answers `Missing metadata`.
- Know what the CLI checks, by content hash, never by date. Before uploading anything it asks **one question** listing every file whose platform copy changed since the last sync from here, or was never synced from this machine; new files and files equal to the platform copy never ask. After uploading it asks **one more** before deleting platform-only files under `draft/`. `--yes` (step 4) answers **Cancel** and **No**, so the push stops or keeps the files, and step 5 says what to do. When the platform may have moved since the pull (a days-old pull, a component others edit), suggest `/b6p-audit` first.

### 3. Choose how the change goes out (this also confirms the push)

**Publish** (`--snapshot --message`) compiles `scripts/` and any `static/` bundle in the CLI, updates the **live version** and records a restore point. **Save draft only** (plain push) uploads the source as-is: nothing compiles, the live version does not change — rarely what the user wants. Publish is the recommended default: pre-selected, never run without an explicit selection.

Most users are non-technical, so present the choice in **plain language — avoid the words "snapshot" and "push" in what they see.** Show the one-line diff scope from step 2, then ask **two** structured questions with clickable options (`AskUserQuestion` in Claude Code) — one at a time, never as a numbered list to answer by hand:

1. **"How should this change go out?"** — two options, plus an "Other" escape (`AskUserQuestion` adds "Other" automatically in Claude Code, so don't author a third option there; where the tool doesn't auto-add one, add it yourself):
   - `Publish — make it live (Recommended)` — "Compiles your code and updates the live version everyone sees, and saves a restore point you can roll back to." → `--snapshot --message`.
   - `Save draft only — not live yet` — "Uploads your work to the platform without compiling or making it live. Use only if you're not ready for it to go live." → plain push.

   Selecting an option is the confirmation to push; if the user cancels, do not push. "Other" is a free-text instruction: follow it rather than forcing it into the two options.
2. On **Publish**, a second question — **"Describe this change"** (it becomes the restore-point label):
   - `Use suggested description (Recommended)` — a concise plain-language summary you draft from the diff, put in the option label so the user sees what they're accepting.
   - `Let me write my own` — the user types it through the "Other" escape.

### 4. Run the push

**Publish:**

```
b6p --yes --json push --file "U######/<ComponentName>/draft/scripts/app.ts" --snapshot --message "<description>"
```

**Save draft only:**

```
b6p --yes --json push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Any existing file inside the component works for `--file`; `app.ts` is the usual one.

`--yes` is **required**: without it b6p may ask a question you cannot answer and exit `1`. It takes the **safe answer of every question** — **Cancel** to overwriting, **No** to deleting — and prints each one on stderr (`[Cancel] / Overwrite all: Cancel  (answered by --yes: …)`); those lines are not errors. An overwrite or a delete happens only through the command the CLI prints, on the user's yes (step 5). `--json` puts the result on stdout as one object — step 5's success test.

- **`Missing metadata`** from `--file` means the component was never pulled with the CLI: read `${CLAUDE_PLUGIN_ROOT}/skills/b6p-push/references/root-fallback.md` for the `--root` push. The step-3 choice still applies.
- **`Stale client bundle`** on a draft-only push: `draft/static/script.ts` is newer than its `.build/script.js`, and a plain push uploads the old client JS. Tell the user; a publish ships fresh client JS (the `bluestep-reference` skill's `conventions/single-script.md`).

### 5. Read the result and report

**The exit code and the `--json` object are the success signal, not the prose.** Exit `0` means it pushed; `1` means it did not do everything asked. The object always has seven fields — `pushed`, `historyRecorded`, `typeCheckDiagnostics`, `liveVerified`, `liveMismatches`, `keptPlatformOnly`, `declinedOverwrites` — except after a cancelled target-URL question: `{"cancelled": true}`, no `pushed` key. Questions, warnings and next steps are on stderr. Take the first row that matches:

| Exit | `--json` | What happened | What to do |
|---|---|---|---|
| `1` | `pushed: false`, files in `declinedOverwrites` | Stopped before uploading: those files changed on the platform | **Stop and ask**, below |
| `1` | `pushed: false`, `declinedOverwrites: []` | Nothing uploaded: the compiled entrypoint has no code (`Snapshot not published: … has no code`), a wrong `--root`, or an empty `draft/` | Fix the cause, re-run |
| `1` | `liveVerified: false`, files in `liveMismatches` | Uploaded, but those live copies are still missing or wrong after one re-send; no restore point | Say the live version may be broken; offer to re-run the publish (a clean re-push repairs it) |
| `1` | `historyRecorded: false` | Published without its restore point: no rollback | Say so; offer to re-run the publish |
| `1` | `typeCheckDiagnostics` above `0` | Live, but not type-clean; the CLI prints each diagnostic | Treat them as real: read `${CLAUDE_PLUGIN_ROOT}/skills/b6p-push/references/type-check-diagnostics.md` |
| `1` | stdout empty | A thrown failure (an upload refused, a question with no input); details on stderr | Read stderr; "If the CLI fails" |
| `0` | files in `keptPlatformOnly` | Pushed; platform-only files kept | Report done, then **Kept files**, below |
| `0` | `liveVerified: null` on a publish | Published; the platform served no content hash, so the live copy was not checked (`WARNING: Could not verify the live copy …`) | Say so; confirm which build is live (Report) |
| `0` | `{"cancelled": true}` | Target-URL question cancelled | Nothing pushed; say so |
| `0` | anything else | Pushed | Report, below |

On a draft-only push `typeCheckDiagnostics` and `liveVerified` are `null` (nothing compiles or goes live) — not a warning. No exit-`1` row is a CLI bug or a reason to switch tools.

**Stop and ask** (exit `1`, `declinedOverwrites` lists files). Nothing was uploaded. stderr ends with the files, the reason for each, and the command that overwrites them:

```
ERROR: Push stopped before uploading anything: 2 file(s) were not overwritten, because each would overwrite a platform version nobody here has seen:

README.md (changed on the platform since the last push or pull from here)
scripts/app.ts (changed on the platform since the last push or pull from here)

…
After checking them, overwrite them with your local files with:
  b6p --yes --json push --file draft/scripts/app.ts --overwrite README.md --overwrite scripts/app.ts
```

1. This is the push doing its job, not a failure: do not retry, do not switch tools.
2. Show the user the files and each reason: *changed on the platform since the last push or pull from here* means someone edited it there; *the platform has a different copy, never pulled or pushed from this machine* means this machine has no record to compare with (a fresh clone, a new machine).
3. Suggest `/b6p-audit` to see the differences, or `/b6p-pull` to take the platform copy. Do not run either unasked.
4. Ask one structured question, as in step 3 — **"These files changed on the platform since your last pull. What should happen?"**:
   - `Check them first (Recommended)` — "Nothing is uploaded. Look at the differences first, then push again."
   - `Overwrite them with my local files` — "Replaces the platform copy of every file listed with yours."
5. Only on *Overwrite*: run the printed command **exactly as printed** — same directory, nothing edited, added or removed; it repeats this push's arguments (publish choice and description included) plus one `--overwrite` per file. Read its result from the top of this step; if it stops on other files, the platform moved again — same flow. The CLI uploads all or nothing: if the user wants only some overwritten, the push waits until the rest are settled (pulled, merged or confirmed).

**Kept files** (exit `0`, `keptPlatformOnly` lists files). The push succeeded. stderr ends with the kept files and the command that deletes them:

```
WARNING: Kept 1 platform-only file(s): they are on the platform but not in your local draft folder, and deleting them was not confirmed.
…
To delete it from the platform, run the push again without --yes and answer Yes to the delete question:
  printf 'Yes\n' | b6p --json push --file draft/scripts/app.ts
```

1. Report the push as done, and list the kept files: on the platform but not in the local `draft/` — added there, or deleted here.
2. Ask one structured question — **"These files are on the platform but not in your copy. What should happen?"**:
   - `Keep them (Recommended)` — "Leaves them on the platform. Nothing changes."
   - `Pull them` — "Brings them into your local copy." → `/b6p-pull` for this component.
   - `Delete them from the platform` — "Removes them from the platform for good." On a publish, add: "This publishes once more, so your history gets a second restore point with the same description."
3. Only on *Delete*: run the printed command exactly as printed (under PowerShell it prints `'Yes' | b6p …`). If that run stops at an overwrite question (the platform moved in between), the piped `Yes` matches none of its answers, so nothing uploads: go back to **Stop and ask**.

**Report.**

- **Published** → say it is live, then confirm **which build is live** rather than assuming it: read `${CLAUDE_PLUGIN_ROOT}/skills/b6p-push/references/verify-live-build.md`. A `java.nio.file.NoSuchFileException: …/scripts/app` in a formula's ERR log means the script has no live build yet — publish it (step 3).
- **Saved a draft only** → say plainly it is **not live yet**; publishing makes it live.
- **A change does not show up** → check the push mode first, then `verify-live-build.md` — before theorising about caches, `config.json` or compilation.
- Remind the user to check the behaviour on the platform; if `draft/README.md` changed, the platform now has the updated docs.

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push with a `b6p` CLI older than 0.8.0 (step 0), and do NOT run the update yourself — hand it over.
- Do NOT push without showing the user the diff scope and getting an explicit selection for *this* push (step 3). Publish is recommended and pre-selected, never performed on its own — not on task completion, and `/spec-execute` offers no publish mid-task.
- Do NOT overwrite or delete anything on the platform without the user's yes for *this* push (step 5): no answer, or anything short of a clear yes, means no, and an earlier yes does not carry over.
- Do NOT edit the command the CLI printed or pipe answers into `b6p` yourself: run it exactly as printed, and never add an `--overwrite` for a file the user did not confirm.
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

- **`command not found`** — the b6p-cli binary is not installed or not on `PATH`. Do NOT retry; tell the user to install it (`/b6p-setup` hands over the command), then retry `/b6p-push <component>`.
- **Exit `1` from the push itself** (a stop at the overwrite question, nothing uploaded, a live copy still wrong, no restore point, type-check diagnostics) — **not** a CLI failure and **not** a reason to change tools: handle it by the step-5 table.
- **Exit `1` naming a question it could not answer** (`Enter your access token`, or any other) — **not** a tool failure: relay the message, tell the user to run `b6p auth set`, retry. It can happen even when the step-0 check printed `OK`; do **not** send them to the VS Code extension for it.
- **`outDir not specified`** (after `Build folder doesn't exist (this is fine)`) — a pulled `static/` sub-project with `"outDir": ""` in `draft/static/tsconfig.json`. Set it to `"."` (any non-empty value) and push again; it only satisfies the local build and does not change what deploys.
- **Any other error** (network, conflict, a real auth *rejection* by the platform) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.

**Never fall back to the platform's in-browser script/page editor** (`editScript.jsp`) to save the component: it bypasses `b6p`'s sync metadata and makes local and platform diverge, like a manual WebDAV upload (the `bluestep-reference` skill's `b6p-platform.md`, sync-failure fallbacks). The VS Code extension is the only equivalent fallback.
