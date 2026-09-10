# Migration `rules-template` — the always-on rules file becomes the current short one

**Says to the user:** "rules file is out of date".

**Detect.** `AGENTS.md`'s `<!-- bluestep-tools rules-template N -->` marker is below the marker in
`../../project-init/templates/AGENTS.md.template` (relative to this file), or it has no marker at all
while carrying B6P rules (files from before the marker are recognisable by a
`## Critical rules (always apply)` heading). No marker means version 1.

**What it fixes.** Earlier templates carried the whole platform reference in the always-on file. The
shipped template carries only what must be true on every turn; everything longer is served on demand
by the `bluestep-reference` skill and the `/b6p-*` skills. The old file still works — it just pays
for that content on every turn of every session.

## Step 1 — Find out whether the project added anything (cheap check first)

Diff the file against `../../project-init/templates/legacy/AGENTS.md.v1.template`,
the last pre-split template. Revisions before it differ by a few lines, so read a near match as
template text. The title line and a `**Scaffolded:**` line are per-project header, not rules.

This one command usually settles it. **Most old rules files turn out to be unmodified template
text** — they were hand-updated to track each template release and never grew rules of their own.

Reach for `git -C <dir> log -p --follow -- AGENTS.md` **only when the diff leaves something genuinely
ambiguous**. It is the more reliable answer — the scaffolded version is its first commit and every
line added since is visible — but it costs far more, and on a sweep that cost is paid per project for
an answer the diff already gave.

## Step 2 — Nothing of the project's own? Then just do it.

Go straight to step 4 and report it afterwards. There is no decision here, so there is nothing to
put in front of the user. Say it in the report like this:

> `northwind-intake` — swapped, 136 → 48 lines. Every line was template text; nothing of yours to
> keep.

Do **not** ask "did I miss anything you added by hand?". The diff and the history are better at that
question than memory is, and asking it on a file that is provably unmodified trains people to click
through the prompts that do matter.

## Step 3 — The project did add lines: decide, then show one table

Sort every added chunk yourself, using the reasons below. Then show **one** table and take **one**
approval for this project.

| Chunk | What to do | Reason to give the user |
|---|---|---|
| Restates a `docs/` page, or the component `README.md` files | replace with one pointer line | The doc is the real source and gets read when a task needs it. Two copies drift, and the stale one wins by being always-on. |
| A table or procedure only one skill uses | move it into a `docs/` page as-is, leave a two-line pointer | Needed in the sessions that run that skill, not on every turn of the ones that do not. |
| A dated rule, or one naming a ticket | **keep** | A live decision with an owner and an end date. |
| A description of what the system is | one paragraph, then a pointer | Orientation, not a rule. |
| A rule the shipped template now covers | drop | It comes from the plugin now, and a stale copy of it silently overrides the fixed version. |
| Anything you cannot classify | **keep** | Safe default. Mark it kept in the table and say you were unsure. |

**Read the docs pages before claiming a chunk restates one.** "This is already in
`docs/ARCHITECTURE.md`" is a claim about a file — open it and check. A confident wrong reason in the
table is worse than no table, because the user is approving a batch on the strength of those reasons.

The table shows **every** chunk, including the ones you kept. A skill built to shorten files leans
toward cutting; showing what you chose not to touch is what makes the table reviewable rather than a
result to rubber-stamp.

```
Your lines in this file — what I'd do with each:

  KEEP     ClickUp reads (3 lines)          project-specific script, needed every turn
  KEEP     Complexity markers (5 lines)     dated rule, names bspecs#156
  POINTER  System description (14 lines)    → 1 line pointing at docs/ARCHITECTURE.md, which
                                              already has the component list (checked)
  MOVE     Model routing table (20 lines)   → docs/model-routing.md, 2-line pointer left behind;
                                              only /spec-execute uses it
  KEEP     "Pull before editing" (2 lines)  unsure if this is yours or an old template line

Result: 154 lines → about 73. Everything above is either kept or one pointer away.
Go ahead, or tell me which to keep as-is?
```

Take the answer as final for this project — a chunk the user keeps is settled; do not raise it again.

## Step 4 — Write

Build the new `AGENTS.md` from `../../project-init/templates/AGENTS.md.template`
with `{{PROJECT_NAME}}` substituted, keeping the existing file's title line as line 1 — it may carry
a client name the template no longer asks for — and its `**Scaffolded:**` line if it has one. Append
what survived under a `## Project rules` heading, before the `## Compaction` section.

Write any `docs/` page a chunk moved into during the same change, so no pointer dangles.

Leave the bridge file alone. In Claude Code the one-line `CLAUDE.md` that imports `AGENTS.md` is
already correct; a bridge holding rules instead is the `rules-file-bridge` migration's job.
