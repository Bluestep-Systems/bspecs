# Design — Consolidate BlueStep rules into bspecs (atomic files + index)

**Status:** Approved

## Files / areas affected

### Templates (the new rule content)

- `templates/claude/instructions/index.md.template` — **new.** The Tier-3 manifest (read on demand, *not* `@`-imported): one line per topic file in the "what it covers + load when X + key terms" form, a `grep` discovery hint, and a roll-up of any unresolved conflicts. Links **directly** to every atomic file (one hop).
- `templates/claude/instructions/reference/*.md.template` — **new dir.** Brandon's `01-Platform-Reference/*` (30 atomic files) + the reconciled topic guides that don't duplicate a Tier-2 overview (`api-patterns`, `code-patterns`, `component-library`, `file-execution`, `design-system`).
- `templates/claude/instructions/conventions/*.md.template` — **new dir.** Brandon's `02-Workflow-Conventions/*` (13 files).
- `templates/claude/instructions/gotchas/*.md.template` — **new dir.** Brendan's `BSJS_GOTCHAS.md` + Brandon's `bluestep-knowledge/common-gotchas.md` + any gotcha-shaped reference files.
- `templates/claude/instructions/b6p-platform.md.template` — **edited.** Fold in unique deltas from the reconciled `platform-overview` (Brian/Brandon). Stays the Tier-2 platform overview.
- `templates/claude/instructions/bsjs-development.md.template` — **edited.** Fold in unique deltas from the reconciled `typescript-guide`. Stays the Tier-2 BsJs overview.

### Code (so the new tree actually ships and syncs)

- `src/scaffold.js` → `mirrorInstructionsToGithub` — **deleted** (Claude-only; no GitHub Copilot mirror). The call site in `scaffold()` and the import, if unused afterward, go too.
- `src/sync.js` → `SYNC_TARGETS` — **replaced by a full walk of `templates/claude/**` + Copilot entries removed.** The entire hardcoded array (skills, hooks, settings, spec-templates, and the four instruction lines incl. the two `.github/instructions/*` mirrors) is replaced by a dynamically-discovered list walking `templates/claude/**`, emitting one `.claude/**` target per file. A documented `SYNC_EXCLUDE` constant (empty today) is the opt-out for future scaffold-once files. This is the load-bearing change: without it, `bspecs sync` and `bspecs.lock` would silently ignore every new file.

### Docs (kept in sync)

