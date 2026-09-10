# Migration `rules-file-bridge` — the rules move into `AGENTS.md`

**Detect.** No `AGENTS.md`, but the tool-specific bridge file holds real rules. Or both files exist
and both hold real rules.

**What it fixes.** `AGENTS.md` is read natively by Cursor, Codex and most agents; Claude Code reads
it through a one-line bridge next to it. Rules kept in the bridge instead reach only Claude Code —
a teammate on another tool sees none of them.

**This is an offer, never automatic.** A project whose rules sit in the bridge file still works in
Claude Code. Nothing is broken, so nothing is forced.

## Steps

1. **Show what is in each file.** Line counts, and enough of the content for the user to see what
   would move.
2. **When `AGENTS.md` does not exist:** offer to move the bridge file's content into it verbatim, then replace the bridge with the shipped one-liner at `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/CLAUDE.md.template`, whose only job is to import `AGENTS.md`.
3. **When both files exist and both hold rules:** do not merge and do not clobber. Show both and
   let the user say what should happen. Two files of rules is a decision only they can make.
4. **When the user declines:** leave both files exactly as they are, and say the consequence —
   agents that read only `AGENTS.md` (Cursor, Codex) will not see those rules.

Content that has just moved into `AGENTS.md` is an un-migrated rules file, so re-run the
`rules-template` detector on the result and continue there if it matches.
