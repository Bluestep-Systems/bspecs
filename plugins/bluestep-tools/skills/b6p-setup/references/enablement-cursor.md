# Cursor — plugin enablement (read by `/b6p-setup` step 1)

Applies when `/b6p-setup` runs inside Cursor.


If `/b6p-setup` is running in Cursor, the marketplace is imported and the plugin is installed — there is nothing left to click for enablement, and no settings file to write. Say so. For a teammate who has not installed yet, the steps are:

1. **Install Git** if `git --version` fails (Windows: Git for Windows from `https://git-scm.com/download/win`, default options), then fully restart Cursor. Cursor downloads the marketplace with git; without it the plugin page shows `Failed to resolve git ref "main" … spawn git ENOENT`. On Windows the plugin's hooks also run in Git Bash.
2. **Connect GitHub to Cursor first** (the **Connect GitHub** button in the sidebar, or Cursor settings). Without it the import below does nothing and shows no error, even though this repo is public.
3. **Add the marketplace:** Cursor → plugins → **Add Marketplace → Import from Repo**, with the bspecs repo URL `https://github.com/Bluestep-Systems/bspecs`. A marketplace source must be a **committed git repo** (this one is — a plain local folder does not resolve unless it is a git repo with a commit).
4. **Install `bluestep-tools`** from that marketplace, and enable it on the Manage screen if it is not on by default.

**phi-guard (opt-in).** A separate plugin in the same imported marketplace, listed next to `bluestep-tools`: it blocks an agent's write that looks like real client data. Cursor runs it through a generated wrapper, which may not see every write. It is installed per machine, acts only in a B6P project (a `U######/` folder or the `AGENTS.md` marker `/b6p-setup` writes), and stays silent everywhere else. Cursor gives the agent no read-only check, so ask the user whether `phi-guard` shows as installed on Cursor's plugin screen, folded into the offer. Missing → offer it, and on a yes hand over the click: install `phi-guard` from the imported marketplace in Cursor. To turn it off for one project on Cursor, a `*` line in that project's `.phi-allow` does it, but it also turns off the git client-data check. That git check, which `/b6p-setup` sets up in step 2, runs with or without the plugin.

Worth saying out loud to the user in front of you:

- **Skills and hooks are workspace-coupled.** Open the project folder before installing/using them — an empty window shows only user-global surfaces (the MCP server), and a project-scoped install needs an open workspace.
- **Updates** arrive by themselves: an imported marketplace refreshes from the repo, so a new plugin version shows up without re-importing.
- If Claude Code on the same machine already has the `bluestep` marketplace registered, Cursor may have imported it on its own — the skills can appear in the slash menu before you do anything.