- `templates/root/CLAUDE.md.template` — "Deep reference" section gains an `index.md` pointer; "Self-improvement" section updated to mention the index. Tier-1 rules untouched.
- `CHANGELOG.md`, `TODO.md` — new entry / B4 follow-up note + ticked items.
- `CLAUDE.md` (this repo's own) — "Architecture", "What gets scaffolded", and "Editing templates" sections updated for the new tree; the `mirrorInstructionsToGithub` description removed and the "single source of truth for both Claude Code and GitHub Copilot" claim dropped (now Claude-only).
- Optionally `docs/decisions/` — a short ADR for the dynamic-enumeration + Claude-only decision (see Alignment).

### Read-only inputs

- `~/Downloads/BlueStep-Team-Knowledge-Kit/BlueStep-Team-Knowledge-Kit/{01-Platform-Reference,02-Workflow-Conventions,03-Agents}/` (Brandon)
- `~/Downloads/Brendan Rules/BSJS_GOTCHAS.md` (Brendan)
- `~/Downloads/BrianBlueStepMarkdown/{agents.md,agents-support/*}` (Brian)

## Approach

### Target layout

```text
templates/claude/instructions/
  index.md.template              ← Tier-3 manifest ("load when X" + conflict roll-up)
  b6p-platform.md.template       ← Tier-2 overview (existing, extended)
  bsjs-development.md.template    ← Tier-2 overview (existing, extended)
  reference/                     ← atomic single-topic files
  conventions/                   ← build/deploy/workflow rules
  gotchas/                       ← sharp edges, one per file
```

Three loading tiers, unchanged from the pattern commit `a1adf55` established:

- **Tier 1 — always loaded:** the 8 numbered rules inline in `CLAUDE.md`. Not touched.
- **Tier 2 — on-demand overviews:** `b6p-platform.md`, `bsjs-development.md`. Pointed to (never `@`-imported) from CLAUDE.md.
- **Tier 3 — on-demand atomic detail:** everything under `reference/`, `conventions/`, `gotchas/`, indexed by `index.md`.

**Reconciling the "always-on" question (raised by the best-practices review).** The requirements call `index.md` the "always-on cost," but also mandate **no `@`-imports**. These conflict. Anthropic's Skills model resolves it: only light *metadata* is ever auto-loaded; bodies load on demand. So `index.md` is **read on demand, not `@`-imported** — the only always-on cost is the one pointer line in CLAUDE.md's "Deep reference" section that tells Claude to consult the index first for any platform/BsJs detail task. This is leaner than the requirements assumed and honors the hard no-`@`-import rule. The index is the navigation hub Claude opens once per relevant task (the equivalent of a Skill's pre-loaded description set, but paid only when needed).

### Source → target mapping

| Source | Target |
|---|---|
| Brandon `01-Platform-Reference/reference_*.md` (30) | `reference/<kebab-name>.md.template` |
| Brandon `02-Workflow-Conventions/feedback_*.md` (13) | `conventions/<kebab-name>.md.template` |
| Brandon `bluestep-knowledge/common-gotchas.md` | `gotchas/common-gotchas.md.template` |
| Brandon `bluestep-knowledge/design-system.md` | `reference/design-system.md.template` |
| Brendan `BSJS_GOTCHAS.md` | `gotchas/fetched-resource-code.md.template` (split if multiple gotchas) |
| Shared six docs — `api-patterns`, `code-patterns`, `component-library`, `file-execution` | reconcile Brian≈Brandon → one canonical `reference/<name>.md.template` each |
| Shared six docs — `platform-overview` | reconcile, fold deltas into `b6p-platform.md.template` (no separate file) |
| Shared six docs — `typescript-guide` | reconcile, fold deltas into `bsjs-development.md.template` (no separate file) |
| Brandon `03-Agents/*` role files, `README - Start Here.docx`, Brian `agents.md`/`CLAUDE.md` landing | **not imported** (deferred / kit-meta, see Out of scope) |

**Why platform-overview / typescript-guide fold into the overviews instead of becoming files:** they parallel the two existing Tier-2 overviews 1:1. Per requirement B1 ("do not duplicate overview content into atomic files"), keeping them as separate `reference/` files would create two competing overviews per topic. The reconciled *deltas* enrich the overviews; the overviews remain the single Tier-2 on-ramp.

### Naming + wikilink conversion

- Strip the category prefix (`reference_`, `feedback_`) — the folder already encodes the category — and the `bluestep_` noise word; convert to kebab-case. E.g. `reference_bluestep_datetime_field_write.md` → `reference/datetime-field-write.md.template`; `feedback_bluestep_date_format.md` → `conventions/date-format.md.template`.
- Brandon's `[[wikilink]]` cross-references resolve against the *old* stems. During migration, maintain an old-stem → new-relative-path map and rewrite each `[[…]]` to `[text](../folder/name.md)` (relative to the file's own folder). A final `grep -r '\[\[' templates/claude/instructions` must return nothing.

### Conflict surfacing (my call, per your hand-off)

Two cases, distinguished per Anthropic's "avoid time-sensitive information" guidance:

- **Superseded, not contested** (one version is clearly newer/correct, e.g. SweetAlert2 v8 supersedes an older snippet): write the current version as the body and move the old one into a collapsible `<details><summary>Legacy (pre-vX)</summary>…</details>` "old patterns" block — the doc's recommended pattern. No human decision needed; no CONFLICT flag.
- **Genuinely contested** (sources disagree and it's not clear who's right): keep one canonical file, write the likely-correct version, and:
  1. Insert an inline `<!-- CONFLICT: <topic> — Brian says X, Brandon says Y. Needs human resolution. -->` comment at the point of disagreement (invisible in render, co-located, greppable).
  2. Add a one-line entry to an **"Unresolved conflicts"** section at the bottom of `index.md` so every flag is findable in one place: `- gotchas/sweetalert.md — version uncertainty — see inline CONFLICT`.

This beats a separate `UNRESOLVED.md` (flags drift from content) and beats silently picking (loses the disagreement).

### Code generalization — single source of truth for the instructions tree

Add a helper (in `utils.js` or `sync.js`) that walks **all of `templates/claude/**`** once and returns, per file, its sync target:

```js
// for templates/claude/instructions/reference/foo.md.template →
// { templateSrc: 'claude/instructions/reference/foo.md.template',
//   destRel:     '.claude/instructions/reference/foo.md' }
// for templates/claude/spec-templates/design.template.md →
// { templateSrc: 'claude/spec-templates/design.template.md',
//   destRel:     '.claude/spec-templates/design.template.md' }   // .template.md preserved
```

Transform rule (identical to `copyTemplateTree`'s `walk`): `destRel` = `.claude/` + path under `templates/claude/`, with a **trailing** `.template` stripped. Because the rule strips only a trailing `.template`:

- `settings.json.template` → `settings.json` (stripped)
- `spec-templates/design.template.md` → `design.template.md` (ends in `.md`, untouched)
- `instructions/**/foo.md.template` → `foo.md` (stripped)
- `skills/**/SKILL.md`, `hooks/*.sh` → unchanged

This reproduces the old hardcoded array exactly. (No GitHub dest — Claude-only.)

Then:

- `SYNC_TARGETS` = the helper's output for `templates/claude/**`, minus a documented `SYNC_EXCLUDE` set (empty today). The **entire** hardcoded array is deleted. The `templates/claude/**` boundary is what made the old list correct implicitly: `templates/root/` (user-owned CLAUDE.md/README) and `templates/module/` (scaffold-once) live outside it and are naturally excluded.
- `mirrorInstructionsToGithub` and its call site in `scaffold()` (scaffold.js:54, 205–215) are deleted entirely. No mirror is generated.

This guarantees lock-file hashing and `bspecs sync` both derive from the one tree — add a skill, hook, or `reference/` file and it flows automatically, with no Copilot copy and no hand-maintained list to keep in sync.

### File extension convention

Every file under `instructions/` uses `.md.template` (even those with no `{{VAR}}`). Uniformity lets `copyTemplateTree`'s ext-strip and the dynamic enumeration assume a single shape. `applyTemplate` is a harmless no-op on files without variables.

## Data / control flow

**At scaffold (`scaffold()`):**

1. `copyTemplateTree('claude', …)` already recurses subfolders (`walk` in utils.js:35) → `reference/`, `conventions/`, `gotchas/`, `index.md` land under `.claude/instructions/` automatically, `.template` stripped, vars applied. No change needed here.
2. ~~`mirrorInstructionsToGithub`~~ — removed. No `.github/` tree is written.
3. `writeBspecsLock` iterates the generalized `SYNC_TARGETS` → hashes every `.claude/instructions/**` file into `bspecs.lock`.

**At `bspecs sync`:** `syncFiles` iterates the generalized `SYNC_TARGETS` → new instruction files are added, upstream-changed ones updated, locally-edited ones skipped — same logic, now covering the whole tree.

## Edge cases

- **Empty subfolder** — if a folder ends up empty it simply contributes no targets; `copyTemplateTree` skips it. No special handling.
- **Brendan's file with >1 gotcha** — split into one file per gotcha under `gotchas/` so each is independently linkable from `index.md`. If it's truly a single gotcha, one file.
- **Wikilink to a deferred/dropped file** (e.g. a link into `03-Agents/`) — drop the link, leave the text, note it in the migration so it's not a dangling relative link.
- **Filename collision after kebab-casing** two different sources to the same name — disambiguate with a topic suffix; never silently overwrite.
- **Pre-existing `.github/instructions/` in a project scaffolded by an older bspecs** — `bspecs sync` does not delete files, so stale Copilot mirrors linger harmlessly. Out of scope to clean up automatically; note it in the CHANGELOG so users can delete `.github/instructions/` by hand if they want.

## Applying current Anthropic best practices

Verified against the live docs (June 2026): [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) and [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). The instruction tree is, in effect, a progressive-disclosure Skill library, so the Skills guidance applies directly. Each principle below becomes a concrete migration/authoring rule that tasks must follow:

1. **Just-in-time over upfront.** Keep lightweight identifiers (paths) and load on demand. → The tree + index is exactly this; no `@`-imports (see tier reconciliation above).
2. **References one level deep.** Claude only *partially* reads files reached through a chain of references (it previews with `head`). → `index.md` links **directly** to every atomic file (one hop). Each reference file must be **self-contained** — cross-links between reference files are allowed only as secondary navigation, never as the path to required content. CLAUDE.md → index.md → file is the single intended chain; nothing deeper.
3. **Table of contents for files >100 lines.** → Any overview or reference file over ~100 lines starts with a `## Contents` list, so partial reads still reveal full scope. The two Tier-2 overviews get one.
4. **Descriptions = what it does + when to use it, third person, specific key terms.** → Every `index.md` entry follows `path — <what it covers>. Load when <trigger>.` with concrete BlueStep keywords (so keyword matching fires). No first/second person.
5. **Be concise; assume Claude is already smart.** → Migration rule: strip generic explanation (what an HTTP request is, what TypeScript narrowing is); keep only BlueStep-specific signal. Challenge each atomic file's token cost.
6. **Consistent terminology.** → Pick one term and enforce it across the tree: always "component" (not module/element), "field" (not box/control), "endpoint" (not route). Reconcile source-author variance during migration.
7. **Descriptive filenames, organized by domain.** → kebab-case content-revealing names; `reference/`/`conventions/`/`gotchas/` is the domain split.
8. **Grep as a discovery path.** → `index.md` includes a hint: ``grep -ri "<term>" .claude/instructions/`` for term-level lookup, giving Claude a second retrieval route beyond the manifest.
9. **Right altitude, imperative voice.** → Conventions read as directives ("Push the inner draft, not the outer folder"), not observations. Most of Brandon's `feedback_*` files already do; normalize the rest.
10. **Avoid too many options; give a default + escape hatch.** → Where sources offered competing approaches, present the recommended one first, alternatives as the escape hatch.

**Hooks (you asked):** Track B adds no hooks. The relevant best practice — *enforce must-always rules deterministically rather than trusting the model* — is already satisfied: the Tier-1 critical rules are backed by the existing hooks (`block-generated-files`, `block-tsc`, `require-wsl-for-b6p`). Migrated reference content is advisory detail, which correctly stays in the on-demand tier, not in hooks.

## Alignment with existing patterns

- **Three-tier on-demand loading** — exactly the pattern CLAUDE.md.template already documents ("not auto-imported — read on demand"); we scale it from 2 files to a tree. The only always-on cost is the CLAUDE.md pointer to `index.md`.
- **Claude-only is a simplification, not a new pattern** — removing the Copilot mirror retires the dual-target single-source-of-truth machinery. The remaining single source is the template tree → `.claude/` only.
- **`.md.template` + `{{VAR}}`** — same template engine and ext-strip convention as every other template file.
- **New pattern introduced: dynamic enumeration of `SYNC_TARGETS`.** Today `SYNC_TARGETS` is fully static. Computing the **whole list** at runtime by walking `templates/claude/**` is a deliberate departure. **This warrants a short ADR** in `docs/decisions/` (e.g. `instruction-tree-and-claude-only.md`) recording (a) the move from a hardcoded array to a walked tree (with the `SYNC_EXCLUDE` escape hatch and the `templates/claude/**`-is-synced boundary) and (b) the Claude-only decision (Copilot mirror dropped) — both change core mechanisms future contributors will touch. Recommended, low cost.

## No-duplication review (consolidation correctness)

The whole point of the merge is to *remove* duplication; we verify we achieved it rather than assuming. After migration, run a cross-file dedup pass over `templates/claude/instructions/**`:

- **Mechanical pass:** `grep`/normalized-text comparison for repeated headings, code blocks, and distinctive sentences across files; flag any rule appearing in two places.
- **Semantic pass:** a focused review (its own task, optionally delegated to a subagent reading the whole tree) that catches paraphrased duplicates the grep misses — e.g. the same date-handling rule stated differently in `conventions/date-format.md` and an overview.
- **Resolution rule:** each duplicated rule collapses to **one canonical file**; other locations link to it (respecting the one-level-deep constraint — link from the index, not file-to-file chains). Overviews keep the high-frequency *summary* and link to the atomic file for detail; they must not restate the atomic file's full content.

This directly enforces requirement B1 ("do not duplicate overview content in the atomic files") and the best-practice "minimal high-signal tokens."

## Risks

No test suite — verification is manual scaffold-and-inspect.

- **`bspecs sync` regression (highest risk).** The `SYNC_TARGETS` generalization touches the live sync/lock mechanism that every scaffolded project's `SessionStart` hook runs. A bug here could corrupt lock files or skip/clobber files in existing projects. *Verify:* scaffold a scratch project, confirm `bspecs.lock` lists every instruction file with both copies; edit one reference file locally and confirm `bspecs sync` reports it `skipped (locally modified)`; add a template file and confirm sync `added` it.
- **Removing the mirror could leave dangling references in this repo's own docs/code.** `mirrorInstructionsToGithub` is named in CLAUDE.md, possibly in `README.md`/`CHANGELOG.md`. *Verify:* `grep -ri "mirrorInstructions\|github/instructions\|copilot" .` (outside the spec dir) returns nothing live after the change.
- **Dangling relative links** after wikilink conversion. *Verify:* `grep -r '\[\[' templates/claude/instructions` returns nothing, and spot-check 5–6 converted links resolve to real files.
- **Residual duplication** — paraphrased rules surviving in two files defeat the consolidation. *Verify:* the No-duplication review above (mechanical + semantic passes).
- **Index drift** — a `reference/` file with no `index.md` entry is invisible to Claude's on-demand selection. *Verify:* count files under the three dirs vs. entries in `index.md`. (A lint check is a possible follow-up, not this spec.)
- **Spanish content slipping through** (project rule: English only). *Verify:* spot-check migrated files; the sources are already English, but Brandon's `feedback_*` files may have stray notes.
- **Volume** — ~50 atomic files is a lot of manual reconciliation under a tight deadline. *Mitigation:* migrate Brandon's `01`/`02` largely verbatim (mechanical: rename + wikilink-convert); spend the reconciliation effort only on the six shared docs and the flagged cross-author overlaps.
