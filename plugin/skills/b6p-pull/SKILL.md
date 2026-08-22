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

- **A re-pull never renames the local folder.** If the component was renamed on the platform, the CLI keeps pulling into the folder it first created — don't read the folder name as the component's current display name; the platform (or a legacy `draft/info/metadata.json`, when the component still ships one) is authoritative.
- **A re-pull keeps a file you edited locally rather than overwriting it.** Since b6p-cli 0.6.0, a file whose content differs from *both* the platform copy and the last-synced hash is left on disk untouched, and every kept file is listed in one warning at the end of the pull — read it (step 3). The guard needs a recorded last-sync hash, and that record is **machine-local**: on a fresh clone, a new machine, or after cleared state there is no record, so that first pull writes the platform copy over whatever is there.

## How to invoke `b6p`

`b6p` is a standalone binary on the system `PATH` (the b6p-cli standalone artifact, installed separately from bspecs). Invoke it directly:

```
b6p <args>
```

If `b6p` is not found, the user has not installed the b6p-cli binary yet — point them at its release/install instructions.

## Steps

### 0. Auth preflight (do this first, before any `b6p` call)

`b6p` stores a BlueStep platform **access token** globally in `~/.b6p/` (since b6p-cli 0.6.0 / core 0.5.0 — bearer auth replaced the old username + password, with **no** migration path, so every pre-0.6.0 user is re-prompted once). Without a stored token the first `pull` prompts for one **interactively** — a prompt you (Claude) cannot answer. The CLI now **fails loudly**: it names the prompt it could not answer and exits `1`. (Before 0.6.0 it hung, then drained and exited `0` having done nothing — so an old "it succeeded" is not evidence the pull happened.) `--yes` does **not** save you here: it guards the *confirmation* prompt, not the *missing-token* one.

Before running the pull, check for the secrets store:

```
test -f ~/.b6p/secrets.enc && echo OK
```

- If it prints nothing (file absent) → STOP. Do **not** run the pull. Tell the user:
  > `b6p` has no BlueStep platform access token on this machine yet, so the pull would stop at an interactive prompt I can't answer. Run `b6p auth set` once (it stores the token globally in `~/.b6p/`, so you only do this per machine), then retry `/b6p-pull <DAV URL>`.
- If it prints `OK` → continue, but treat this as a **negative check only**. `secrets.enc` holds every secret under its own key, so a machine that authenticated before 0.6.0 has the file *without* an access token in it — the preflight passes and the pull still stops at `Enter your access token` and exits `1`. That failure is self-describing: surface it verbatim and give the user the same `b6p auth set` instruction rather than retrying.

### 1. Get the DAV URL

- If `$ARGUMENTS` looks like a URL (starts with `http://` or `https://`), use it.
- If `$ARGUMENTS` is empty or looks like a display name (no scheme), STOP and ask the user:
  > I need the **DAV URL** of the component, not its name. Copy it from the component's page in the BlueStep platform UI and paste it here.
- Do NOT guess the URL. Do NOT try to derive it from another component's recorded metadata.

### 2. Run the pull

```
b6p --yes pull "<DAV URL>"
```

The `--yes` is **required** — without it, b6p may show an interactive confirmation prompt that you (Claude) cannot answer, and the call fails with exit `1` naming that prompt. Always include it.

Capture the output — it prints the local path where the component landed.

### 3. Locate the component folder, and read the kept-files warning

**First, check whether the pull kept any local file.** If it did, the CLI ends with a warning like:

```
Kept 2 file(s) that differ from what was last synced (local edits, or a previously
interrupted pull) — NOT synced:

<path>
<path>
```

The list is capped at 10 with a trailing `…and N more`; `b6p --json pull …` reports the same set as `{"keptLocalPaths": [...]}`. This is the divergence guard working as designed, so the pull still exits `0` — but **those files are NOT the platform version**, and a reader who assumes a clean pull will be working against stale content. Carry every kept path into the step-6 report.

To actually take the platform copy for a kept file, **delete the file and pull again**. The CLI's own message also suggests an audit pull, but `b6p audit --pull` defaults to *Cancel* since 0.6.0, so under `--yes` it declines — that route needs a human answering the confirmation interactively.

Then parse the CLI output, or scan for the most recently modified `U######/<Name>/` directory under the project root. Confirm:

- `declarations/` is populated
- `draft/scripts/app.ts` exists (or whatever `config.json:main` points at, on a component that still ships a legacy `draft/info/`)
- **Do not check for `draft/info/`.** It is **deprecated** platform behavior: newly-created formulas never get one, and that configuration now lives on the component's setup page. Only older components still serve it. Its absence is normal and is never a broken pull (see the `bluestep-reference` skill's `b6p-platform.md`).

### 4. Identify the component type

**Start from the folder shape and the code** — that is all most components give you, since `draft/info/` is deprecated and usually absent:

