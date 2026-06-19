# Design — b6p `npx` migration + shell-detection removal (A5)

**Status:** Drafting

## Files / areas affected

### Scaffolder logic

- `src/scaffold.js` — **remove** `detectEnvironmentFor`, `probeCommand`, `shellPrefixCandidates`,
  and the call that writes `.claude/b6p-env.json`. Keep the prettier pre-flight check (independent).
  Decide whether to **add** a step that ensures the scaffolded project's `package.json` carries the
  `b6p-cli` devDependency and (optionally) runs `npm install`.
- `src/sync.js` / `src/utils.js` — no direct change expected: `SYNC_TARGETS` is derived dynamically
  by walking `templates/claude/**`, so deleting the `b6p-detect` skill folder removes it from sync
  automatically. Confirm `.claude/b6p-env.json` is not in any hardcoded scaffold-once path that
  would error when absent.

### Templates (scaffolded output)

- `templates/claude/skills/b6p-detect/` — **delete** the whole skill.
- `templates/claude/skills/b6p-pull/SKILL.md`, `b6p-push/SKILL.md`, `b6p-audit/SKILL.md` — replace
  every `shellPrefix` / `wsl <shell> -lc` invocation with `npx b6p …`; drop "command not found →
  install" guidance (npm resolves it now).
- `templates/claude/hooks/require-wsl-for-b6p.sh` — remove or reduce (see open question);
  `templates/claude/settings.json.template` — update/remove the matching hook registration.
- `templates/root/CLAUDE.md.template` — remove the "Install the b6p CLI" section and shell-prefix
  prose; replace with a one-liner that b6p comes from the project's devDependency via `npx b6p`.
- `templates/root/README.md.template` — same: drop the b6p install section.
- `templates/claude/instructions/b6p-platform.md.template` — strip shell-prefix references.
- **New (likely):** a `templates/root/package.json.template` (or augment an existing one) so the
  scaffolded project has `devDependencies["@bluestep-systems/b6p-cli"]` and an `.npmrc` mapping the
  scope (so `npm install` / `npx` resolves it). Mirror the repo-root `.npmrc` pattern from 0.8.0.

### This repo's own meta

- `CLAUDE.md` — the "**b6p detection**" and "**Shell prefix list**" paragraphs under "Key behaviors"
  become obsolete; replace with the `npx b6p` model. Update "What gets scaffolded" (no `/b6p-detect`,
  no `b6p-env.json`).
- `CHANGELOG.md` — a large `### Removed` entry (the ADR literally asks for this).
- `docs/decisions/b6p-cli-distribution.md` — status → fully superseded; check off the "Cleanup"
  list.
- `TODO.md` — tick the A5 item; `README.md` — update if it references detection.

## Approach

Two coupled changes: **(a) wire b6p into scaffolded projects via `npx`** and **(b) delete the
workaround**. Do (a) first so there's never a window where the workaround is gone but `npx b6p`
isn't wired — i.e. a scaffold must always be able to reach b6p.

1. **Wire the project dependency.** Ensure scaffolded projects get `b6p-cli` as a devDependency + a
   scope-mapped `.npmrc`, so `npx b6p` resolves locally. Decide auto-`npm install` vs. instruct.
2. **Switch skills to `npx b6p`.** Mechanical edit across the three b6p skills + instruction prose.
3. **Delete the workaround.** Remove the detection code, the `/b6p-detect` skill, `b6p-env.json`
   writes, and the WSL hook regex. Update `settings.json.template`.
4. **Resync docs** (this repo's CLAUDE.md, CHANGELOG `### Removed`, ADR, TODO).

## Data / control flow

After this change, a b6p skill runs:

```
/b6p-pull  →  skill says: `npx b6p pull …`
   └─ npx resolves <project>/node_modules/.bin/b6p  (installed from the devDependency)
        └─ runs cross-platform; no shell detection, no global PATH, no b6p-env.json
```

Scaffold flow loses the `detectEnvironmentFor` → `b6p-env.json` branch; gains (option) an
`npm install` for the project so `node_modules/.bin/b6p` exists before first skill use.

## Edge cases

- **Scaffold without registry auth:** if the scaffolder auto-runs `npm install`, it needs the
  consumer's PAT at scaffold time. Mitigation: prefer "instruct the user to `npm install`" over
  auto-install, or make auto-install best-effort with a clear fallback message.
- **`bspecs sync` on an existing project that still has `b6p-env.json` / `/b6p-detect`:** sync
  updates tracked files but won't delete user files it no longer manages. Decide whether sync should
  prune the now-removed `b6p-detect` skill and `b6p-env.json`, or leave them as harmless cruft with
  a note.
- **WSL hook removal:** if other hooks or skills assume the WSL guard exists, removing it must not
  break them. Audit `settings.json.template` hook wiring.
- **`npx` first-run prompt:** `npx` can prompt to install a missing package; with `b6p-cli` already
  a devDependency it resolves silently. Verify no interactive prompt blocks Claude.

## Alignment with existing patterns

- Matches the ADR's documented end state exactly (Option A + `npx` invocation).
- Dynamic `SYNC_TARGETS` (walk `templates/claude/**`) means removing a skill needs no hardcoded-list
  edit — consistent with the 0.6.0 design.
- **ADR update warranted:** yes — flip status to fully superseded and check off the cleanup list.
- English-only docs.

## Risks

No test suite — verify by scaffolding into a scratch dir:

- **`npx b6p` doesn't resolve** → scaffold a project, `npm install`, run a b6p skill end-to-end;
  confirm `npx b6p --help` works from the project root.
- **Over-deletion** breaks an unrelated path → grep for every symbol before removing
  (`detectEnvironmentFor`, `b6p-env.json`, `shellPrefix`, `require-wsl-for-b6p`) and confirm each
  reference is intentionally removed or updated (the 20-file grep from this spec's scoping is the
  checklist).
- **Removing the WSL guard** surfaces a real WSL-only requirement → keep a minimal guard if b6p
  genuinely needs WSL on Windows; otherwise delete. Resolve the open question first.
- **Migration friction** for existing scaffolded projects → document the manual cleanup (delete
  `b6p-env.json`, the `b6p-detect` skill) in the CHANGELOG, same as the 0.8.0 uninstall note.
