<!-- markdownlint-disable MD024 -- repeated subsection headings are intentional in a per-version changelog -->

# Changelog

All notable changes to `@bluestep-systems/bspecs` are documented here.

This project follows [Semantic Versioning](https://semver.org/). While the major version is `0.x`, every minor bump (`0.1.x` → `0.2.0`) may contain breaking changes — that is the SemVer convention for pre-1.0 packages.

## [plugin 0.22.0] — 2026-08-18

Scopes the git-site SPA base guidance shipped in 0.15.0 — it does not reverse it. The relative
Vite base (`base: './'`) was verified and stays correct for its purpose: a bundle mounted into
another page. The defect was presenting that one purpose's answer as the universal one, so anyone
building the other kind of site — a standalone routed SPA — followed it and shipped a site that
deploys clean and renders a blank page, with nothing reporting an error. Reported in ClickUp
[86bbd257g](https://app.clickup.com/t/86bbd257g).

### Changed — bluestep-reference skill

- **`reference/git-site-spa.md` — one Vite base per purpose, and the file now asks which one you
  have.** Restructured around an explicit fork. It opens with the model both answers rest on —
  **two mounts that are not equivalent**: `/spa/**` serves any file in the deployed commit, while
  the domain root is a funnel on the 404 branch that adopts only extension-less GET/HEAD
  navigations (so a missing asset stays a clean 404, never a 200 full of HTML) — then a two-row
  table routes the reader before any base advice appears. The **mounted bundle** section keeps
  `base: './'` with its host-agnostic rationale intact (the entry may be loaded from any host —
  this is a production pattern, not a mistake to "correct"). A new **standalone routed SPA**
  section documents the conditional base — `command === 'build' ? '/spa/' : '/'`, shown in that
  form because a flat `'/spa/'` breaks the dev server — why both `'/'` and `'./'` fail on deep
  routes, and the deploys-fine-renders-blank symptom by name so it is recognisable. The old "deep
  links work" bullet moved into the standalone section where it is true, with the
  fallback-under-`/spa/` half explicitly marked unverified; the `/b/` proxy embedding variant is
  relabelled as a sub-case of the mounted-bundle purpose, content unchanged. The date-stamp
  preamble is gone per the current authoring rule (mark individual facts unverified instead).
- **Reserved platform prefixes documented.** New section listing the prefixes the platform answers
  before any request reaches the SPA — `/gql`, `/csrf-token`, `/shared`, `/oauth2`, `/b`, `/data`,
  `/files`, `/downloadFolder`, `/appinfo`, `/spa` — so a client-side route defined under one is
  known dead on arrival. Presented as the known-reserved set, not an exhaustive one.
- **A CI base check is recommended for the standalone case**, described inline in a few lines:
  read the built `index.html`, assert every asset `src`/`href` is addressed from `/spa/`, fail the
  build otherwise. Nothing else catches this failure class — a wrong base typechecks, builds, and
  deploys.
- **Manifest entry trimmed and re-triggered.** The `git-site-spa.md` entry in `SKILL.md` was the
  largest in the manifest at 113 words and named only the relative base; it is now ~45 words and
  names **both purposes**, so either kind of builder routes to the file — the original failure was
  a reader who had no way to know a second purpose existed. The file's frontmatter `description`
  was updated in the same pass to match.

## [plugin 0.21.0] — 2026-08-17

The platform's AI surface (`B.ai`) documented, from the 2026-08 `ai-plugin` feedback triage.
Two reporters independently designed an outbound third-party integration — one wrote a phantom
"no home for the LLM credential" blocker into an approved design — because the reference
mentioned model access nowhere.

### Added — bluestep-reference skill

- **`reference/ai-services.md` — the platform's model access.** A new single-topic file covering
  `B.ai`, written from the `Ai*` declarations in `declarations/B.d.ts` and from a live in-house
  consumer, not from recollection. It states the fact both reports needed and neither had: model
  access runs **inside the platform** and bills to the tenant, so a call needs only a prompt —
  provider, model, and credentials come from tenant configuration (`apiKey` exists as an override,
  so the default path needing no key is stated as the default, not as an absolute). Covers the
  fully synchronous execution model (`AiCallResult` returned directly; the BSJS surface has no
  Promises and no token-streaming path), one-shot `call()` and multi-turn `agent()` with the
  boundary between them, the `B.ai.tool` factory including the Relate-native `forNewEntry` /
  `forExistingEntry` helpers that let a model fill a form entry, spend budgets keyed by `flag`
  (`maxSpendMicros` is micros of USD — 1,000,000 = $1.00), denial via `stopReason === "ai_denied"`
  plus `denialMessage`, availability feature-detection (`typeof B.ai !== "undefined"` — the surface
  is experimental and not present on every pod/tenant), audio input via `streamingAgent()`, and AI
  write provenance in formulas via `RowContext.ai()`. Unconfirmed behavior — the full `stopReason`
  value set and any `denialCode` values — is marked unverified rather than guessed. Indexed from
  the manifest with a trigger that fires on model access, AI generation, agents, or AI tools.
  Resolves ClickUp [86bbe9b36](https://app.clickup.com/t/86bbe9b36), which consolidated
  [86bbd2w2y](https://app.clickup.com/t/86bbd2w2y).

### Changed — bluestep-reference skill

- **The `B` object section no longer claims to be the full API.** `bsjs-development.md`'s
  `## The B object — full API` heading covered six namespaces; `export class B` has **25 members**,
  so a reader who trusted the heading concluded the object had no AI surface — which is what
  happened, twice. Renamed to **core namespaces**, with a line naming several of the undocumented
  ones (`B.db`, `B.io`, `B.util`, `B.crypto`, `B.mail`, `B.find`, `B.org`) and pointing at the
  component's own `declarations/B.d.ts` for the rest. A short `### B.ai — model access` subsection
  was added immediately after `B.net` — the adjacency where "a model call is an outbound call"
  forms — carrying one load-bearing fact, a minimal example, and a link out. Contents anchor
  updated to match.
- **`reference/internal-loopback-fetch.md` stops priming an outbound provider call.** Its closing
  pointer read *"httpRequester is still correct for EXTERNAL calls like api.openai.com"* — the only
  LLM-adjacent sentence in the whole reference, and the one a reporter traced a wrong design to.
  The provider hostname is gone; the line now routes model access to `B.ai` and says plainly that
  `B.net.fetch` is the default for outbound HTTP, internal or external, with `httpRequester` as the
  older imperative API.

### Changed — spec-create skill

- **AI-touching features consult the AI reference before an architecture is chosen.** A new Phase 2
  step — placed *between* copying the design template and filling it in, because the reported
  failure was that the architecture was already settled by the time anything got written down —
  directs a feature involving AI, agents, model calls, generation, or AI tools to read
  `reference/ai-services.md` first and prefer tenant-metered `B.ai` over a third-party provider
  unless the design states a reason otherwise.

### Changed — bluestep-init templates

- **`AGENTS.md.template` names `B.ai` and stops promising a table that does not exist.** `B.ai`
  joins the `B`-namespace list, and *"the full namespace table"* became *"the other namespaces"* to
  match the reference it points at. Kept to those two changes deliberately: this template is
  always-on project context, so every word costs tokens in every session. **Reaches newly
  scaffolded projects only** — existing projects keep their `AGENTS.md` and get the benefit through
  the reference-side changes on their next plugin update.

## [plugin 0.20.1] — 2026-08-12

More fixes from the 2026-08 `ai-plugin` feedback triage — the entries that missed the 0.18.0
train, landing after the query-creation batch in 0.19.0 — plus a cross-tool frontmatter fix
from the 0.18.0 pilot.

### Fixed — bluestep-init invisible on Cursor (strict-YAML frontmatter)

- **`bluestep-init`'s skill description broke strict YAML parsers.** The unquoted
  `Non-destructive/idempotent: writes …` (colon + space inside a plain scalar) is invalid
  strict YAML. Claude Code's lenient frontmatter parser masked it, but Cursor's composer
  registry silently dropped the skill — `/bluestep-init` was uninvocable there (found in the
  0.18.0 live pilot; GitHub's preview renderer flags the same error). Reworded the description
  (`Non-destructive and idempotent — writes …`). **Guardrail:** `gen:check` now scans every
  skill and agent frontmatter value for unquoted colons and fails CI on them, so this class
  cannot ship again — and that new lint immediately caught a second live instance:
  **`b6p-code-review`'s description** (`REPORT-ONLY by default: it makes …`) had the same
  defect, explaining why that subagent was missing from Cursor's composer while the other two
  showed. Reworded likewise.

### Changed — bluestep-reference skill

- **Endpoint authoring documented as a grantable prerequisite, not a dead end.** The END_POINT quirk in
  `conventions/mcp-platform-authoring.md` told the AI to hand *all* endpoint work back to the platform UI,
  so the ENGINEER ENDPOINT refusal read as permanent. It now carries the two invariants code investigation
  established: the `You do not have Custom ENGINEER ENDPOINT privileges` failure on `create_script` means the
  **calling token's subject lacks the endorsement**, the check fires **before persistence** (the tool
  transaction rolls back, so nothing partial is left behind and an identical retry fails identically), and
  the endorsement is **grantable via a global account** — a one-time setup step to surface, with the UI
  hand-back as the fallback only when the grant will not happen. A note records that a pre-flight honest
  error is being added server-side. The `add_field_access` entry in the supported-tool set gained the
  matching caveat, so the wiring tools no longer read as unconditionally available on a BSJS endpoint.
- **`lookup_script_by_name` misses are name mismatches first.** New quirk: the exact-name lane is
  **case-sensitive** and matches the display name **literally**, and BSJS endpoints *are* searched on both
  lanes — so a miss is not evidence the script type is unsupported. A half-failed creation can also show up
  as a folder child while matching nothing by name. Rule: list the folder and compare exact display names
  before concluding a script does not exist.
- **Trust but verify booleans set at CREATE time.** New quirk pairing the existing
  `form`-CREATE `singleEntry` / `userUpdateable` bullet: a CREATE response echo reports what the tool was
  *asked* to do, never a read of what was stored, so a load-bearing boolean must be re-read with an
  authoritative reader and corrected via UPDATE. The underlying flag-handling bug is being fixed
  server-side; the read-back habit is durable regardless.
- **New gotcha: nullable booleans.** `gotchas/common-gotchas.md` gained a section on the fact that an
  untouched BlueStep boolean is `null`, not `false` — so `=== false` on an opt-out flag silently excludes
  every record where the box was never ticked, and the short result is indistinguishable from "no matching
  records". Rule with examples: `!== true` for opt-out flags, `=== true` for opt-in. The manifest line
  gained the matching load hook.

  All four resolve ClickUp [86bb9247d](https://app.clickup.com/t/86bb9247d). Two of the reported
  behaviors were **refuted** by code investigation and are documented as the investigated reality
  rather than the report: `create_script` does **not** persist the endpoint before the permission
  failure, and `lookup_script_by_name` does **not** skip BSJS endpoints.

## [plugin 0.19.0] — 2026-08-12

More fixes from the 2026-08 `ai-plugin` feedback triage — the entries that missed the 0.18.0
train.

### Changed — bluestep-reference skill

- **Query/view creation: display columns are a CREATE-time requirement, and creation needs a
  completeness read-back.** The `conventions/mcp-platform-authoring.md` `view` bullet framed the
  display-column rule as an aside about *editing* existing views, so a query created with no columns —
  incomplete, renders blank for a human — read as acceptable. Rewritten affirmatively as a property of
  **creation on any path** (the `view` inner tool, `create_mefr`, and raw
  `createRelateQuery` / `graphql_mutation` alike), with the reason kept: column edits on an existing
  view die on the AI-tools DELETE guard, so the only recovery is manual platform-UI work and create
  time is the only cheap moment. Adds the copy-pasteable `displayColumns` shape and the full
  `DisplayColumnInput` field list (`formId`, `fieldId`, `sortOrder`, `width`, `wordWrap`,
  `sortDirection`, `detailReportId`). A new **create-time completeness read-back** section mirrors the
  mandatory declaration read-back of step 6: after creating a query, assert non-empty `displayFields`
  and `searchComponents` plus the expected `recordTypes` and `mustHave`/`mustNotHaveCategories` —
  three of the four silently come back empty, `createRelateQuery` stores neither category set (and a
  follow-up `updateRelateQuery` drops them too unless `recordTypes` rides along in the same mutation),
  and an empty `searchComponents` on a permission query **fails open**. Step 6 and the manifest line
  gained pointers. Resolves ClickUp [86bb8xe8d](https://app.clickup.com/t/86bb8xe8d).
- **Permission queries: exactly one display column, the staff `Full Name` field.**
  `reference/staff-query-permission-gating.md` covered only the runtime side; it gained an
  **authoring-side** section carrying the verified invariant (8-for-8 across the Reader/Author/Editor
  triads, the Standard Report gates, and the boolean variant), the warning to resolve the field **by
  name** because topIds are per-org and never portable, the create-time column shape, and the
  fails-open read-back assertion — cross-linked both ways with the authoring convention. Manifest line
  and frontmatter description gained the authoring hook so the file loads when a permission query is
  being *created*, not only consumed. Same ClickUp task.

## [plugin 0.18.0] — 2026-08-12

Headline: **the plugin now ships for Cursor and OpenAI Codex too.** The same `plugin/` source
is emitted as generated native trees (`dist/cursor/`, `dist/codex/`), and this repo now doubles
as **three** marketplaces — Claude Code (`.claude-plugin/`), Cursor (`.cursor-plugin/`), and
Codex (`.agents/plugins/`). Resolves ClickUp
[86bb9x4d2](https://app.clickup.com/t/86bb9x4d2). Also carries the second batch of fixes from
the 2026-08 `ai-plugin` feedback triage. **Codex note for this release:** plugin hooks are new/changed here, so
Codex users must (re-)trust them after updating — untrusted hooks are silently skipped.

### Added — cross-tool plugin output (Cursor, Codex)

- **Generated Cursor and Codex plugin trees, committed.** A dependency-free generator
  (`tools/gen-cross-tool/` — `npm run gen`, `npm run gen:check`) reads `plugin/**` and emits
  `dist/cursor/bluestep-tools/` and `dist/codex/bluestep-tools/` plus the two root marketplace
  manifests (`.cursor-plugin/marketplace.json`, `.agents/plugins/marketplace.json`). Skills copy
  near-verbatim (SKILL.md is an open standard both tools read) with `${CLAUDE_PLUGIN_ROOT}`
  rewritten and `allowed-tools` stripped; agents copy for Cursor (frontmatter trimmed) and become
  TOML for Codex (underscore names — `b6p_task_implementer` etc.); hooks ship as thin per-tool
  wrappers exec-ing the shared scripts; MCP config uses each tool's env syntax
  (`${env:B6PT_TOKEN}` on Cursor, `bearer_token_env_var` on Codex — Codex does not interpolate
  `${VAR}`). Output is a pure function of `plugin/**` (no timestamps), so the sanitization
  invariant holds: nothing exists in `dist/` that isn't in `plugin/`. Every layout/wiring choice
  was locked by a live prove-out on real Cursor and Codex installs before the emitters were
  written.
- **CI drift gate + Claude-ism lint.** New `cross-tool-drift` job in `ci.yml`: regenerates,
  fails on any diff or untracked file under the generated paths (stale or hand-edited `dist/`
  can't merge), and runs `npm run gen:check` — a structural self-test plus a denylist lint
  (`AskUserQuestion`, `/reload-plugins`, `claude plugin install`, …) that keeps the source
  de-Claude-ing enforced instead of a one-time cleanup. The `plugin-version-bump` gate widened
  to also fire on `tools/gen-cross-tool/**`: emitter changes bump the one shared version too
  (single version stream — all three tools skip an unchanged version on update).
- **Tag-on-merge release automation.** New `.github/workflows/release-tag.yml`: on push to
  `main`, reads the manifest version and — if the `plugin-vX.Y.Z` tag is missing — creates and
  pushes it **and creates the GitHub Release itself** (as built: tags pushed with the default
  `GITHUB_TOKEN` never trigger other workflows, so `publish.yml` can't fire from the
  automation; it stays untouched serving the manual-tag path). Idempotent, never `--force`;
  merging a version-bumped PR is now the whole release, no terminal step.
- **Documented degradations (known, not silent).** Cursor has no blocking pre-edit event
  carrying new content, so the edit hooks (`block-generated-files`, `block-inline-frontend`)
  run post-hoc on `afterFileEdit` as advisories — they warn, they don't block (see
  `dist/cursor/bluestep-tools/hooks/README.md`). On Codex, plugins can't register subagents:
  the three agents ship as TOML in `dist/codex/bluestep-tools/agents/` for manual copy into
  `~/.codex/agents/` or a project `.codex/agents/` until `/bluestep-init` learns to write them
  — until then, delegation is unavailable on Codex and spec skills run in-session. Codex hook
  trust is per-definition: every hook-touching release needs re-trust.
- **Docs.** ADR `docs/decisions/cross-tool-plugin-output.md` (seven decisions: per-tool native
  output, committed `dist/`, no external translator, AGENTS.md bridge, single version stream,
  tag-on-merge, deliberately-unbuilt per-tool extension point) and the per-release checklist
  `docs/cross-tool-output-test-plan.md`.

### Changed — bluestep-init skill

- **`AGENTS.md` is now the scaffolded rules file; `CLAUDE.md` becomes a one-line bridge.** The
  always-on project rules template was renamed `CLAUDE.md.template` → `AGENTS.md.template`
  (content tool-neutralized) — `AGENTS.md` is read natively by Cursor, Codex, and dozens of
  other tools — and a new one-line `CLAUDE.md.template` carries the `@AGENTS.md` import for
  Claude Code, which doesn't read `AGENTS.md` natively. SKILL.md was restructured into
  tool-neutral scaffold steps plus per-tool **Enablement** subsections (Claude Code / Cursor /
  Codex — marketplace add, install, hook trust, token setup per OS). Idempotency extended: an
  existing populated `CLAUDE.md` is never overwritten — the migration (content → `AGENTS.md`,
  shrink `CLAUDE.md` to the import line) is offered, not forced.

### Changed — plugin-wide (source de-Claude-ing)

- **Claude-only phrasing neutralized at the source** (correct for Claude Code too, and it keeps
  the generator a dumb transform): `AskUserQuestion` mentions became "ask one question at a time
  with clickable options where the tool supports structured questions"; `spec-execute`'s
  `[mechanical]` model mapping is now conditional on runtime support (Claude Code's Task-tool
  `model` param named as the example); `CLAUDE.md` prose references swept to `AGENTS.md`;
  "Claude Code plugin" branding became "agent plugin (Claude Code, Cursor, Codex)" with
  per-tool `/reload-plugins` parentheticals. Regressions are caught by the `gen:check` denylist
  lint above.

### Changed — bspecs-feedback skill

- **Runtime environment captured on every submission.** The skill now states which tool it runs
  in (Claude Code / Cursor / Codex, surface, version when known — asking the user only if
  genuinely unsure) and sends it as a new top-level `environment` string in the POST payload;
  the intake endpoint accepts and validates it, pushes it to the ClickUp `Environment` field on
  AI.List, and renders an `**Environment:**` line in the GitHub issue body. Older endpoint
  deployments ignore the key, so the skill is safe on its own.

### Changed — bluestep-reference skill

- **`B.text` (Bluestep.Text) string helpers documented.** New "Text Utilities" section in
  `reference/api-patterns.md`: `toPlainText` (formatted HTML → plain text, the BSJS twin of
  Relate's), `escapeHtml`, `escapeJs`, `escapeJsInTagAttribute`, `xxsSafe`, and
  `messageFormat(format, zone?)` — with the rule to reach for these before hand-rolling escaping
  or regex, and cross-links to the existing `toBaseUrl64` and `B.text.csv` mentions. The
  manifest line gained task-shaped hooks ("string escaping/HTML-stripping", "escaping output")
  so the file loads when the AI is about to hand-roll. Resolves ClickUp
  [86bbc8gya](https://app.clickup.com/t/86bbc8gya) /
  [#78](https://github.com/Bluestep-Systems/bspecs/issues/78).

## [plugin 0.17.0] — 2026-08-11

First batch of fixes from the 2026-08 `ai-plugin` feedback triage: two reference additions
and a new guardrail hook. Resolves ClickUp 86bb99c64, 86bb9tb41, and 86bb9xypw. Existing
installs receive this on `/plugin marketplace update` / `autoUpdate` because the version changed.

### Added — hooks

- **`block-inline-frontend.sh`** — a PreToolUse Edit/Write hook that blocks CSS/HTML dumps into a
  component's `scripts/app.ts` when a sibling `static/` folder exists: incoming content containing
  `<style>`, a `<link>` tag, or `<script src` is denied with a message routing CSS →
  `static/styles.css`, markup → `static/index.html`, client JS → `static/script.ts`
  (per `conventions/separate-files.md`, whose on-demand trigger repeatedly failed to fire when
  *creating* a merge report from scratch). Components without a `static/` bundle are exempt, and a
  user-approved exception is declared once with a `// b6p:allow-inline-frontend — <reason>` comment
  in `app.ts` — visible in review and durable across pushes. Resolves the hook half of ClickUp
  [86bb9tb41](https://app.clickup.com/t/86bb9tb41).

### Changed — bluestep-init skill

- **Scaffolded `CLAUDE.md` critical rule 6 strengthened.** The abstract "frontend lives in
  `static/`, not `scripts/`" line now spells out the concrete prohibition (no `<style>` blocks,
  markup dumps, or `<script src>` strings in `app.ts` template literals when `static/` exists),
  applies it from the first line of a new merge report, and documents the hook enforcement plus
  the `b6p:allow-inline-frontend` override marker. The always-on half of ClickUp
  [86bb9tb41](https://app.clickup.com/t/86bb9tb41).

### Changed — bluestep-reference skill

- **New gotcha: `third-party-lib-type-noise.md`.** A MergeReport whose `static/script.ts` uses a
  runtime-loaded client library (e.g. GridStack) with no local type declarations prints a wall of
  advisory `Cannot find name` / cascading `never` diagnostics on every push. The gotcha documents
  why (no ambient types for the browser global), that it's harmless (the platform compile is
  authoritative), the masking risk (the wall can bury a genuine new diagnostic), and the one-time
  ambient `.d.ts` stub silencer. The `b6p-push` skill's report step gained a one-sentence pointer
  so the noise is no longer surfaced as compile failure. Resolves ClickUp
  [86bb9xypw](https://app.clickup.com/t/86bb9xypw); the bonus ask (CLI output labeling the
  pre-push build advisory) stays tracked for b6p-cli.
- **`runFormula()` documented as the OnDemand trigger.** The reference documented OnDemand
  execution characteristics (task pod, ~5 s scheduler-queue delay) but never stated that
  RelateScript's `runFormula()` / `System.runFormula("name")` is what *triggers* an OnDemand
  formula — leading the AI to assume the call might run the target inline within the save and
  wrongly caution "make sure the call is async". Now pinned down in two places: a "How an
  OnDemand is triggered" paragraph in `bsjs-development.md` → "OnDemand / Field Formula"
  (above the existing `runFormula()` example), and a bullet in `reference/api-patterns.md` →
  "Committing Writes and Formula Triggers", cross-linked to the execution notes. Dispatch is
  detached from the save transaction; the caller needs no async handling. Resolves ClickUp
  [86bb99c64](https://app.clickup.com/t/86bb99c64).

## [plugin 0.16.0] — 2026-07-31

Adds **model-selection guidance for delegated spec execution**: cheap, mechanical work now runs on
the cheapest model tier instead of inheriting the (typically expensive) session model. Three levers,
each owned by the layer that has the context to pull it: a `[mechanical]` task tag defined at
spec-creation time, a per-launch model override applied by `/spec-execute` when it delegates, and
`model:` frontmatter on the one always-cheap agent. Generic aliases only (`haiku`), never dated
model ids, so the files stay correct as models rotate. Resolves ClickUp
[86bb2utj6](https://app.clickup.com/t/86bb2utj6) and
[#43](https://github.com/Bluestep-Systems/bspecs/issues/43). Existing installs receive this on
`/plugin marketplace update` / `autoUpdate` only because the version changed.

### Changed — skills

- **`spec-execute`** — step 5 gained a "Pick the model for this launch" block: a `[mechanical]`-
  tagged task launches `b6p-task-implementer` with a per-launch `model: haiku` override (the Agent
  tool's `model` param, which wins over frontmatter); untagged tasks inherit the session model.
  Two guard rails: the **escalation rule** (a failed/incomplete cheap run gets exactly one re-run
  at the session model — never `[x]` from the failed run, never a cheap-tier retry loop, and the
  escalation is reported at the STOP) and the **momentum rule** (after an escalation, un-tag the
  remaining `[mechanical]` tasks of the same pattern with a note — the pattern proved not
  mechanical). Explicit `--inline` means no override: in-session work runs on the session model.
- **`spec-create`** — the tasks phase defines the `[mechanical]` tag: `[CODE]`-only, reserved for
  repeats of a pattern proven earlier in the same spec (or a named pilot), no new design decisions,
  no new imports/schema, and the first instance of a pattern is never tagged. The tasks-phase
  review is the approval gate for the tags. `spec-templates/tasks.template.md` shows one tagged
  example line.

### Changed — agents

- **`b6p-commenter`** — now carries `model: haiku` frontmatter (verified against current Claude
  Code docs: generic alias accepted, absent means `inherit`, per-launch `model` param overrides
  it). It's the docs-from-code agent — lowest-risk delegate, always cheap by default.

### Docs (ship on merge to `main`)

- **`docs/decisions/subagents-and-delegated-execution.md`** — amended 2026-07-31 with the model
  policy: the three-lever design, the two deliberate keep-inheriting calls (`b6p-code-review` and
  `b6p-task-implementer` stay on the session model — their frontmatter gets no `model:` line), and
  the generic-alias durability rule (shipped files use `haiku`-style aliases, never dated ids).
- **Repo-local dev mirrors** (`.claude/skills/spec-execute`, `.claude/skills/spec-create`,
  `.claude/spec-templates/tasks.template.md`) updated to match — repo-side, not plugin content,
  but part of this change.

## [plugin 0.15.0] — 2026-07-31

Reference-docs release batching the fixes from the 2026-07 `ai-plugin` feedback triage — one spec
(the `mcp-platform-authoring` overhaul, its central claim **re-verified live on a playground org
2026-07-31** before rewriting) plus eight quick-tasks, shipped as a single release so feedback
reporters get one close-out wave.

### Changed — bluestep-reference skill

- **`conventions/mcp-platform-authoring.md` — MEFR imports are now MCP-authorable.** The old
  "add_forms cannot wire a MEFR / route to the UI" limitation prohibited a path that works. Replaced
  with the live-verified query-group recipe (`create_mefr` → `add_queries` with the MEFR's topId as
  the group → `add_forms` with the same `groupId` → `add_field_access` per field → declaration
  read-back), documenting all three failure modes: no-`groupId` silent no-op (`formsAdded: 0`),
  plain-List-view loud rejection, and base-form-topId typedoc exclusion. `create_mefr` added to the
  schema-authoring tool list and the skill description.
- **New "Known authoring quirks" subsection** — dated, workaround-first bullets for observed gateway
  behaviors (platform fixes tracked separately): `form` CREATE mishandling `singleEntry`/
  `userUpdateable` (untrustworthy echo; CREATE-then-UPDATE, verify via `list_available_forms`);
  TEXT/MEMO requiring an explicit format type on CREATE; `record_type` producing an orphaned
  category; MCP-created fields lacking a script-facing FID (`readonly null:` keys — UI-only fix);
  END_POINT creation **and** wiring gated by the ENGINEER ENDPOINT privilege (hand back to the UI).
- **Declaration read-back hardened (step 6)** — now mandatory after any op a `[CODE]` task builds
  on and accessor-name-specific: wiring success is not proof, and a `null`/blank property key means
  stop and hand back. The Safety section notes "global-super" does not cover END_POINT authoring.
- **`bsjs-development.md` — both query-import binding shapes documented**: named-query imports bind
  `B.queries.X`; query-group imports bind a bare global const named after the group (reaching for
  `B.queries.<name>` on a group import returns `undefined`). Check `declarations/index.d.ts`.
- `list_available_forms` and `list_folders` added to the read-only tool catalogue.
- **`bsjs-development.md` — new "Dates: reading, writing, and shipping to a browser" subsection**
  under `B.time`, with three verified silent-failure facts: date-field writes accept
  `M/D/YYYY h:mmAM` and reject ISO 8601 (also closes `date-format.md`'s "unverified" datetime note
  with the observed form); stored dates use a 0-indexed month (6 = July); and
  `ZonedDateTime.toString()` is not browser-parseable ISO 8601 — emit `.toInstant().toString()`.
- **`b6p-platform.md` — new "Anonymous access — two independent grants" section**: Everyone: Reader
  on the endpoint (execute) + Everyone: Relate Author on the form (create), both required for an
  anonymous write; anonymous writes need no elevated script authority; and the 403 (permission) vs
  500 (unknown alias) diagnostic. Cross-linked with `reference/session-cookie-forwarding.md`.
- **New `reference/git-site-spa.md`** — documents the second SPA hosting model (a Git site serving
  a GitHub repo under `/spa/` on its own domain), previously covered nowhere: the five UI-only
  config fields, save-is-the-redeploy (+ webhook auto-deploy scoped to the configured ref, Pull
  button, no-rollback-UI), deep-link fallback, relative Vite base, the absolute-vs-relative
  `/b/<alias>` fetch rule, and the CORS-blocked cross-origin embedding variant with its verified
  same-origin proxy fix. Indexed in `SKILL.md` so the choice between the two hosting models is
  visible at index level.
- **New `gotchas/relate-query-over-mefr.md`** — four live-verified traps when reading multi-entry
  form data through a `view`-tool Relate query: `maxRows: 0` is a literal zero-row cap despite the
  tool schema's "0 = unlimited" (and is the default — use `-1`); `recordTypes` must be the base
  record type, not the form's category; `list_views(formId:)` gives false negatives (omits
  EntityList/MEFR views — re-verified live 2026-07-31, with a matching caution added to the
  `[PLATFORM]` procedure's Idempotency step and its MEFR-recipe reuse check); and `relateQuery`
  cannot execute an EntityList — use a `List` view for data reads. Includes the working recipe and
  the note that `formRows` ignores `limit`/`offset` and carries no field values.
- **New `reference/mcp-read-multi-entry-forms.md`** — the read-path decision tree for multi-entry
  form data over the gateway MCP (knowledge that cost a fresh session ~15 discovery calls):
  `form_entry` READ resolves to `NEW_MULTI` and can't enumerate; `formRows` ignores
  `limit`/`offset`, returns XMLEncoder blobs and times out on huge forms; `fieldData` is
  one-field-one-entry (batch via GraphQL aliases); prefer `relateQuery` over a stored `List` query
  — the only paged, filterable path (cross-links the new MEFR-read gotcha for creating that view
  safely). Plus sibling-tool argument-name gotchas.
- **Template-literal safety hardened** (`conventions/ts-in-template-literal.md` + the
  `b6p-task-implementer` agent): a backtick or unintended `${` anywhere inside the `B.out`
  literal — **including inside comments** — closes/interpolates the literal, misparses the rest of
  the file, and still ships (emit continues through errors, so a snapshot prints "complete" with
  broken output). Added to the leak list, the how-to-apply rules, and the quick-lint (which now
  scans comment contents); the implementer agent now treats a stray backtick/`${` as a
  return-blocking error.
- **Known authoring quirks grew a sixth bullet**: SIMPLE signature fields render blank without a
  Right Label — always pass `rightLabel` when creating them via MCP.
- **`gotchas/common-gotchas.md` — option matching across fields**: match by `displayName()` or
  option id, not `exportValue()` — lists can carry no export values, and `'' === ''` fails open.
- **Compile-on-push correction finished** (started in 0.13.0 on `b6p-push/SKILL.md`): the
  remaining "the platform compiles on push" claims across `b6p-platform.md`,
  `bsjs-development.md` (including the multi-file ES-import note), and the `b6p-task-implementer`
  agent now draw the plain-push vs publish/snapshot distinction — a plain push uploads source
  as-is and compiles nothing; only a snapshot runs the TypeScript build. Also corrected:
  `b6p pull` omits `draft/info/` for most components (its absence is normal, not a broken pull).
- **`mcp-platform-authoring.md` — view-tool limitation documented**: column/filter/sort edits on
  an **existing** view internally delete-and-re-add display components and die on the AI-tools
  DELETE guard; create-time columns and scalar-prop updates work — route such edits to the
  platform UI.
- **`bsjs-development.md` — the "### Endpoint" section now matches the real Response API**:
  `B.net.request` / `B.net.response` (no bare `request`/`response` globals), fluent method setters
  (`status(400).contentType(...)` — the Response object has no settable properties),
  `optParameter(name).orElse(...)` for request params, and callback-form `stream(out => …)` (it
  returns void, never a writable). The section previously contradicted
  `reference/endpoint-output-channel.md`; the two now agree, with the reference file as the
  output-channel source of truth.

## [plugin 0.14.0] — 2026-07-23

Closes the feedback loop: when an AI.List feedback task is **closed**, the reporter now receives an
**automated email saying what actually happened** — worded by a new `resolution` dropdown
(`shipped` / `fixed-unreleased` / `wont-fix` / `duplicate` / `stale`) that **gates the send**: no
resolution set means no email, only a nudge comment (ClickUp's Required-field enforcement is
plan-gated and unavailable, so the gate lives in the endpoint). The body is chosen
by a three-tier ladder: a reporter-facing **`resolution-note`** field sent verbatim → a **`B.ai`
draft** from the task (tenant default provider, spend-capped, constrained to plain reporter-facing
language) → fixed per-resolution generic wording. The notification is sent by the existing BlueHQ
intake endpoint, which gained a second door (`?hook=close`) receiving the HMAC-verified ClickUp
status webhook; after sending it posts a **sent-marker comment quoting the exact email** (dedupe +
closer visibility). A secret-gated **test mode** runs the real pipeline against any list item, mailing only
the maintainer. Because the loop now depends on an address, the **reporter email is required at
filing time** — this is the plugin-side change (the endpoint also rejects email-less payloads).
Verified live end-to-end 2026-07-23 (webhook → email → marker; recipients approved the wording).
Existing installs receive this on `/plugin marketplace update` / `autoUpdate` only because the
version changed. See `docs/decisions/feedback-reporter-email.md`.

### Changed — skills

- **`bspecs-feedback`** — reporter identity is no longer optional/skippable: the email is required
  (auto-filled from `git config user.email`, editable at the confirm gate, prompted for when git
  config is empty), because it now receives the automated close-out notification. The payload docs
  mark `reporter.email` REQUIRED; anonymous filing ended (recorded as an amendment to the intake
  ADR).

### Platform (ships via `b6p push`, independent of the plugin version)

- The BlueHQ intake endpoint gained the `?hook=close` webhook branch, the body ladder, test mode,
  and required-reporter validation (three publish snapshots, 2026-07-23). Setup additions (two
  custom fields, webhook registration, `webhookSecret` form field) are documented in
  `docs/bluehq-feedback-endpoint-setup.md` §5.

### Docs (ship on merge to `main`)

- **New ADR `docs/decisions/feedback-reporter-email.md`** — trigger choice (close + resolution
  field vs. issue-close / release-time / manual), all-outcomes coverage, the note→AI→generic
  ladder, rejected alternatives (received email, mid-work updates, personal API key, human approval
  gate, required note), and the live platform-API findings (`B.util.email`, required `froms`,
  `B.ai` on tenant default, `Version` = filed-from). The intake ADR's status line records the
  amendment.
- **`docs/bluehq-feedback-endpoint-setup.md`** — new §5: close-notification setup checklist
  (fields, webhook + secret, two-stage verification, ops notes).

## [plugin 0.13.0] — 2026-07-23

Makes **publishing the recommended default** everywhere a component push is offered, tightens the
`/b6p-push` confirmation flow, and describes the two modes in **plain, non-technical language**. Previously
the rules framed the choice **neutrally** ("neither marked recommended") and described the difference
inaccurately (as "records history vs. no history"). A live test on bkplayground established the real
difference: **Publish** (`--snapshot --message`) runs the TypeScript build, ships the compiled `app.js`,
updates the **live** version, and records a restorable snapshot — while a **plain push** uploads the draft
source as-is with **no** compile and **no** change to the live version (so it produces nothing runnable and
is rarely useful). Publishing is now **pre-selected and marked `(Recommended)`**, and the choice is shown in
plain words ("Publish — make it live" vs "Save draft only — not live yet") with a description on each
option so non-technical users understand it at the decision point. The hard guarantee is preserved: a push
still happens only on an **explicit** selection — pre-marked, never pre-executed, never silent or automatic.
Resolves ClickUp [86bb23pu5](https://app.clickup.com/t/86bb23pu5) and the `TODO.md` "Auto-snapshot in push
(still undecided)" question (decision: recommend, don't automate). Existing installs receive this on
`/plugin marketplace update` / `autoUpdate` only because the version changed.

### Changed — skills

- **`b6p-push`** — step 3 rewritten from "diff summary → neutral choice → separate conversational message
  round" into **two tight, plain-language `AskUserQuestion` prompts**: "How should this change go out?"
  (`Publish — make it live (Recommended)` → `--snapshot --message`, `Save draft only — not live yet` →
  plain push), then, if Publish, "Describe this change" (`Use suggested description (Recommended)` pre-filled
  from the diff, or `Let me write my own`). Each option carries a plain description of what it does. Step 3
  states the **verified** compile-and-publish vs. raw-draft-upload difference; step 4 leads with the publish
  command; step 5, the `--root` fallback, and "What this skill must NOT do" align — publish recommended yet
  never silent/automatic, a draft-only push reported plainly as *not live*, and `/spec-execute` offers no
  publish mid-task.
- **`quick-task`** — its push reminder now notes Publish (make it live) is the recommended default and that
  a draft-only push neither compiles nor goes live (still delegating the actual flow to `/b6p-push`).

### Changed — scaffolded templates

- **`CLAUDE.md.template` rule 9** — flipped from "ALWAYS present the choice neutrally / NEVER recommend" to
  "**recommend publishing by default** (pre-select it); still NEVER publish or save-a-draft silently or
  automatically; the mode is always the user's explicit choice." Corrects the difference to compile +
  update-live + restore-point (publish) vs. raw draft upload (plain push), tells the agent to use plain
  language for non-technical users, and adds the `/spec-execute` carve-out so "default" is never read as
  "auto-publish on task completion."

### Docs (ship on merge to `main`)

- **New ADR `docs/decisions/snapshot-default-push-mode.md`** — records the neutral → publish-default
  reversal, the **bkplayground-verified** compile-and-publish vs. raw-draft-upload difference, the
  plain-language relabel, the retention of plain push as a deprioritized `Save draft only`, and the
  explicitly-rejected true-auto-snapshot alternative (including no per-task push in `/spec-execute`).

## [plugin 0.12.0] — 2026-07-22

Replaces the `/bspecs-feedback` transport. The skill no longer builds a **prefilled GitHub-issue deep link**
the submitter opens and submits in a browser — it now **POSTs the feedback (drafted from context, confirmed
in chat) to a public BlueHQ intake endpoint** (`https://bluehq.bluestep.net/b/bspecs-feedback`) that files a
**ClickUp task** on AI.List (`901414350506`) and a **routed GitHub issue** (`bspecs` / `b6p-cli` / `web`) via
a GitHub App, links the two, and returns both URLs. The submitter needs **no GitHub or ClickUp account** — the
login wall that used to silently lose feedback is gone. Issue **#25**'s structured failure metadata
(component / failure modes / severity / AI-confidence) folds in as **ClickUp custom fields** (the filterable
surface); **no new per-axis GitHub labels are minted** — the generated issue keeps a single `feedback` label
plus an axes body text-line, so label maintenance across the three repos stays near-zero. Verified working
end-to-end 2026-07-22. Existing installs receive this on `/plugin marketplace update` / `autoUpdate` only
because the version changed.

**Two release mechanics.** The `/bspecs-feedback` rewrite and the `bluestep-init` / `bluestep-reference` trims
ride **this plugin version bump**. The retired GitHub feedback plumbing —
`.github/workflows/feedback-to-clickup.yml`, `.github/workflows/feedback-triage.yml`, and
`.github/ISSUE_TEMPLATE/feedback.yml` — and the new ADR are repo changes that ship on **merge to `main`**,
independent of the plugin version.

### Changed — skills

- **`bspecs-feedback`** — transport rewritten from a prefilled GitHub-issue link to a `curl` POST to the
  BlueHQ intake endpoint: draft-from-context (incl. `routing`) → conditional AI-failure questionnaire (fires
  only for AI-output-failure feedback) → reporter identity auto-filled from `git config` (editable/skippable
  at the confirm gate) → POST → print the returned ClickUp task + GitHub issue links. No browser opens.
  `## What this skill must NOT do` rewritten — the GitHub-issue-link / no-backend / no-`kind:*`-label rules
  are gone; still: no credential shipped in the plugin, no editing installed plugin files, no filing without
  confirmation.
- **`bluestep-init`** — verbosity trim of the `b6pt_`-token / access-reality setup prose (same guidance,
  fewer words).

### Changed — `bluestep-reference`

- **`reference/b-include-element.md`** — duplication trim: the lazy-loading merge-report recipe is condensed
  and the full version (incl. the imported-primary-form-FormEntry requirement) now lives once in
  `reference/merge-report-async-loading.md`.

### Docs (ship on merge to `main`)

- **New ADR `docs/decisions/feedback-intake-bluehq-endpoint.md`** — records the transport change and
  **supersedes `bspecs-feedback-mechanism.md`** (Status flipped to *Superseded*). New setup checklist
  `docs/bluehq-feedback-endpoint-setup.md` (GitHub App, ClickUp fields, token form, endpoint deploy).

## [plugin 0.11.0] — 2026-07-21

Resolves the in-repo half of the feedback backlog — six new/edited `bluestep-reference` rules and four skill
doc fixes filed via `/bspecs-feedback` (issues #9, #23, #24, #26, #27, #28, #29, #30, #31, #32). All content is
category-level per the sanitization ADR. The cross-repo code fixes (b6p CLI static-bundle handling; platform
MCP server MEFR wiring / `get_script_declarations` / customer-org `/mcp` exposure) are tracked upstream in
[`b6p-cli#9`](https://github.com/Bluestep-Systems/b6p-cli/issues/9) and
[`web#1005`](https://github.com/Bluestep-Systems/web/issues/1005), not in this release. Existing installs
receive this on `/plugin marketplace update` / `autoUpdate` only because the version changed.

### Added — `bluestep-reference`

- **`reference/import-scope.md`** (new, #24) — form/field imports are scoped: current-record (only with a
  primary form attached) vs. specific named queries; a field must be imported on *every* query whose record
  type reaches the code — the runtime-read query **and** any query used as a declared parameter type — and the
  scope is verifiable against `declarations/`.
- **`gotchas/b-exports-proxy-map.md`** (new, #30) — `B.exports` is a Java-side proxy map (`ProxyJavaMap`), not
  a plain JS object; the `.push()` accumulate pattern type-checks locally but throws at runtime; store
  structures as JSON strings (primitives round-trip).
- **`reference/version-stream-previous-value.md`** (new, #26) — read the previous committed version with
  `entry.versionStream().findFirst().orElse(null)` and diff current-vs-previous field values, with the
  first-create null guard and the pre-save vs post-save timing caveat.

### Changed — `bluestep-reference`

- **`reference/merge-report-urls.md`** (#9) — added `contentOnlyUrl()` (+ `profileNewEntryUrl()`,
  `profileCopyUrl()`, `mergeTagResult()`) to the `MergeReport<T>` method list and property-mapping table
  (property in RelateScript, method in BSJS; only on the full report, not metadata), plus the `optApplicable*`
  **primary-form hard rule**. `reference/merge-report-async-loading.md` + `reference/b-include-element.md` gained
  the `contentOnlyUrl()` → `<b-include run-scripts="true">` client-side async-embed recipe.
- **`conventions/single-script.md`** (#27, doc half) — neither `b6p push` nor the platform push transpiles
  `static/script.ts` → `static/script.js`; editing only the `.ts` silently ships stale client JS.
- **`conventions/mcp-platform-authoring.md`** (#32, #29 doc halves) — `add_forms` cannot wire a MEFR
  all-entries report (route MEFR imports to the UI); a `/mcp` 404 means the org doesn't expose the platform MCP
  (request enablement, don't retry); `get_script_declarations` may be absent → `b6p pull` fallback.

### Changed — skills

- **`spec-create`, `quick-task`** (#24) — every `[PLATFORM]` import item must state its scope (current-record
  only with a primary form, or the exact named queries); the paired `[CODE]` item names which query/record it
  reads through. Both point at `import-scope.md`. (Plugin skills only — the `.claude/skills/*` copies are
  bspecs-repo-development variants, not BlueStep mirrors.)
- **`b6p-push`** (#31, #28, #27) — documented the `--root` fallback for components never pulled via the CLI
  (root is the component folder, not `draft/`); the empty-`outDir` gotcha (set to `.`); and a warning that a
  push after editing only `static/script.ts` ships stale client JS.
- **`task-comment`** (#23) — the "what changed" body may be a short bullet list, not only sentences.
- **`bluestep-init`** (#29, doc half) — the `b6pt_` token + platform MCP currently require BlueStep-internal
  super-user access; an org-admin with no Super tab should request a token / MCP enablement from BlueStep
  rather than being sent to an unreachable screen. (Note: #29 originally targeted the `bluestep-mcp-connect`
  skill, retired in 0.10.0; the token setup now lives here.)

## [plugin 0.10.0] — 2026-07-20

Replaces the per-org platform-MCP connection with a **single bundled gateway MCP**. The platform now fronts
every org at one global endpoint (`https://gateway.bluestep.net/mcp`), a **relay facade** exposing three
meta-tools — `available_tenants`, `list_org_tools(org)`, `invoke_org_tool(org, tool, arguments)` — where
`org` is a **U-number** orgKey. Because the URL is constant it ships **bundled in the plugin's `.mcp.json`**
and auto-registers when the plugin is enabled and `$B6PT_TOKEN` is set — so the per-org `/bluestep-mcp-connect`
skill and its per-org `bluestep-<subdomain>` entries are gone. Verified live 2026-07-20 (handshake `200`,
`serverInfo bluestep-mcp-gateway v1.2.2`; real relay reads against four orgs, incl. two absent from
`available_tenants` yet fully reachable). **Coexistence unchanged:** component sync (`/b6p-*`) stays on the
b6p CLI permanently, and the two-credential design holds. Existing installs receive this on
`/plugin marketplace update` / `autoUpdate` only because the version changed.

### Added

- **Bundled gateway MCP** (`plugin/.mcp.json`, new) — declares the `bluestep-gateway` HTTP server (constant
  global URL, `Authorization: Bearer ${B6PT_TOKEN}` runtime-expanded, never a literal). Auto-registers when
  the `bluestep-tools` plugin is enabled; in-session tools are
  `mcp__plugin_bluestep-tools_bluestep-gateway__{available_tenants,list_org_tools,invoke_org_tool}`.
- **Token-setup guidance in `/bluestep-init`** — step 7 now carries the `b6pt_` token creation, `$B6PT_TOKEN`
  env setup, and the full security/token-handling section (salvaged from the retired connect skill), plus a
  desktop-app single-connector note.

### Changed

- **Shared `[PLATFORM]`-authoring procedure** (`bluestep-reference/conventions/mcp-platform-authoring.md`)
  rewritten around the facade: connection-check keys off the gateway tools; org resolves to a **U-number**
  (user-supplied → `available_tenants` map → unlisted ≠ unreachable, ask/derive); discovery/mutation/read-back
  route through `invoke_org_tool`, with `list_org_tools(org)` for inner schemas; the approval echo prints the
  concrete inner call. `bluestep-reference/SKILL.md` manifest line updated to match.
- **Entry points re-pointed** to the bundled gateway — `/spec-execute` (`[PLATFORM]` branch), `/quick-task`,
  the `spec-create` `tasks.template.md` `[PLATFORM]` definition, and the scaffolded `CLAUDE.md.template`
  rules 8 & 10.
- **Docs** — repo `README.md`, `CLAUDE.md`, `plugin/README.md`, and `docs/mcp-platform-authoring-test-plan.md`
  describe the bundled gateway instead of `/bluestep-mcp-connect`; `docs/decisions/platform-mcp-integration.md`
  gains a dated **2026-07-20 gateway addendum** (historical body preserved).

### Removed

- **`/bluestep-mcp-connect` skill** — deleted `plugin/skills/bluestep-mcp-connect/`; its token-setup and
  security content is preserved in `/bluestep-init` (see Added). One bundled gateway replaces the per-org
  connect flow.

## [plugin 0.9.0] — 2026-07-09

Removes the `prettier-on-save` hook. `prettier` is a Node CLI and these projects are no longer
Node-dependent, so an auto-format-on-save hook could only ever fire for the subset of users who
happen to have Node + a global `prettier` installed and silently no-op for everyone else — it can
never "work for any user." Formatting moves to where it belongs: the scaffolded `.prettierrc` still
ships (pure config, zero runtime) and each developer's editor formats on save through its own
prettier integration. The two guardrail hooks (`block-generated-files`, `block-tsc`) are unaffected.
Existing installs receive this on `/plugin marketplace update` / `autoUpdate` only because the
version changed.

### Removed

- **`prettier-on-save` hook** — deleted `plugin/hooks/prettier-on-save.sh` and its `PostToolUse`
  wiring in `plugin/hooks/hooks.json`; the plugin now ships two hooks, not three.
- **`prettier` prerequisite** — dropped the `prettier` bullet from the repo `README.md` Prerequisites
  section; it is no longer required to run the tooling.

### Changed

- Docs updated to reflect two hooks: `CLAUDE.md` (architecture + Hooks + testing sections),
  `plugin/README.md`, and a note in `docs/decisions/npm-free-scaffolding-via-vscode-extension.md`
  (the prettier hook was the last item on that ADR's "remaining npm surface" list).

## [plugin 0.8.2] — 2026-07-09

Reframes the `/bluestep-init` description-only, no behavior change ([#18](https://github.com/Bluestep-Systems/bspecs/issues/18)):
the always-in-context line now says the skill works on a project **new or existing** and that a key
purpose is **activating the always-on platform rules** (the project `CLAUDE.md`), not only scaffolding
greenfield projects. The skill is not renamed and no `/bluestep-activate` split was introduced. Existing
installs receive it on `/plugin marketplace update` / `autoUpdate` only because the version changed.

### Changed

- **`/bluestep-init` description** (`plugin/skills/bluestep-init/SKILL.md` frontmatter) — reworded to lead
  with "new or existing" and "activate the always-on platform rules," reassuring a mature-repo user who
  might read "init" as "this will reinitialize my project."
- **`/bluestep-init` body intro** — added a one-line note that the project `CLAUDE.md` written by this
  skill is what makes the Tier-1 platform rules always-on, since a plugin alone can't ship always-on context.

## [plugin 0.8.1] — 2026-07-08

Removes a small UX friction in the spec flow: the "run the next task" suggestion is now presented as a
copyable command instead of buried in a sentence. Existing installs receive it on
`/plugin marketplace update` / `autoUpdate` only because the version changed.

### Changed

- **`/spec-create` "After approval"** (`plugin/skills/spec-create/SKILL.md`) and **`/spec-execute` step 8**
  (`plugin/skills/spec-execute/SKILL.md`) now instruct the agent to present the next `/spec-execute`
  command on its own line as a **fenced code block** (with the real feature name and task number filled
  in), so the terminal UI renders a copy button — rather than embedding it in inline backticks inside a
  sentence, which shows no copy button. Repo-local mirror skills (`.claude/skills/spec-*`) updated to match.

## [plugin 0.8.0] — 2026-07-08

Makes `[PLATFORM]` authoring/wiring **agent-executable in-session** over the per-org platform MCP,
approval-gated, instead of always handing back to a human UI round-trip. The flow is defined once as a
`bluestep-reference` procedure and driven from **three entry points** — `/spec-execute` (`[PLATFORM]`
tasks), `/quick-task`, and the scaffolded project `CLAUDE.md`'s always-on conversational rule. After a
wiring op it reads declarations back via `get_script_declarations` so the dependent `[CODE]` task can
code against the new import. **Coexistence unchanged:** component sync (pull/push/audit) stays on the b6p
CLI permanently. Live prove-out against **bkplayground** (in-app tool registration + create/assert/teardown)
passed on 2026-07-08. **Known limitation:** MCP-authored *schema* objects (e.g. option lists) currently
have **no MCP teardown** — removal is a manual platform-UI step (see the procedure page's destructive-tool
discipline). Existing installs receive it on `/plugin marketplace update` / `autoUpdate` only
because the version changed.

### Added

- **Shared MCP `[PLATFORM]`-authoring procedure** (`plugin/skills/bluestep-reference/conventions/mcp-platform-authoring.md`,
  new) — the single source of truth for the flow: connection-check → offer-to-connect-else-hand-back →
  resolve org → map op to tool (with the optional `op:` hint) → approval echo (tool + target + args) →
  execute → `get_script_declarations` read-back → idempotency (detect-and-skip) → destructive-tool
  discipline. Covers the tool set `add_queries` / `add_forms` / `add_field_access` +
  `form` / `field` / `option_list` / `view` / `record_type`. A one-line trigger entry was added to the
  reference manifest (`plugin/skills/bluestep-reference/SKILL.md`).
- **Authoring-tool test plan** (`docs/mcp-platform-authoring-test-plan.md`, new) — a committed,
  human-runnable checklist + re-runnable MCP call sequence: run each authoring/wiring tool against
  bkplayground, assert the effect (`get_script_declarations` / `list_*` reflects it), then tear down,
  reporting residue on failure, with a per-tool "description self-sufficient?" note feeding the
  MCP tool-inventory audit.

### Changed

- **`/spec-execute` `[PLATFORM]` branch** (`plugin/skills/spec-execute/SKILL.md`, step 3) — no longer an
  unconditional hand-back: when a live org MCP connection is present it follows the shared procedure
  (approval → execute → read-back → mark `[x]`); when not, it follows the procedure's
  offer-to-connect-else-hand-back path. The prereq scan (step 4) is unchanged.
- **`/quick-task`** (`plugin/skills/quick-task/SKILL.md`) — a small conversational change that needs a
  platform authoring/wiring op now follows the same shared procedure (connected) or offers to
  connect / hands back (not connected).
- **Scaffolded `CLAUDE.md` always-on rule** (`plugin/skills/bluestep-init/templates/CLAUDE.md.template`) —
  the pull/push "round-trip" wording was adjusted and a new rule added so platform authoring/wiring may be
  performed in-session via the MCP procedure (approval-gated) when connected, else handed back — enabling
  the no-skill conversational path.
- **Tasks template** (`plugin/skills/spec-create/spec-templates/tasks.template.md`) — documents that
  `[PLATFORM]` tasks are agent-executable when connected, adds the optional `op:` hint (tool + key args),
  and softens "done in the BlueStep UI" to "UI or MCP."
- **`/bluestep-mcp-connect` cross-reference** (`plugin/skills/bluestep-mcp-connect/SKILL.md`) — a one-line
  note that the skill may be reached as the procedure's "not connected → offer to connect" step, with the
  fresh-session caveat. No functional change to the skill's own steps.

## [plugin 0.7.0] — 2026-07-08

Adds platform-MCP integration. BlueStep now exposes a **per-org MCP server**
(`https://<org>.bluestep.net/mcp`) that can perform `[PLATFORM]` operations directly. This release ships
the **connection** tooling; migrating the actual `/b6p-*` and `[PLATFORM]` operations onto MCP tools is a
phased follow-up. Existing installs receive it on `/plugin marketplace update` / `autoUpdate` only
because the version changed.

### Added

- **`/bluestep-mcp-connect` skill** (`plugin/skills/bluestep-mcp-connect/SKILL.md`) — connects to a
  BlueStep org's platform MCP. Registers a `bluestep-<subdomain>` entry per org, authed by a **single
  global `b6pt_` token** the user creates once in the UI (*Tools → Organization Admin → Super → Global
  Users → Access Tokens → Create New Token*) and stores in the `B6PT_TOKEN` env var. **Default scope is
  user/global** (`claude mcp add … --scope user`) so one setup persists across every workspace; the token
  is injected from `$B6PT_TOKEN` (never a literal) into the user-private, uncommitted `~/.claude.json`.
  A **per-workspace `.mcp.json`** with `${B6PT_TOKEN}` (runtime-expanded — works only in `.mcp.json`) is
  the opt-in for containment, secret-only-in-env, or team-shared config. The **`claude` CLI is not a hard
  dependency**: the global path is used only when `claude` is on PATH, and the skill **falls back to
  `.mcp.json`** (no external tool) otherwise — never auto-installing. When the CLI is absent it *offers*
  (does not run) the **npm-free** native Claude Code installer and otherwise proceeds per-workspace;
  desktop-app users are pointed at claude.ai custom-connector settings. The skill preflights the token, refuses to guess
  the org URL, merges `.mcp.json` non-destructively, verifies with a curl `initialize` handshake (200),
  and tells the user a **fresh session** is required for the tools to register. Mirrors the discipline of
  `/b6p-pull`.
- **ADR `docs/decisions/platform-mcp-integration.md`** — records the auth model (two coexisting credential
  systems: MCP `b6pt_` token vs. b6p CLI `~/.b6p/` WebDAV creds), the per-org / multi-per-workspace
  connection model, the ~80-tool surface the probe found, the manual→MCP operation mapping
  (`read_script_draft`/`write_script_draft`/`get_script_declarations` ≈ pull/push; `add_queries`/`add_forms`/
  `add_field_access` ≈ the currently-manual `[PLATFORM]` imports), the MCP-primary/CLI-fallback coexistence
  policy, and the phased migration sequence.

### Changed

- **`/bluestep-init` offers an optional MCP connection step** (`plugin/skills/bluestep-init/SKILL.md`, new
  step 7) — an `AskUserQuestion` after `git init` that defers to `/bluestep-mcp-connect`; skippable, since a
  project is often created before the org/token exists. Step 9 now also documents the `B6PT_TOKEN` MCP
  credential as distinct from the b6p CLI's `b6p auth set`.
- **Skill inventories updated** to list `/bluestep-mcp-connect` — `README.md`, `plugin/README.md`, and the
  `CLAUDE.md` plugin skills inventory + a new Key-behaviors entry.

## [plugin 0.6.0] — 2026-07-03

Adds a snapshot path to `/b6p-push`. The b6p CLI has always supported `push --snapshot --message`
(a restorable server-side version entry), but the skill only ever ran a plain push, so the
scaffolded flow recorded **no** platform history. `/b6p-push` now offers the choice on every push.
Existing installs receive it on `/plugin marketplace update` / `autoUpdate` only because the version
changed.

### Changed

- **`/b6p-push` always offers plain-vs-snapshot** (`plugin/skills/b6p-push/SKILL.md`, step 3). The
  skill now presents a neutral two-option choice (no default) via the AskUserQuestion tool on every
  push; the selection doubles as the push confirmation. On **Snapshot** it drafts a concise
  commit-style message from the diff for the user to accept or edit, then runs
  `b6p --yes push --file "…" --snapshot --message "<summary>"`; **Plain push** runs the existing
  command unchanged. Step 5 reports whether a versioned history entry was recorded. The skill
  explicitly never snapshots silently or automatically — the snapshot is always the user's explicit
  choice for that push (it does not auto-snapshot on task completion); the separate **auto-snapshot**
  convention remains deferred in `TODO.md`.
- **Plain-vs-snapshot promoted to a project-level rule** (`plugin/skills/bluestep-init/templates/CLAUDE.md.template`).
  The choice previously lived only in the `/b6p-push` skill, so it bound only when the skill was the
  entry point — a bare `b6p push` run by hand would plain-push silently. The scaffolded project
  `CLAUDE.md` now carries it as Critical rule 9 (always present the choice, never snapshot or
  plain-push silently, never auto-snapshot) and reinforces it in the "Sync workflow (b6p CLI)"
  section, so the rule holds regardless of how the push is triggered.

## [plugin 0.5.0] — 2026-07-03

Renames and broadens the `/bug-fix` skill into `/quick-task` — a short workflow for **small
changes and bug fixes** (not just bugs) that don't warrant a full 3-phase spec, now with light
structure: it keeps **one living markdown doc** at `.claude/quick-tasks/<slug>.md` that stays open
for review and gets ticked off during implementation, the middle ground between an ad-hoc edit and a
full spec. Existing installs receive it on `/plugin marketplace update` / `autoUpdate` only because
the version changed.

### Changed

- **`/bug-fix` → `/quick-task`** (`plugin/skills/quick-task/SKILL.md`, renamed via `git mv` from
  `plugin/skills/bug-fix/`). The skill now covers small clearly-scoped changes as well as bugs, and
  its `description` reflects the broader scope. Step 3 drafts a single quick-task doc from a bundled
  template; step 5 keeps that doc current (ticking items, noting divergences) so it's reviewable
  during implementation. Retains the scoped-read discipline and the platform-push / README-sync
  reminders from the old bug-fix flow.
- **Folded in the `[PLATFORM]` / `[CODE]` task distinction** (previously a standalone TODO): the
  quick-task doc's approach checklist tags each item, so a change that needs both a platform edit and
  a code edit has an explicit, reviewable handoff.
- **`bluestep-init` root templates** now reference `/quick-task` instead of `/bug-fix`
  (`CLAUDE.md.template` routing rule + skill table, `README.md.template` skills list).
- **Repo docs** updated to match: `README.md`, `plugin/README.md`, `CLAUDE.md` skill inventories,
  and `docs/bspecs-builder/requirements.md`.

### Added

- **`plugin/skills/quick-task/quick-task.template.md`** — the single-doc template (Summary, Root
  cause, Approach checklist with `[PLATFORM]`/`[CODE]` tags, Notes), bundled with the skill and
  copied to `.claude/quick-tasks/<slug>.md` at draft time.

## [plugin 0.4.0] — 2026-07-03

Documents and tools the **off-platform Vite/Preact SPA merge-report build model** — building a full SPA
off-platform (Node 20 + npm), producing a minified `dist/`, and deploying it into the report's `static/`
folder via deploy-lib, bypassing the platform's `static/script.ts` compiler entirely. Existing installs
receive it on `/plugin marketplace update` / `autoUpdate` only because the version changed.

### Added

- **Three `bluestep-reference` files for the off-platform Vite/Preact SPA merge report**, each with a
  `SKILL.md` manifest entry:
  - `reference/vite-spa-merge-report.md` — the pattern: architecture (SPA in `static/`, report serves
    `index.html`, `app.ts` is a no-op or a `B.out` window-bootstrap), when to use it vs. the
    platform-compiled `static/script.ts` path, the two data models (endpoint fetch carrying the session vs.
    server bootstrap needing `objects/imports.ts`), history in GitHub, Preact-default/React-alternative.
  - `conventions/deploy-lib-workflow.md` — install deploy-lib from git, the `package.json` `config` block
    (the camelCase `deployUrl` trap vs. lowercase `deploypathsuffix`/`builddir`), `npm run deploy -- --build
    --clean` (draft+snapshot upload), auth resolution, Node 20+. Owns the deploy-lib issue #30 link.
  - `gotchas/vite-merge-report-gotchas.md` — `base: './'` (the headline trap), `<head>` stripping,
    mount-id match, Node 20+ (`crypto is not defined` on 18), config-key casing, `Swal`/site-CSS absent in
    local dev, and "don't 'fix' the `build` script."
- **`/bluestep-vite-report` scaffold skill** (`plugin/skills/bluestep-vite-report/SKILL.md`) — a guided
  scaffold modeled on `/bluestep-init`: Node-20 precheck (STOP, don't install) → `create-vite`
  (`preact-ts`) → `base: './'` + deploy-lib `config`/`repository`/`deploy` wiring → printed (not run)
  `[PLATFORM]` report-creation, GitHub-repo, and deploy steps. Links the three reference files.
- **ADR `docs/decisions/off-platform-bundler-build-model.md`** — records keeping both merge-report build
  models and the load-bearing constraints (`base: './'`, Node 20+, deploy-lib config-key casing,
  GitHub-hosted history).

### Changed

- **Cross-linked the six platform-compiled `static/` docs** to the new off-platform pattern with an
  additive one-line disambiguator each (no rule reworded): `reference/merge-report-static-index.md`,
  `conventions/single-script.md` (now scopes its "only root `static/script.ts` compiles" rule to the
  platform-compiled path — it does not apply to a Vite bundle), `conventions/separate-files.md`,
  `reference/file-execution.md`, `reference/crm-dashboard-inspo.md`, `reference/dpn-dashboard-framework.md`.
- **`CLAUDE.md`** plugin skills inventory now lists `/bluestep-vite-report`.

## [plugin 0.3.0] — 2026-07-01

### Changed

- **`plugin/README.md`**: refreshed the contents list (added `/bluestep-init`) and removed the stale
  "manifest skeleton / spec tasks 5–8" note left over from the migration; points at the repo README
  for usage and the release process.

> Also serves as the first end-to-end auto-update test after the marketplace was re-registered via
> claude.ai — verifying a fresh version bump propagates to installed clients without manual steps.

## [plugin 0.2.0] — 2026-07-01

Plugin manifest `version` → `0.2.0` (`plugin/.claude-plugin/plugin.json`). This is the release that ships the changes merged since the initial `0.1.0` plugin install — existing installs receive them on `/plugin marketplace update` / `autoUpdate` only because the version changed.

### Changed

- **`/bluestep-init`**: prompts are now clickable (`AskUserQuestion`) instead of a free-text questionnaire; can bootstrap into a **new subfolder** as well as the current directory; removed the project-description prompt and the `{{PROJECT_DESCRIPTION}}` template field.
- **`/bspecs-feedback`**: de-staled for the plugin model — quotes tooling files from `${CLAUDE_PLUGIN_ROOT}` (not the retired scaffolded `.claude/` copy), reads the version from the plugin manifest (not `.claude/bspecs.lock`), and is reframed around the read-only plugin install updated via `/plugin marketplace update`.

### Added

- **ADR `docs/decisions/plugin-context-delivery-model.md`** — confirms a plugin cannot ship always-on context (so `CLAUDE.md` is written by `/bluestep-init`) and that the on-demand `bluestep-reference` is reachable by subagents; records the residual gaps found while auditing the migration.

## [Unreleased] — plugin distribution

> **Version-scheme note (needs a human call):** the npm package `@bluestep-systems/bspecs` is **no
> longer published** — the tooling now ships as a Claude Code plugin (`plugin/.claude-plugin/plugin.json`
> carries its own `version`, currently `0.1.0`). Whether to keep bumping the root `package.json`
> version, retire it, or align it with the plugin manifest version is a maintainer decision. This entry
> is filed under `[Unreleased]` and uses no semver heading until that is settled.

### Changed

- **Tooling migrated to a Claude Code plugin distributed via a public marketplace — the single
  delivery path.** All shared `.claude/**` tooling (skills, subagents, hooks, the on-demand
  instruction tree, and spec-templates) now lives in `plugin/`, distributed via the in-repo public
  `bluestep` marketplace (`.claude-plugin/marketplace.json` at the repo root, `source: ./plugin`).
  There is no per-project copy and no `bspecs sync`/`bspecs.lock`/`SessionStart` sync — updates are
  native (`/plugin marketplace update` / `autoUpdate`). The instruction tree is re-homed as the
  `bluestep-reference` skill (`index.md` → `SKILL.md`, atomic files as bundled resources), preserving
  the on-demand-read pattern. The `/b6p-*` skills now call a bare `b6p` (the standalone b6p-cli
  artifact on PATH) instead of `npx b6p`.

### Added

- **`/bluestep-init` plugin skill — the single project-bootstrap path.** Run inside Claude Code with
  the plugin enabled, it writes the per-project files in-session (`CLAUDE.md`, `README.md`, a
  `package.json` with **no** `b6p-cli` devDependency, `.gitignore`, `.prettierrc`, and a
  plugin-enabling `.claude/settings.json`) from bundled root templates and guides `git init`. Replaces
  the dormant CLI's scaffold step and works for everyone, including no-npm staff.
- **ADR `docs/decisions/plugin-distribution.md`** — plugin as the single delivery path; the
  templating-model change (substitution now lives only in `/bluestep-init`'s bundled root templates);
  the npm CLI dropped-but-kept-dormant rationale; the public marketplace + managed-settings enforcement
  model; and the supersession of both the SEA binary and the two-paths plan.
- **ADR `docs/decisions/content-sanitization-for-public-tooling.md`** (category-level) — why
  customer-derived working-memory does not belong in publicly distributed tooling, and the
  audit-before-publish gate that now governs it.

### Removed

- **Standalone SEA binary dropped.** The Part A binary build is fully reverted: `sea-config.json`,
  `scripts/build-binary.mjs`, `src/templates-embed.js`, `INSTALL.md`, the binary CI/build jobs, and
  the SEA version-injection are gone. `src/version.js` reads `package.json` from disk again.
- **npm publish dropped.** `.github/workflows/publish.yml` no longer publishes to npm; on a version
  tag it now only cuts a GitHub Release. The npm CLI (`cli.js`/`src/*`) is **dropped as a supported
  path but kept dormant** in the repo — it still loads (`node cli.js -v`/`-h`) but scaffolds nothing
  (`templates/` is now empty).

### Security

- **Content sanitization (gating).** A pre-publication sensitivity audit found the instruction tree
  carried customer-derived working-memory. The pure-IP files were relocated to a private store and the
  provenance/business framing was redacted in place, keeping the generic platform technique in each.
  Every committed artifact describes the removed content by **category only** (no literal customer
  names, org subdomains, file IDs, employee names, domain terms, or business figures). See the
  content-sanitization ADR.

## [0.15.0] — 2026-06-26

### Added

- **`/bspecs-feedback` skill — route tooling-change requests to the canonical bspecs repo.**
  A scaffolded project's `.claude/` tree is a copy that `bspecs sync` overwrites, so when an end
  user notices a bspecs rule / skill / hook / instruction that should change, a local edit never
  reaches the repo and doesn't survive the next sync. The new
  `templates/claude/skills/bspecs-feedback/SKILL.md` infers the submission from the conversation
  (kind(s), target(s), affected file + current rule text, proposed change/rationale, bspecs version
  from `.claude/bspecs.lock`), confirms with the user, builds a prefilled GitHub issue deep link
  against the public repo (`issues/new?template=feedback.yml&labels=feedback&…`, URL-encoded via
  node's `URLSearchParams`), and opens it (`wslview`/`xdg-open`/`open`) — always printing the URL as
  the fallback. **No token and no backend**: GitHub authenticates the user through their existing
  browser session. Picked up automatically by `bspecs sync` (dynamic `SYNC_TARGETS`, no hardcoded
  list). Kind and target are both multi-valued; because a single `feedback` label is used (no
  `kind:*` labels) and GitHub multi-select prefill is unreliable, kind(s)/target(s) are embedded as
  text in the issue title + body as the safety net.
- **Structured issue form `.github/ISSUE_TEMPLATE/feedback.yml`** (plus a `config.yml` that keeps
  the blank-issue route) so prefilled submissions land in a consistent shape — kind, target, file
  path, current text, proposal, version. Backed by a repo-side `feedback` label. The `current_text`
  and `proposal` textareas carry no `render:` attribute, which is required for query-param prefill.
- **ADR `docs/decisions/bspecs-feedback-mechanism.md`** memorializing the prefilled-link /
  no-backend / no-token decision and the rejected alternatives (baked-in token, server-side
  webhook, local `.jsonl` fallback, `gh`-CLI primary path).
- **ADR `docs/decisions/path-scoped-rules-evaluation.md`** — evaluated Claude Code's path-scoped
  rules (`.claude/rules/*.md` with `paths:` frontmatter) as a replacement for the on-demand
  `instructions/` + `index.md` tree and **rejected it for now**. The ~50 atomic files are keyed by
  task *intent*, not by file path (B6P sources are undifferentiated `*.ts`/`*.js`), and path-scoped
  rules don't fire on the Write/Edit-dominated B6P workflow; reliability and subagent-inheritance
  gaps compound it (sync and the Claude-only invariant were *not* blockers). Records a gated revisit
  trigger and a thin "augment" sketch. Doc-only — no code or scaffold change.

### Changed

- **Scaffolded `CLAUDE.md` Self-improvement section now routes by _what_ the discovery is.**
  Project-local B6P domain knowledge is still captured locally; a bspecs **tooling** problem — or a
  B6P rule general enough to belong in every scaffolded project — is now handed off to
  `/bspecs-feedback`, since local `.claude/` edits don't survive `bspecs sync`. This makes the skill
  discoverable at the moment a user notices something wrong.
- **Tightened the scaffolded `CLAUDE.md.template` (167 → 131 lines).** The file loads into every
  session of every scaffolded project, so its length is paid continuously. Cut ~36 lines of
  redundancy with no signal loss: collapsed the README-vs-spec lifecycle (previously stated four
  times) into one "Module context" section; replaced the `B`-object table with a pointer to
  `bsjs-development.md` (keeping the `B.time`-not-`Date` and `B.user`-null-in-cron gotchas inline);
  demoted the "Sync workflow" section to a short pointer (the `/b6p-*` skills own the `npx b6p`
  commands, with the one-time `auth set` note preserved); and trimmed the Deep-reference footer that
  restated the critical rules. The on-demand `index.md` design (no `@`-imports) and the Critical
  rules block are unchanged. Also fixed the `spec-create` skill's cross-reference to the renamed
  "Module context" heading.

## [0.14.1] — 2026-06-26

### Fixed

- **Corrected the MergeReport `static/`-bundle guidance that wrongly claimed `B.out` is
  suppressed.** `reference/merge-report-static-index.md` previously stated that when a merge
  report ships a `static/` bundle the served page becomes `static/index.html` and `scripts/app.ts`'s
  `B.out` is **not** injected. That is wrong and contradicted the canonical model in
  `reference/file-execution.md`: `B.out` (server content) **and** `static/index.html` (client markup)
  both render, and `static/styles.css` + `static/.build/script.js` load automatically. The bad rule
  led an agent to `B.net.fetch("static/styles.css")` and inline its own stylesheet into a `<style>`
  block — pointless work it then had to delete. Rewrote the file around the real behavior (reserve
  `B.out` for **final server-rendered markup** like record-scoped URLs; keep the mount/config/CSS in
  `static/`; never fetch/inline your own stylesheet). Per platform-team clarification, `B.out` and
  `static/index.html` are **completely disjoint**: `B.out` is injected as a tag that runs *after*
  index.html, so a mount or `<script type="application/json">` config island emitted from `B.out`
  can't be reached by the index.html client script (and `DOMContentLoaded` won't fix it). The
  null-mount symptom is reframed accordingly — put the mount + config island in
  `index.html` and fetch dynamic data from the endpoint, not a `B.out` island. Cross-linked
  `merge-report-urls.md` for the record-scoped-URL computation that legitimately belongs in `B.out`.
- **Dropped the misleading "we inline styles.css via `B.net.fetch`" aside in
  `reference/csv-parsing.md`,** which implied fetching/inlining your own stylesheet is a normal
  pattern. The fetch-by-URL CSV route now stands on its own.
- **Made `conventions/separate-files.md` explicit about the `static/`-bundle case** — `styles.css`
  loads automatically, so CSS stays in `styles.css` and is never read or fetched to inline — closing
  the gap an agent used to resolve by inlining CSS into `app.ts`. Updated the matching `index.md`
  one-liner.

## [0.14.0] — 2026-06-26

### Added

- **Documented async merge-report loading and the `<b-include>` element in the scaffolded
  instruction tree.** Two new atomic `reference/` files capture platform knowledge that was
  previously absent: `merge-report-async-loading.md` (the "Asynchronous Loading" option on a
  Data Merge Report lazy-loads it *after* the page resolves — covering the BSJS-`async`-metadata-
  vs-checkbox history, parent→child fan-out, the script-timing gotcha, and the obsolete
  `formFooter` hack) and `b-include-element.md` (the `<b-include>` browser custom element for
  inline async HTML fragments — `src`/`run-scripts`/`csrf` attrs, behavior, security/Zesty
  whitelist). Both cross-link each other and the existing merge-report files, with matching
  one-line `index.md` entries. Picked up automatically by `bspecs sync` (no hardcoded list).

## [0.13.0] — 2026-06-25

### Removed

- **Dropped four `~/.bluestep`-tooling convention files from the scaffolded instruction tree.**
  `conventions/always-snapshot.md`, `snapshot-integrity.md`, `push-inner-draft.md`, and
  `tsc-rootdir.md` documented a machine-local `node ~/.bluestep/push.js` / `pull.js` snapshot
  workflow that does not exist in a consumer's environment and contradicted the actual scaffolded
  flow on three axes: tooling (`~/.bluestep/*.js` vs `npx b6p`), local `tsc` (mandated by the files
  but forbidden by the `block-tsc` hook and `CLAUDE.md`), and a snapshot step the b6p flow does not
  have. All references were cleared in the same change: the four `index.md.template` links, the
  `bsjs-development.md` `tsc-rootdir` pointer, the `merge-report-memo-json.md` "Related" links, and
  the stale `~/.bluestep/docs/*` doc path in `csv-parsing.md`. No platform truth was lost — the
  server-side compile-on-push and URL-root file-serving facts are already in `CLAUDE.md` /
  `bsjs-development.md`, and pull/push/audit are owned by the `/b6p-*` skills.

## [0.12.0] — 2026-06-25

Adds an in-place install path and makes the CLI verbs explicit. You can now drop the full
Claude Code tooling into a project you already have, without scaffolding a new directory.

### Added

- **`bspecs init` — install the tooling into the current directory.** Copies the whole template
  tree (root files + `.claude/**` + module templates) into the cwd **non-destructively**: any
  file that already exists is left byte-for-byte untouched. The one exception is `package.json`
  — the `@bluestep-systems/b6p-cli` devDependency and the `b6p` script are merged into an
  existing manifest (existing values never changed; malformed JSON is left alone with a
  warning). Writes `.claude/bspecs.lock` so `bspecs sync` works afterward, then prints a report
  of every file it skipped, with guidance to rename/move local copies and re-run for the
  pristine versions. The client-name prompt is optional (defaults to `BlueStep Client`); no
  `git init` is run. (`cli.js`, `src/prompts.js`, `src/scaffold.js`, `src/utils.js`)

### Changed

- **Scaffolding a new project is now `bspecs new`** (previously bare `bspecs`). The result is
  identical — only the verb is explicit, matching the new three-verb surface (`new` / `init` /
  `sync`).
- **Bare `bspecs` (no recognized verb) now prints help** instead of immediately starting the
  scaffolder. **Breaking:** any script or habit relying on bare `bspecs` to scaffold must switch
  to `bspecs new`.

## [0.11.1] — 2026-06-24

### Fixed

- **The one-time auth command 404'd when run as documented.** README and the post-scaffold reminder
  told users to run `npx b6p auth set` for the once-per-machine credential step, but `b6p` is a
  *project-local* devDependency — bare `npx b6p` only resolves inside a scaffolded project that has
  run `npm install`. Run from anywhere else (e.g. `~`, right after `npm install -g`), npx tried to
  download a nonexistent package named `b6p` and failed with `404 b6p not found`. The standalone auth
  step is now documented as `npx -p @bluestep-systems/b6p-cli b6p auth set`, which fetches the real
  scoped package on the fly and works from any directory. Inside a scaffolded project, plain
  `npx b6p …` still works as before. Fixes the install flow shipped in 0.11.0
  (`README.md`, `src/scaffold.js`).

## [0.11.0] — 2026-06-24

Fixes the first-run auth foot-gun: on a machine that never ran `npx b6p auth set`, the first
`/b6p-pull` (or push/audit) hit an interactive credentials prompt Claude can't answer and hung
silently — `--yes` guards only the *confirmation* prompt, not the *missing-credentials* one. Auth is
now surfaced at every point the agent looks: a run-time preflight in the skills, a scaffold-time
reminder, and the scaffolded `CLAUDE.md`. Resolves Concern C of
`docs/decisions/b6p-cli-onboarding-in-scaffolds.md`.

### Added

- **Auth preflight in the `/b6p-pull`, `/b6p-push`, and `/b6p-audit` skills.** Before any `b6p` call,
  each skill runs `test -f ~/.b6p/secrets.enc`; if the encrypted credential store is absent it STOPs
  with a "run `npx b6p auth set` first" message instead of hanging. File-existence is the check
  because the b6p CLI exposes no non-interactive `auth status` command. Each skill's `allowed-tools`
  gains `Bash(test -f *)`.
- **Post-scaffold `auth set` reminder (`scaffold.js`).** After generating files, the scaffolder prints
  the one-time `npx b6p auth set` next step (credentials are global in `~/.b6p`, once per machine).

### Changed

- **Scaffolded `CLAUDE.md`** now states the one-time `npx b6p auth set` prerequisite in the
  Sync-workflow section, where the agent reads it before acting — not just in the README prose.
- **README** install flow promotes the platform-credential step to its own
  `### Set your platform credentials` section.

### Note for existing projects

`bspecs sync` propagates the updated skills and `CLAUDE.md` to projects scaffolded by an older
`bspecs` (unless those files were edited locally).

## [0.10.0] — 2026-06-24

### Changed

- **Switched to the public npm registry (`access: public`, no PAT).** `publishConfig` targets the
  default npm registry; the GitHub Packages mapping, `${GITHUB_TOKEN}`, and `access: restricted` are
  gone. Install is now a single `npm install -g @bluestep-systems/bspecs` — no `~/.npmrc` or token.
- **Removed `@bluestep-systems/b6p-cli` from bspecs's own `dependencies`.** It was never used by
  bspecs source — it is a devDependency of *scaffolded* projects only. Removing it prevents the
  stray dep from pulling `b6p-cli` (and formerly requiring a PAT) at global-install time.
- **Repo-local `.npmrc` rewritten.** Single line `@bluestep-systems:registry=https://registry.npmjs.org`
  (defensive override against stale GitHub-Packages mappings in `~/.npmrc`); the `${GITHUB_TOKEN}` +
  `always-auth` lines are gone.
- **Scaffolder runs `npm install` best-effort (`scaffold.js`, `reportInstallStep` →
  `installDependencies`).** After generating files it now attempts the install so the `b6p-cli`
  devDependency is present without a manual step, instead of only printing a reminder. The install
  is **not** assumed to succeed (network failure, offline). On any failure it falls back to the
  manual `npm install` reminder and never fails the scaffold.
- **`installDependencies` fallback message rewritten.** No longer mentions `~/.npmrc` or
  `GITHUB_TOKEN` — the only likely failure is being offline.

### Added

- **`.github/workflows/ci.yml`.** PR + push-to-default-branch validation: Node 18/20/22 matrix,
  `npm ci` with retry, smoke checks (`node cli.js -v`, `node cli.js -h`, `node test-scaffold.mjs`).
  No secrets. Trimmed from the `b6p-cli` CI workflow.
- **`.github/workflows/publish.yml`.** Tag-triggered (`v*.*.*`) publish to public npm: version guard
  (tag must match `package.json`), same smoke checks as CI, then
  `npm publish --provenance --access public` via `NPM_TOKEN`. Trimmed from the `b6p-cli` publish
  workflow.

### Removed

- **Scaffolded `.npmrc.template`** (`templates/root/.npmrc.template`). Generated projects no longer
  ship an `.npmrc` — `@bluestep-systems/b6p-cli` resolves anonymously from public npm.

### Docs

- **README** rewritten: "Installation" → single `npm install` command, no PAT; migration note for
  users with the old GitHub-Packages scope in `~/.npmrc`; "Publishing" → tag-triggered workflow;
  "Generated structure" → `.npmrc` line removed. The one-time `npx b6p auth set` platform-credential
  step is kept clearly separate.
- **CLAUDE.md** — "Publishing" and "b6p invocation" paragraphs updated to the public-registry,
  no-PAT reality; scaffolded-files list corrected (no `.npmrc`).
- **ADR `install-friction-and-registry.md`** flipped from *Proposed* to *Accepted* (Option 2, engineer
  sign-off, `b6p-cli` already public).
- **ADR `b6p-cli-distribution.md`** — registry-update note added (public npm supersedes the
  GitHub-Packages setup it described).

## [0.9.0] — 2026-06-19

Completes the "A5" fast-follow staged in 0.8.0: scaffolded projects now reach `b6p` via `npx b6p`
(resolving the project's own `node_modules/.bin/b6p`), and the ~200-line shell-detection workaround
is deleted. `b6p-cli` becomes a **devDependency of each scaffolded project** rather than something
the builder installs from source — because a dependency's bin is never placed on the global PATH, so
`bspecs` depending on `b6p-cli` did not, by itself, give a scaffolded project a usable `b6p`. `npx`
resolves the local bin cross-platform with no shells, login profiles, or PATH probing involved.

### Removed

- **Shell-detection scaffolding in `src/scaffold.js`.** `detectEnvironmentFor`, `probeCommand`,
  `shellPrefixCandidates`, `userShell`, `classifyPrefix`, `detectB6pEnvironment`, `reportB6pStatus`,
  and `writeB6pEnvFile` are gone. The scaffolder no longer probes for `b6p` or writes
  `.claude/b6p-env.json`.
- **`.claude/b6p-env.json`.** No longer written or read; the `npx b6p` invocation needs no persisted
  shell prefix.
- **`/b6p-detect` skill.** `templates/claude/skills/b6p-detect/` is deleted (it re-detected and
  rewrote `b6p-env.json`). It drops out of the dynamic `SYNC_TARGETS` automatically.
- **`require-wsl-for-b6p` hook.** `templates/claude/hooks/require-wsl-for-b6p.sh` is deleted and its
  `PreToolUse(Bash)` registration removed from `settings.json.template`. Its sole job was enforcing a
  shell-prefix shape so nvm-installed `b6p` was found on PATH — vestigial under `npx b6p`.

### Added

- **`templates/root/package.json.template`.** Scaffolded projects now ship a `private` `package.json`
  declaring `@bluestep-systems/b6p-cli` (`^0.1.0`) as a `devDependency`, so `npm install` populates
  `node_modules/.bin/b6p` for `npx b6p` to resolve.
- **`templates/root/.npmrc.template`.** Maps the `@bluestep-systems` scope to GitHub Packages (token
  via `${GITHUB_TOKEN}`), so `npm install` / `npx b6p` resolve `b6p-cli` in the scaffolded project.
  Mirrors the repo-root `.npmrc` pattern from 0.8.0.
- **Install-step instruction (`scaffold.js:reportInstallStep`).** After generating files, the
  scaffolder tells the user to `cd <project> && npm install`. It deliberately does **not** auto-run
  `npm install` — that would need the consumer's GitHub Packages PAT at scaffold time and fails poorly
  on a first run.

### Changed

- **`/b6p-pull`, `/b6p-push`, `/b6p-audit` invoke `npx b6p …`** instead of `<shellPrefix> 'b6p …'`.
  Each skill's `allowed-tools` is `Bash(npx b6p *)`; the `.claude/b6p-env.json` reading, auto-detect
  procedure, and `/b6p-detect` references are removed. "command not found" now points at
  `npm install` rather than an "install the b6p CLI from source" flow.
- **Scaffolded prose switched to the `npx b6p` model** — `templates/root/CLAUDE.md.template` (critical
  rule 5, the sync-workflow section, the skill table minus `/b6p-detect`),
  `templates/root/README.md.template` (the build-from-source and WSL-invoke sections replaced with an
  "Install dependencies" + `npx b6p auth set` flow), and
  `templates/claude/instructions/b6p-platform.md.template` (the `bash -lc`/nvm rationale dropped).
- **Prettier pre-flight is now self-contained** (`scaffold.js:checkPrettierOnPath`). It kept its
  WSL-aware probe and warning but no longer depends on the removed `detectEnvironmentFor` machinery.
- **This repo's `CLAUDE.md`** — the "b6p detection" / "Shell prefix list" key-behaviors paragraphs are
  replaced with the `npx b6p` model; "What gets scaffolded" now lists `package.json` + `.npmrc`, drops
  `/b6p-detect` and `require-wsl-for-b6p`, and notes three hooks (was four).

### Note for existing projects

`bspecs sync` updates tracked files but never deletes user files it no longer manages. A project
scaffolded by an older `bspecs` keeps an orphaned `.claude/b6p-env.json` and `.claude/skills/b6p-detect/`
— both harmless and no longer used; delete them by hand if you want them gone. To adopt the new flow,
add `@bluestep-systems/b6p-cli` as a devDependency plus a scope-mapped `.npmrc`, then `npm install` so
`npx b6p` resolves.

### Note

- The `~/.bluestep/push.js` snapshot conventions in `instructions/conventions/` still describe a
  separate (personal) workflow that conflicts with the `b6p` CLI flow; tracked as a follow-up in
  `TODO.md` ("Scaffolded snapshot conventions conflict with the `b6p` CLI flow"), out of scope for A5.

---

## [0.8.0] — 2026-06-19

Makes `bspecs` the single tool BlueStep builders install: it now depends on the freshly-published
`@bluestep-systems/b6p-cli`, so a global install brings the `b6p` binary transitively. The package
is renamed and moved to the `Bluestep-Systems` org for consistency with the rest of the toolchain.

### Changed

- **Package renamed** `@bluestep/bspecs` → `@bluestep-systems/bspecs`, matching the
  `@bluestep-systems` scope used by `b6p-cli` and `b6p-core`. Uninstall the old global before
  installing the new one: `npm rm -g @bluestep/bspecs && npm i -g @bluestep-systems/bspecs`.
- **Repository moved** to `github.com/Bluestep-Systems/bspecs` (off the personal account); the
  `repository.url` field is corrected to match.

### Added

- **Runtime dependency on `@bluestep-systems/b6p-cli` `^0.1.0`.** Installing `bspecs` now installs
  `b6p` automatically — no separate source checkout. Requires a `~/.npmrc` mapping
  `@bluestep-systems` → GitHub Packages and a PAT (`read:packages` to install). See the README
  "Installation" section.
- **Repo-root `.npmrc`** mapping the `@bluestep-systems` scope to GitHub Packages (token via the
  `${GITHUB_TOKEN}` env placeholder — no secret committed).

### Note

- The detect-and-guide shell-detection workaround (`detectEnvironmentFor`, `.claude/b6p-env.json`,
  `/b6p-detect`, the `require-wsl-for-b6p` regex) is **not** removed in this release. Switching skills
  to `npx b6p` and deleting that ~200 lines is staged as a separate fast-follow (the "A5" spec) to
  keep this publish small and reversible. See `docs/decisions/b6p-cli-distribution.md` and
  `.claude/specs/publish-chain/`.

---

## [0.7.0] — 2026-06-19

Adds three BlueStep subagents and makes `/spec-execute` delegate task implementation to one of them by default, so a large feature's heavy declaration/source reads stay out of the main session. Resolves the B4 follow-up from the rules consolidation.

### Added

- **`.claude/agents/` subagents.** Every scaffolded project now ships three BlueStep-aware subagents: `b6p-task-implementer` (implements exactly one approved spec task in an isolated context and returns a structured summary), `b6p-commenter` (fills in a component's `draft/README.md` from the code), and `b6p-code-review` (BlueStep-aware review grouped Critical/Warnings/Suggestions, **report-only by default**). Each references the `instructions/` tree on demand rather than restating platform rules. They ride the existing `templates/claude/**` walk, so `copyTemplateTree` and `SYNC_TARGETS`/`bspecs.lock` pick them up with no `src/` change.

### Changed

- **`/spec-execute` delegates by default.** A `[CODE]` task is implemented by spawning `b6p-task-implementer` in its own context; the main session surfaces the git diff and keeps the approval gate (review, mark `[x]`, README sync, STOP). A new `--inline` flag implements in-session for trivial tasks. The "task done" STOP now offers the optional, user-invoked `@b6p-commenter` and `@b6p-code-review` — never auto-fired. See `docs/decisions/subagents-and-delegated-execution.md`.

### Note

- `bluestep-dev` was **not** ported as an artifact — its platform knowledge already lives in `instructions/` (0.6.0); only its workflow became the implementer's prompt. The implementer never runs `tsc` (hook-blocked; the platform compiles on push) — it verifies via `ide_diagnostics`.

---

## [0.6.0] — 2026-06-19

Consolidates four team members' separate BlueStep rule kits into one canonical, deduplicated instruction tree that ships with every scaffolded project, and makes scaffolding Claude-only (the GitHub Copilot mirror is removed).

### Added

- **`.claude/instructions/` rule tree.** Every scaffolded project now ships an `index.md` manifest plus atomic single-topic files under `reference/`, `conventions/`, and `gotchas/`, alongside the existing Tier-2 overviews (`b6p-platform.md`, `bsjs-development.md`). All read on demand (not `@`-imported); the `index.md` manifest lists every file with a "load when…" trigger and links one hop to each. Sources merged: Brandon's `01-Platform-Reference`/`02-Workflow-Conventions`/`bluestep-knowledge`, Brendan's `BSJS_GOTCHAS.md`, and Brian's `agents-support/*` (the shared docs were reconciled, not duplicated).
- **`index.md` "Unresolved conflicts" roll-up.** Genuine cross-source disagreements are flagged inline with `<!-- CONFLICT: … -->` comments and rolled up in `index.md` for human resolution, rather than silently picked.

### Changed

- **`SYNC_TARGETS` is now derived dynamically** by walking `templates/claude/**` (`enumerateClaudeTargets(SYNC_EXCLUDE)` in `src/utils.js`), replacing the hand-maintained array in `src/sync.js`. New skills, hooks, and instruction files flow into `bspecs sync` and `bspecs.lock` automatically — no list to keep in step. A documented (empty) `SYNC_EXCLUDE` is the escape hatch for future scaffold-once files. See `docs/decisions/instruction-tree-and-claude-only.md`.
- **`b6p-platform.md` / `bsjs-development.md` overviews** gained a `## Contents` TOC and folded-in deltas from the reconciled `platform-overview` / `typescript-guide`; they summarize and link to the atomic files instead of restating them.

### Removed

- **GitHub Copilot mirror.** `mirrorInstructionsToGithub` and its call site are deleted; scaffolding no longer writes a `.github/instructions/` tree, and the `.github` entries are gone from the sync list. Scaffolded projects are Claude-only. This repo's docs no longer claim dual Claude Code + Copilot support.

### Note for existing projects

`bspecs sync` never deletes files, so a project scaffolded by an older `bspecs` keeps its now-orphaned `.github/instructions/` mirror. It is harmless and no longer updated; delete `.github/instructions/` by hand if you want it gone.

---

## [0.5.0] — 2026-05-26

Adds `bspecs sync` to keep scaffolded projects up to date when `bspecs` templates change, without requiring a re-scaffold.

### Added

- **`bspecs sync` subcommand.** Updates infrastructure files (skills, hooks, settings, instructions, spec-templates) in an existing project. Files the user edited locally are detected via SHA-256 hash comparison against a lock file and skipped — local edits are never overwritten.
- **`.claude/bspecs.lock`.** Written by the scaffolder at project creation time. Contains the `bspecs` version, scaffold date, project vars (excluding `CONTEXT7_API_KEY`), and a hash of every infrastructure file at scaffold time. `bspecs sync` reads and updates this file on each run.
- **`SessionStart` hook in generated projects.** The scaffolded `.claude/settings.json` now includes a `SessionStart` hook that runs `bspecs sync --silent` automatically on every workspace open, resume, and compaction — no manual intervention needed.
- **`--silent` flag for `bspecs sync`.** Suppresses all output and swallows errors with exit 0, so the hook never blocks Claude Code startup.

### Changed

- **`bsjs-development.md` instruction template** — new section "TS narrowing pitfalls (Graal/Java types)" documenting patterns that collapse to `never` in closures with Java types, with three solutions ordered by preference.
- **`/spec-execute` skill** — new step 5.5 requires verifying IDE diagnostics before marking a task done. Errors in touched files must be fixed; warnings can be dismissed with justification.

---

## [0.4.0] — 2026-05-21

**Breaking change:** package renamed from `@bluestep/init` (command `bluestep-init`) to `@bluestep/bspecs` (command `bspecs`). Uninstall the old global before installing the new one:

```sh
npm uninstall -g @bluestep/init
npm install -g @bluestep/bspecs   # once published, or: npm install -g .
```

### Changed

- **Package renamed** from `@bluestep/init` to `@bluestep/bspecs`. The CLI command is now `bspecs` instead of `bluestep-init`. All internal references and generated project files updated.
- **Scaffolded projects** now reference `bspecs` in their generated `CLAUDE.md` and `README.md` (no functional change to the generated workspace structure).

### Why

The original name `bluestep-init` implied the tool's only job is project initialisation. The real purpose is spec-driven development with normalised rules for AI agents — scaffolding is just the entry point. `bspecs` (BlueStep + specs) names the actual goal.

---

## [0.3.2] — 2026-05-21

Shell-aware `b6p` detection: handles zsh-with-nvm-in-.zshrc setups (which were silently broken before), persists the detected invocation prefix per project, and lets users redo detection without re-running the scaffolder.

### Added

- **`.claude/b6p-env.json` persistence.** Scaffolder writes the detected shell prefix (e.g. `"/usr/bin/zsh -ic"`) to this file. Skills read it once and skip re-detection on every invocation.
- **`/b6p-detect` skill.** Re-runs detection and rewrites `.claude/b6p-env.json`. Use after re-installing b6p in a different location.

### Changed

- **Shell-prefix detection now tries `<user-shell> -lc`, then `-ic`, then bash variants, then WSL variants on Windows hosts.** Previously hardcoded `bash -lc`, which never found nvm-installed binaries on zsh systems because nvm typically lives in `.zshrc` (loaded only by interactive shells, `-ic`). The new probe order picks the cleanest shell + flag combo that actually works.
- **`require-wsl-for-b6p.sh` regex broadened** to accept any of bash/zsh/sh/fish with `-lc` or `-ic`, with or without an absolute-path prefix or `wsl` prefix. The old regex only accepted `bash -lc`; with the broader detection, valid invocations were getting blocked.
- **All `/b6p-*` skills now read `.claude/b6p-env.json`** for the prefix instead of running `uname -s` at the start of every invocation. Auto-detect with persist as fallback when the file is missing.

### Why this is technical debt

`docs/decisions/b6p-cli-distribution.md` now has a "Cleanup once b6p-cli is published" section listing exactly what to remove when upstream publishes `@bluestep-systems/b6p-cli`. The whole shell-detection apparatus disappears when we can use `npx` (the Node.js standard for CLI distribution). Recording this so future maintainers don't mistake the workaround for an intentional design choice.

## [0.3.1] — 2026-05-21

### Fixed

- **Pre-flight `prettier` and `b6p` checks no longer give false negatives when scaffolding from inside WSL.** The previous implementation always called `wsl bash -lc "command -v X"`, which fails when Node is already running in Linux/WSL (either `wsl` is not present in Linux, or Windows-interop evaluates against the wrong PATH). The check now branches on `process.platform`: `'linux'` → `bash -lc` directly; everything else → `wsl bash -lc`. Mirrors the shell-detection logic the `/b6p-*` skills already use at runtime. Install-command hints in the warning messages are also adjusted per platform so the user can copy-paste them as-is.

## [0.3.0] — 2026-05-21

Tightened our integration with `b6p` after auditing the full CLI surface. The previous version used only `b6p pull` and `b6p push`, missing several commands that map directly to friction points in the workflow.

### Added

- **`/b6p-audit` skill.** Wraps `b6p audit --json` to compare local vs. platform state and list divergent files. Read-only — does not auto-pull or auto-push. Intended for on-demand use ("did something change on the platform?"), explicitly NOT auto-chained as a pre-flight to push, because most sessions push multiple times and the user knows the context (whether others are working on the same module). The CLI's own server-side conflict detection covers the rare worst case.
- **`auth set` reminder in scaffolder pre-flight and project README.** Without configured credentials, the first `b6p pull` prompts interactively, which Claude cannot answer (the call hangs). The scaffolder now reminds the user to run `b6p auth set` once when it detects b6p is installed; the project README documents it as a one-time setup step.
- **CLAUDE.md "Skill quick reference" section.** Table of all available skills with intent-to-skill mapping, plus a mandatory routing rule for spec-driven changes (must `/spec-create` or `/bug-fix` before editing module code, except trivial changes the user explicitly opts out of) and soft routing for sync/status/audit operations. Closes the gap where Claude had no central guidance on when to invoke which skill.

### Changed

- **`/b6p-pull` and `/b6p-push` now pass `--yes` to b6p.** Without this flag, the CLI may show interactive confirmation prompts that Claude cannot answer — the call would hang silently. Required for any Claude-driven invocation. Same change applied to the documented commands in CLAUDE.md and the project README.

### Why this is a minor bump (0.3.0, not 0.2.2)

The `--yes` change is technically a bug fix (latent hang), but a new skill (`/b6p-audit`) is additive functionality. Minor bump is the right call: existing users are not broken, but a new capability ships.

## [0.2.1] — 2026-05-21

Added an interim solution for the `b6p` CLI dependency, since `@bluestep-systems/b6p-cli` is not yet published to any npm registry and most BlueStep devs do not have it installed.

### Added

- **Pre-flight check for `b6p` CLI in `scaffold.js`.** After generating files, the CLI now checks whether `b6p` is reachable via `wsl bash -lc "command -v b6p"`. If not, it prints the six commands the user needs to install it from source (clone, install, compile, link) plus a hint about the SSH access requirement to the `Bluestep-Systems` GitHub org.
- **"Install the b6p CLI" section in the generated project's `README.md`.** Same install commands, surfaced where a developer onboarding to the scaffolded project will look first.
- **Distinct handling of "command not found" in `/b6p-pull` and `/b6p-push`.** When the skills encounter that specific error (CLI missing), they now redirect the user to the README install section instead of suggesting fallbacks or retrying. Other errors (network, auth, conflict) still point at the VS Code extension as fallback.
- **`TODO.md`** and **`docs/decisions/b6p-cli-distribution.md`** at the repository root. The decision record explains why we chose the detect-and-guide approach today and the path to replacing it with a `peerDependencies` declaration once the upstream package is published.

### Why this is an interim solution

The correct long-term shape is to declare `@bluestep-systems/b6p-cli` as a `peerDependencies` entry in our `package.json`. That requires the upstream team at `Bluestep-Systems/vscode-extension` to first publish both `b6p-core` and `b6p-cli` to a registry (most likely GitHub Packages). That work is acknowledged in the upstream README's "Follow-ups" section as out of scope for the initial monorepo split. We will revisit when it ships.

## [0.2.0] — 2026-05-21

This is the first iteration after real-world use. The flow was end-to-end tested against the `Appointment Scheduler` project; several incorrect assumptions in the original design were corrected.

### Breaking changes

- **Removed prompts `unitId` and `projectType`.** A project has no unit or type of its own — Unit folders (`U######/`) are created by `b6p pull` when a component from a new unit is first pulled. A single project commonly spans multiple Unit folders, each mixing component types. Projects generated by `0.1.0` had a hand-created U-folder that is no longer expected.
- **Removed per-component `SPEC.md`.** The "permanent contract" concept conflated description (stable) with planning (volatile). Replaced with two artifacts separated by lifecycle:
  - `<Component>/draft/README.md` — what the module does today; lives inside `draft/` so it ships to the platform on push.
  - `.claude/specs/<feature>/` — what we're about to change; per feature, not per component.
- **Removed `/new-module` skill.** Its only durable value (a SPEC.md stub) is now folded into `/b6p-pull`, which can read the freshly-pulled `metadata.json` and prefill a README accurately.
- **Changed `b6p` invocation shape.** The required form is now `wsl bash -lc 'b6p ...'` (or `bash -lc 'b6p ...'` when Claude already runs in WSL). Plain `wsl b6p ...` fails with `command not found` because it skips the login shell, so nvm/PATH never load. The `require-wsl-for-b6p` hook now enforces the new shape.

### Added

- **`draft/README.md` auto-scaffolding in `/b6p-pull`.** When a pulled module lacks a substantive `README.md`, the skill identifies component type from `metadata.json` + `config.json` + entry script, infers Overview/Behavior/Fields/Dependencies from the code, and asks the user if it cannot infer the purpose with confidence. Existing substantive READMEs are preserved.
- **Shell detection in skills.** `/b6p-pull` and `/b6p-push` run `uname -s` first and choose between `bash -lc` (inside WSL) and `wsl bash -lc` (from Windows). The hook accepts both forms.
- **`[PLATFORM]` / `[CODE]` task prefix convention.** Every task in `tasks.md` is prefixed by where the work happens. `/spec-execute` rejects `[PLATFORM]` tasks (they're done in the BlueStep UI) and checks for unchecked `[PLATFORM]` prerequisites before running a `[CODE]` task. Tasks template includes a `## Deployment` section listing components to push.
- **Session-start README directive in `CLAUDE.md`.** Claude reads every `draft/README.md` once per session, not per skill invocation. `/spec-create`, `/spec-execute`, and `/bug-fix` rely on that session-start coverage and don't re-read.
- **README update reminders.** `/bug-fix` and `/spec-execute` remind the user to update `draft/README.md` when documented behavior changes.
- **CLI flags `-v` / `--version` and `-h` / `--help`.** Version is read from `package.json` for single source of truth.
- **Clean cancellation.** Ctrl+C at any prompt now exits with `"Cancelled."` instead of falling through to subsequent prompts. (`@clack/prompts` `group()` had a quiet bug here; replaced with individual `bail()` checks.)
- **Pre-flight prettier check.** Scaffold prints a warning if `prettier` is not on the WSL PATH, since the `prettier-on-save` hook would silently no-op.

### Changed

- **`/b6p-push` uses `--file`** instead of trying to push by name. `--file` lets the b6p CLI derive the destination DAV URL from the local `.b6p_metadata.json`.
- **Hook messages.** `block-generated-files` and `require-wsl-for-b6p` now print the correct corrective invocation (`wsl bash -lc 'b6p pull "<DAV URL>"'`) rather than the old `wsl b6p pull <component>` shape.

### Documentation

- **`rule-audit.md`** now contains rules R18a (project shape), R18b (README vs. spec lifecycle), and R18c (task prefix convention) — all derived from real-session feedback, not from the original template.
- **`bsjs-development.md`** and **`b6p-platform.md`** instruction templates rewritten with the new invocation shape and the module structure that matches what `b6p pull` actually produces.

## [0.1.0] — Initial scaffold

First working version. Generated a project with `CLAUDE.md`, `.claude/{hooks,skills,instructions,spec-templates}`, `.vscode/mcp.json`, mirrored Copilot instructions in `.github/instructions/`, and a per-component `SPEC.md` template. Six prompts including `unitId` and `projectType` (both later removed). Seven skills including `/new-module` (later removed).

Not published to GitHub Packages — used only via local symlink during development.
