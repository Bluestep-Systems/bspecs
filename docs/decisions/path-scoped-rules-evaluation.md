# ADR: Path-scoped rules (`.claude/rules/`) vs. the on-demand instruction tree

**Status:** Accepted

**Date:** 2026-06-26

## Context

Claude Code shipped **path-scoped rules**: markdown files under `.claude/rules/**`
with a `paths:` frontmatter glob, where the rule's body auto-loads into context
*only* when Claude reads a file matching the glob. This is a more native version of
the pattern the scaffolder builds by hand today — the [`instruction-tree-and-claude-only`
ADR](instruction-tree-and-claude-only.md) established a `templates/claude/instructions/`
tree (two Tier-2 overviews, an `index.md` manifest, and ~50 atomic single-topic files
under `reference/`, `conventions/`, `gotchas/`), none `@`-imported; the scaffolded
`CLAUDE.md` tells the agent to consult `index.md` first, then read the one relevant
file on demand.

The [TODO "Template staleness" item](../../TODO.md) flagged this for its own ADR —
explicitly *not* a tightening-pass fold-in — because it intersects that Accepted ADR
(Claude-only scaffolding + the dynamic `SYNC_TARGETS` walk over `templates/claude/**`).
This ADR decides: replace, augment, or reject.

### Feature state (verified against docs + open issues, June 2026)

Confirmed against the official memory docs (`code.claude.com/docs/en/memory`) and the
Claude Code issue tracker — not from memory:

- **Location / discovery.** `.claude/rules/**/*.md` (project) or `~/.claude/rules/**`
  (user). Discovered recursively; no hardcoded list.
- **Frontmatter.** `paths:` is a list of globs (gitignore/minimatch style, brace
  expansion, no negation). A rule with **no** `paths` loads **unconditionally**, at
  session start, exactly like `CLAUDE.md`.
- **Trigger.** A path-scoped rule loads when Claude **reads** a file matching the glob.
- **Precedence.** Always-on rules and `CLAUDE.md` load first; path-scoped rules layer
  in when their files are read. Separate mechanism from `@`-imports (always expanded)
  and skills (load via `/name`).

**Limitations that bear directly on the B6P use case:**

