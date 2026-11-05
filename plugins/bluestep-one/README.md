# bluestep-one

Build BlueStep One custom components with Claude Code. It sets up a component workspace, then
builds, publishes and checks one component at a time, through a row of gates: a failed gate stops
the run and says why. It also ships an on-demand BlueStep One reference and a tab guard for the
GraphQL calls a browser tab sends.

## Who installs what

- **Build-only helpers and customers:** `bluestep-tools` and `bluestep-one`. That is all a
  component workspace needs.
- **BlueStep's own migration helpers:** those two, plus BlueStep's internal migration tooling.
  If you also use that tooling, wait for its release that drops its own build skill before you
  install this, so the build skill and the mod do not load twice.

## Claude Code only, and what needs the desktop app

bluestep-one runs on Claude Code only. Its hooks are Node scripts and it ships a mod, which are
Claude Code features, so there is no Cursor or Codex version.

Setup and the first four build gates (types, type check and tests, copies and required fields,
push to `draft`) run on the Claude Code CLI or in the Claude desktop app. Everything that needs a
signed-in tab runs only in the **Claude desktop app's built-in browser pane**: the build, the
publish, and the served, UX, live and design checks (gates 5 to 9). Without the desktop app, a
build run stops after gate 4.

## Install

The plugin comes from the `bluestep` marketplace (`Bluestep-Systems/bluestep-ai`). Add it once
per machine as the [repo README](../../README.md#plugins) says, then:

- **Claude Code CLI:** `claude plugin install bluestep-one@bluestep --scope user`. Claude Code
  installs `bluestep-tools` with it when it is missing.
- **Claude desktop app:** Customize → Plugins → Browse plugins → **bluestep-one** → Install, and
  **bluestep-tools** too if it is not there yet. Plugins there are managed by your account, so the
  CLI command above does not apply.

bluestep-one asks for `bluestep-tools` at version `>=0.46.0`. With an older one installed, Claude
Code does not load bluestep-one until you update bluestep-tools
(`claude plugin update bluestep-tools@bluestep`, or Customize → Plugins in the desktop app).

Then start a **new** session in the folder where your components will live and run
`/bluestep-one:setup`.

## Skills

- **`/bluestep-one:setup`** — checks the machine first: `bluestep-tools` and its token
  (`B6PT_TOKEN`), Node.js, git access to the git host for each component, and the desktop app's
  browser pane with a sign-in on the BlueStep One host. Then it writes the project files that are
  missing: `.claude/bluestep-one.json`, `AGENTS.md`, and two Claude Code files: the `CLAUDE.md`
  bridge and the Claude Code `.claude/settings.json`. It never overwrites a file. `--check`
  reports and writes nothing.
- **`/bluestep-one:build <component name or id> [--clone | --no-publish]`** — one component, from
  commit to a checked screen: fresh types, type check and tests, copies and required-fields checks,
  push to `draft`, build from a signed-in tab, publish (only a new commit that built green, and
  only after you say yes), served-commit check after a full reload, a measured UX check, a live
  check on your own test record, and for a UI change a design check against an approved canvas
  export. `--clone` sets up a new component repo first; `--no-publish` stops before the publish.
- **`/bluestep-one:reference`** — the on-demand reference: build and publish steps, the checks,
  rules, patterns, and gotchas of the host, the kit, `/gql` reads and writes, rights, pages and
  tooling. Its `SKILL.md` lists one line per file; an agent reads only the file a task needs.

## The project config: `.claude/bluestep-one.json`

Setup writes it; the build skill, the tools and the hooks read it. A folder without it is not a
BlueStep One project, and the hooks do nothing there.

| Key | What it holds |
| --- | --- |
| `one.host` | The BlueStep One host the components are served from. Builds and publishes run from a tab signed in here. |
| `one.gitHost` | The host whose git serves the component repos. |
| `components` | The components this folder builds: `id`, `name`, and `repo` (the path to its checkout, relative to this folder). A build or publish runs only on an id listed here. |
| `testPrefix` | Name prefix for test data, written out in full. The live check runs only on test records whose names start with it. |
| `uxCheck` | Optional thresholds of the UX check: time to first content, time to the last skeleton gone, `/gql` calls, layout shift, console errors, failed requests, duplicate control names, and how long a step may run. A key left out takes its default. |

The schema is `config/bluestep-one.schema.json`; the `uxCheck` defaults are in
`config/defaults.json`.

## The tab guard

Since the gateway lost its GraphQL tools, writes go to `/gql` from a signed-in tab, and the tab
guard watches those scripts. A script with no GraphQL mutation goes on as usual. A lone build or
publish of a component listed in `components` goes on to the normal permission prompt. Any other
mutation is put to you first, because a tab may be signed in to any org and only you can tell a
test save from a write to a real one. Where mods are on, the mod shows a fuller card first (what
the script says it saves, the site the tab is on, Proceed or Cancel), and after Proceed the hooks
do not ask again. `bluestep-tools` has its own tab guard that runs beside this one and honors the
same Proceed. The guard reads the script's text, so it is a safety net, not a wall: a mutation
built at run time is not seen.

## Contents

- `skills/` — `setup`, `build`, and `reference` (the reference files).
- `tools/` — the Node scripts the build gates run (types, type check, copies, required fields, UX
  check, canvas serving), with their tests in `tools/test/`.
- `hooks/` — `hooks.json`, the tab guard (`tab-guard.mjs`), the mod (`register.tsx`), shared code
  in `hooks/lib/`, tests in `hooks/test/`.
- `templates/` — the component repo files, the change's `design-audit.md`, the canvas `launch.json`.
- `config/` — the config schema and defaults. `types/` and `tests/` — the mod's types and its test.
