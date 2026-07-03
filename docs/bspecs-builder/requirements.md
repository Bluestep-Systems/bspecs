# Requirements: Make `bspecs` the builder entry point + consolidate BlueStep rules

## TL;DR — what needs to be done

Make `@bluestep/bspecs` the single tool builders install, and merge everyone's BlueStep rules into it. Two independent tracks (do in parallel), deadline **June 19**:

**Track A — Publishing (so installing bspecs gives you `b6p`):**
1. Merge **PR #14** → publish `@bluestep-systems/b6p-cli` to GitHub Packages. *(Skip publishing `b6p-core` — the cli already bundles it.)*
2. bspecs depends on `b6p-cli`, add an `.npmrc`, fix the `repository` URL.
3. Move bspecs from the personal account (`fchazarreta-bs`) to the **`Bluestep-Systems` org** and push.
4. Publish bspecs (bump version + CHANGELOG).
5. *Fast-follow (separate release):* delete the ~200 lines of shell-detection workaround, switch skills to `npx b6p`.

**Track B — Rules merge (Brandon + Brendan + Brian → bspecs instruction templates):**
1. Reconcile the 6 shared knowledge-base docs (Brian ≈ Brandon), then add Brandon's atomic reference/conventions + the gotchas under `templates/claude/instructions/{reference,conventions,gotchas}/`.
2. Three-tier on-demand loading: critical rules inline in CLAUDE.md, overviews + an `index.md` manifest ("load when X"), **no `@`-imports**.
3. Generalize `mirrorInstructionsToGithub` to mirror the whole instructions tree into `.github/instructions/`.

**Needs a human call before executing:** `@bluestep` vs `@bluestep-systems` scope for bspecs; confirm publish rights / org membership.

**Biggest risk:** hooks run in WSL — verify the npm-global `b6p` binary is on the WSL PATH (Track A5).

## Context

**Why this is happening.** In the kickoff call, Brendan asked Fernando to (1) segment the b6p monorepo into core / VS Code extension / CLI, (2) publish the developer core to a registry, and (3) build a canonical set of "BlueStep memory.md" rule files merged from each team member's personal rules. The conversation then **redirected**: rather than shipping three separate repos and a fourth rules repo, the agreed direction is to **use the existing `@bluestep/bspecs` CLI as the single tool builders install**, have it pull in the b6p CLI, and **fold the consolidated rules into bspecs' instruction templates**. Deadline: **June 19th** (tomorrow).

**What the research established:**

- The monorepo at `Bluestep-Systems/vscode-extension` (WSL: `/home/fchazarreta/vscode-extension`) is **already segmented** into npm workspaces: `packages/b6p-core`, `packages/b6p-cli`, `packages/b6p-vscode`. "Step zero" is effectively done — no repo split needed for this plan.
- `b6p-core` is `"private": true`, v0.1.0, **unpublished**. `b6p-cli` has `bin: b6p`, bundles core via esbuild, `publishConfig` already targets GitHub Packages (restricted), **unpublished**. `b6p-vscode` already ships a **BlueStep MCP provider** and `languageModelTools` (so "MCP into b6p" is largely present and is out of scope here).
- Neither core nor cli is on public npm.
- **bspecs' git remote is a personal account** (`git@github.com:fchazarreta-bs/bspecs.git`), not the org. Its `package.json` `repository` field wrongly says `github.com/bluestep/bspecs`.
- An existing ADR, [b6p-cli-distribution.md](../decisions/b6p-cli-distribution.md), already designed the end state (publish core→cli, consumers declare `b6p-cli`, invoke `npx b6p`, delete ~200 lines of shell-detection workaround).
- Rule sources:
  - **Brandon** — a 42-file kit (`C:\Users\FernandoChazarreta\Downloads\BlueStep-Team-Knowledge-Kit`): atomic topic files (`01-Platform-Reference/`, 31 files), workflow conventions (`02-Workflow-Conventions/`, 13 files), and agent/knowledge-base files (`03-Agents/`, incl. `bluestep-knowledge/` of 8 files).
  - **Brendan** — a single `BSJS_GOTCHAS.md` (`C:\Users\FernandoChazarreta\Downloads\Brendan Rules`): one gotcha (FetchedResource.code() returns 0 on success).
  - **Brian** — an 8-file kit (`C:\Users\FernandoChazarreta\Downloads\BrianBlueStepMarkdown`): `CLAUDE.md` (landing) + `agents.md` (main guide) + `agents-support/` (`api-patterns`, `code-patterns`, `component-library`, `file-execution`, `platform-overview`, `typescript-guide`).
  - **Fernando** — this repo's `templates/claude/instructions/{bsjs-development,b6p-platform}.md.template`, skills, hooks, CLAUDE.md.
