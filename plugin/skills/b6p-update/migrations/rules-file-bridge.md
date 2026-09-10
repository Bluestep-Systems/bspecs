# Migration `rules-file-bridge` — the rules move into `AGENTS.md`

**Says to the user:** "your rules are in the wrong file".

**Detect.** No `AGENTS.md`, but the tool-specific bridge file holds real rules. Or both files exist
and both hold real rules.

**What it fixes.** `AGENTS.md` is read natively by Cursor, Codex and most agents; Claude Code reads
it through a one-line bridge next to it. Rules kept in the bridge instead reach only Claude Code —
a teammate on another tool sees none of them.

## No `AGENTS.md` yet? Move the rules and say so.

The content moves verbatim; nothing is cut, nothing is reworded, and the project keeps working
exactly as before on every tool instead of one. That has one correct answer, so do it:

> `riverside-forms` — moved your rules from `CLAUDE.md` into `AGENTS.md`, unchanged. `CLAUDE.md` is
> now the one-line import. Cursor and Codex can read these rules now; before, only Claude Code
> could.

Replace the bridge with the shipped one-liner at
`${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/CLAUDE.md.template`, whose only job is to import `AGENTS.md`.

The moved content is then an out-of-date rules file, so continue into `rules-template` on the result
— including its cheap check, which usually finds the whole thing is template text.

## Both files hold real rules? Ask.

Do not merge and do not clobber. Two files of rules is a state someone created on purpose or by
accident, and only they know which. Show what is in each — line counts, and enough content to tell
them apart — and ask which should be the real one.

Keep the question concrete: "Which of these is the one you maintain?", with the option to leave both
alone.

## If they decline

Leave both files exactly as they are, and say the consequence in one line: agents that read only
`AGENTS.md` — Cursor, Codex — will not see those rules.
