# Cursor — plugin enablement (read by `/b6p-setup` step 1)

Applies when `/b6p-setup` runs inside Cursor.


If `/b6p-setup` is running in Cursor, the marketplace is imported and the plugin is installed — there is nothing left to click for enablement, and no settings file to write. Say so. For a teammate who has not installed yet, the steps are:

1. **Install Git** if `git --version` fails (Windows: Git for Windows from `https://git-scm.com/download/win`, default options), then fully restart Cursor. Cursor downloads the marketplace with git; without it the plugin page shows `Failed to resolve git ref "main" … spawn git ENOENT`. On Windows the plugin's hooks also run in Git Bash.
2. **Connect GitHub to Cursor first** (the **Connect GitHub** button in the sidebar, or Cursor settings). Without it the import below does nothing and shows no error, even though this repo is public.
3. **Add the marketplace:** Cursor → plugins → **Add Marketplace → Import from Repo**, with the bspecs repo URL `https://github.com/Bluestep-Systems/bspecs`. A marketplace source must be a **committed git repo** (this one is — a plain local folder does not resolve unless it is a git repo with a commit).
4. **Install `bluestep-tools`** from that marketplace, and enable it on the Manage screen if it is not on by default.

Worth saying out loud to the user in front of you:

- **Skills and hooks are workspace-coupled.** Open the project folder before installing/using them — an empty window shows only user-global surfaces (the MCP server), and a project-scoped install needs an open workspace.
- **Updates** arrive by themselves: an imported marketplace refreshes from the repo, so a new plugin version shows up without re-importing.
- If Claude Code on the same machine already has the `bluestep` marketplace registered, Cursor may have imported it on its own — the skills can appear in the slash menu before you do anything.
