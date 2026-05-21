# TODO

Living list of pending work for `@bluestep/init`. Items roughly ordered by priority within each section. Cross off (`[x]`) when done; remove entries that are no longer relevant rather than letting them rot.

For deeper context behind any decision, see `docs/decisions/`.

## Blocking publication / cross-machine use

- [ ] **Pre-flight check for `b6p` CLI.** Detect at scaffold time whether `b6p` is reachable; if not, print install instructions from the upstream README plus a note about SSH access requirements. Also surface the same info in the scaffolded project's `README.md` and add guidance to `/b6p-pull` and `/b6p-push` skills for "command not found" errors. See `docs/decisions/b6p-cli-distribution.md`.
- [ ] **Upstream issue for `b6p-cli` publish.** Open an issue in `Bluestep-Systems/vscode-extension` requesting that `@bluestep-systems/b6p-core` and `@bluestep-systems/b6p-cli` be published to GitHub Packages (or npm public). This unblocks moving from detect-and-guide to a proper `peerDependencies` declaration. Cite our CLI as a concrete consumer. See `docs/decisions/b6p-cli-distribution.md`.
- [ ] **`b6p` peer-dependency migration (depends on upstream publish).** Once `b6p-cli` is published, remove the pre-flight check code and add `"@bluestep-systems/b6p-cli": "^X.Y.Z"` under `peerDependencies` in our `package.json`. Note the change in `CHANGELOG.md`.
- [ ] **GitHub Actions publish workflow.** Create `.github/workflows/publish.yml` that publishes `@bluestep/init` to GitHub Packages on `v*` tags. Same pattern as we'll need for the upstream b6p publish.
- [ ] **Push to GitHub.** Create `github.com/bluestep/bluestep-init` (private) and push `main` + tags.
- [ ] **Consumer auth docs.** Document the `npm login --scope=@bluestep --registry=https://npm.pkg.github.com` flow and the `~/.npmrc` config a dev needs to install our CLI from GitHub Packages. Probably goes in our top-level `README.md` (which we don't have yet for the CLI repo).

## Flow improvements

- [ ] **`/spec-status` should split `[PLATFORM]` vs `[CODE]` task counts.** Today it just counts `[x]` vs `[ ]`. A spec at 3/5 means very different things if the 2 pending tasks are `[PLATFORM]` (blocking) vs `[CODE]` (just unimplemented).
- [ ] **Spec consistency validation.** If `design.md` says "no platform-side changes" but `tasks.md` has `[PLATFORM]` tasks, nothing catches it. Could be a `/spec-validate` skill or a check inside `/spec-execute`.

### Resolved by 0.3.0 (audit skill)

- ~~`/b6p-pull` should handle re-pulls of existing modules~~ — `/b6p-audit` covers the "what changed on the platform" need on demand. Subsequent pulls still work; if the user wants the diff first, they run `/b6p-audit` then `/b6p-pull`.
- ~~`/b6p-push` should warn if the user is pushing against stale local state~~ — kept as on-demand `/b6p-audit` instead of automatic pre-flight, per design decision: most sessions push multiple times and the user knows whether parallel work is likely; b6p's server-side conflict detection covers the worst case. Reopen if real-world use shows lost work.

## b6p CLI integration — wave 2 (defer)

The full b6p CLI audit (see git history for the conversation) surfaced two more capabilities worth considering, both deferred until we have a concrete use case:

- [ ] **`--snapshot` + `--message` in push.** b6p supports pushing as a snapshot with a commit-style message for server-side history. Could be tied to `/spec-execute` task completion: "push task N as snapshot with message `feat(spec/FEATURE): task N done`". Needs a convention decision first — when does a push become a snapshot vs. a plain draft push?
- [ ] **`/b6p-deploy <feature>` skill.** Wrap `b6p deploy <config>` for multi-target deployment using the `## Deployment` section of a spec's `tasks.md`. Useful when a feature touches multiple components that all need to ship together to one or more environments. Defer until the multi-environment story for B6P is clearer.

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.
- [ ] **`/bug-fix` could use the `[PLATFORM]/[CODE]` distinction too.** Today it doesn't generate a structured task list, but for bugs that need both a platform change and a code change, the lack of structure makes the handoff vague.

## Done in 0.3.1

- [x] Fix false-negative pre-flight checks for `prettier` and `b6p` when scaffolding from WSL.

## Done in 0.3.0

- [x] `--yes` flag on all `b6p` invocations to prevent interactive prompts hanging Claude.
- [x] `/b6p-audit` skill wrapping `b6p audit --json` for on-demand local-vs-platform comparison.
- [x] `auth set` reminder in scaffolder pre-flight and project README.
- [x] CLAUDE.md "Skill quick reference" with mandatory routing rule for spec-driven changes.

## Done in 0.2.1

- [x] Pre-flight check for missing `b6p` CLI with install instructions.
- [x] Decision record at `docs/decisions/b6p-cli-distribution.md`.
- [x] `TODO.md` established as living pending-work list.

## Done in 0.2.0

(Kept here briefly so the next CHANGELOG-writing pass remembers what shipped. Move to CHANGELOG and prune from here when freezing the next release.)

- [x] Remove `unitId` / `projectType` prompts (projects are folders; U-folders come from `b6p pull`).
- [x] Replace per-component `SPEC.md` with `<Component>/draft/README.md` lifecycle.
- [x] Remove `/new-module` skill.
- [x] Shell-detection in `/b6p-pull` and `/b6p-push`; hook accepts both `bash -lc` and `wsl bash -lc`.
- [x] `[PLATFORM]` / `[CODE]` task prefix convention with `/spec-execute` enforcement.
- [x] Session-start README directive in `CLAUDE.md`.
- [x] CLI flags `-v` / `-h`; clean Ctrl+C cancellation.
- [x] `git init` + tag `v0.2.0`; CHANGELOG.md established.