- **Key dedup insight:** Brian's `agents-support/*` and Brandon's `03-Agents/bluestep-knowledge/*` are the **same six docs** (identical filenames, common ancestor) — for those, the merge is *reconcile two divergent versions*, not combine distinct content. Brian also already uses the exact target pattern: a short `CLAUDE.md` landing page + reference table → support files loaded on demand. Brian-unique detail worth keeping: `mergeTag()` option codes (L/F/I/H), `B.net.pageContent()` placement methods, SweetAlert2 v8 quirks, the SVG-icon-endpoint requirement, component-library CSS anti-pattern.

**Decisions locked with the user:**

1. Scope = **publishing chain + rules merge into bspecs**. (Three-repo split, MCP-into-b6p, and a 4th rules repo are deferred/separate.)
2. Registry = **GitHub Packages (restricted)** for all packages.
3. **bspecs itself** declares `@bluestep-systems/b6p-cli` as a dependency (installing bspecs brings `b6p`).
4. Rules structure = **atomic files + a short index**, loaded on demand.
5. Distribution = **publish `b6p-cli` via PR #14** (not `git+`).
6. **`b6p-core` publish is skipped for the deadline** (cli bundles it; publish later only for external consumers).

---

## Track A — Publishing chain (b6p-cli → bspecs)

Tracks A and B are independent and can proceed in parallel.

