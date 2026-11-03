# phi-guard

A write-time check for client data in BlueStep (B6P) projects. Before an agent's Edit or Write
lands, it reads the text being written and blocks it when it looks like real client or contact
data: phone numbers, email addresses, record titles. The agent then rewrites the text with
placeholders. It never changes the text itself.

It is opt-in: not every client handles PHI, so whoever owns a machine that works on such projects
installs it. It runs on Claude Code, and on Cursor and Codex through their generated wrappers
(which may not see every write there).

## Scope

- **Installed per machine** (user scope), not per project.
- **Acts only in a B6P project**: the project root holds a `U######/` unit folder, or an
  `AGENTS.md` with the rules-template marker `/b6p-setup` writes. Everywhere else it stays silent.
- **Off for one project** with this in the project's `.claude/settings.json`:

  ```json
  { "enabledPlugins": { "phi-guard@bluestep": false } }
  ```

- **Skips** `.claude/scratch/` (the place for real data while debugging), `declarations/`,
  `.build/`, `static/assets/`, `node_modules/`, lockfiles and `.phi-allow`.

## Install

Claude Code CLI:

```
claude plugin install phi-guard@bluestep --scope user
```

Claude desktop app: Customize → Plugins, then install `phi-guard` from the `bluestep` marketplace.
Plugins there are managed by your account, so the CLI command above does not apply.

Cursor and Codex: the generated marketplaces in this repo list `phi-guard` next to
`bluestep-tools`. Install it the same way; on Codex, trust its hook when asked.

## How it fits with the git client-data check

This plugin only sees what an agent writes. Hand edits, other tools and pasted files reach git
without it. The git client-data check covers those: `/b6p-setup` (in the `bluestep-tools` plugin)
copies `pre-commit` and `pre-push` hooks into a project's `scripts/hooks/`, committed, so every
teammate gets that gate whether or not they have this plugin. Both use the same detector. What the
checks catch and what to do when one blocks is in the `bluestep-reference` skill →
`conventions/client-data.md`.

## Contents

- `hooks/hooks.json` — one `PreToolUse` hook on `Edit|Write`.
- `hooks/phi-guard.sh` — the hook. It fails closed: if its helper or detector is missing, or no
  JSON parser runs, it blocks with a message instead of letting the write through.
- `hooks/lib/phi-detect.sh` — the detector. `bluestep-tools` ships a second copy for the git
  client-data check (`skills/b6p-setup/assets/phi-guard/phi-detect.sh`); `npm run gen:check`
  fails when the two differ.
- `hooks/lib/hook-input.sh` — reads the hook's input. Kept identical to the `bluestep-tools` copy
  the same way.