- **Write/Edit does not trigger rules** ([#23478](https://github.com/anthropics/claude-code/issues/23478)).
  A rule fires on *reading* an existing matching file, not on creating or editing one.
- **Auto-load is unreliable even on matching reads** ([#16853](https://github.com/anthropics/claude-code/issues/16853)).
- **User-level path rules are silently ignored** ([#21858](https://github.com/anthropics/claude-code/issues/21858)) — project-level only, in practice.
- **Subagents do not inherit** path-scoped rules — relevant because `/spec-execute`
  delegates implementation to `b6p-task-implementer` (see
  [`subagents-and-delegated-execution`](subagents-and-delegated-execution.md)).

## Decision

**Reject path-scoped rules for now. Keep the `index.md` + on-demand instruction tree.**
Record a concrete revisit trigger (below) so this is re-evaluated when the feature's
gaps close, rather than left to rot.

The rejection is on **semantic fit**, not on sync or the Claude-only invariant — those
two would actually accommodate rules cleanly (see "Comparison"). The tree wins on the
axis that matters: how B6P knowledge is *keyed*.

### Why the model doesn't fit

1. **Our knowledge is intent-keyed, not path-keyed.** Every atomic file triggers on
   *what the task does* — "load when writing a DateTimeField", "load when filtering a
   query by a date field", "load when aborting a save from a formula". B6P component
   files are overwhelmingly `*.ts` (BsJs) and `*.js` (RelateScript) with **no path
   signal** that distinguishes a file that writes a DateTimeField from one that parses
   a CSV. A `U######/**/*.ts` glob can't select `datetime-field-write.md` over the
   other ~30 reference files — it can only select *all* of them (which destroys the
   context savings and recreates exactly the always-on bloat the intersecting ADR and
   the `CLAUDE.md`-tightening TODO item are protecting against) or a coarse overview
   (which the Tier-2 `bsjs-development.md` already is, already on demand).

2. **The dominant B6P workflow is *writing* code, and rules don't fire on writes**
   ([#23478](https://github.com/anthropics/claude-code/issues/23478)). The agent in a
   scaffolded project mostly generates and edits endpoints, MergeReports, and formulas.
   A rule scoped to `**/*.ts` would silently fail to load during the exact operation it
   exists to guide. The `index.md` route has no such blind spot — the agent consults it
   by intent regardless of read vs. write.

3. **Discoverability is worse for intent-keyed knowledge.** `index.md` is a manifest
   the agent can *reason over* — every entry carries a "Load when <trigger>" the agent
   matches against the task. Rules are invisible until a path matches; the agent cannot
   choose to consult them by intent, and cannot fall back to `grep -ri "<term>"
   .claude/instructions/` the way the index explicitly offers.

4. **The unconditional-load default is a footgun.** A rules file authored without
   `paths` loads every session like `CLAUDE.md`. In a 50-file tree maintained by many
   hands, one omitted `paths:` silently regresses the no-auto-load discipline that is
   the whole point of the current design.

5. **Reliability + subagent gaps.** Unreliable auto-load ([#16853](https://github.com/anthropics/claude-code/issues/16853)),
   broken user-level rules ([#21858](https://github.com/anthropics/claude-code/issues/21858)),
   and no subagent inheritance mean even the genuinely path-scoped facts wouldn't reach
   `b6p-task-implementer`, which does the bulk of the writing.

## Comparison summary

| Axis | `index.md` + on-demand tree (today) | `.claude/rules/` path-scoped |
| --- | --- | --- |
| **What loads when** | `CLAUDE.md` only at start; `index.md` (~80 lines) + one atomic file when intent calls for it | `CLAUDE.md` + any no-`paths` rule at start; path rules on *read* of a matching file |
| **Keying** | Task **intent** (matches our knowledge) | File **path glob** (mismatched — B6P files are undifferentiated `.ts`/`.js`) |
| **Write-heavy work** | Always available (agent consults by intent) | Silent miss — rules fire on read, not write/edit |
| **Discoverability** | Reasoned manifest + `grep` fallback | Invisible until a path matches; no intent route |
| **Sync mechanics** | `SYNC_TARGETS` walk of `templates/claude/**` + `bspecs.lock` picks up every file automatically | **Same** — `templates/claude/rules/**` is under the walk; zero code change |
| **Claude-only invariant** | Preserved | **Preserved** — rules are a Claude Code feature, no `.github` mirror |
| **Subagents** | `b6p-task-implementer` reads `instructions/` in its own context | Not inherited |

Sync and the Claude-only invariant are **neutral-to-favorable** for rules: a
`templates/claude/rules/` folder would flow through `enumerateClaudeTargets` and
`bspecs.lock` with no edit to `src/sync.js`, and rules carry no Copilot baggage. The
decision turns entirely on keying, the write-trigger gap, and reliability.

## Revisit trigger (the "augment" path, deferred)

Reconsider a **thin augment** — never a replace — when **both**: Write/Edit triggers
rules ([#23478](https://github.com/anthropics/claude-code/issues/23478) resolved) **and**
auto-load reliability is confirmed ([#16853](https://github.com/anthropics/claude-code/issues/16853) resolved).
At that point a small set of *genuinely path-determined* facts could move to
`templates/claude/rules/`, leaving the intent-keyed topic tree untouched:

- `**/*.js` → "this is **RelateScript**, not standard JavaScript" (no `var`/`let`/`const`,
  double-backtick strings, typed arrays). The single highest-value path-determined fact;
  today it lives in `CLAUDE.md`.
- `**/declarations/**/*.d.ts` → "platform-generated, never hand-edit."
- `**/static/**` → the server/client split and the single-`script.ts` compile rule
  (`conventions/single-script.md`, `reference/merge-report-static-index.md`).

Mechanics if/when this happens: drop the files under `templates/claude/rules/` with
`paths:` frontmatter; `SYNC_TARGETS`/`bspecs.lock` pick them up with no `sync.js` change;
remove the now-duplicated prose from `CLAUDE.md`/overviews in the same change to keep the
no-duplication invariant; and verify `b6p-task-implementer` still gets the facts (it
won't inherit rules — so the subagent's own `instructions/` reads must still cover them,
or the facts stay in both places by design). Even then, the ~50 intent-keyed atomic
files stay in `instructions/` — they have no honest path mapping.

## Consequences

- **No change to the scaffolded tree or `sync.js`.** The `instruction-tree-and-claude-only`
  design stands; this ADR confirms it survives the path-scoped-rules feature rather than
  being superseded by it.
- **The TODO item is resolved** ([TODO "Template staleness"](../../TODO.md)) — marked
  done with a pointer here.
- **Re-evaluation is gated, not forgotten.** The revisit trigger above is concrete
  (two named issues); when they close, the augment is a small, well-scoped change.
- **No new mechanism, no second source of truth, no second discovery model.** Avoiding a
  parallel `rules/` + `instructions/` split keeps maintenance on one tree.

## References

- Intersecting ADR: [`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md)
  (dynamic `SYNC_TARGETS`, Claude-only scaffolding).
- Related: [`subagents-and-delegated-execution.md`](subagents-and-delegated-execution.md)
  (`b6p-task-implementer` delegation — subagents don't inherit rules).
- TODO: "Template staleness — Evaluate path-scoped rules" in [`TODO.md`](../../TODO.md).
- Code: `src/sync.js` (`SYNC_TARGETS`, `SYNC_EXCLUDE`), `src/utils.js`
  (`enumerateClaudeTargets`); scaffolded entry point `templates/root/CLAUDE.md.template`
  → `templates/claude/instructions/index.md.template`.
- Feature docs: Claude Code memory docs (`code.claude.com/docs/en/memory`).
- Open issues bearing on the decision:
  [#23478](https://github.com/anthropics/claude-code/issues/23478) (write doesn't trigger),
  [#16853](https://github.com/anthropics/claude-code/issues/16853) (unreliable auto-load),
  [#21858](https://github.com/anthropics/claude-code/issues/21858) (user-level path rules ignored).
