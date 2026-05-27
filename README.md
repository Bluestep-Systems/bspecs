# @bluestep/bspecs

CLI for scaffolding BlueStep projects with spec-driven development conventions for Claude Code and GitHub Copilot.

## What it does

`bspecs` generates a project directory ready to use with:

- Claude Code skills (`/spec-create`, `/spec-execute`, `/b6p-pull`, `/b6p-push`, and more)
- Automatic hooks (prettier on save, generated-file blocking, `b6p` integration)
- Instructions for Claude Code and GitHub Copilot (single source of truth)
- Spec templates (`requirements.md`, `design.md`, `tasks.md`)
- Automatic `b6p` environment detection

## Installation

Requires access to the Bluestep GitHub Packages registry. Configure your `.npmrc` once:

```sh
echo "@bluestep:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm login --scope=@bluestep --registry=https://npm.pkg.github.com
```

Then install the CLI globally:

```sh
npm install -g @bluestep/bspecs
```

## Usage

### Scaffold a new project

From the parent directory where you want to create the project:

```sh
bspecs
```

The interactive wizard asks for the project name, client, description, and Context7 API key. When done, it generates the project directory with the full structure and runs `git init`.

### Keep a project up to date

When a new version of `bspecs` is published with improvements to skills, hooks, or instructions, update your global install and sync the project:

```sh
npm update -g @bluestep/bspecs
cd my-project
bspecs sync
```

`bspecs sync` compares each infrastructure file against the state it was in when scaffolded. Files you have not modified locally are updated; files you have edited are left untouched with a warning. If you believe your local changes would be useful across all BlueStep projects, open an issue in this repo so they can be incorporated into the scaffolder.

Projects scaffolded with `bspecs 0.5.0` or later run `bspecs sync` automatically every time Claude Code opens the workspace — no manual action needed.

## Prerequisites

- **Node.js 18+**
- **`b6p` CLI** — required for the `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills. If not installed, `bspecs` prints install instructions during scaffold.
- **prettier** — required for the auto-format hook. `bspecs` warns if it is not found.

## Generated structure

```
my-project/
├── CLAUDE.md                          ← project instructions for Claude
├── README.md                          ← project documentation
├── .prettierrc
├── .gitignore
├── .claude/
│   ├── bspecs.lock                    ← lock file for bspecs sync
│   ├── b6p-env.json                   ← detected b6p environment
│   ├── settings.json                  ← Claude Code permissions and hooks
│   ├── hooks/                         ← 4 scripts executed by Claude Code
│   ├── skills/                        ← 8 skills (/spec-create, /b6p-pull, etc.)
│   ├── instructions/                  ← development rules for Claude
│   ├── spec-templates/                ← spec file templates
│   └── templates/                     ← component scaffolding templates
├── .github/
│   └── instructions/                  ← mirrors for GitHub Copilot
└── .vscode/
    └── mcp.json                       ← Context7 MCP
```

## Proposing changes

### Global changes (improvements for all projects)

If you find something that should be improved in the skills, hooks, instructions, or templates — something useful across all BlueStep projects — open an issue or PR in this repo. Once merged and published as a new version, `bspecs sync` propagates the change to all existing projects automatically.

### Local changes (specific to your project)

If you need to adjust something only for your project (an extra permission in `settings.json`, a custom skill, changes to your `CLAUDE.md`), edit it directly in your repo. `bspecs sync` detects that those files were locally modified and leaves them untouched on future syncs.

## Publishing

The package is published to GitHub Packages (`https://npm.pkg.github.com`) under the `@bluestep` organization. Only `cli.js`, `src/`, and `templates/` are included in the published package.
