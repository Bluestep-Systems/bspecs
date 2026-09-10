# Migration `codex-agents-payload` — Codex only, a note not an edit

**Says to the user:** "Codex needs its subagents re-copied" / "Codex needs hooks re-trusted" —
whichever applies.

**Detect.** Running in Codex, and either the bundled subagents have not been copied since the last
release that changed them, or hooks have not been re-trusted since the last release that changed a
hook definition.

**What it fixes.** Codex does not load bundled subagents from the plugin tree, and it runs hooks
only once the user has trusted them. Both are steps only the user can take, in their own
environment — so this migration **reports and instructs; it never writes and never asks**.

## Steps

1. **Say what is stale**, one line each: the subagents copy, hook trust, or both.
2. **Point at `/b6p-init`**, which owns both steps and checks them before instructing. Do not
   restate its commands here — a copy of them would drift from the skill that performs them.
3. **Do not block anything on this.** The rest of a project's changes apply regardless, and the
   platform rules stand on their own without hooks.

There is no question to ask: the user cannot delegate these steps, and nothing here depends on their
answer. It belongs in the closing report, not in a prompt.

A release note that says "no hook definition changed" means this migration does not apply to that
release, however far behind the project is otherwise.
