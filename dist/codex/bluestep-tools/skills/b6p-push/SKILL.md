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

### 0. Preflight (do this first, before any other `b6p` call)

**CLI version.** Run `b6p --version`; it prints the bare version (e.g. `0.8.0`).

- **0.8.0 or later** → continue.
- **Older** → STOP. Do **not** run the push: on older versions `--yes` overwrites platform edits and deletes platform-only files without asking — the opposite of what steps 4 and 5 promise. Tell the user:
  > Your `b6p` CLI is version <version>; this skill needs 0.8.0 or later, which stops and asks before anything on the platform is overwritten or deleted. Update it — if you installed it with npm: `npm i -g @bluestep-systems/b6p-cli@latest`; if you downloaded the binary: get the new one from https://github.com/Bluestep-Systems/b6p-cli/releases — then retry `/b6p-push <component>`.
- **Not a version number** (no output, an error, a wrapper's own text) → say so and ask the user which version they have before pushing; do not guess. `command not found` → see "If the CLI fails".

**Login.** `b6p` stores a BlueStep platform **access token** globally in `~/.b6p/` (since b6p-cli 0.6.0 / core 0.5.0 — bearer auth replaced the old username + password, with **no** migration path, so every pre-0.6.0 user is re-prompted once). Without a stored token the first `push` prompts for one **interactively** — a prompt you (Claude) cannot answer. The CLI now **fails loudly**: it names the prompt it could not answer and exits `1`. (Before 0.6.0 it hung, then drained and exited `0` having done nothing — so an old "it succeeded" is not evidence the push happened.) `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-token* one.

Before running the push, check for the secrets store:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints nothing (file absent) → STOP. Do **not** run the push. Tell the user:
  > `b6p` has no BlueStep platform access token on this machine yet, so the push would stop at an interactive prompt I can't answer. Run `b6p auth set` once (it stores the token globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-push <component>`.
- If it prints `OK` → continue, but treat this as a **negative check only**. `secrets.enc` holds every secret under its own key, so a machine that authenticated before 0.6.0 has the file *without* an access token in it — the preflight passes and the push still stops at `Enter your access token` and exits `1`. That failure is self-describing: surface it verbatim and give the user the same `b6p auth set` instruction rather than retrying.

**Setup preflight.** Look at the working directory's rules file. Any of these means the folder is not ready: no `AGENTS.md` at all; an `AGENTS.md` with **no** `<!-- bluestep-tools rules-template N -->` marker (a file from before the marker — version 1); a marker **below** the one in `../b6p-setup/templates/AGENTS.md.template` (relative to this file); or a `CLAUDE.md` holding real rules with no `AGENTS.md` beside it. In that case **invoke the `/b6p-setup` skill** (through the Skill tool, so its own tool allowances apply — never re-implement it from memory; its file is `../b6p-setup/SKILL.md`) for its step 2, then continue with this request. It performs what has one correct answer and asks only what a file with the user's own lines raises — an old rules file with project rules, a populated `CLAUDE.md`, a folder with no BlueStep signal — and those questions are asked before this request goes on. If `b6p` is missing or older than 0.8.0, or `$B6PT_TOKEN` is unset when a `[PLATFORM]` op needs it, run its step 1 first and hand over the commands only a person can run. Never drop the request: if the user would rather go on without setup, continue and say in the report that `/b6p-setup` is there when they want it. The one exception is the user answering "Not a BlueStep repo" or opting the plugin out — then this request ends with that answer, and say so.

### 1. Identify the component

If `$ARGUMENTS` contains a component path (relative to the project root), use it. Otherwise ask the user which component to push.

### 2. Pre-flight checks

- Run `git status` to surface what changed and flag anything unexpected.
- Briefly summarise the diff scope: "X files changed in `U######/<Component>/draft/`".
- Confirm the component was pulled with `b6p` (so its sync metadata is recorded) — `--file` resolves the destination URL from that metadata. If the component was never pulled here, pull it first.
- Know what the CLI itself checks. Push compares each file's content with the platform copy — content hashes, never dates — and asks **one question before it uploads anything**, listing every file that would overwrite a platform version nobody here has seen, each with its reason: `changed on the platform since the last push or pull from here`, or `the platform has a different copy, never pulled or pushed from this machine`. A new file (not on the platform yet), a file equal to the platform copy, files inside a snapshot version and compiled build-folder output never ask. After uploading, it asks **one more question** before deleting platform-only files under `draft/` (on the platform, not in the local draft). The `--yes` this skill passes (step 4) takes the safe answer of both — **Cancel** and **No** — so a push never overwrites or deletes a platform file on its own: it stops, or keeps the files, and step 5 says what to do next. When the platform may have moved since the pull (a days-old pull, a component others edit), suggest `/b6p-audit` first, so the user sees the differences before the push stops on them.

### 3. Choose how the change goes out (this also confirms the push)

**What the two modes actually do** (the build runs in the b6p CLI on your machine — a plain push compiles nothing; only a snapshot transpiles `scripts/` and any `static/` bundle before upload and ships the emitted JS alongside the source):

- **Publish** (`--snapshot --message`) — compiles the code, updates the **live** version, and records a restorable snapshot the user can roll back to.
- **Save draft only** (plain push) — uploads the draft source as-is; does **not** compile and does **not** change the live version. Rarely what the user wants.

Publishing is the recommended default — but **never** push without an explicit selection: it is *pre-selected*, never run on its own.

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
b6p --yes --json push --file "U######/<ComponentName>/draft/scripts/app.ts" --snapshot --message "<description>"
```

**Save draft only** (when the user chose "Save draft only"):

```
b6p --yes --json push --file "U######/<ComponentName>/draft/scripts/app.ts"
```

Use any existing file inside the component for `--file`; `app.ts` is the most common entry point.

The `--yes` is **required** — without it, b6p may ask a question you cannot answer, and the call fails with exit `1` naming that question. Always include it — and know what it answers. `--yes` takes the **safe answer of every question** — **Cancel** to overwriting platform files that changed, **No** to deleting platform-only files — and prints each question it answered, with the answer, on stderr (`[Cancel] / Overwrite all: Cancel  (answered by --yes: the safe choice; --yes never confirms an overwrite or a delete)`); those lines are not errors. So a push never overwrites or deletes a platform file on its own: the CLI prints the command that would, and step 5 says when to run it. `--json` puts the result on stdout as one object — the success test in step 5.

> **Warning — stale client JS on a draft-only push.** `b6p push --snapshot` compiles `draft/static/script.ts` → `draft/static/.build/script.js` in the CLI before uploading (b6p-cli 0.6+, verified 2026-09 on two orgs), so a publish always ships fresh client JS. A **plain** push compiles nothing: if the `.ts` is newer than its `.build` output the CLI prints a `Stale client bundle` warning and uploads as-is, so a draft-only push after editing only the `.ts` leaves the old client JS in place. Publish, or accept that the draft's client code is stale until you do. (Detail: the `bluestep-reference` `conventions/single-script.md` caveat.)

#### Fallback: a component that was never pulled via the CLI (`--root`)

`b6p push --file <path>` fails with `Missing metadata` when the component has **no local sync metadata** (it was never pulled through the CLI, so there is nothing to derive the destination URL from). Push it explicitly instead:

```
b6p --yes --json push <target-url> --root "U######/<ComponentName>" [--snapshot --message "<description>"]
```

- `--root` points at the component's **root** — the folder that *contains* `draft/`, **not** `draft/` itself. Pointing at `draft/` gives `Draft folder not found: .../draft/draft`.
- There is no local metadata to derive `<target-url>` from, so source it from the org's platform MCP: `lookup_script_by_name` → use the returned `webDavUrl`. (Only when connected; otherwise ask the user for the WebDAV URL.)
- The choice from step 3 **still applies** — carry `--snapshot --message "<description>"` if the user chose Publish (the recommended default). Do **not** trial-and-error the argument shape: guessing can land on a plain draft-only push that never compiles or goes live, defeating the user's explicit choice.

### 5. Read the result and report

**Read the exit code and the `--json` object first — they are the success signal, not the prose.** `b6p push` exits `0` when it pushed and `1` when it did not do everything that was asked. The object has the same seven fields on every push — `pushed`, `historyRecorded`, `typeCheckDiagnostics`, `liveVerified`, `liveMismatches`, `keptPlatformOnly`, `declinedOverwrites` — except after a cancelled target-URL question, which prints `{"cancelled": true}` with no `pushed` key (test for the key rather than assuming it is false). Questions, warnings and next steps are on stderr. Take the first row that matches:

| Exit | `--json` | What happened | What to do |
|---|---|---|---|
| `1` | `pushed: false`, files in `declinedOverwrites` | Stopped before uploading anything: those files changed on the platform | **Stop and ask**, below |
| `1` | `pushed: false`, `declinedOverwrites: []` | Nothing uploaded: the compiled entrypoint has no code (`Snapshot not published: the compiled entrypoint … has no code`), a wrong `--root` (see the fallback above), or an empty `draft/` | Fix the cause, then re-run |
| `1` | `liveVerified: false`, files in `liveMismatches` | Uploaded, but the live copy of those files is still missing or wrong after one re-send, and no restore point was recorded | Say the live version may be broken; offer to re-run the publish — a clean re-push repairs it even with no local change |
| `1` | `historyRecorded: false`, `liveVerified` not `false` | Published without its restore point: no rollback for this version | Say so plainly; offer to re-run the publish |
| `1` | `typeCheckDiagnostics` above `0` | Live, but it went out without passing type-check; the CLI prints each diagnostic | Treat them as real — "Reading the diagnostics" below |
| `1` | stdout empty | A thrown failure (an upload refused, a question with no input); the details are on stderr, ending `Push stopped: the error above has the details.` | Read stderr; see "If the CLI fails" |
| `0` | files in `keptPlatformOnly` | Pushed; platform-only files were kept | Report the push as done, then **Kept files**, below |
| `0` | `liveVerified: null` on a publish | Published, but the platform served no content hash, so the live copy could not be checked (`WARNING: Could not verify the live copy …`) | Say it could not be verified; run the which-build check below |
| `0` | `{"cancelled": true}` | The target-URL question was cancelled | Nothing was pushed; say so |
| `0` | anything else | Pushed | Report, below |

`typeCheckDiagnostics` and `liveVerified` are both `null` on a draft-only push (nothing compiles, nothing live to check) — not a warning there; `typeCheckDiagnostics` is `0` on a clean publish. None of the exit-`1` rows is a CLI bug or a reason to switch tools.

**Stop and ask** (exit `1`, `declinedOverwrites` lists files). Nothing was uploaded. stderr ends with the files, the reason for each, and the command that overwrites them:

```
ERROR: Push stopped before uploading anything: 2 file(s) were not overwritten, because each would overwrite a platform version nobody here has seen:

README.md (changed on the platform since the last push or pull from here)
scripts/app.ts (changed on the platform since the last push or pull from here)

Pull or audit them to see the platform versions before overwriting them.
After checking them, overwrite them with your local files with:
  b6p --yes --json push --file draft/scripts/app.ts --overwrite README.md --overwrite scripts/app.ts
```

1. This is the push doing its job, not a failure: do not retry, and do not switch tools.
2. Show the user the listed files with the reason for each. *Changed on the platform since the last push or pull from here* means someone edited it there; *the platform has a different copy, never pulled or pushed from this machine* means this machine has no record to compare with (a fresh clone or a new machine).
3. Suggest `/b6p-audit` to see the differences, or `/b6p-pull` to take the platform copy. Do not run either unasked.
4. Ask one structured question, the same way as step 3 — **"These files changed on the platform since your last pull. What should happen?"**:
   - `Check them first (Recommended)` — "Nothing is uploaded. Look at the differences first, then push again."
   - `Overwrite them with my local files` — "Replaces the platform copy of every file listed with yours."
5. Only on *Overwrite*: run the printed command **exactly as printed** — same working directory, nothing edited, added or removed. It repeats this push's own arguments (the publish choice and description included) with one `--overwrite` per file. Then read its result from the top of this step. If it stops again naming other files, the platform moved again: same flow. If the user wants only some of the files overwritten, say the push cannot go out until the rest are settled (pulled, merged, or confirmed) — the CLI uploads all or nothing.

**Kept files** (exit `0`, `keptPlatformOnly` lists files). The push succeeded. stderr ends with the kept files and the command that deletes them:

```
WARNING: Kept 1 platform-only file(s): they are on the platform but not in your local draft folder, and deleting them was not confirmed.
…
To delete it from the platform, run the push again without --yes and answer Yes to the delete question:
  printf 'Yes\n' | b6p --json push --file draft/scripts/app.ts
```

1. Report the push as done.
2. List the kept files: they are on the platform but not in the local `draft/` — someone added them there, or they were deleted here.
3. Ask one structured question — **"These files are on the platform but not in your copy. What should happen?"**:
   - `Keep them (Recommended)` — "Leaves them on the platform. Nothing changes."
   - `Pull them` — "Brings them into your local copy." → `/b6p-pull` for this component.
   - `Delete them from the platform` — "Removes them from the platform for good." On a publish, add: "This publishes once more, so your history gets a second restore point with the same description."
4. Only on *Delete*: run the printed command exactly as printed (under PowerShell the CLI prints `'Yes' | b6p …` instead — run what it printed). If that run stops at an overwrite question instead (the platform moved in between), the piped `Yes` is not one of its answers, so it declines and uploads nothing: go back to **Stop and ask**.

**Report.**

- **Publish** runs the TypeScript build in the CLI and uploads the compiled output with the source. The build type-checks `scripts/app.ts` **with** the component's `declarations/` wired in, so it is a real type-check, not a syntax pass. **Save draft only** does not compile at all.
- **Reading the diagnostics.** A correctly-pulled component reports **zero**. A `Cannot find name` on a **platform global or imported query/field name** (`B`, your query-group consts, …) now means the declaration is genuinely missing — the `declarations/` were not pulled, or the name was never imported into *this* component (rule 8: never fabricate references). Fix it by re-pulling the component, or adding the import on the platform and pulling again — **not** by adding a `/// <reference … />` directive (obsolete now: the build wires declarations in for you). A `Cannot find name` on **one of your own** symbols is an ordinary type error in your source; fix it.
  - **A stray unescaped backtick** inside a `B.out` template literal also cascades into bogus `Cannot find name` diagnostics and produces genuinely broken `app.js` — rule it out via the `bluestep-reference` skill's `conventions/ts-in-template-literal.md`.
  - **Client-bundle noise is separate and does NOT fail the push.** A MergeReport `static/` bundle can reference browser-only third-party globals it declares nowhere (GridStack, Swal); those print as **advisory** diagnostics (visible with `--verbose`) and are excluded from `typeCheckDiagnostics`, so they never fail the push and do not mean anything is wrong. See the `bluestep-reference` skill's `gotchas/third-party-lib-type-noise.md`.
  - **Re-pushing does not clear real diagnostics** — they are deterministic; fix the cause.
- **The trap that makes a plain push expensive.** After a draft-only push the platform genuinely *has* the new code — as a draft — while the page keeps serving the previously published build. `read_script_draft` reads the draft, so it confirms the change is on the platform while the live version is still the old one; both readings are true at once. When a change does not show up, check the push mode first, before theorising about caches, `config.json`, or compilation.
- If the user **published**, confirm the live version was updated — **concretely, which build is live**, not by assumption: the new snapshot sits at the top of the component's version / restore-point history with the description just used; for a BSJS formula you can also confirm the running build via the gateway MCP's `read_script_log` — its `console.log` output identifies the build, and a `java.nio.file.NoSuchFileException: …/scripts/app` there means the script has no live build yet — publish it (step 3). (`read_script_draft` only confirms the platform received the draft source — a draft is decoupled from the live version, so it can never confirm what is live.) Inner tools are reached through `invoke_org_tool` — see the `bluestep-reference` skill's `conventions/mcp-platform-authoring.md`. If they **saved a draft only**, tell them plainly it is **not live yet** — they must publish to make it live.
- **A stale page render can look like a failed publish** (verified 2026-08; distinct from the stale-client-JS warning in step 4). A formula's own on-page output — a message/modal it writes, rendered field output — can be served from a cached, stale page render, so a fully-successful publish can look like the old version is still running. Hard-refresh and **re-trigger** (re-save the record) before doubting the deploy; do **not** re-push or roll back on an unchanged-looking page alone. Run the which-build check above instead.
- Remind the user to verify behaviour on the platform itself.
- If `draft/README.md` was modified locally, note that the platform now has the updated docs (useful for other devs pulling the same component).

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT push with a `b6p` CLI older than 0.8.0 (step 0), and do NOT run the update yourself — hand it over.
- Do NOT push without showing the user the diff and getting an explicit selection (step 3). Publish is *recommended and pre-selected*, never performed automatically.
- Do NOT publish silently or automatically. Recommending it is not the same as doing it: the push happens only on the user's explicit selection for *this* push — this skill never publishes on its own (e.g. it does not auto-publish on task completion, and `/spec-execute` offers no publish mid-task).
- Do NOT overwrite or delete anything on the platform without the user's yes for *this* push. The printed `--overwrite` and delete commands run only after the user picks *Overwrite* or *Delete* in step 5; no answer, or anything short of a clear yes, means no, and a yes given for an earlier push does not carry over.
- Do NOT edit the command the CLI printed, and do NOT pipe answers into `b6p` yourself: run the printed command exactly as printed, never add an `--overwrite` for a file the user did not confirm, and never write your own `printf … | b6p` line.
- Do NOT loop on CLI failures — fall back to the VS Code b6p extension.

## If the CLI fails

Three distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-push <component>`.
- **Exit `1` from the push itself** — stopped at the overwrite question (`declinedOverwrites`), nothing uploaded (`pushed: false`), a live copy still wrong (`liveVerified: false`), no restore point (`historyRecorded: false`), or type-check diagnostics — **not** a CLI failure and **not** a reason to change tools. The CLI ran correctly and is telling you what it did not do; handle it by the step-5 table (ask about the overwrite; fix the entrypoint, the `--root` or the empty draft; or re-run the publish).
- **Exit `1` naming a prompt it could not answer** (`Enter your access token`, or any other prompt) — **not** a tool failure. Same handling as above: relay the message, tell the user to run `b6p auth set`, retry. This is the standard post-0.6.0 upgrade path even when the step-0 preflight printed `OK`, so do **not** send them to the VS Code extension for it.
- **Any other error** (network, conflict, a real auth *rejection* by the platform, etc.) — the VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Do not retry the CLI in a loop.

**Never fall back to the platform's in-browser script/page editor** (`editScript.jsp`) to save the component. It bypasses `b6p`'s recorded sync metadata and diverges local vs platform — the same hazard class as a manual WebDAV upload (see the sync-failure fallbacks in the `bluestep-reference` skill's `b6p-platform.md`). The VS Code extension is the only equivalent fallback.

### Gotcha: empty `outDir` in a `static/` sub-project aborts the push

A fresh `b6p pull` of a component with a `static/` bundle can leave `draft/static/tsconfig.json` with `"outDir": ""` (an empty string). A later push then aborts in the local pre-push build of the `static/` sub-project with a bare, unhelpful error such as:

```
Build folder doesn't exist (this is fine)
outDir not specified
```

**Workaround:** set `draft/static/tsconfig.json` `"outDir"` to `"."` (any non-empty value works), then push again. This is a local build-tool satisfier only — it does **not** affect what deploys. (The real fix is tracked upstream in the b6p CLI; treat this as a temporary gotcha.)
