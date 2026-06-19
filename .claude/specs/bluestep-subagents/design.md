# Design — BlueStep subagents (implementer, commenter, reviewer) + delegated spec-execute

**Status:** Drafting

## Files / areas affected

### New — `templates/claude/agents/` (the scaffolded `.claude/agents/` tree)

Three subagent definition files, authored as plain `.md` (not `.template`):

- `templates/claude/agents/b6p-task-implementer.md`
- `templates/claude/agents/b6p-commenter.md`
- `templates/claude/agents/b6p-code-review.md`

**Why plain `.md`, not `.md.template`:** these are static role definitions with no `{{VAR}}` needs, exactly like skills (`CLAUDE.md`: "Skills live in `templates/claude/skills/<name>/SKILL.md` — no vars, plain markdown"). Both `walk()` and `walkClaude()` handle plain `.md` and `.md.template` identically (a non-`.template` file copies/syncs verbatim), so the choice is purely about whether we need substitution. We don't.

### No code changes required for scaffolding or sync

Verified in `src/utils.js`:

- `copyTemplateTree('claude', join(projectDir, '.claude'), …)` (`src/scaffold.js:50`) calls `walk()`, which **recurses every subdirectory** of `templates/claude/`. A new `agents/` folder is copied to `.claude/agents/` automatically; `.template` stripping is applied only when present.
- `SYNC_TARGETS = enumerateClaudeTargets(SYNC_EXCLUDE)` (`src/sync.js:21`) calls `walkClaude()`, which **recurses the whole tree** and emits one `.claude/**` target per file. The three new agent files are picked up by `bspecs sync` and written into `bspecs.lock` with no hardcoded additions.

This is the dynamic-`SYNC_TARGETS` behavior consolidate-rules established (`docs/decisions/instruction-tree-and-claude-only.md`). The new directory is the first thing to validate it on a non-instructions subtree.

### Modified — `templates/claude/skills/spec-execute/SKILL.md`

The shipped `/spec-execute` skill gains:

1. `$ARGUMENTS` parsing for an optional `--inline` flag.
2. A delegation step: by default, spawn the `b6p-task-implementer` subagent to implement the one task; with `--inline`, implement in the main session (today's behavior).
3. A reworked "task done" STOP that (a) reports the subagent's summary + surfaces the git diff, and (b) suggests the optional `b6p-commenter` then `b6p-code-review` as user-invoked next steps.

The bookkeeping (verify, mark `[x]`, doc-sync, STOP) stays in the main session — see Data / control flow.

### Modified — docs

- `CLAUDE.md` (repo): document `.claude/agents/` in "What gets scaffolded" and the delegate-by-default execution model in "Key behaviors"; add an "Editing agents" note alongside "Editing templates".
- `README.md`: mention the three subagents in the scaffolded-project feature list.
- `CHANGELOG.md`: new `## [x.y.z]` entry (minor bump — additive feature).
- `TODO.md`: check off the B4 item under "Rules consolidation follow-ups".
- `docs/decisions/`: one new ADR (see Alignment).

### Out of this repo's editing — this workspace's own `.claude/skills/spec-execute`

`TODO.md` notes the shipped `templates/claude/skills/spec-*` and this workspace's adapted `.claude/skills/spec-*` should be kept in sync. The delegation change is about *scaffolded projects executing BlueStep tasks*; this repo is a Node CLI with no `b6p` components, so the workspace copy does **not** need the BlueStep implementer. **Resolved with user:** rather than mirror the change, add a `TODO.md` item proposing the *same delegate-to-subagent approach* for this repo's own `/spec-execute` (a generic implementer subagent for context isolation on large specs), so the idea is tracked without forcing a BlueStep-specific port into a non-BlueStep repo.

## Approach

`bluestep-dev` is split along the seam the requirements identified:

- **Knowledge layer** → already in `templates/claude/instructions/`. Untouched. The subagents *reference* it on demand via `instructions/index.md`; they do not restate it.
- **Workflow layer** → becomes the `b6p-task-implementer` system prompt.

The commenter and reviewer are near-direct ports of Brandon's files with three edits each: (1) drop the "Setup — Load Full Knowledge Base" block that reads eight `~/.claude/agents/bluestep-knowledge/*` paths (those don't exist in a scaffolded project) and replace it with "consult `.claude/instructions/index.md` on demand"; (2) align file paths to the `b6p`/component layout (`draft/README.md`, `draft/scripts/`, `info/`); (3) reviewer defaults to report-only.