- **`draft/static/` directory present** → **MergeReport** (it owns a frontend).
- **`app.ts` works through `B.net.request` / `B.net.response`** → **Endpoint** (it handles an HTTP request/response pair).
- **Neither** → it is a **formula**, but *which* kind is **not knowable from the code**. Post-Save vs Scheduled vs OnDemand vs a plain field formula is platform configuration, not source. Read it off the component's **setup page** via the gateway MCP (`bluestep-reference` → `conventions/mcp-platform-authoring.md`), or from a legacy `draft/info/` if the component still ships one. `app.ts` comment headers (`// Scheduler MR` etc.) are a weak hint, not proof.

**Shortcut when a legacy `draft/info/` *is* present** — `metadata.json` / `config.json` state the type outright, and these keys settle it. Do not go looking for these names in `app.ts`; they exist only in those JSON files:

- `httpOption` + `allowedMethods` + a `path` field → **Endpoint**
- `useAsHeaderInRelate` / `useForEditing` / `replaceRelateRecordSummary` → **MergeReport**
- `triggerType: "POST_SAVE"` (or comparable) → **Post-Save**
- `triggerType: "SCHEDULED"` → **Scheduled**
- `triggerType: "ON_DEMAND"` → **OnDemand**
- `language: "mjs"` + no triggers + presence of formula configuration → **Formula**

If you still cannot tell — which is normal for a formula with no `draft/info/` and no MCP access — **ask the user** rather than guessing. Do not report the missing `draft/info/` as the reason.

### 5. Handle `draft/README.md`

This is the per-module documentation that lives WITH the code (it ships to the platform on push, so anyone who pulls the module gets it).

a. **Check if it already exists and is substantive.** Read `<Component>/draft/README.md`.
   - If file does not exist → proceed to scaffold (step b).
   - If file exists with > 200 characters AND contains at least one `##` heading that is not literally `## Title` → it is substantive. **Leave it alone.** Tell the user: "draft/README.md already exists and looks substantive — leaving it. Read it before editing code."
   - Otherwise (empty, only `# Title`, only boilerplate) → proceed to scaffold (step b), overwriting.

b. **Scaffold from the template.** Read `component-readme-template.md` (the module README skeleton bundled alongside this skill, in the same directory as this `SKILL.md`). Fill it in using inference from the code:

   - **Title (`# [Component displayName]`):** use `displayName` from a legacy `draft/info/metadata.json` if the component ships one. Otherwise take the name from the DAV URL / the folder the pull created, or read it off the component's setup page via the gateway MCP — do not invent one, and do not treat the missing `draft/info/` as an error.
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

e. **Recommend pushing the scaffolded README, and know what protects it.** Since b6p-cli 0.6.0 a later pull will **keep** the scaffolded README rather than reverting it to the platform stub — it differs from both the platform copy and the last-synced hash, so the divergence guard holds it and lists it in the kept-files warning (step 3). Two things that does *not* mean:

   - **It is not protection on another machine.** The last-sync record is machine-local, so a colleague's fresh clone — or your own after cleared state — has no record and that first pull writes the platform copy straight over it.
   - **Only a push puts the docs where others get them.** `draft/` ships to the platform, so until the README is pushed, nobody who pulls the component sees it.

   So still recommend pushing it in the step-6 report — as the way to publish the docs, not as a race against the next pull. (The do-not-overwrite rule further down binds *this skill's* own writes; it is unrelated to the CLI's guard.)

### 6. Report

Print a summary:

```
Pulled: U######/<ComponentName>/
Type:   <Endpoint|MergeReport|...>
README: <created from scaffold — push it so others who pull the component get the docs | preserved (already substantive)>
Kept:   <local files the pull did NOT overwrite, one per line — omit this line if none>

Next: read draft/README.md, then start editing. For a new feature use /spec-create.
```

## What this skill must NOT do

- Do NOT invoke `b6p` any way other than the bare `b6p` binary.
- Do NOT accept a display name as a substitute for the DAV URL.
- Do NOT overwrite a substantive `draft/README.md`.
- Do NOT speculate beyond what the code shows when filling Overview/Behavior — if uncertain, ask.
- Do NOT scaffold a SPEC.md anywhere — the SPEC concept lives only under `.claude/specs/<feature>/` for new work, never per component.

## If the CLI fails

Three distinct failure modes — handle them differently:

- **`command not found` / `b6p` cannot be resolved** — the b6p-cli standalone binary is not installed (or not on `PATH`). Do NOT retry, do NOT try alternative invocations. Tell the user:
  > `b6p` could not be resolved. Install the b6p-cli standalone binary and make sure it is on your `PATH` (see its release/install instructions), then retry `/b6p-pull <DAV URL>`.
- **Exit `1` naming a prompt it could not answer** (`Enter your access token`, or any other prompt) — **not** a tool failure and **not** a reason to switch tools. The CLI ran correctly and is telling you it needed an answer nobody could give. For the token case this is the standard post-0.6.0 upgrade path even when the step-0 preflight printed `OK`: relay the CLI's message and tell the user to run `b6p auth set`, then retry. Do not send them to the VS Code extension for this.
- **Any other error** (network, lock, a real auth *rejection* by the platform, etc.) — `b6p` ran but the call failed. The VS Code b6p extension (`bsjs-push-pull`) is the equivalent fallback. Tell the user to use it via the editor UI rather than retrying the CLI in a loop.
