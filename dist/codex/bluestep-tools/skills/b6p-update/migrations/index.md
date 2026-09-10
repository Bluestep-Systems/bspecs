# Migration catalogue

`/b6p-update` reads this file every run, then reads **only** the asset files whose detector matched.
Run matched migrations in the order listed here.

Detectors read the project, not a release number — a project can be many releases behind, and a
version in prose goes stale while a marker or a missing key does not.

| # | id | Detect | Asset | Remove when |
|---|---|---|---|---|
| 1 | `rules-file-bridge` | The rules file is in the wrong place: no `AGENTS.md`, but the tool-specific bridge file holds real rules. Or both files hold real rules. | `rules-file-bridge.md` | No project detects for a full release cycle. |
| 2 | `rules-template` | `AGENTS.md`'s marker version is below the shipped template's, or it has no `<!-- bluestep-tools rules-template N -->` marker at all while carrying B6P rules. | `rules-template.md` | No project detects for a full release cycle. |
| 3 | `project-settings` | The project's settings file for this tool is missing a key `/project-init` writes, or holds one in a shape a later release replaced. | `project-settings.md` | Every project has the keys, or has declined them. |
| 4 | `codex-agents-payload` | Running in Codex, and the agents payload copy or hook trust has not been redone since the last release that changed a hook definition. | `codex-agents-payload.md` | Codex trusts hooks and reads bundled subagents without a per-release step. |

Order matters for the first two: content that has just moved into `AGENTS.md` is then an
un-migrated rules file, so `rules-file-bridge` runs before `rules-template` and the latter
re-detects on its result.

**The current template version is data, not prose.** Read the `<!-- bluestep-tools rules-template N -->`
marker in `../../project-init/templates/AGENTS.md.template` (relative to this file) and compare. A
project with no marker is version 1. Never compare against a number written in a skill or an asset.
