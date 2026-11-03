# ADR: Keep client data out of committed project files — block, don't rewrite

**Status:** Accepted (2026-11-02). **Amended 2026-11**: the write-time hook is now the separate
opt-in `phi-guard` plugin, and the detector exists as two checked copies (see the note under
decision 1).

**Date:** 2026-11-02

## Context

While debugging a component, agents copy real client and contact data — names, phone numbers,
emails, record titles — into docs, quick-task and spec files, code comments, README examples and
test fixtures. From there it lands in git history and in every clone. On one client project the
cleanup took redacting about 25 files, republishing 4 components and recreating the GitHub repo
from one clean commit (#248). Compiled `draft/.build/*.js` made it worse: each file carries its
TypeScript source as an inline base64 sourcemap, so text removed from the source stayed in the
repo until a publish and a pull.

The content-sanitization ADR keeps customer data out of the plugin's own content. Nothing kept it
out of the projects the plugin sets up.

What the agent tools offer:

- Claude Code has no built-in detection or masking of personal data. Its hooks can block a tool
  call (`PreToolUse`, exit 2, the reason reaches the model), rewrite a tool's input
  (`updatedInput`), or replace what the model sees from a tool's output (`PostToolUse`
  `updatedToolOutput`).
- Cursor's edit hook only warns after the write, and Codex runs hooks only once trusted.
- A git hook runs the same way whichever tool — or person — made the change.

## Decision

1. **One shared rule, one detector, three checks.** Rule 9 of the shipped `AGENTS.md`: placeholders
   in anything committed, record ids are fine, real data only in the git-ignored `.claude/scratch/`.
   One detector (`hooks/lib/phi-detect.sh`, POSIX `sh` + `awk`) finds phone numbers with separators,
   emails outside allowed domains and record titles that start with a short code in parentheses
   followed by a last and first name, and prints values cut to
   two characters. Three checks call it:
   - a `PreToolUse` hook on Edit/Write (`phi-guard.sh`), silent outside B6P projects;
   - a git `pre-commit` hook on the lines a commit adds — **the required gate**;
   - a git `pre-push` hook that runs the regex again and, if turned on, a model review.

   *(**Amended 2026-11:** the write-time hook left bluestep-tools and now ships as its own opt-in
   plugin, `phi-guard` (`plugins/phi-guard/`, hook `hooks/phi-guard.sh`). Not every client handles
   PHI, so whoever owns a machine that works on such projects installs it, once per machine (user
   scope); a project that does not want it turns it off with `"enabledPlugins":
   {"phi-guard@bluestep": false}` in its `.claude/settings.json`. The detector now exists as two
   copies, because a plugin cannot read another plugin's files: `hooks/lib/phi-detect.sh` in
   phi-guard, for the hook, and `skills/b6p-setup/assets/phi-guard/phi-detect.sh` in bluestep-tools,
   which `/b6p-setup`'s `phi-guard` migration copies into projects for the git checks.
   `npm run gen:check` fails if the two differ by a byte. The git checks are unchanged and still
   the required gate. On Claude Code, bluestep-tools' `SessionStart` canary nudges when a project runs the git check but the phi-guard plugin is not
   installed, so an update that drops the write-time check is announced, not silent. Paths in the
   text above are the ones of 2026-11-02, when everything lived in bluestep-tools.)*
2. **Block, never rewrite.** The write-time hook stops the write and tells the agent to use
   placeholders; it does not swap values itself with `updatedInput`. A silent rewrite on a false
   positive changes code or docs without anyone knowing, and mixes test data with replacements. A
   block keeps the agent — and the transcript — aware of what changed.
3. **No masking of tool output, for now.** Redacting what Read, Bash, MCP or the browser return
   (`updatedToolOutput`) would break the debugging that needs the real record to find it, and the
   data would still be on disk and already past the gateway. Revisit if a project needs the model
   to never see client data at all — that is a different requirement from keeping it out of git.
4. **The model review runs only at pre-push, only on the same provider, and only when turned on.**
   Names in free text have no reliable pattern, so an opt-in review (`git config
   bluestep.phiReview true`) sends the added lines of the pushed commits to `claude -p` on Haiku,
   with no tools and no project settings. The agent already saw that data in the session, so the
   review adds no new recipient. It is not in pre-commit (slow, non-deterministic, needs a network
   on every commit) nor in CI (by then the data is already on the remote). Its own failures — not
   installed, not logged in, timeout — warn and let the push through: the regex stays the gate.
   Any provider other than the one the sessions use is ruled out: it would be a new recipient.
5. **A local NER detector is the named alternative, not built.** A tool such as Microsoft Presidio
   keeps data on the machine and finds names, but needs Python and a language model on every dev
   box, which is the setup friction the hooks were rewritten to avoid. Revisit if the opt-in review
   is not enough.
6. **The git hooks are copied into the project and committed.** `/b6p-setup`'s `phi-guard`
   migration copies four scripts into `scripts/hooks/` with a version marker, sets
   `core.hooksPath` per clone, pins them to LF in `.gitattributes`, and refreshes them when the
   shipped marker moves. Pointing git at the plugin's install path instead would always be current,
   but teammates without the plugin, or on another tool, would get no check, and the path differs
   per machine.
7. **Escape hatches, not an off switch.** `phi-ok` on a line (test data only), a committed
   `.phi-allow` (literal values, `domain:<d>`, or `*` to turn the checks off for a project), and
   git's own `--no-verify`. The `*` entry is the stopgap until the general per-project opt-out
   ("opt-outs that stick") exists.

## Consequences

- An agent that writes real-looking data into a B6P project is stopped at the write on Claude Code
  and at the commit everywhere else. False positives cost a placeholder, a `phi-ok` or an allowlist
  line; the patterns require separators and known shapes to keep that rare.
- What a regex cannot see — names, addresses and dates in prose — is caught only by the opt-in
  review or a person reading the diff. The reference page says so plainly.
- Each clone has to run `/b6p-setup` once; committed scripts check nothing until git points at
  them.
- A change to the detector or the git scripts means bumping the marker in all four files together
  (`tools/test-hooks.sh` asserts they match), so projects pick up the refresh.
- Unproven at the time of writing: which folder Cursor and Codex hooks treat as the project root,
  Cursor-only names for the written text, and a logged-in live run of the model review.

Related: [content-sanitization-for-public-tooling.md](content-sanitization-for-public-tooling.md),
[per-project-migrations.md](per-project-migrations.md),
[cross-tool-plugin-output.md](cross-tool-plugin-output.md). Reference page:
`plugins/bluestep-tools/skills/bluestep-reference/conventions/client-data.md`. The opt-in hook:
[`plugins/phi-guard/README.md`](../../plugins/phi-guard/README.md).
