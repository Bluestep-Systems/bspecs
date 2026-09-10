# Migration catalogue

`/b6p-update` reads this file every run, then reads **only** the asset files whose detector matched.
Run matched migrations in the order listed here.

Detectors read the project, not a release number — a project can be many releases behind, and a
version in prose goes stale while a marker or a missing key does not.

**"Says to the user" is the wording for the report.** Never put the id in front of a user;
`rules-file-bridge` tells them nothing about their project. The id is for this catalogue and the
asset filenames only.

| # | id | Says to the user | Detect | Asset | Remove when |
|---|---|---|---|---|---|
| 1 | `rules-file-bridge` | "your rules are in the wrong file" | No `AGENTS.md`, but the tool-specific bridge file holds real rules. Or both files hold real rules. | `rules-file-bridge.md` | No project detects for a full release cycle. |
| 2 | `rules-template` | "rules file is out of date" | `AGENTS.md`'s marker version is below the shipped template's, or it has no `<!-- bluestep-tools rules-template N -->` marker at all while carrying B6P rules. | `rules-template.md` | No project detects for a full release cycle. |
| 3 | `project-settings` | "settings are missing N keys" (or "one setting differs from the current default") | The project's settings file for this tool is missing a key `/project-init` writes, or holds one in a shape a later release replaced. | `project-settings.md` | Every project has the keys, or has declined them. |
| 4 | `codex-agents-payload` | "Codex needs its subagents re-copied" / "Codex needs hooks re-trusted" | Running in Codex, and the agents payload copy or hook trust has not been redone since the last release that changed a hook definition. | `codex-agents-payload.md` | Codex trusts hooks and reads bundled subagents without a per-release step. |

Order matters for the first two: content that has just moved into `AGENTS.md` is then an
un-migrated rules file, so `rules-file-bridge` runs before `rules-template` and the latter
re-detects on its result. Report a project needing both as one line, not two.

**The current template version is data, not prose.** Read the `<!-- bluestep-tools rules-template N -->`
marker in `${CLAUDE_PLUGIN_ROOT}/skills/project-init/templates/AGENTS.md.template` and compare. A
project with no marker is version 1. Never compare against a number written in a skill or an asset.

## Which steps ask, and which decide

Each asset marks its own steps, but the shape is the same across all four: **a step with one correct
answer is performed, not offered.** In practice most projects reach the end of a migration without a
single question, because most old rules files turn out to be unmodified template text.

Asking on a decision the user cannot make better than you costs them attention they need for the
decisions that are really theirs.
