# Migration `project-settings` — reconcile the keys `/project-init` owns

**Says to the user:** "settings are missing N keys", or "one setting differs from the current
default". Name the count, not the id.

**Detect.** The project's settings file for the tool you are running in is missing a key
`/project-init` writes, or holds one in a shape a later release replaced.

**Read the current shape from `/project-init`, not from here.** Its settings step is the source of
truth for which keys belong in a project and what each is worth. Read that skill's settings section
and compare key by key. A list of keys copied into this asset would go stale the first time that
skill changes.

**What it fixes.** A project set up by an older release can be missing settings that matter — the
compaction window, the marketplace registration, the plugin enablement — or hold one in a shape the
tool no longer reads, which fails silently rather than erroring.

## Missing and additive? Add it and say so.

A key the project does not have at all, whose absence has a cost and whose addition conflicts with
nothing, has one correct answer. **Add it.** Report it in one line naming the keys and what each
buys:

> `riverside-forms` — added 2 settings: the marketplace registration (so a session opened here can
> find the plugin) and the 400 K compaction window (compacts at 400 K instead of near the 1 M
> limit).

Do not present a table of missing keys and ask whether to add them. The user has nothing to weigh:
the keys are absent, the defaults are the ones this tooling ships, and adding them changes nothing
they chose.

## A key that already holds a different value? Ask.

That value may be deliberate. Show the key, their value, what `/project-init` writes, and what the
difference does — then let them decide. One question per differing key, and only for real
differences, not formatting.

## The plugin enablement key: remove a project-level `true`, offer the user-scope install

`/project-init` no longer writes `"enabledPlugins": { "bluestep-tools@bluestep": true }` (nor the older
array shape): the plugin is enabled at **user scope** by `/b6p-init`, which covers every B6P project on
the machine, and a project-level `true` with no user-scope install loads nothing while looking enabled.
So:

- A project that holds the `true` (either shape) → **remove that key.** One correct answer; say it in
  the report: "removed the per-project plugin switch — the plugin is enabled for the whole machine."
- Then **read** `~/.claude/plugins/installed_plugins.json` (Claude Code) and look for a
  `bluestep-tools@bluestep` row with `scope: user`. If there is none, the machine has no install at
  all — say so in the report and give the command for the user to run:
  `claude plugin install bluestep-tools@bluestep --scope user` on Claude Code (desktop app: the claude.ai Plugins
  screen). Do not run it and do not write outside the project.
- A project that holds `false` is an **opt-out** someone chose for a repo that is not a B6P workspace.
  Leave it exactly as it is, and skip every other key here — it is not a B6P project.

## Always

- **Never overwrite the file wholesale.** The rest of it is the user's, and may hold permissions and
  hooks this migration knows nothing about. Add or change only the keys named above.
- **Never touch settings outside the project directory.** User-scope and machine-scope settings are
  `/b6p-init`'s territory.
- **Where a shape changed** (a value that used to be a list and is now keyed, or the reverse), change
  that one line rather than rewriting the block around it.
- **Say when a restart is needed.** In Claude Code, plugin-bundled surfaces such as MCP servers and
  hooks load at session start, so enabling one takes effect in a fresh session.
- **A settings file the plugin did not write is not yours to modernise.** A project carrying its own
  local hooks from before the plugin existed is outside every migration here: add the missing keys,
  leave the rest alone, and note what you saw in the report.
