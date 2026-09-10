---
name: bluestep-init
description: Deprecated alias, removed in a later release. Use /b6p-init for the once-per-machine setup (b6p CLI, plugin install, platform token) and /project-init for each project's files (AGENTS.md, CLAUDE.md bridge, README, settings).
---

# /bluestep-init — deprecated

This skill was split in plugin 0.33.0:

- **`/b6p-init`** — once per machine and tool: install and authenticate the `b6p` CLI, register the marketplace and install the plugin, trust hooks on Codex, set `B6PT_TOKEN`.
- **`/project-init`** — once per project: write `AGENTS.md`, the `CLAUDE.md` bridge, `README.md`, `package.json`, `.gitignore`, `.prettierrc`, guide `git init`, and (Claude Code) the project settings that enable the plugin.

Tell the user which of the two matches what they asked for and run it. Do nothing else here.
