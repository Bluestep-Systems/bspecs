# @bluestep-systems/bspecs

CLI for scaffolding BlueStep projects with spec-driven development conventions for Claude Code.

## What it does

`bspecs` generates a project directory ready to use with:

- Claude Code skills (`/spec-create`, `/spec-execute`, `/b6p-pull`, `/b6p-push`, and more)
- BlueStep subagents — `b6p-task-implementer` (isolated task execution; `/spec-execute` delegates to it), `b6p-commenter` (component README), `b6p-code-review` (report-only review)
- Automatic hooks (prettier on save, generated-file blocking, `b6p` integration)
- Instructions for Claude Code (the template tree is the single source of truth)
- Spec templates (`requirements.md`, `design.md`, `tasks.md`)
- The `b6p` CLI wired into each project as a devDependency, invoked via `npx b6p` (no global install or shell/PATH detection)

## Installation

`bspecs` and the `b6p` CLI it depends on are published to the **public npm registry**, so there is no
token or `~/.npmrc` setup — install in one command:

```sh
npm install -g @bluestep-systems/bspecs
```

This gives you the `bspecs` command for scaffolding projects. It does **not** put a `b6p` binary on
your global `PATH` — a dependency's bin is never globally reachable. Instead, every project you
scaffold declares `@bluestep-systems/b6p-cli` as a devDependency and the skills invoke it via
`npx b6p`. The scaffolder runs `npm install` in the new project for you (best-effort) to fetch `b6p`;
if it can't — e.g. you're offline — it prints the command to run by hand. That per-project install
resolves `@bluestep-systems/b6p-cli` anonymously from public npm, no token needed.

> **Not "zero setup."** Removing the npm token does **not** remove the one-time **BlueStep platform**
> credential step. Before the `/b6p-pull`, `/b6p-push`, or `/b6p-audit` skills work in a scaffolded
> project, run `npx b6p auth set` **once per machine** (credentials are stored globally in `~/.b6p`,
> not per project). This is unrelated to the npm registry and is still required — see the scaffolded
> project's own README.

> **Migrating from the old GitHub Packages install?** If you previously installed `bspecs` you likely
> have a line in `~/.npmrc` mapping the scope to GitHub Packages:
>
> ```ini
> @bluestep-systems:registry=https://npm.pkg.github.com
> ```
>
> Remove it (and the matching `//npm.pkg.github.com/:_authToken=...` line). Left in place it keeps
> routing `@bluestep-systems/*` to GitHub Packages and the public install will 404.

## Usage

### Scaffold a new project

From the parent directory where you want to create the project:

```sh
bspecs
```

The interactive wizard asks for the project name, client, and an optional description. When done, it generates the project directory with the full structure and (unless you opt out) runs `git init`.

### Keep a project up to date

When a new version of `bspecs` is published with improvements to skills, hooks, or instructions, update your global install and sync the project:

```sh
npm update -g @bluestep-systems/bspecs
cd my-project
bspecs sync
```

`bspecs sync` compares each infrastructure file against the state it was in when scaffolded. Files you have not modified locally are updated; files you have edited are left untouched with a warning. If you believe your local changes would be useful across all BlueStep projects, open an issue in this repo so they can be incorporated into the scaffolder.

Projects scaffolded with `bspecs 0.5.0` or later run `bspecs sync` automatically every time Claude Code opens the workspace — no manual action needed.

## Prerequisites

- **Node.js 18+**
- **`b6p` CLI** — required for the `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills. Scaffolded
  projects declare it as a devDependency (`@bluestep-systems/b6p-cli`, resolved from public npm with
  no token); the scaffolder runs `npm install` for you (re-run it by hand if that failed) and the
  skills invoke it via `npx b6p` — no global install, no shell/PATH detection. Set your platform
  credentials once per machine with `npx b6p auth set` (see Installation).
- **prettier** — required for the auto-format hook. `bspecs` warns if it is not found.

## Generated structure

```
my-project/
├── CLAUDE.md                          ← project instructions for Claude
├── README.md                          ← project documentation
├── .prettierrc
├── .gitignore
├── package.json                      ← declares the b6p-cli devDependency
└── .claude/
    ├── bspecs.lock                    ← lock file for bspecs sync
    ├── settings.json                  ← Claude Code permissions and hooks
    ├── hooks/                         ← 3 scripts executed by Claude Code
    ├── skills/                        ← 8 skills (/spec-create, /b6p-pull, etc.)
    ├── agents/                        ← 3 BlueStep subagents (implementer, commenter, reviewer)
    ├── instructions/                  ← development rules for Claude
    ├── spec-templates/                ← spec file templates
    └── templates/                     ← component scaffolding templates
```

## Proposing changes

### Global changes (improvements for all projects)

If you find something that should be improved in the skills, hooks, instructions, or templates — something useful across all BlueStep projects — open an issue or PR in this repo. Once merged and published as a new version, `bspecs sync` propagates the change to all existing projects automatically.

### Local changes (specific to your project)

If you need to adjust something only for your project (an extra permission in `settings.json`, a custom skill, changes to your `CLAUDE.md`), edit it directly in your repo. `bspecs sync` detects that those files were locally modified and leaves them untouched on future syncs.

## Publishing

The package is published to the **public npm registry** under the `@bluestep-systems` organization
(`access: public`). Only `cli.js`, `src/`, and `templates/` are included in the published package.

Releases are automated by GitHub Actions — there is no manual `npm publish`:

1. Bump `version` in `package.json` and commit.
2. Tag the commit `vX.Y.Z` (matching the new version) and push the tag.
3. `.github/workflows/publish.yml` fires on the tag, verifies the tag matches `package.json`, runs the
   smoke checks, and publishes with `npm publish --provenance --access public`.

Publishing needs the `NPM_TOKEN` repo secret (an npm automation token with publish rights to
`@bluestep-systems`); the version guard fails the run early if the tag and `package.json` disagree.
`.github/workflows/ci.yml` runs the same smoke checks on every pull request and push to the default
branch.
