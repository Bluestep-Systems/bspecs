# ADR: Snapshot is the recommended default push mode

**Status:** Accepted (2026-07-23)

**Date:** 2026-07-23

## Context

Every `b6p push` offered through the tooling presents a **plain-vs-snapshot** choice. Until now the rules
framed that choice **neutrally** and forbade ever recommending one side:

- `/b6p-push` step 3: *"Present two options, neutrally (neither marked 'recommended')."*
- The scaffolded project `CLAUDE.md` rule 9: *"ALWAYS present the plain-vs-snapshot choice … and NEVER
  snapshot (or plain-push) silently."*

A **snapshot** (`b6p push --snapshot --message`) records a restorable, versioned server-side history entry;
a **plain push** overwrites the draft on the platform with no history.

In practice users have stopped choosing plain push. A snapshot is what they want almost every time —
the restorable history is cheap insurance, and losing it is the expensive outcome. The neutral framing made
the common, safer choice cost the same number of decisions as the rare one, and `/b6p-push` step 3 compounded
that with a diff-summary-then-conversation flow to draft the message. A user (Steve Pyrah) filed
[ClickUp 86bb23pu5](https://app.clickup.com/t/86bb23pu5) asking for a tighter flow with snapshot recommended.

This also resolves the long-standing open question in `TODO.md` — *"Auto-snapshot in push (still
undecided)"* — which asked whether a push should ever become a snapshot automatically.

## Decision

**Make snapshot the recommended, pre-selected default everywhere a component push is offered — while
keeping the push an explicit choice that never happens silently or automatically.**

Concretely:

1. **`/b6p-push` step 3 becomes two tight `AskUserQuestion` prompts:**
   - *"Push mode?"* → `Snapshot (Recommended)`, `Push Only` (the tool auto-adds "Other").
   - If Snapshot: *"Snapshot message?"* → `Use recommended title (Recommended)` (pre-filled with a
     commit-style summary drafted from the diff), `Let me write my own` (free text via "Other").
2. **The same posture reaches every push surface** — the scaffolded `CLAUDE.md` rule, the `/b6p-push`
   skill, and the `/quick-task` push step all recommend snapshot by default. The full flow lives once in
   `/b6p-push`; the other surfaces point at it and carry only a one-line push-vs-snapshot difference
   statement (no-duplication invariant).
3. **The never-silent guarantee is preserved.** Snapshot is *pre-marked*, never *pre-executed*. A push
   still happens only after an explicit selection. The wording that forbade **silent/automatic**
   snapshotting stays; only the "neither marked recommended" neutrality is dropped.

## Rejected alternative — true auto-snapshot

Making a push **automatically** become a snapshot (auto-drafted message) unless the user opts out was
considered and rejected. It would break the never-silent guarantee, take the message-quality decision away
from the user, and surprise anyone who genuinely wanted a plain push. "Recommended and pre-selected" gets
the ergonomic win of a default without the loss of control.

In particular, **`/spec-execute` gains no per-task push or snapshot behavior.** Finishing a `[CODE]` task
does not push and does not prompt for a snapshot mid-task; pushing stays a deliberate, separate `/b6p-push`
action. This is the specific "auto-snapshot on task completion" idea the `TODO.md` item floated — now
explicitly declined.

## Consequences

- The common case (snapshot with a drafted message) is one confirming click instead of a neutral fork plus
  a conversational message round.
- The rules read consistently across surfaces and state the push-vs-snapshot difference plainly.
- Plain push remains fully available — it is `Push Only`, one selection away.
- No change to the `b6p` CLI or the `--snapshot --message` argument shape; this is a tooling-policy and
  prompt-shape change only. Sync stays on the b6p CLI (unchanged by the platform-MCP ADR).
- Ships in plugin **0.13.0**; the `TODO.md` "Auto-snapshot in push (still undecided)" item is resolved by
  this ADR.

## References

- ClickUp [86bb23pu5](https://app.clickup.com/t/86bb23pu5) — the "[change rule]" request (Steve Pyrah).
- `TODO.md` → "b6p CLI integration — wave 2" → *"Auto-snapshot in push (still undecided)"* — resolved here.
- `plugin/skills/b6p-push/SKILL.md` — the source-of-truth flow.
- `plugin/skills/bluestep-init/templates/CLAUDE.md.template` — the scaffolded always-on rule.
- Spec: `.claude/specs/snapshot-default-push/`.
