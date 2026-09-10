# ADR: Per-project migrations live in `/b6p-update` as data assets

**Status:** Accepted (2026-09-10)

**Date:** 2026-09-10

## Context

Plugin 0.33.0 cut the scaffolded project `AGENTS.md` from 142 lines to about 40 and moved the rest
into on-demand skills. That change reaches **new** projects only. `/project-init` is non-destructive
by design — it skips any file that already exists — so every project set up before 0.33.0 kept its
long copy, which an agent re-reads on **every turn** of every session there.

Nothing told those users a shorter file existed, and nothing performed the swap. Three options were
on the table:

1. **A check in the `SessionStart` hook** that warns when the project's rules file is out of date.
   Rejected: it would fire in every session forever, and there is no way to know when the last old
   file is gone, so the check could never be removed. A permanent warning for a finite problem.
2. **A hand-written checklist per release** (in the CHANGELOG, or a docs page). Rejected: it puts the
   work on each user to read, interpret and execute correctly across every project they own, and it
   ages badly — nobody goes back to a release-old checklist.
3. **A skill that performs the migration.** Chosen.

The second question was where the *content* of each release's migration lives. Writing the steps into
the skill body is the obvious answer and the wrong one: the skill would grow a section per release,
old sections would be indistinguishable from live ones, and the always-on cost of the skill's own
description would creep up — reproducing, inside the tooling, exactly the problem the tooling exists
to fix.

## Decision

**`/b6p-update` is a release-agnostic procedure; each migration is a data asset it reads.**

```
plugin/skills/b6p-update/
├── SKILL.md                    ← the procedure and the guardrails. Release-agnostic.
├── migrations/
│   ├── index.md                ← catalogue: id | detect | asset | remove when
│   └── <id>.md                 ← one per migration: detect, what it fixes, steps
└── references/
    └── project-index.md        ← per-tool: where the list of opened directories lives
```

The skill reads `migrations/index.md` on every run, runs each detector, and then reads **only** the
assets whose detector matched. A later release adds one row and one file. **The procedure file does
not change**, and a migration that is no longer live is deleted rather than left to be guessed at.

Four properties make this hold up over releases:

- **Detectors read the project, not the release.** A marker (`<!-- bluestep-tools rules-template N -->`),
  a pre-split heading, a missing settings key. A project can be many releases behind, or have been
  half-migrated by hand, and a detector that inspects the file still gives the right answer where one
  keyed to a version number would not.
- **The current version is read from the shipped template's own marker**, never written into prose.
  Nothing to bump in two places, nothing to go stale.
- **Every migration carries a "remove when" condition** in the catalogue, so the set shrinks as well
  as grows.
- **Numbers about the user's files are measured from the files.** A cost quoted from a skill would be
  a number about somebody else's project.

The four guardrails in `SKILL.md` apply to every migration, present and future: report before
writing (a table, then the user picks); never drop a line silently (carry project lines over, then
propose cuts one chunk at a time with a reason each, accepted or kept individually); never commit or
stage (edits outside the session root are left as reviewable diffs); and touch only what a matched
migration names.

`/project-init` keeps first-time setup and hands the long-`AGENTS.md` swap to `/b6p-update` in one
line — one project at a time was never the right shape for a migration that spans a machine.

## Consequences

**Good.** Adding a migration is additive and reviewable — a row and a file, no edit to shared
procedure, so one release's migration cannot break another's. The catalogue is the honest inventory
of what a project can be behind on. Users get one command after a plugin update instead of a
per-release checklist, and the `SessionStart` hook stays free of a permanent warning.

**Costs and risks.**

- **The skill only helps someone who runs it.** The nudge is the release email (`/release-email`,
  which composes from `CHANGELOG.md`) and the README's "Keeping it updated" section. If neither
  reaches a user, their project stays behind — and unlike option 1, nothing in-session says so. That
  is the accepted trade for not shipping a permanent hook check.
- **`all` mode reads tool-internal stores** — see `references/project-index.md`. These are
  undocumented, differ per tool, and move between tool versions. They are read-only and the skill
  falls back to `here` plus a subfolder scan when a store is missing or has changed shape, but this
  is the part of the skill most likely to need maintenance.
- **Reach differs per tool.** Claude Code indexes every directory ever opened; Cursor keeps a short
  recently-opened list; Codex records one `cwd` per retained session. So `all` is a best-effort
  sweep, not a guarantee, and it must say which kind of list it read.
- **A migration author has to resist the obvious.** The temptation on any awkward case is to add a
  special case to `SKILL.md`. The rule is the opposite: a case the procedure cannot express is a gap
  in the procedure, reported with `/bspecs-feedback`.

## Addendum, 2026-09-10 (plugin 0.35.0): asking is a cost, not a safety measure

The first real run — a sweep that updated four projects — asked seven questions. For three of the
four there was nothing to decide: the diff and the git history both showed the old rules file was
unmodified template text, the skill said so, and then it asked "did I miss anything you added by
hand?" anyway.

That is the wrong instinct twice over. It spends the user's attention on a settled question, and
attention spent on settled questions is not available for the unsettled ones — a run that asks seven
times trains someone to approve without reading. The guardrail it was serving ("never drop a project
line silently") is better served by a table shown before the write: the user sees every chunk at
once, in context, with what happens to each, instead of judging chunk 3 blind and then chunk 4.

So the rule is now **a step with one correct answer is performed, not offered**, and the test is
whether the user can answer better than the skill can. Where the default is the safe one — keep the
line, add the absent key, move the content verbatim — an unanswered question would resolve the same
way, which is the tell that it should never have been asked.

Two cases keep their question because both options are legitimate and nothing in the project decides
between them: a settings key that already holds a different value, and both `AGENTS.md` and the
bridge file holding real rules. One case keeps a single approval because it contains real judgement:
a rules file that did grow project lines.

This shifts weight onto the reasons in the table. When a user approved chunk by chunk, a shaky
classification got caught by them; approving a batch means a confident wrong reason passes. Hence
the added requirement to open a `docs/` page before claiming a chunk restates it, and to show kept
chunks alongside cut ones — a skill built to shorten files leans toward cutting, and the kept rows
are the counterweight.

## Related

- `docs/decisions/plugin-context-delivery-model.md` — why always-on context is a scaffolded project
  file and not something a plugin can ship, which is what makes the per-project swap necessary at all.
- `docs/decisions/release-update-email.md` — the mechanism that tells users a migration is waiting.
- `CHANGELOG.md`, plugin 0.33.0 (the short template) and 0.34.0 (this skill).