**Distribution method — decided (see PR [#14](https://github.com/Bluestep-Systems/vscode-extension/pull/14)).** A developer proposed using a `git+` dependency instead of publishing. This does **not** work cleanly for `b6p-cli` because it lives inside the `bsjs-push-pull-monorepo`: npm cannot target the `packages/b6p-cli` sub-package from a git URL (it installs the repo root), there is no semver (pins a ref — the "doesn't stay in sync" problem), and every consumer needs SSH access to the private repo. The chosen registry is GitHub Packages (restricted), and PR #14 already implements the publish path. **Decision: merge PR #14 (publish b6p-cli), do not use `git+`.**

**Note on `b6p-core` — decided: skip for the deadline.** `b6p-core` is the host-agnostic engine (script-tree model, push/audit logic, WebDAV/HTTP, auth/sessions, URL/ID parsing, persistence) that exposes provider interfaces (`IFileSystem`, `ILogger`, `IPrompt`, `IProgress`, `IPersistence`); `b6p-cli` and the extension are thin adapters that inject Node/VS Code implementations and `import … from '@bluestep-systems/b6p-core'`. **`b6p-cli` devDepends on core and esbuild-bundles it**, so the published cli tarball is self-contained — a consumer of `b6p-cli` never resolves core from a registry. Therefore publishing core is **not required** for bspecs→cli. Publish it later only when there's a real external consumer of core (Brendan's "give core to users" goal) or if cli/extension stop bundling it. **A1 below is the optional/forward-looking path — skip it for June 19.**

### A0. Prerequisites / auth (verify first — these are blockers)

- Confirm Fernando has **publish rights** on the `@bluestep-systems` scope (monorepo packages) and the `@bluestep` scope (bspecs) on GitHub Packages, and org membership in `Bluestep-Systems`.
- Ensure a `~/.npmrc` with a GitHub PAT (scope `write:packages`) and scope→registry mappings:

  ```ini
  @bluestep-systems:registry=https://npm.pkg.github.com
  @bluestep:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
  ```

- **Open question to confirm with Brendan/Steve:** bspecs is scoped `@bluestep` while the monorepo uses `@bluestep-systems`. Decide whether to keep `@bluestep/bspecs` or rename to `@bluestep-systems/bspecs` for consistency before first publish (a rename is much cheaper now than after publish).

### A1. Publish `b6p-core` (OPTIONAL — skip for deadline; see note above)

File: `packages/b6p-core/package.json`

- Remove `"private": true`.
- Add `publishConfig: { "registry": "https://npm.pkg.github.com", "access": "restricted" }`.
- Add a `repository` block with `"directory": "packages/b6p-core"` (mirror b6p-cli's).
- Build and publish: `npm run compile -w @bluestep-systems/b6p-core` then `npm publish -w @bluestep-systems/b6p-core`.
- Only do this when there's a real external consumer of core, or if cli/extension stop bundling it. Not needed for the deadline.

### A2. Publish `b6p-cli` (in the monorepo) — merge PR #14

File: `packages/b6p-cli/package.json` — already publish-ready (`publishConfig`, `prepublishOnly` runs clean→lint→check-types→compile).

- `npm publish -w @bluestep-systems/b6p-cli` (prepublishOnly builds the esbuild bundle).
- Verify the published tarball contains `dist/cli.js` and the `b6p` bin.

### A3. Wire bspecs to depend on the cli + move to the org

Files: `package.json`, new `.npmrc`, git remote.

- Add to `dependencies`: `"@bluestep-systems/b6p-cli": "^0.1.0"`.
- Add a repo-root `.npmrc` mapping `@bluestep-systems` → `npm.pkg.github.com` so install resolves the cli (and document the consumer-side PAT requirement in `README.md`).
- Fix `repository.url` to the correct org path (`https://github.com/Bluestep-Systems/bspecs.git` — exact name to confirm in A0).
- Create the `Bluestep-Systems/bspecs` repo, change the `origin` remote from `fchazarreta-bs/bspecs`, push `main`.

### A4. Publish bspecs

- Bump version (e.g. 0.5.0 → 0.6.0) and add a CHANGELOG entry (new b6p-cli dependency; org move; rules consolidation from Track B).
- `npm publish` (publishConfig already targets GitHub Packages restricted).

### A5. (Fast-follow, not deadline-critical) ADR cleanup

Per [b6p-cli-distribution.md](../decisions/b6p-cli-distribution.md) "Cleanup once b6p-cli is published": once a clean-machine install is verified, remove the shell-detection workaround (`detectEnvironmentFor`, `.claude/b6p-env.json`, `/b6p-detect`, the `require-wsl-for-b6p.sh` regex) and switch skills to `npx b6p`. **Stage this as a separate release** — do not bundle it with the first publish, to keep the deadline change small and reversible.

- **Risk to verify before A5:** hooks run inside WSL, but an npm-global `b6p` installed via the Windows toolchain may not be on the WSL PATH (or vice versa). Confirm where the `b6p` bin lands for a bspecs global install and that the WSL hooks/skills can find it. This is the single biggest integration risk in the plan.

---

## Track B — Consolidate rules into bspecs (atomic files + index)

Target layout under `templates/claude/instructions/`:

```text
instructions/
  index.md.template              ← short; lists every topic with a one-line "load when…" hint
  b6p-platform.md.template       ← keep as the platform overview (on-ramp)
  bsjs-development.md.template    ← keep as the BsJs overview (on-ramp)
  reference/                     ← atomic single-topic files (Brandon 01-Platform-Reference)
  conventions/                   ← build/deploy rules (Brandon 02-Workflow-Conventions)
  gotchas/                       ← Brendan BSJS_GOTCHAS + Brandon's gotcha files
```

### B1. Merge & dedup (three sources now: Brandon + Brendan + Brian)

- Keep the two existing instruction files as **overviews**; they already cover the high-frequency material (field access, `B.time`, Java optionals, endpoint/merge-report basics, TS narrowing). Do **not** duplicate that content in the atomic files — atomic files are the *detail* layer the overviews link into.
- **Reconcile the shared knowledge-base set first:** Brian's `agents-support/*` and Brandon's `03-Agents/bluestep-knowledge/*` are the same six docs (`api-patterns`, `code-patterns`, `component-library`, `file-execution`, `platform-overview`, `typescript-guide`). Diff each pair, keep one canonical version per topic, and merge in the deltas (Brian's `mergeTag()` codes, `B.net.pageContent()` placements, SweetAlert2 v8 quirks, SVG-icon endpoint, component CSS anti-pattern).
- Import Brandon's `01-Platform-Reference/*` as atomic files under `reference/`, `02-Workflow-Conventions/*` under `conventions/`, and fold Brendan's `BSJS_GOTCHAS.md` plus Brandon's gotcha files under `gotchas/`.
- Resolve the cross-author overlaps the research surfaced (date format/handling, endpoint output channel vs. fetched-resource code, merge-report patterns, Java collections vs JS array methods, SweetAlert2 version) by keeping one canonical file per topic and cross-linking. Flag any genuine *conflicts* (e.g. SweetAlert2 v8 vs other versions) for human resolution rather than silently picking one.
- Convert Brandon's `[[wikilink]]` cross-references to relative markdown links (`[text](path.md)`) for clickability and consistency with bspecs style.
- All content in **English** (project rule).

### B2. On-demand loading design (how rules enter context)

This workspace's mechanism is **prose + absence of `@`-imports**, not a special feature — confirmed in [CLAUDE.md.template](../../templates/root/CLAUDE.md.template): critical rules are inline, and the "Deep reference" section names the two instruction files with an explicit "not auto-imported — read on demand" note. Claude pulls them with the Read tool only when a task needs them. Brian's `CLAUDE.md` independently arrived at the same pattern (landing page + reference table). Scale it to a folder:

- **Tier 1 — critical rules, always loaded:** stay inline in `CLAUDE.md.template` (the existing 8 numbered rules). These are the must-always-apply subset; never move them into reference files.
- **Tier 2 — overviews, on-demand:** `b6p-platform.md` + `bsjs-development.md`, pointed to (not `@`-imported) from CLAUDE.md's "Deep reference" section.
- **Tier 3 — atomic reference, on-demand:** `index.md` is the manifest. One line per topic file with a **"load this when you're doing X"** trigger hint, so Claude can pick the right file for the task without scanning the tree. `reference/`, `conventions/`, `gotchas/` sit under it.
- **The rule for the build:** no `@`-imports of Tier 2/3 anywhere in CLAUDE.md (that is what forces content into every session — the regression a1adf55 fixed). The index + trigger hints are the only always-on cost beyond Tier 1.
- **Optional reinforcement (consider, not required):** the existing skills (`/quick-task`, `/spec-execute`, etc.) can name the specific reference file to read for a given workflow, since skills are themselves only loaded when invoked. This gives a second, action-driven path to the right file without inflating CLAUDE.md.
- Update `CLAUDE.md.template` to add `index.md` to the "Deep reference" pointer list; keep the existing on-demand wording.

### B3. Generalize the GitHub mirror

File: `src/scaffold.js` → `mirrorInstructionsToGithub`.

- It currently mirrors exactly two hard-coded files to `.github/instructions/*.instructions.md`. Generalize it to walk the whole `instructions/` tree (including `reference/`, `conventions/`, `gotchas/`), apply `{{VAR}}` substitution, and mirror each file — preserving subfolders. Keep the single-source-of-truth guarantee.
- Confirm `copyTemplateTree` already copies nested subfolders (it does for skills); the new subfolders ride along for the `.claude/` side automatically.

### B4. Decide on Brandon's `03-Agents/`

- Brandon's agent role files (`bluestep-code-review`, `bluestep-commenter`, `bluestep-dev`) and `bluestep-knowledge/` overlap with bspecs **skills**. For the deadline, ingest the *knowledge-base* content as `reference/` material; **defer** turning agent roles into new skills (scope creep). Note this as a follow-up in `TODO.md`.

---

## Critical files

- Monorepo: `packages/b6p-cli/package.json` (and `packages/b6p-core/package.json` only if A1 is done). WSL: `/home/fchazarreta/vscode-extension/...`.
- bspecs: `package.json`, new `.npmrc`, `README.md`, `CHANGELOG.md`, `TODO.md`, `src/scaffold.js` (`mirrorInstructionsToGithub`), `templates/root/CLAUDE.md.template`, `templates/claude/instructions/**`.
- Reference inputs (read-only): `BlueStep-Team-Knowledge-Kit/` (Brandon), `Brendan Rules/BSJS_GOTCHAS.md` (Brendan), `BrianBlueStepMarkdown/` (Brian).

## Verification

**Publishing (do on a clean checkout/dir with a valid PAT in `.npmrc`):**

1. `npm view @bluestep-systems/b6p-cli version` returns the published version (no more E404). (Same for `…/b6p-core` only if A1 was done.)
2. `npm i -g @bluestep/bspecs` (against GitHub Packages) succeeds and transitively installs b6p-cli; `b6p --version` resolves.
3. Run `bspecs` to scaffold a throwaway project; run a b6p skill end-to-end (e.g. `/b6p-audit`) — **specifically check the WSL-vs-Windows PATH for `b6p` (risk in A5)**.
4. Confirm `Bluestep-Systems/bspecs` exists and `main` is pushed.

**Rules merge:**

5. Scaffold a project; confirm `.claude/instructions/{index.md, reference/, conventions/, gotchas/}` all land, and that **every** file is mirrored under `.github/instructions/` with subfolders preserved.
6. Confirm `CLAUDE.md` links to `index.md` and does **not** force-load the reference tree at session start (grep the rendered CLAUDE.md for `@`-imports of reference files — there should be none).
7. Spot-check a few migrated files for resolved wikilinks and no Spanish.

## Out of scope (deferred — confirmed with user)

- Splitting the monorepo into three physically separate repos (already workspace-segmented).
- Putting MCP connection instructions into b6p / a standalone 4th rules repo (extension already provides an MCP server provider).
- Public-npm publishing (chose GitHub Packages restricted).
- Converting Brandon's agent roles into bspecs skills (B4 follow-up).