All three get scoped `tools` frontmatter and English-only content.

### Subagent definitions (frontmatter `tools` scoping)

| Subagent | `tools` | Rationale |
|---|---|---|
| `b6p-task-implementer` | `Read, Edit, Write, Glob, Grep, Bash` | Reads declarations/source, edits/creates files; Bash for read-only shell (grep `B.d.ts`, `git status`) only — **never `tsc`** (hook-blocked; platform compiles on push). |
| `b6p-commenter` | `Read, Edit, Write, Glob, Grep` | README only; no compile needed. No Bash. |
| `b6p-code-review` | `Read, Edit, Glob, Grep` | Report-only by default; `Edit` present only for an explicit user-requested fix pass. No Write, no Bash. |

### `b6p-task-implementer` prompt — distilled workflow

Carries only the non-duplicated workflow from `bluestep-dev.md`:

1. Read the task's spec files (`requirements.md`, `design.md`, the one task in `tasks.md`).
2. **Read `declarations/index.d.ts` fully and grep `declarations/B.d.ts`** for needed APIs (the "manual IntelliSense" step) before writing code.
3. Consult `.claude/instructions/index.md` and open only the reference files the task needs.
4. Implement **exactly one** task; touch only the files it references; apply conventions.
5. Verify via the `PostToolUse` `ide_diagnostics` on touched files; fix any `Error` before returning. **Do not run `tsc`** — it is forbidden by the scaffolded "Critical rules" and hook-blocked; the platform compiles on push.
6. Return a **structured summary**: files changed, what/why (1–3 sentences), diagnostics result, anything flagged for the human. Do **not** mark the checkbox, invoke other subagents, or start the next task.

Note on the `tsc` resolution: the scaffolded `CLAUDE.md` rule "NEVER run `tsc` locally" (hook-enforced) is authoritative for the bspecs-scaffolded `/b6p-push` flow. The `instructions/conventions/snapshot-integrity` "ALWAYS run `tsc`" rule describes Brandon's personal `push.js --snapshot` workflow, which is **not** the scaffolded flow — so it does not apply to the implementer.

## Data / control flow

### Delegated `/spec-execute <feature> <task#>` (default)

```
main session (skill)                    b6p-task-implementer (isolated context)
─────────────────────                   ─────────────────────────────────────────────
1. parse args (feature, task#, --inline?)
2. read spec files; identify task
3. verify earlier deps are [x]
4. spawn implementer  ───────────────▶  read spec + declarations + scoped instructions
                                        implement ONE task; check diagnostics
   summary  ◀───────────────────────── return structured summary
5. surface git diff of the change
6. verify (ide_diagnostics + summary flags)
7. mark task [x] in tasks.md
8. keep CLAUDE.md/README/TODO in sync
9. STOP — show summary + diff; suggest
   optional /commenter then /code-review;
   tell user to approve before next task
```

The approval gate and all bookkeeping (steps 5–9) stay in the main session, so the user reviews real diffs and the checkbox only flips after a human-visible STOP. The subagent's verbose file reads (declarations, component source) never enter the main context — only its summary does.

### `--inline` path

