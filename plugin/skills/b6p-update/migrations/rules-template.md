# Migration `rules-template` — the always-on rules file becomes the current short one

**Detect.** `AGENTS.md`'s `<!-- bluestep-tools rules-template N -->` marker is below the marker in
`${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/AGENTS.md.template`, or it has no marker at all
while carrying B6P rules (files from before the marker are recognisable by a
`## Critical rules (always apply)` heading). No marker means version 1.

**What it fixes.** Earlier templates carried the whole platform reference in the always-on file. The
shipped template carries only what must be true on every turn; everything longer is served on demand
by the `bluestep-reference` skill and the `/b6p-*` skills. The old file still works — it just pays
for that content on every turn of every session.

## Steps

### 1. Separate the project's own lines from template text

Where the file is tracked, `git -C <dir> log -p --follow -- AGENTS.md` shows the scaffolded version
as its first commit and every line added since — that is the reliable answer.

Otherwise diff against `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/legacy/AGENTS.md.v1.template`,
the last pre-split template. Revisions before it differ by a few lines, so read a near match as
template text.

The title line and a `**Scaffolded:**` line are per-project header, not rules.

### 2. Show the list, and let the user correct it

Print the lines you take to be the project's own, and ask before going further. Where a line could
be either, keep it and name it as one you were unsure about — the user recognises their own rule
faster than any diff will.

### 3. Propose cuts, one chunk at a time, with a reason each

Carrying every line over verbatim is the failure mode this step exists to prevent: done that way, a
swap can keep several times the lines a proper sort would leave, and the project pays for them on
every turn from then on. So after the carry-over list, walk the chunks:

| Chunk | Proposal | Reason to give |
|---|---|---|
| Restates a `docs/` page, or the component `README.md` files | one pointer line | The doc is the source of truth and is read when the task needs it; two copies drift apart, and the stale one wins by being always-on. |
| A table or procedure only one skill uses | move it verbatim into a `docs/` page, leave a two-line pointer | It is needed in the sessions that run that skill, not on every turn of the ones that do not. |
| A dated rule, or one naming a ticket | **keep it** | A live decision with an owner and an end date. |
| A description of what the system is | one paragraph, then a pointer | Orientation, not a rule. |
| A rule the shipped template now covers | drop it | It arrives from the plugin, and a stale copy of it silently overrides the fixed version. |

One chunk per question, each with its reason, and the user accepts or keeps each. Bundling them
into one question turns a series of judgements into a yes-or-no nobody can answer well, and a chunk
the user keeps is settled — do not raise it again in the same run.

Where the project keeps a decisions log, offer to record what moved and why in the same change.

### 4. Write

Build the new `AGENTS.md` from `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/AGENTS.md.template`
with `{{PROJECT_NAME}}` substituted, keeping the existing file's title line as line 1 — it may carry
a client name the template no longer asks for — and its `**Scaffolded:**` line if it has one. Append
what survived under a `## Project rules` heading, before the `## Compaction` section.

Show the new file and the line count before and after, then write it, along with any `docs/` page a
chunk moved into, in the same change so no pointer dangles.

Leave the bridge file alone. In Claude Code the one-line `CLAUDE.md` that imports `AGENTS.md` is
already correct; a bridge holding rules instead is the `rules-file-bridge` migration's job.
