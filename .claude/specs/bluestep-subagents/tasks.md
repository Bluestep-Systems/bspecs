# Tasks — BlueStep subagents (implementer, commenter, reviewer) + delegated spec-execute

**Status:** Complete

Each task references specific file paths and is small enough to ship as one coherent unit — one `/spec-execute` invocation per task. Order matters: the subagent files (1–3) must exist before `/spec-execute` references the implementer (4); the ADR (5) precedes the docs that link it (6).

All new/edited files must be **English** (project rule). Subagent files are plain `.md` (no `{{VAR}}`, like skills) under `templates/claude/agents/` — they are copied to `.claude/agents/` and tracked by `SYNC_TARGETS` automatically (no code change to `src/`).

## Tasks

- [x] **1.** Create the task-implementer subagent — files: `templates/claude/agents/b6p-task-implementer.md`.
  - Frontmatter: `name: b6p-task-implementer`, a `description` that makes clear it implements **one** spec task in an isolated context, `tools: Read, Edit, Write, Glob, Grep, Bash`.
  - Body distills only `bluestep-dev`'s **workflow** (do **not** restate platform knowledge — point to `.claude/instructions/index.md`): read the task's `requirements.md`/`design.md` + the single task in `tasks.md`; read the component's per-component `declarations/index.d.ts` fully and grep `declarations/B.d.ts` for APIs before coding; consult `instructions/index.md` on demand; honor the scaffolded "Critical rules" (no editing `declarations/`, no `.writable()`, **no local `tsc`**, no new components locally); implement exactly one task touching only referenced files; verify via `PostToolUse` `ide_diagnostics` (no compile — hook-blocked); return a **structured summary** (files changed, what/why, diagnostics result, flags). Explicitly: does NOT mark the checkbox, invoke other subagents, or start the next task.

- [x] **2.** Create the commenter subagent — files: `templates/claude/agents/b6p-commenter.md`.
  - Port `03-Agents/bluestep-commenter.md` with edits: drop the "Setup — Load Full Knowledge Base" block (the eight `~/.claude/agents/bluestep-knowledge/*` paths don't exist in a scaffold) and replace with "consult `.claude/instructions/index.md` on demand"; align paths to the `b6p` layout (`draft/README.md`, `draft/scripts/`, `info/metadata.json`, `info/config.json`) and the `templates/claude/templates/` module-README shape; keep "README only — no inline comments, no JSDoc, no logic changes"; preserve meaningful existing README content. `name: b6p-commenter`, `tools: Read, Edit, Write, Glob, Grep`.

- [x] **3.** Create the code-review subagent — files: `templates/claude/agents/b6p-code-review.md`.
  - Port `03-Agents/bluestep-code-review.md` with edits: drop the knowledge-base load block → "consult `.claude/instructions/index.md` on demand"; keep the Critical/Warnings/Suggestions report format and the BlueStep checklist (try/catch coverage, bare `.get()` on Optionals, server/client boundary, `console.*`, `mergeTag`/field-name usage, component-library vs hand-rolled UI, a11y) but defer rule *definitions* to `instructions/`; **change the default to report-only** (no auto-fix; edits only on explicit user request). `name: b6p-code-review`, `tools: Read, Edit, Glob, Grep`.

- [x] **4.** Wire delegation into spec-execute — files: `templates/claude/skills/spec-execute/SKILL.md`. (Depends on 1; references 2–3 in the STOP.)
  - Parse an optional `--inline` flag from `$ARGUMENTS` alongside feature + task#.
  - Default path: after loading spec context and verifying deps, **delegate implementation of the one task to the `b6p-task-implementer` subagent**; on return, the main session surfaces the git diff, verifies, marks `[x]`, and keeps docs in sync (steps preserved from today).
  - `--inline` path: implement in the main session (today's behavior verbatim).
  - Rework the "task done" STOP to (a) show the subagent's summary + diff and (b) suggest the optional, user-invoked `@b6p-commenter` then `@b6p-code-review`. Keep "never auto-continue to the next task".

- [x] **5.** Add the ADR — files: `docs/decisions/subagents-and-delegated-execution.md`.
  - Record both decisions as one coherent choice: (a) subagents (not skills) for these roles — context isolation + `tools` scoping, establishing `.claude/agents/` as a scaffolded primitive; (b) `/spec-execute` delegates task implementation by default with an `--inline` escape hatch. Note the report-only reviewer default and the on-demand (no-hook) triggering. Follow the existing ADR style in `docs/decisions/`.

- [x] **6.** Sync repo docs — files: `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `TODO.md`. (Do last — depends on 1–5.)
  - `CLAUDE.md`: add `.claude/agents/` (three subagents) to "What gets scaffolded into every project"; document the delegate-by-default execution model under "Key behaviors"; add an "Editing agents" note beside "Editing templates" (plain `.md`, English, references `instructions/` not inline knowledge).
  - `README.md`: mention the three subagents in the scaffolded-project feature list.
  - `CHANGELOG.md`: new `## [x.y.z]` entry (minor bump — additive).
  - `TODO.md`: check off the B4 item under "Rules consolidation follow-ups"; **add a new item** proposing the same delegate-to-subagent approach (a generic implementer subagent for context isolation on large specs) for this repo's own `.claude/skills/spec-execute`.

## Verification

No test suite — confirm manually:

- `node cli.js -v` and `node cli.js -h` still run.
- Scaffold into a scratch dir (`node cli.js` into a temp folder) and confirm `.claude/agents/` contains `b6p-task-implementer.md`, `b6p-commenter.md`, `b6p-code-review.md`, each with valid frontmatter (`name`, `description`, `tools`) and English content.
- Confirm `SYNC_TARGETS` picks up the three files: a one-off `node -e "import('./src/sync.js').then(m => console.log(m.SYNC_TARGETS.filter(t => t.destRel.includes('agents'))))"` lists all three `.claude/agents/*.md` destinations.
- Re-read the edited `spec-execute/SKILL.md`, the ADR, and the doc edits for well-formedness.
- For each task: check the latest `ide_diagnostics` for `Error` in touched files; fix before marking done.

## Wrap-up

- `CLAUDE.md` / `README.md` kept in sync (task 6).
- B4 `TODO.md` item ticked; new workspace-spec-execute follow-up item added (task 6).
- `CHANGELOG.md` entry added (task 6).
- No `templates/claude/instructions/` files were added, so no `index.md` entry is required (the subagents *reference* `index.md`, they don't add to it).
- When all tasks are `[x]`, propose a commit message (title + body) from the diff per `CLAUDE.md` (no `Co-Authored-By` trailer). Do not run `git commit` unless asked.
