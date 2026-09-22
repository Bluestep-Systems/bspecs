# Claude Code — plugin enablement (read by `/b6p-setup` step 1)

Applies when `/b6p-setup` runs inside Claude Code (CLI or desktop app). Check first, act only on what is missing.


Two scopes:

- **Once per machine (`/b6p-setup` step 1):** the plugin is installed at **user scope** — `claude plugin marketplace add Bluestep-Systems/bspecs`, then `claude plugin install bluestep-tools@bluestep` (the README's step 1; internal staff usually get both through managed settings). If `/b6p-setup` is running, that part is already done on this tool; confirm the marketplace is registered with `claude plugin marketplace list` so updates arrive. A user-scope install loads the B6P skills, hooks and gateway MCP in **every** session on the machine, B6P project or not. That is what lets `/b6p-setup` run in a new, empty folder, but say the cost out loud: the guardrail hook fires in every repo, so an edit to any path containing `declarations/` is **blocked in any project on the machine**. Give the off switch with it: in a non-BlueStep repo, add `"enabledPlugins": { "bluestep-tools@bluestep": false }` to that project's `.claude/settings.json` — project settings override the user-scope entry, and the plugin stays installed for everything else. `/b6p-setup` writes that line for you when it is run in a repo that is not a B6P workspace.
- **Per project (`/b6p-setup` step 2):** writes the project's `.claude/settings.json` with the marketplace registration (`extraKnownMarketplaces`), the compaction window and the permission allowlist — **not** `enabledPlugins`: the install above is what enables the plugin, for every project on the machine, and a project-level `true` with no user-scope install does not load anything. When a teammate clones and trusts the folder, Claude Code registers the marketplace from it, so their one `claude plugin install bluestep-tools@bluestep --scope user` finds it. It does not replace the install above.

Plugin-bundled surfaces (MCP servers, hooks) load at session start: after enabling, use a fresh session or `/reload-plugins`.

**Desktop-app note.** Plugin-bundled MCP is account-managed via claude.ai, not local config, so desktop-app users may need to add the gateway **once** as a claude.ai custom connector (URL `https://gateway.bluestep.net/mcp`, Authorization `Bearer <b6pt_ token>`) rather than relying on the bundle. That is one gateway connector — **not** one per org.
