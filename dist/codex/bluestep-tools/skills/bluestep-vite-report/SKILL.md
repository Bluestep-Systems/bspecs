---
name: bluestep-vite-report
description: Scaffold an off-platform Vite/Preact SPA merge-report project — check Node 20, run create-vite (preact-ts), set base "./", wire the deploy-lib config block + repository field, then print the [PLATFORM] report-creation and GitHub-repo steps for the human to execute. Use when starting a new Vite/Preact single-page-app merge report (the report serves a bundled static/index.html deployed via deploy-lib, not the platform-compiled static/script.ts path).
---

# /bluestep-vite-report — Scaffold a Vite/Preact SPA merge report

This skill scaffolds an **off-platform Vite/Preact SPA merge report** in-session: it checks Node 20, drives `create-vite` (the `preact-ts` template) live, sets the load-bearing `base: './'`, wires the deploy-lib `config` block + `repository` field into `package.json`, and then **prints** — does not run — the `[PLATFORM]` report-creation and GitHub-repo steps for the human to execute. It **guides** the outward steps (create the platform report, create the GitHub repo, deploy) the same way `/bluestep-init` guides `git init`.

For the pattern itself — what this build model is, when to pick it over the platform-compiled `static/script.ts` path, the two data models — this skill **points at** the `bluestep-reference` files rather than restating them (see [Point at the reference](#5-point-at-the-reference)).

This is a **separate, focused** skill from `/bluestep-init` (project bootstrap). Run `/bluestep-init` first if you are setting up a brand-new BlueStep project; run this when you specifically want a Vite/Preact SPA merge report.

It is **non-destructive**: any file that already exists is left untouched and reported as skipped.

## Collecting answers — use the picker, not a written questionnaire

Ask every choice below as a **structured question with clickable options** where the tool supports them (`AskUserQuestion` in Claude Code), so the user clicks an option instead of typing free-form answers to a list. Always keep an "Other" escape for a custom value (`AskUserQuestion` adds one automatically in Claude Code; add it yourself where the tool doesn't). The **only** value asked as plain text is a brand-new project's folder name (it has no presets). Ask one thing at a time; never dump a numbered list of questions for the user to answer by hand.

**Framework is fixed to Preact — do not prompt for it.** The scaffold uses the `preact-ts` template. React is a valid alternative (the architecture is identical) and is documented in the pattern reference; if the user wants React, point them at that file rather than branching the flow here.

## Steps

### 1. Prerequisite: Node 20+

Run:

```bash
node -v
```

Node **20 or newer is required**. If it prints a version below 20 (or `node` is not found), **STOP** — do **not** attempt to install Node, and do **not** run any `create-vite`/`npm`/deploy step. Tell the user:

> This skill needs **Node 20+** (yours is `<version>`). `create-vite` / Vite 7 / deploy-lib / the b6p-cli all require it — on Node 18 the deploy fails with `crypto is not defined` (Web Crypto isn't a global until Node 20). Install Node 20 (e.g. via `nvm`: `nvm install 20 && nvm use 20`), then re-run `/bluestep-vite-report`.

Only continue past this step once `node -v` reports 20+.

### 2. Collect answers with the picker

**Target location.** Detect the current directory's basename first: `basename "$PWD"`. Then ask:

- **Question:** "Where should I scaffold the Vite SPA merge report?"
- **Options:**
  - `Current directory (<basename>)` — *(recommended if this dir is empty)* scaffold right here.
  - `New subfolder` — create a new folder here and scaffold inside it.

Resolve the target:

- **Current directory** → project name = `<basename>`; `create-vite` runs in the current directory (`.`).
- **New subfolder** → ask the user for the folder name (this is the one free-text value — a new name has no presets). That name is both the project name and the directory `create-vite` creates.

The **project name** is the target folder name resolved above — do not ask separately.

**Do not ask for the deploy URL here.** The report's WebDAV deploy URL is deferred: the report doesn't exist yet, so it can't be known. It is written into `package.json` as a placeholder now and filled in by the human after the `[PLATFORM]` step (step 4).

### 3. Scaffold the Vite project locally

Drive `create-vite` **live** — this skill does **not** vendor a template tree; it edits the generated files for the BlueStep-specific bits only.

1. **Run `create-vite`** (non-interactive, `preact-ts` template):

   ```bash
   npm create vite@latest <name> -- --template preact-ts
   ```

   Use the resolved project name for `<name>`. For the current-directory case, use the folder name (or `.` per the create-vite convention for the current directory).

2. **Set `base: './'` in `vite.config.ts`.** This is the **load-bearing** setting: Vite defaults `base` to `/`, which bakes site-root `/assets/...` URLs that 404 on-platform and the app silently doesn't render. Edit the generated config so it includes `base: "./"`:

   ```typescript
   // vite.config.ts
   export default defineConfig({
     base: "./",
     // ...existing plugins etc. left intact
   });
   ```

   For why this matters, see the gotchas file linked in step 5.

3. **Install deploy-lib** from git (it is not on npm):

   ```bash
   npm install git+https://github.com/BlueStep-Platform/deploy-lib.git
   ```

4. **Edit `package.json`** — add the deploy-lib `config` block, the `repository` field, and the `deploy` script. Read the generated `package.json`, then merge in (do not clobber the scaffold's existing fields):

   ```json
   {
     "repository": {
       "type": "git",
       "url": "git+https://github.com/<owner>/<repo>.git"
     },
     "config": {
       "deployUrl": "https://<org>.bluestep.net/files/<id>/",
       "deploypathsuffix": "static",
       "builddir": "dist"
     },
     "scripts": {
       "deploy": "deploy-lib"
     }
   }
   ```

   Critical details:
   - **`config.deployUrl` is camelCase** — a placeholder for now. deploy-lib reads `npm_package_config_deployUrl`; the README's lowercase `deployurl` silently fails. Leave a note next to it (e.g. a `// TODO` in your working notes, since JSON has no comments): **replace this with the report's WebDAV folder after you create the report in step 4.**
   - `"deploypathsuffix": "static"` and `"builddir": "dist"` are lowercase (in both code and README) — uploads land under the report's `static/` folder; `dist` is Vite's default build output.
   - The `repository` `url` is a `git+https://github.com/<owner>/<repo>.git` placeholder — fill in after creating the GitHub repo in step 4.
   - **Keep the default `build` script** the `preact-ts` template ships (`tsc -b && vite build`). Do **not** strip the `tsc -b`. It does **not** trip the `block-tsc` hook (that hook only matches a literal top-level Bash `tsc`; here `tsc` runs inside an npm script / as a child of deploy-lib) — see the gotchas file linked in step 5.

5. **Protect the deploy token.** deploy-lib reads a bearer token from `.env-local` (hyphen) in the project root. `create-vite`'s default `.gitignore` uses `*.local`, which does **not** match `.env-local` — so append a line `.env-local` to the project's `.gitignore` so the token file can never be committed. (Full auth options are in the deploy-lib workflow file linked in step 5.)

6. **Non-destructive.** If any file you would write/edit already exists with real content that isn't the fresh scaffold output (e.g. you're re-running in a populated dir), skip it and report it as skipped rather than overwriting.

### 4. Print (do NOT run) the [PLATFORM] + repo steps

Print these as a clear checklist the **human** executes — this skill does not create the platform report or the GitHub repo unattended (mirroring how `/bluestep-init` guides `git init`):

**[PLATFORM] — create the BSJS MergeReport component:**

1. Create a BSJS MergeReport with `info/config.json`: `"language": "mjs"`, `"main": "../scripts/app"`, `"sandbox": "SMALL"`, `"propagationBehavior": "REQUIRED"`.
2. Leave `scripts/app.ts` a **no-op** — `B.out = "";` (the report serves the bundled `static/index.html`, not `app.ts`). If the SPA needs server context on first paint (e.g. the current record id), use a `B.out` window-bootstrap `<script>` instead — see the pattern reference (step 5) for the two data models.
3. Set the metadata flags: **available on individuals** and **available when viewing** (the relate flags).
4. **Snapshot the empty report once BEFORE the first deploy** — this avoids the hosed-metadata state.

**Repo + deploy:**

5. Create the **GitHub repo (public)**. Then update `package.json`: set the `repository` `url` to your repo and set `config.deployUrl` to the report's WebDAV folder (its `.../files/<id>/` root — copy it from the report's page in the platform UI).
6. Deploy:

   ```bash
   npm run deploy -- --build --clean
   ```

   `--build` builds a fresh `dist/`; `--clean` removes stale remote files. deploy-lib uploads to both `draft/static/` and `snapshot/static/`. Full mechanics (auth resolution, config keys) are in the deploy-lib workflow file linked in step 5.

### 5. Point at the reference

Do **not** restate the pattern here — send the user to the three `bluestep-reference` files for the details:

- **The pattern / architecture / when to use it (and React as an alternative):** `../bluestep-reference/reference/vite-spa-merge-report.md` (relative to this file)
- **The deploy workflow (install deploy-lib, the `config` keys, auth, `npm run deploy -- --build --clean`):** `../bluestep-reference/conventions/deploy-lib-workflow.md`
- **The sharp edges (`base: './'`, `<head>` stripping, mount-id match, Node 20+, config-key casing, `Swal`/site-CSS in local dev, the `build` script):** `../bluestep-reference/gotchas/vite-merge-report-gotchas.md`

Note the relationship to `/bluestep-init`: that skill bootstraps a whole BlueStep project; this one is the focused Vite/Preact SPA merge-report scaffold. They are separate skills.

## Done

Summarize:

- **What was scaffolded** (local, done by this skill): the `preact-ts` Vite project in `<target dir>`, `base: './'` set in `vite.config.ts`, deploy-lib installed, and `package.json` wired with the `config` block (`deployUrl` placeholder), `repository` placeholder, and `deploy` script — plus any files skipped because they already existed.
- **What the human must still do** (printed in step 4, not run here): create the `[PLATFORM]` MergeReport (`language: mjs`, `main: ../scripts/app`, `sandbox: SMALL`, `propagationBehavior: REQUIRED`, no-op `app.ts`, individual/view flags, **snapshot before first deploy**); create the GitHub repo; fill in the real `repository` URL and `config.deployUrl`; then `npm run deploy -- --build --clean`.

If a new subfolder was created, tell the user the project is in `./<name>` and to open a session rooted there to work in it. Point them at the three reference files (step 5) for anything they hit along the way.