Steps 4 collapses into in-session implementation (today's behavior verbatim). Everything else (verify, mark, sync, STOP) is unchanged. Intended for trivial tasks where spinning a fresh context and re-reading spec files isn't worth it.

### Commenter / reviewer (on-demand, after the STOP)

User explicitly invokes (e.g. `@b6p-commenter` or by asking). Each runs in its own context, reads the component files, and returns: commenter writes `draft/README.md` and prints a summary; reviewer prints the Critical/Warnings/Suggestions report and makes no edits. Neither is wired into a hook; neither auto-fires.

### Scaffold / sync flow (unchanged machinery)

`scaffold()` → `copyTemplateTree('claude', …)` → `walk()` recurses → `.claude/agents/{three files}` written. `SYNC_TARGETS` enumerates them → `bspecs.lock` records SHA-256 → `bspecs sync` keeps them current unless locally edited. No new code path.

## Edge cases

- **Subagent can't determine the error field for a flagged issue** — implementer/reviewer flag it for the human rather than guessing (mirrors Brandon's "flag, don't false-positive" rule).
- **`--inline` passed with a non-existent feature/task** — same validation/STOP as the default path; flag parsing must not swallow the feature/task args.
- **A task touches files outside one component** (e.g. a shared `objects/`): implementer still implements only the one task's referenced files; no scope creep.
- **Implementer must never run `tsc`** even if it sees a `tsconfig.json` — local compile is hook-blocked; it verifies via `ide_diagnostics` and relies on the platform compile at push time.
- **Existing meaningful `README.md`** — commenter augments, never clobbers (acceptance criterion).
- **Subagent returns but the diff is empty / nothing changed** — main session reports "no changes" and does **not** mark the task `[x]`.
- **`SYNC_EXCLUDE`** stays empty; the agents are meant to be synced like skills/instructions (not scaffold-once), so no exclusion entry is added.

## Alignment with existing patterns

- **Dynamic `SYNC_TARGETS` / Claude-only** (`docs/decisions/instruction-tree-and-claude-only.md`): the new folder rides the existing tree-walk with no hardcoding — exactly what that ADR set up. No `.github` mirror is produced.
- **Template engine & `.template` stripping** (`CLAUDE.md`): respected; agents are plain `.md` like skills.
- **English-only committed files** and **no Co-Authored-By in commits** (project memory): applied to the new files and the eventual commit.
- **Human-in-the-loop spec flow**: `/spec-execute`'s STOP-and-approve is preserved; delegation changes *where the reading happens*, not *who approves*.
- **No-duplication invariant** from consolidate-rules: enforced by making the subagents reference `instructions/` rather than inline knowledge.

**New patterns → ADR warranted.** Two non-obvious choices deserve a record in `docs/decisions/`:
1. **Subagents over skills** for these roles (context isolation + tool scoping), establishing `.claude/agents/` as a scaffolded primitive alongside skills.
2. **`/spec-execute` delegates by default** (with `--inline`), shifting task implementation into an isolated context.

Proposal: **one ADR** — `docs/decisions/subagents-and-delegated-execution.md` — covering both, since they're a single coherent decision (use subagents, and route execution through one). Settling the "one vs two ADRs" open question this way; flag if you'd rather split.

## Risks

- **Delegation hides intermediate reasoning.** The user sees a summary + diff, not the step-by-step. Mitigation: the diff is the source of truth at the STOP, and `--inline` exists for when the user wants to watch the work. Acceptable given the supervised approval gate.
- **Re-read overhead on trivial tasks.** A fresh subagent re-reads the (small) spec files each task. Mitigation: spec files are small; the expensive reads (component source) are exactly what we *want* isolated; `--inline` covers genuinely trivial edits.
- **Subagent invocation portability.** Need to confirm the skill's delegation instruction works across CLI/IDE surfaces (Open question). Verified manually, not by tests.
- **Workspace/template drift.** `TODO.md` wants `spec-*` skills kept in sync, but we're intentionally diverging here (this repo has no BlueStep components). Risk of future confusion. Mitigation: note the intentional divergence in `tasks.md` and the ADR.
- **Verification (no test suite).** Per `CLAUDE.md`: scaffold into a scratch dir and assert `.claude/agents/{three files}` exist with valid frontmatter; run `node cli.js -v/-h`; confirm `SYNC_TARGETS` includes the three agent paths (a one-off `node -e` import of `src/sync.js`). The skill/prompt edits are verified by re-reading the rendered files for well-formedness.
