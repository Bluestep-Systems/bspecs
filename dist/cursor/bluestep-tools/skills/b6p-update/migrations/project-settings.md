# Migration `project-settings` — reconcile the keys `/project-init` owns

**Detect.** The project's settings file for the tool you are running in is missing a key
`/project-init` writes, or holds one in a shape a later release replaced.

**Read the current shape from `/project-init`, not from here.** Its settings step is the source of
truth for which keys belong in a project and what each is worth. Read that skill's settings section,
compare key by key, and report the difference. A list of keys copied into this asset would go stale
the first time that skill changes.

**What it fixes.** A project set up by an older release can be missing settings that matter — the
compaction window, the marketplace registration, the plugin enablement — or hold one in a shape the
tool no longer reads, which fails silently rather than erroring.

## Steps

1. **Report per key**, not per file: the key, what the project has, what `/project-init` writes,
   and what the difference costs. A key the user has deliberately set differently is theirs — say
   what you see and let them decide.
2. **Apply only the keys the user accepts**, each shown before writing. **Never overwrite the file
   wholesale** — the rest of it is the user's, and may hold permissions and hooks this migration
   knows nothing about.
3. **Never touch settings outside the project directory.** User-scope and machine-scope settings are
   `/b6p-init`'s territory.
4. **Where a shape changed** (a value that used to be a list and is now keyed, or the reverse),
   show the one line before and after rather than rewriting the block around it.
5. **Say when a restart is needed.** In Claude Code, plugin-bundled surfaces such as MCP servers and
   hooks load at session start, so a settings change that enables one takes effect in a fresh
   session.
