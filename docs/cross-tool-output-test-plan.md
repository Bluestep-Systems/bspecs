# Cross-tool plugin output — per-release test plan (Claude Code / Cursor / Codex)

**Status:** Not yet run. The first run is the **live validation** of the cross-tool output
(spec: `.claude/specs/cross-tool-plugin-output/`) and must include §5. Every later run is
§1–§4 + §6 only.

This is a committed, human-runnable checklist for the **generated Cursor and Codex plugin
trees** (`dist/cursor/`, `dist/codex/`) plus a **Claude Code regression pass**. It follows
the same pattern as `docs/mcp-platform-authoring-test-plan.md`: every step says what to do
and what SUCCESS looks like, and anything that fails goes in the findings ledger (§6) —
a failed step is a reportable result, not a silent skip.

You do not need to have read the spec to run §1–§4. Deeper context, where it helps, is
linked: the design record is `docs/decisions/cross-tool-plugin-output.md`, the live
prove-out behind the hook/MCP rules is
`.claude/specs/cross-tool-plugin-output/prove-out.md`, and the per-tool hook degradation
notes are `dist/cursor/bluestep-tools/hooks/README.md` and
`dist/codex/bluestep-tools/hooks/README.md`.

---

## 1. Purpose & when to run

### What this validates

That one released plugin version actually works on all three tools — skills discoverable
and invocable, the `bluestep-reference` tree readable on demand, the three guardrail hooks
doing what each tool allows them to do (block where the tool supports blocking, advise
where it doesn't), the gateway MCP server connecting, and `/bluestep-init` scaffolding the
`AGENTS.md` + `CLAUDE.md` bridge — plus that nothing regressed for existing Claude Code
users.

### When

After **every release that ships plugin content or emitter changes** — i.e. any merge to
`main` that bumped `version` in `plugin/.claude-plugin/plugin.json`. Installed plugins
only update on a version change, so run this **after** the release is live, against what
users actually receive. Docs-only merges (no bump) ship nothing and need no run.

The **first** run doubles as the live validation the spec deferred (task 14): it adds the
one-time §5 items and is done by Fernando plus end users on real Cursor/Codex seats.
Findings come back per §6.

### Run record

Fill in per run (copy the row):

| Date | Plugin version | Claude Code ver. | Cursor ver. | Codex ver. (+surface: CLI / IDE / desktop app) | Runner | Result |
| --- | --- | --- | --- | --- | --- | --- |
| ____ | ____ | ____ | ____ | ____ | ____ | ____ |

## 2. Shared prerequisites (before any tool)

- [ ] **The release is actually out.** The repo (`github.com/Bluestep-Systems/bspecs`) has
      the `plugin-vX.Y.Z` tag and GitHub Release for the version under test, and that
      version is what `plugin/.claude-plugin/plugin.json` on `main` says.
- [ ] **`B6PT_TOKEN` is set** in the environment the tool launches from (needed for the
      MCP steps only; everything else works without it). Creation + placement steps live in
      the `/bluestep-init` skill's "Platform token" section — the short version:
  - Linux / WSL / macOS terminal: `export B6PT_TOKEN="b6pt_…"` in your shell profile, new
    terminal.
  - **Windows: `setx B6PT_TOKEN "b6pt_…"` (User scope), then FULLY restart the app** —
    quit and reopen, not just a new window. A variable exported in a shell session never
    reaches a GUI-launched app.
  - GUI-launched apps on macOS/Linux don't read your shell profile either — launch from a
    terminal or use `launchctl setenv` (macOS).
- [ ] **A scratch project folder that is a git repo** (`git init` + at least one commit;
      any empty folder works). Cursor needs an **open workspace** for skills/hooks — an
      empty window shows only user-global surfaces — so open this folder in each tool
      before testing.
- [ ] `tsc` does **not** need to be installed. The block-tsc test below uses
      `tsc --version > tsc-ran.txt`: the shell creates the file the moment the command
      runs at all, so "file absent" proves the block even on a machine without tsc.
- [ ] The `b6p` CLI is **not** needed for this checklist. (The `/b6p-*` skills need it at
      runtime, but this plan only checks they are discoverable, not that they sync.)

## 3. Install / setup per tool

Do the subsection for each tool you are testing. All three consume the same repo — it
serves a Claude Code marketplace (`.claude-plugin/marketplace.json`), a Cursor marketplace
(`.cursor-plugin/marketplace.json`), and a Codex marketplace
(`.agents/plugins/marketplace.json`) at once.

### 3.1 Claude Code

1. Add the marketplace (once per machine): `/plugin marketplace add Bluestep-Systems/bspecs`.
2. Install: `/plugin install bluestep-tools@bluestep`. Already installed? Run
   `/plugin marketplace update` instead.
3. Start a **fresh session** (or `/reload-plugins`) — plugin MCP servers and hooks load at
   session start.

- **SUCCESS:** the plugin page / `/plugin` listing shows `bluestep-tools` at the version
  under test.

### 3.2 Cursor

1. **Open the scratch project folder first** (skills/hooks are workspace-coupled; a
   project-scoped install needs an open workspace).
2. Plugins → **Add Marketplace → Import from Repo**, URL
   `https://github.com/Bluestep-Systems/bspecs`.
3. Install `bluestep-tools` from that marketplace; enable it on the Manage screen if it is
   not on by default.

- **SUCCESS:** the plugin page renders all its surfaces (skills, agents, hooks, the
  `bluestep-gateway` MCP server) at the version under test.
- Notes: imported marketplaces refresh from the repo on push, so on later runs the new
  version should appear without re-importing (confirm it did). If Claude Code on the same
  machine already registered the `bluestep` marketplace, Cursor may have auto-imported it —
  skills appearing before you did anything is expected, not a bug.

### 3.3 Codex

1. Add the marketplace: `codex plugin marketplace add Bluestep-Systems/bspecs` (CLI), or
   add the same repo from the plugins screen in the IDE / desktop app.
2. Install `bluestep-tools`.
3. **Trust the hooks — mandatory, and easy to miss.** Open the plugin's page; the Hooks
   section shows "needs review before it can run" with **Review / Trust all** buttons (in
   the CLI: `/hooks`). Until you trust them, the guardrails **silently never run** — no
   error, no log.
4. **Re-trust after every hook-changing release.** Trust is per hook *definition*, so any
   release that touched `plugin/hooks/**` or the emitters' hook wiring resets it. Check the
   plugin page for the "needs review" banner on **every** run of this plan, not just the
   first.
5. If you just set `B6PT_TOKEN`, fully quit and reopen the app.

- **SUCCESS:** plugin installed at the version under test; Hooks section shows trusted (no
  "needs review" banner).

## 4. Per-tool checklists

Each step: **Do** → **SUCCESS looks like**. Run inside the scratch project folder. The 12
skills that must exist everywhere: `b6p-pull`, `b6p-push`, `b6p-audit`, `spec-create`,
`spec-execute`, `spec-status`, `quick-task`, `task-comment`, `bspecs-feedback`,
`bluestep-init`, `bluestep-vite-report`, `bluestep-reference`.

Three reusable probes referenced below:

- **P1 — shell block (falsifiable):** ask the agent to run
  `tsc --version > tsc-ran.txt`. A real block means the command never executed — verify
  **`tsc-ran.txt` does not exist** afterwards (the redirect would create it even if tsc
  isn't installed). Then ask it to run `echo ok` — must pass through (no over-blocking).
- **P2 — generated-file edit:** create `declarations/B.d.ts` in the scratch folder with
  one comment line in it, then ask the agent to append a comment to that file. The
  guardrail message starts with `BLOCKED: … is platform-generated`.
- **P3 — inline-frontend edit:** create `scripts/app.ts` (one line) and an empty sibling
  `static/` folder, then ask the agent to paste a `<style>` block with a few CSS rules
  into `scripts/app.ts`. The guardrail message says CSS/HTML belongs in `static/`.

### 4.1 Claude Code (regression — existing behavior must not change)

- [ ] **Skills discoverable:** type `/` in the composer → all 12 skills above appear
      (namespaced `bluestep-tools:` or plain, per your setup).
- [ ] **One skill end-to-end:** run `/spec-status` in the scratch folder → it reports that
      no specs exist (or lists them), with no error.
- [ ] **Reference on-demand:** ask "Using the bluestep-reference skill, open the
      common-gotchas file and quote its first heading." → the agent reads the bundled file
      and quotes a heading that matches
      `plugin/skills/bluestep-reference/gotchas/common-gotchas.md` in this repo.
- [ ] **Hook — block-tsc:** P1 → command denied, `tsc-ran.txt` absent, `echo ok` passes.
- [ ] **Hook — block-generated-files:** P2 → edit denied, file byte-identical.
- [ ] **Hook — block-inline-frontend:** P3 → edit denied.
- [ ] **MCP:** ask the agent to call `available_tenants` on the bluestep gateway → a
      non-empty tenant list returns (it's a curated directory, not the full reachable
      set — non-empty is the pass bar).
- [ ] **`/bluestep-init` scaffold:** in a fresh empty scratch dir, run `/bluestep-init`
      (choose "Current directory", "Set later", skip the token step) → it writes
      `AGENTS.md` (the rules), a **one-line `CLAUDE.md` bridge** (`@AGENTS.md` plus a
      comment, nothing else), `README.md`, `package.json` (with **no** `b6p-cli`
      devDependency), `.gitignore`, `.prettierrc`, and `.claude/settings.json` with the
      marketplace + `enabledPlugins` block; it guides `git init` and reports written vs.
      skipped.
- [ ] **Existing-project regression:** in a dir that already has a **populated**
      `CLAUDE.md` (fake one with a few real-looking rules), run `/bluestep-init` → the
      file is **not overwritten**; the migration to `AGENTS.md` is **offered**, and
      declining leaves both files exactly as they were.

### 4.2 Cursor

Expected hook behavior differs here by design — see
`dist/cursor/bluestep-tools/hooks/README.md`. Cursor has no blocking pre-edit event that
carries content, so the two edit guardrails are **post-hoc advisory**: the edit lands, and
the guardrail message goes to Cursor's hook logs. Only the shell guardrail blocks.

- [ ] **Skills discoverable:** all 12 skills autocomplete in the composer's slash menu.
- [ ] **One skill end-to-end:** `/spec-status` → reports no specs (or lists them), no
      error. *(First run: this also closes prove-out C2 — skill body execution + bundled
      resource reads on Cursor.)*
- [ ] **Reference on-demand:** same probe as 4.1 → correct heading quoted.
- [ ] **Hook — block-tsc (BLOCKING):** P1 → denied via `beforeShellExecution`,
      `tsc-ran.txt` absent, `echo ok` passes. *(First run: this also closes §5.1 — see
      there before moving on.)*
- [ ] **Hook — block-generated-files (ADVISORY — the edit is EXPECTED to land):** P2 →
      the file **is** modified (that is the pass condition on Cursor, not a failure), and
      the `BLOCKED: … platform-generated` message appears in Cursor's hook logs/output.
      No message anywhere = the hook didn't fire = a finding.
- [ ] **Hook — block-inline-frontend (ADVISORY):** P3 → same shape: edit lands, message
      in the hook logs.
- [ ] **MCP:** Settings → MCP shows `bluestep-gateway` **Connected** with its meta-tools
      listed (`available_tenants`, `list_org_tools`, `invoke_org_tool`, …); then ask the
      agent to call `available_tenants` → non-empty
      list. (`${env:B6PT_TOKEN}` interpolation was proven live in the prove-out; a
      connect failure here points at the token env, §2.)
- [ ] **`/bluestep-init` scaffold:** in a fresh scratch dir → writes `AGENTS.md` +
      one-line `CLAUDE.md` bridge + `README.md`/`package.json`/`.gitignore`/`.prettierrc`,
      guides `git init`, and walks the **Cursor** enablement subsection (marketplace
      import steps — it must NOT write `.claude/settings.json` as if this were Claude
      Code).

### 4.3 Codex

Before anything: confirm the hooks are **trusted** (§3.3) — an untrusted hook is
indistinguishable from a broken one. Full failure ladder if a hook seems dead:
`dist/codex/bluestep-tools/hooks/README.md`.

- [ ] **Skill catalog complete (description budget watch):** the skills list shows all
      **12** entries (plugin-prefixed, e.g. `bluestep-tools:spec-status`), none missing
      and none with a truncated description. Codex caps startup skill discovery at
      8k chars / 2% of context; the generator warns near the cap, this step is the
      runtime check.
- [ ] **One skill end-to-end:** invoke `spec-status` (slash menu; on the CLI the syntax
      may be `$`-prefixed — note which you used) → reports no specs (or lists them), no
      error.
- [ ] **Reference on-demand:** same probe as 4.1 → correct heading quoted.
- [ ] **Hook — block-tsc (BLOCKING via JSON deny):** P1 → denied, **`tsc-ran.txt`
      absent**, `echo ok` passes. On Codex the deny is a `hookSpecificOutput` JSON with
      exit 0 (exit-2 is unreachable on the Windows harness); the plugin page's hook "runs"
      counter incrementing confirms the hook actually executed.
- [ ] **Hook — edit guardrails:** P2 and P3. Two acceptable outcomes, record which:
      - Edit goes through a Claude-compatible tool (`Edit`/`Write`/…) → **blocked**, file
        untouched.
      - Edit goes through **`apply_patch`** → the wrapper's field mapping is best-effort
        and unverified; it may **fail open** (edit lands, nothing logged). That is a known
        gap, not a plan failure — it feeds §5.3.
- [ ] **MCP:** ask the agent to call `available_tenants` → non-empty list. Auth is
      Codex-native `bearer_token_env_var: "B6PT_TOKEN"`; on Windows remember the `setx` +
      full-app-restart rule (§2) — an `AUTHORIZATION_REQUIRED`-style error means the
      process never saw the token.
- [ ] **`/bluestep-init` scaffold:** in a fresh scratch dir → writes `AGENTS.md` +
      one-line `CLAUDE.md` bridge + the root files, guides `git init`, and walks the
      **Codex** enablement subsection — including telling you (a) to trust the hooks and
      (b) that **subagents do not come from the plugin on Codex**: the three agent TOML
      files (underscore names, e.g. `b6p_task_implementer`) sit in the installed plugin's
      `agents/` folder as payload to copy into `.codex/agents/`, and until that happens
      delegation is unavailable and the spec skills run in-session. The skill must say
      so, not pretend a subagent exists.

## 5. First live validation — one-time extras

Run these **once**, on the first post-release run, with real seats. Each closes a question
the task-1 prove-out had to park (details:
`.claude/specs/cross-tool-plugin-output/prove-out.md` — C3–C5 and the X3/X5 ladders).
Write results back into that file's assumption register; anything that changes shipped
behavior becomes a fix task (§6).

Some items need the retained **probe plugin** from the prove-out (a minimal plugin whose
hooks dump their stdin to a log). Its repo and local scratch paths are recorded in the
spec's `tasks.md` task-1 entry — it is a throwaway test asset, not part of the shipped
tooling.

- [ ] **5.1 Cursor hook runtime path resolution (prove-out C4).** The generated Cursor
      `hooks.json` uses relative commands (`./hooks/*-cursor.sh`); whether Cursor resolves
      those against the **installed plugin location** at runtime was only proven at
      registration level. The 4.2 block-tsc pass **is** the proof. If it never fires:
      likely the relative path resolved against the workspace instead → fix task on
      `tools/gen-cross-tool/emit-cursor.mjs` (anchor the command differently), and record
      the finding in the dist README.
- [ ] **5.2 Cursor preToolUse content probe (prove-out C5).** Install the probe plugin in
      Cursor, ask the agent to create and then edit a file, and inspect the probe's
      pre-tool-use log: does **any pre-edit event carry the new file content**?
      - Content present → **file a task** to upgrade `block-generated-files` and
        `block-inline-frontend` from post-hoc advisory to blocking on Cursor (and update
        `dist/cursor/bluestep-tools/hooks/README.md`'s degradation table).
      - Content absent → the advisory degradation stands; mark the register row LIVE.
- [ ] **5.3 Codex `apply_patch` stdin capture (WSL).** On WSL Codex CLI with the probe
      plugin installed, perform a file edit so it goes through `apply_patch`, and capture
      the raw PreToolUse stdin from the probe log. **Paste the JSON verbatim into
      `prove-out.md`.** Compare the field names against what the shipped wrappers accept
      (path: `file_path`/`path`/`filename`/first key of `changes`; content:
      `content`/`new_content`/`new_string`/`patch`/`input` — see the dist Codex hooks
      README). Mismatch → fix task to tighten the mapping in
      `tools/gen-cross-tool/emit-codex.mjs`.
- [ ] **5.4 Codex exit-2 on POSIX (informational).** Same WSL session: have a probe hook
      exit 2 and see whether Codex blocks (the documented contract) or fails open like the
      Windows harness. The shipped wrappers **do not rely on exit codes** (they emit the
      JSON deny), so either answer changes nothing — record it in the assumption register
      (#12, POSIX column) and move on.
- [ ] **5.5 Codex agent names in skill prose — decide.** Codex agent names must be
      `lowercase_underscore` (`b6p_task_implementer` …) and the emitted TOML uses those,
      but the skill prose shipped to Codex still says `b6p-task-implementer` etc.
      (hyphenated, matching Claude Code/Cursor). Decide once: rewrite agent names in
      `emit-codex.mjs`'s skill pass, or leave as-is (defensible: agents don't come from
      the plugin on Codex anyway, so the prose is descriptive). Record the decision here
      and in the spec; if rewrite → fix task.
- [ ] **5.6 Endpoint components — pre-edit `b6p audit` rule.** During this spec's
      feedback-endpoint work (task 18) there was a near-miss editing a pulled endpoint
      component whose local copy could have diverged from the platform. Proposal to
      validate with real usage: an always-on rule that before editing files of a pulled
      endpoint component, the agent runs the read-only `b6p audit` (or `/b6p-audit`) to
      surface drift first. If the first-run experience confirms the need, file the rule
      change as a fix task (candidate homes:
      `plugin/skills/bluestep-init/templates/AGENTS.md.template` and/or
      `plugin/skills/b6p-push/SKILL.md`) — note this deliberately softens the `/b6p-audit`
      skill's current "on demand, not a pre-flight" stance for the endpoint-component case
      only, so it needs a deliberate decision, not a drive-by edit.
- [ ] **5.7 Close the remaining assumption-register rows.** These are still DOCS/INFERRED
      in `prove-out.md`; each maps to a step above — tick the register as you go:

      | Register row | Closed by |
      | --- | --- |
      | #1/#2 Cursor skill execution + bundled resource reads | 4.2 skill + reference steps |
      | #8/#10/#12 Cursor hook schema / trust gate / deny contract | 4.2 hook steps (note whether Cursor asked for workspace trust first) |
      | #11 Cursor hook stdin field names | 5.2 probe log |
      | #12 Codex exit-2 (POSIX column) | 5.4 |
      | #13 Cursor subagent execution (registration was LIVE) | ask Cursor to launch one plugin subagent (e.g. the commenter agent on a scratch file) → it launches and returns |
      | #16 invocation syntax per surface | noted while running 4.2 / 4.3 |
      | #17 hooks on Windows-native installs | 4.2 / 4.3 hook steps on a Windows-native seat — the shipped wrappers are POSIX `sh` (the prove-out's Windows runs used throwaway `.cmd` shims), so whether each tool runs `sh` hooks on Windows-native is still open; if not, that's a fix task (Windows shims in the emitters) |
      | #18 Codex description budget at 12 skills | 4.3 catalog step |

## 6. Findings & feedback loop

- **Every failed, odd, or degraded step is a finding.** File it one of two ways:
  - `/bspecs-feedback` — from any tool, no GitHub/ClickUp account needed; it now records
    the **runtime environment** (tool, surface, version) with the report, so say which
    tool you were in when it happened.
  - A fix task appended to `.claude/specs/cross-tool-plugin-output/tasks.md` — if you have
    repo access and the fix is already scoped.
- Include in either: the step number from this plan, expected vs. observed, tool +
  surface (CLI / IDE / desktop app) + tool version, and the plugin version.
- **Findings ledger** (fill during the run; a dirty result recorded beats a clean result
  assumed):

| Step | Tool + surface | Pass/Fail | Note / link to feedback item |
| --- | --- | --- | --- |
| ____ | ____ | ____ | ____ |

- **After the first live run:** update the assumption register in
  `.claude/specs/cross-tool-plugin-output/prove-out.md` (per §5.7), paste the §5.3 stdin
  capture there, tick the §5 boxes above with dates, and flip this doc's **Status** line
  to "First live validation run <date>; per-release checklist in effect."

## See also

- `.claude/specs/cross-tool-plugin-output/` — requirements, design (see "Prove-out
  amendments"), tasks, and the full prove-out record this plan inherits from.
- `docs/decisions/cross-tool-plugin-output.md` — the ADR (output shape, committed `dist/`,
  single version stream, tag-on-merge).
- `dist/cursor/bluestep-tools/hooks/README.md` / `dist/codex/bluestep-tools/hooks/README.md`
  — per-tool hook wiring and documented degradations the §4 expectations come from.
- `plugin/skills/bluestep-init/SKILL.md` — the scaffold + per-tool enablement steps §3/§4
  exercise, including full `B6PT_TOKEN` setup.
