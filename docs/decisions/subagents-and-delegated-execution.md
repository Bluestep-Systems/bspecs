# ADR: BlueStep subagents and delegated `/spec-execute`

**Status:** Accepted

**Date:** 2026-06-19

## Context

Brandon's team kit shipped three Claude Code **subagents** under `03-Agents/`: `bluestep-dev` (a 914-line BSJS development guide), `bluestep-commenter` (fills in a component README from code), and `bluestep-code-review` (BlueStep-aware review with auto-fix). The `consolidate-rules` spec (0.6.0) ingested only the *knowledge* under `03-Agents/bluestep-knowledge/` into `templates/claude/instructions/` and explicitly deferred converting the agent role files (follow-up B4 in `TODO.md`). This ADR records how B4 was resolved.

Two questions had to be answered before building anything:

1. **What primitive?** Skills (`SKILL.md`, run in the main conversation, invoked by `/name` or auto-loaded) vs. subagents (`.claude/agents/*.md`, run in their own isolated context, delegated/`@mention`ed). The project was 100% skills, and `TODO.md` literally said "convert into skills."
2. **How much to automate vs. supervise?** The whole spec flow is human-in-the-loop — `/spec-execute` STOPs after every task for approval. A separate, real pain point: nothing makes `/spec-execute` run task implementation in a separate context, so on a large feature the main session accumulates component source (often thousands of lines per file) and context grows too fast.

`bluestep-dev` itself was a special case: ~95% of its content was the platform knowledge `consolidate-rules` had *already* moved into the instructions tree. Re-creating it as an artifact would duplicate that tree and break that spec's "no duplicated rules" invariant.

## Decision

### (a) Build three **subagents**, not skills, under `templates/claude/agents/`

`b6p-task-implementer`, `b6p-commenter`, `b6p-code-review` (the `b6p-` prefix matches the existing `b6p-*` skills). Subagents were chosen over skills because all three do **file-heavy, isolatable work** — reading declarations and component source, producing a report — which is exactly the case the official docs cite for subagents ("isolating operations that produce large amounts of output… only the relevant summary returns to your main conversation"). Skills would run that bulk in the main context.

`bluestep-dev` is **not** rebuilt as a knowledge artifact. It splits along a seam:

- Its **knowledge** layer stays in `templates/claude/instructions/` (already there). The subagents *reference* `instructions/index.md` on demand instead of restating rules.
- Its **workflow** layer ("read `declarations/index.d.ts` first, grep `B.d.ts`, apply conventions, hand off") becomes the `b6p-task-implementer` system prompt.

`tools` is scoped per role: implementer `Read, Edit, Write, Glob, Grep, Bash`; commenter `Read, Edit, Write, Glob, Grep`; reviewer `Read, Edit, Glob, Grep` (Edit only for an explicit, opt-in fix pass).

### (b) `/spec-execute` delegates task implementation by default, with `--inline`

A `[CODE]` task is implemented by spawning `b6p-task-implementer` in its own context; it returns a structured summary, and the main session surfaces the git diff. `--inline` keeps the prior in-session behavior for trivial one-liners. **Supervision is unchanged** — the approval gate, checkbox flip, README sync, and STOP all stay in the main session; the user still reviews the diff. Delegation moves *where the reading happens*, not *who approves*. The expensive reads (declarations, component source) live in the subagent; the small spec files are the only re-read cost.

The commenter and reviewer are **on-demand only** — suggested at the `/spec-execute` STOP, never auto-fired. The reviewer is **report-only by default** (no surprise edits).

### (c) The implementer never runs `tsc`

The scaffolded `CLAUDE.md` critical rule "NEVER run `tsc` locally" (hook-enforced by `block-tsc.sh`) is authoritative for the bspecs `/b6p-push` flow; compilation happens at publish/snapshot (a plain push does not compile — corrected 0.13.0/0.15.0) and `ide_diagnostics` (PostToolUse hook) catch errors as you edit. The `instructions/conventions/snapshot-integrity` rule that says "ALWAYS run `tsc`" describes Brandon's personal `push.js --snapshot` workflow, which is **not** the scaffolded flow — so it does not apply to the implementer. The implementer verifies via diagnostics, not compilation.

## Options considered

**Primitive (skills vs. subagents):** skills (rejected — the file-heavy reads would run in the main context, defeating the whole point of isolating them; and the auto-load-by-description behavior is wrong for post-coding tools you invoke deliberately). Subagents give context isolation *and* per-role tool scoping.

**`bluestep-dev` as an artifact:** rebuild it as a skill/subagent (rejected — duplicates the instructions tree and violates `consolidate-rules`' no-duplication invariant). Keeping only its workflow layer in the implementer is the non-duplicative extraction.

**Delegation default:** inline-by-default with `--delegate` opt-in (rejected — the context-bloat pain is the default case on big features; opt-in protects no one who forgets the flag); a heuristic that delegates by file count or "large" design flag (rejected — fiddly to define and tune for marginal benefit). Delegate-by-default with `--inline` is the robust choice; the re-read overhead it adds is just the small spec files.

**Triggering commenter/reviewer:** auto-fire via a PostToolUse/Stop hook (rejected — PostToolUse is advisory and can't gate, and auto-firing clashes with the approve-every-task flow). On-demand suggestion at the STOP keeps the human in control.

**Reviewer auto-fix:** port Brandon's mechanical auto-fix as the default (rejected for now — surprise edits don't fit the supervised flow). Report-only by default; an opt-in fix pass exists but is not the default.

## Consequences

- **`.claude/agents/` is now a scaffolded primitive** alongside skills. It rides the existing `templates/claude/**` tree-walk, so `copyTemplateTree` and `SYNC_TARGETS`/`bspecs.lock` pick the files up with **no `src/` change** (see the dynamic-`SYNC_TARGETS` ADR).
- **Less intermediate visibility on delegated tasks** — the user sees a summary + diff, not the step-by-step. The diff at the STOP is the source of truth, and `--inline` exists when the user wants to watch the work.
- **Subagent invocation portability** across CLI/IDE surfaces is verified manually (no test suite); the skill instructs the main agent to spawn the implementer via the Task/Agent tool.
- **This repo's own `/spec-execute` intentionally does not get the BlueStep implementer** (it is a Node CLI with no `b6p` components). A `TODO.md` item proposes the same delegate-to-subagent pattern with a generic implementer for this repo separately.

## References

- Spec: `.claude/specs/bluestep-subagents/{requirements,design,tasks}.md`.
- Artifacts: `templates/claude/agents/{b6p-task-implementer,b6p-commenter,b6p-code-review}.md`; `templates/claude/skills/spec-execute/SKILL.md`.
- Source files: Brandon's `03-Agents/{bluestep-dev,bluestep-commenter,bluestep-code-review}.md`.
- Related: `docs/decisions/instruction-tree-and-claude-only.md` (dynamic `SYNC_TARGETS`, no-duplication invariant); `TODO.md` (B4).
