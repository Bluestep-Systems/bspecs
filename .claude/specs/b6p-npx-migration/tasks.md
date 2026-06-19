# Tasks — b6p `npx` migration + shell-detection removal (A5)

**Status:** Drafting

All tasks are `[CODE]` in this repo (no external publishing). Order matters: **wire `npx b6p`
before deleting the workaround**, so a scaffold never has a window with neither path working.
Resolve the two design open questions (auto-install vs. instruct; keep/remove the WSL guard) before
tasks 1 and 5.

## Tasks

- [ ] **1.** **Wire b6p into scaffolded projects.** Ensure scaffolded output has
      `@bluestep-systems/b6p-cli` as a `devDependency` and a scope-mapped `.npmrc` so `npx b6p`
      resolves. Add a `templates/root/package.json.template` (if the scaffold has none) and a
      `templates/root/.npmrc.template`, or augment existing ones. — files:
      `templates/root/package.json.template` (likely new), `templates/root/.npmrc.template` (likely
      new), `src/scaffold.js` (wire into the copy if needed)

- [ ] **2.** **Decide + implement install step.** Either run `npm install` in the scaffolded project
      (best-effort, with a clear fallback message if registry auth is missing) or print a single
      "run `npm install`" instruction. Implement the chosen path. — files: `src/scaffold.js`,
      `templates/root/README.md.template`

- [ ] **3.** **Switch `/b6p-pull` to `npx b6p`.** Replace all `shellPrefix` / `wsl <shell> -lc`
      invocations with `npx b6p …`; remove "command not found → install" guidance. — files:
      `templates/claude/skills/b6p-pull/SKILL.md`

- [ ] **4.** **Switch `/b6p-push` and `/b6p-audit` to `npx b6p`.** Same mechanical change as task 3.
      — files: `templates/claude/skills/b6p-push/SKILL.md`,
      `templates/claude/skills/b6p-audit/SKILL.md`

- [ ] **5.** **Remove / reduce the WSL hook.** Per the resolved open question: delete
      `require-wsl-for-b6p.sh` (or reduce to a minimal guard) and update the hook registration. —
      files: `templates/claude/hooks/require-wsl-for-b6p.sh`,
      `templates/claude/settings.json.template`

- [ ] **6.** **Delete the `/b6p-detect` skill.** Remove the folder; confirm no skill/doc references
      it. (Dynamic `SYNC_TARGETS` drops it automatically.) — files:
      `templates/claude/skills/b6p-detect/` (delete)

- [ ] **7.** **Strip detection from `src/scaffold.js`.** Remove `detectEnvironmentFor`,
      `probeCommand`, `shellPrefixCandidates`, and the `.claude/b6p-env.json` write. Leave the
      prettier pre-flight intact. — files: `src/scaffold.js`

- [ ] **8.** **Clean scaffolded-output prose.** Remove the "install b6p" / shell-prefix sections
      from the project templates. — files: `templates/root/CLAUDE.md.template`,
      `templates/root/README.md.template`,
      `templates/claude/instructions/b6p-platform.md.template`

- [ ] **9.** **Update this repo's `CLAUDE.md`.** Replace the "b6p detection" + "Shell prefix list"
      key-behaviors paragraphs with the `npx b6p` model; update "What gets scaffolded" (no
      `/b6p-detect`, no `b6p-env.json`). — files: `CLAUDE.md`

- [ ] **10.** **Version bump + CHANGELOG `### Removed`.** Bump (0.8.0 → 0.9.0); add the big
      `### Removed` section the ADR asks for; note the migration step for existing projects. — files:
      `package.json`, `CHANGELOG.md`

- [ ] **11.** **Close out the ADR + TODO.** Flip `b6p-cli-distribution.md` status to fully
      superseded and check off its "Cleanup" list; tick the A5 item in `TODO.md` / archive to
      `DONE.md`. — files: `docs/decisions/b6p-cli-distribution.md`, `TODO.md`, `DONE.md`

- [ ] **12.** **End-to-end verify.** `node cli.js` scaffold into a scratch dir; `npm install` in the
      generated project; run a b6p skill flow via `npx b6p` (e.g. `npx b6p --help`, then `/b6p-audit`
      against a real target if available). Confirm no `b6p-env.json`, no `/b6p-detect`, no WSL
      shell-prefix prose remain. — files: (verification)

## Verification

No test suite — confirm manually:

- `node cli.js -v` / `-h` still work.
- Grep the repo for the removed symbols — zero live references:
  `detectEnvironmentFor`, `probeCommand`, `shellPrefixCandidates`, `b6p-env.json`, `shellPrefix`,
  `require-wsl-for-b6p`, `b6p-detect` (outside CHANGELOG/DONE history).
- Scaffold a project; confirm its `package.json` has the `b6p-cli` devDependency and `npx b6p`
  resolves after `npm install`.
- `bspecs sync` on an existing project still succeeds.

## Wrap-up

- This repo's CLAUDE.md, README, CHANGELOG, TODO/DONE in sync.
- ADR fully superseded; cleanup list checked.
- Carry forward the upstream `b6p --version` = `0.0.1` bug as a separate (non-blocking) item.
