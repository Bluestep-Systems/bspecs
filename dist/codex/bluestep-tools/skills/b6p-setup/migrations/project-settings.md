# Migration `project-settings` — reconcile the keys `/b6p-setup` step 2b owns

**Says to the user:** "settings are missing N keys", or "one setting differs from the current
default". Name the count, not the id.

**Detect.** The project's settings file for the tool you are running in is missing a key
`/b6p-setup` step 2b writes, or holds one in a shape a later release replaced.

**Read the current shape from `/b6p-setup` step 2b, not from here.** That step is the source of
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
they chose — check that last part before you add a key the user may have set somewhere else (below).

## Claude Code only — the compaction window: the user's own value wins

`autoCompactWindow` is a default, not a rule, and the project file outranks the user's own settings
in Claude Code — so adding it can silently replace a window the user picked for every session.
Before adding it, **read** (never write) `~/.claude/settings.json` and `.claude/settings.local.json`:

- **Either one sets `autoCompactWindow`** → do not add the key. Report it: "kept your own compaction
  window (N, from your user settings)".
- **Neither does** → add it, and tell the user before writing — a statement, not a question: "Models
  make more mistakes as the context gets very large, and every request re-reads the whole history.
  I'm turning on context compaction at 400K, the value the BlueStep team suggests. To use a different
  value just for you, set `autoCompactWindow` in `.claude/settings.local.json`."
- **The project already has the 400 K value and the user's own settings hold a different one** → the
  project value is what runs here. Do not change the shared file; say so and give the same
  `settings.local.json` sentence.

A project that removed the key is not something this migration can tell apart from one that never
had it. If the user says they removed it on purpose, leave it out and tell them that the next run
will offer it again until opt-outs are recorded.

## A key that already holds a different value? Ask.

That value may be deliberate. Show the key, their value, what `/b6p-setup` writes, and what the
difference does — then let them decide. One question per differing key, and only for real
differences, not formatting.

## The plugin enablement key: drop a redundant `true`, keep a working one, offer the install

`/b6p-setup` no longer writes `"enabledPlugins": { "bluestep-tools@bluestep": true }` (nor the older
array shape): the plugin is meant to be enabled at **user scope** by `/b6p-setup` step 1, which covers every B6P
project on the machine. But a project-level `true` can also be a working **project-scope install**
(on Claude Code, `claude plugin install … --scope project` writes exactly that key plus a `scope: project` row), so
whether to remove it depends on what the machine holds. **Read** `~/.claude/plugins/installed_plugins.json`
(Claude Code; read only, never write it) and look for `bluestep-tools@bluestep` rows:

- A `scope: user` row exists → the project-level `true` is redundant. **Remove that one entry**
  — the `"bluestep-tools@bluestep": true` key, or the `"bluestep-tools@bluestep"` string in the older array
  shape — leave any other plugin in `enabledPlugins` alone, and drop the `enabledPlugins` key only if it is
  now empty. One correct answer; say it in the report: "removed the
  per-project plugin switch — the plugin is enabled for the whole machine."
- A `scope: project` row for **this** project exists and no user row → the `true` is what loads the plugin
  here. **Leave it.** Mention in the report that this project carries its own install and that `/b6p-setup` step 1
  can replace it with one machine-wide install.
- Neither row → the `true` loads nothing while looking enabled. Say so, give the command for the user to
  run — `claude plugin install bluestep-tools@bluestep --scope user` on Claude Code (desktop app:
  Customize → Plugins → + → Add marketplace → From repository → Browse plugins → install) — and **ask** before removing the entry; it is harmless until the install
  exists and removing it first leaves nothing that even hints at the plugin.
- A project that holds `false` is an **opt-out** someone chose for a repo that is not a B6P workspace.
  Leave it exactly as it is, and skip every other key here — it is not a B6P project.

## Always

- **Never overwrite the file wholesale.** The rest of it is the user's, and may hold permissions and
  hooks this migration knows nothing about. Add or change only the keys named above.
- **Never touch settings outside the project directory.** User-scope and machine-scope settings are
  `/b6p-setup` step 1's territory — reported there, never written from a project step.
- **Where a shape changed** (a value that used to be a list and is now keyed, or the reverse), change
  that one line rather than rewriting the block around it.
- **Say when a restart is needed.** In Claude Code, plugin-bundled surfaces such as MCP servers and
  hooks load at session start, so enabling one takes effect in a fresh session.
- **A settings file the plugin did not write is not yours to modernise.** A project carrying its own
  local hooks from before the plugin existed is outside every migration here: add the missing keys,
  leave the rest alone, and note what you saw in the report.
