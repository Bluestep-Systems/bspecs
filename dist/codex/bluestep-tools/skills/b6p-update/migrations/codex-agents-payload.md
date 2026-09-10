# Migration `codex-agents-payload` — Codex only, a reminder not an edit

**Detect.** Running in Codex, and either the bundled subagents have not been copied since the last
release that changed them, or hooks have not been re-trusted since the last release that changed a
hook definition.

**What it fixes.** Codex does not load bundled subagents from the plugin tree, and it runs hooks
only once the user has trusted them. Both are steps only the user can take, in their own
environment — so this migration **reports and instructs; it never writes**.

## Steps

1. **Say what is stale**, in one line each: the subagents copy, hook trust, or both.
2. **Point at `/b6p-init`**, which owns both steps and checks them before instructing. Do not
   restate its commands here — a copy of them in this asset would drift from the skill that
   actually performs them.
3. **Do not block anything on this.** The rest of a project's migrations apply regardless, and the
   platform rules stand on their own without hooks.

A release note that says "no hook definition changed" means this migration does not apply to that
release, however far behind the project is otherwise.
