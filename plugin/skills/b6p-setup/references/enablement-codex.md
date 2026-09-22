# Codex — plugin enablement, hook trust and the subagents copy (read by `/b6p-setup` step 1)

Applies when `/b6p-setup` runs inside Codex.


If `/b6p-setup` is running in Codex, the marketplace and the plugin are already installed. (For a teammate who has not installed yet: `codex plugin marketplace add Bluestep-Systems/bspecs` — CLI, or the same repo from the plugins screen in the desktop app — then install `bluestep-tools` from it.)

What remains are two steps that are easy to miss and that the tooling genuinely depends on:

- **Trust the hooks — they silently do nothing until you do.** Open the plugin's page and use **Review → trust** on its hooks (`/hooks` in the CLI). An untrusted hook produces no error and no log; the guardrails simply never run. **Re-trust is required after any release that changes a hook definition**, so re-check this after a plugin update. Check `ls ~/.codex/agents/` while you are here (next bullet).
- **Subagents do not come from the plugin on Codex.** A plugin cannot register them there, so the three BlueStep subagents have to be copied by hand into `~/.codex/agents/` — once per machine, covers every project. (A project's own `.codex/agents/` also works, but then it is a per-project step.) The three files are `b6p_task_implementer.toml`, `b6p_commenter.toml` and `b6p_code_review.toml` (TOML, underscore names — hyphens are not valid agent names on Codex). They sit in the installed plugin's `agents/` folder, next to its `skills/` folder, and in the bspecs repo at `dist/codex/bluestep-tools/agents/` (`https://github.com/Bluestep-Systems/bspecs/tree/main/dist/codex/bluestep-tools/agents`). If you can find the installed plugin's `agents/` folder, give the user the exact `cp` command for the three files into `~/.codex/agents/` — hand it over, do not run it (`~/.codex/` is outside the project); otherwise give them the three filenames and the repo path. Until the copy is done, say plainly that delegation is unavailable on Codex and the spec skills run in-session instead of handing work to a subagent. Do not pretend a subagent exists.

The gateway MCP server ships with the plugin and comes up once `B6PT_TOKEN` is set (`references/platform-token.md`) — note that GUI apps only see the environment they were launched with, so a token set in a shell session does not reach them.
