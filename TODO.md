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

- [ ] **`/b6p-pull` should handle re-pulls of existing modules.** Today the skill assumes first pull. For subsequent pulls (to sync platform-side changes), it should surface a diff of what changed in `declarations/`, `draft/info/metadata.json`, etc., so the user knows what to react to.
- [ ] **`/b6p-push` should warn if the user is pushing against stale local state.** If the platform has changed since the last pull, pushing local edits can overwrite other devs' work. The skill should check and warn before pushing.
- [ ] **`/spec-status` should split `[PLATFORM]` vs `[CODE]` task counts.** Today it just counts `[x]` vs `[ ]`. A spec at 3/5 means very different things if the 2 pending tasks are `[PLATFORM]` (blocking) vs `[CODE]` (just unimplemented).
- [ ] **Spec consistency validation.** If `design.md` says "no platform-side changes" but `tasks.md` has `[PLATFORM]` tasks, nothing catches it. Could be a `/spec-validate` skill or a check inside `/spec-execute`.

## Polish / nice-to-have

- [ ] **`design.template.md` line 13 lint warning.** The `**Does this change require modifying the component on the BlueStep platform? (Yes / No)**` line is rendered as bold but the markdown linter flags it as "emphasis used instead of heading". Either rewrite as a heading or accept the warning permanently. Cosmetic only.
- [ ] **`checkPrettierOnPath` assumes WSL exists.** If a dev runs `bluestep-init` on a pure Linux/Mac box, the check tries `wsl bash -lc ...` and warns spuriously. Detect platform first.
- [ ] **Skill messages in mixed languages.** The hard-coded "STOP" messages in `SKILL.md` files are in English; Claude sometimes reads them literally and breaks the Spanish flow the user is in. Consider whether SKILL.md should be language-neutral or have a localisation hook.
- [ ] **`block-tsc` hook does not catch `tsc -p tsconfig.json`.** The pattern matches `tsc*` at start, so `tsc -p ...` is blocked correctly. But verify edge cases like `./node_modules/.bin/tsc`, `yarn tsc`, etc.
- [ ] **`/bug-fix` could use the `[PLATFORM]/[CODE]` distinction too.** Today it doesn't generate a structured task list, but for bugs that need both a platform change and a code change, the lack of structure makes the handoff vague.

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
