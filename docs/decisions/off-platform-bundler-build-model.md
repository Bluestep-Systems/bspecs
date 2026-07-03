# ADR: Document the off-platform bundler build model as a first-class merge-report path

**Status:** Accepted

**Date:** 2026-07-03

## Context

Every existing `bluestep-reference` entry about a merge report's `static/` bundle describes one build
model: BlueStep compiles `static/script.ts` **on the platform** to `.build/script.js`, and the report
autoloads that alongside `styles.css` (see `reference/merge-report-static-index.md`,
`conventions/single-script.md`, `conventions/separate-files.md`). In that model the platform is the
compiler, the source of truth, and the history store.

A spike proved a **different** model works end to end: build a full **Vite/Preact single-page app
off-platform** (Node 20 + npm, any package), produce a minified `dist/`, and deploy that `dist/` into
the report's `static/` folder with **deploy-lib**. The platform compiler is **bypassed entirely** — the
report serves `static/index.html` as the page body, and `scripts/app.ts` does not render the SPA (it is
a no-op, or a `B.out` `<script>` that bootstraps `window[...]` globals such as the current record id).
This unlocks any npm package, real hot-reload local dev, and source history in GitHub instead of
BlueStep per-snapshot history.

The two models are not variants of one thing; they are distinct architectures with different toolchains
and different failure modes. Today's docs silently imply the platform compiler is the only path, so a
developer asking Claude to "build a reactive merge report with Preact" gets no guidance and reinvents
(and hits) the gotchas the spike already solved. Nothing in `TODO.md`, `CHANGELOG.md`, or an existing
ADR covers this — the npm-free-delivery ADRs are about how *bspecs itself* ships, not the report pattern.

The spike surfaced several **non-obvious, load-bearing constraints** that a naive attempt gets wrong:

- **`base: './'` is mandatory.** Vite defaults `base` to `/`, baking site-root `/assets/...` URLs into
  the built `index.html`; on-platform those 404 and the app silently does not render. `'./'` makes them
  relative so they resolve under the report's `static/`. This was the exact cause of the demo "not
  showing up."
- **Node 20+ is required.** deploy-lib and b6p-cli throw `crypto is not defined` on Node 18 (Web Crypto
  is not a global until Node 20); Vite 7 also needs 20+.
- **deploy-lib config-key casing is misleading.** deploy-lib reads `npm_package_config_deployUrl`
  (**camelCase**), but its README documents `config.deployurl` (lowercase). npm preserves case, so the
  lowercase form silently fails to deploy. The correct key is `config.deployUrl`; `builddir` and
  `deploypathsuffix` are lowercase in both. Filed upstream:
  `github.com/BlueStep-Platform/deploy-lib/issues/30`.
- **Source history lives in GitHub.** deploy-lib does not preserve BlueStep's per-snapshot history; the
  report is linked back to its source via the `package.json` `repository` field
  (`git+https://github.com/<owner>/<repo>.git`).

Because the source is a customer-specific spike, all committed documentation must be **category-level
only** — no org subdomains, file IDs, tokens, employee names, or the spike repo name — per
[`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md). Placeholders
(`https://<org>.bluestep.net/files/<id>/`, `<owner>/<repo>`) stand in for concrete values; the public
deploy-lib git URL and issue link are the one allowed concrete reference (they point at public tooling).

## Decision

**Document and tool the off-platform Vite/Preact bundle as a first-class merge-report build model
alongside the existing platform-compiled `static/script.ts` path — keep both.**

- **The plugin gains reference surface for the new model.** A `bluestep-reference` **pattern** file
  (architecture + when to pick which model + the two data models), a **conventions** file (the deploy-lib
  workflow: install-from-git, `config` keys, the `deploy` script, `npm run deploy -- --build --clean`,
  auth resolution, Node 20+), and a **gotchas** file (`base: './'`, `<head>`-stripping, mount-id match,
  Node 20, config casing, `Swal`/site-CSS absent in local dev). Each gets a `SKILL.md` manifest entry.
- **The plugin gains a `/bluestep-vite-report` scaffold skill** that guides creating such a project: a
  Node-20 precheck, a live `create-vite --template preact-ts` run, the BlueStep-specific edits
  (`base: './'`, the deploy-lib `config` block + `repository` field), and **printed** (not executed)
  `[PLATFORM]` report-creation and GitHub-repo steps. It links the three reference files rather than
  restating them.
- **The platform-compiled docs stay and are not rewritten.** They get additive cross-links and a
  one-line clarification that they describe the **platform-compiled** path; `single-script.md`
  additionally notes its rule (only root `static/script.ts` compiles) **does not apply** to a Vite
  bundle, which is bundled off-platform. No load-bearing rule is weakened.
- **Preact is the scaffolded default; React is documented as a valid alternative** (matching the spike's
  reference apps), not scaffolded.

The **load-bearing constraints above are recorded here as the "why"** so future readers do not
rediscover them: `base: './'`, Node 20+, and the deploy-lib config-key casing are the difference between
a working deploy and a silent failure.

## Options considered

- **Replace the platform-compiled docs with the Vite model** — rejected. The platform-compiled path is
  still the right choice for simple, hand-written client JS with no npm dependency; removing it would
  strand that case. Both models coexist.
- **Fold the guidance into the existing docs without a new pattern file** — rejected. The two models
  have different toolchains, deploy mechanics, and failure modes; conflating them in the platform-compiled
  files would blur the load-bearing distinction the docs exist to make clear.
- **Bundle deploy-lib / a Vite scaffold into the plugin** — rejected. The scaffold needs Node 20 and
  network regardless, and a vendored Vite tree would rot; the skill drives `create-vite` live and only
  edits the BlueStep-specific bits, keeping the plugin free of a checked-in npm project. deploy-lib and
  Node 20 are documented prerequisites, not plugin payload.

## Consequences

- **There are now two documented merge-report build models, and readers must pick one.** Use the
  **platform-compiled** `static/script.ts` path for a simple report with hand-written client JS and no
  npm dependency (nothing to install, no off-platform toolchain). Use the **off-platform Vite/Preact
  bundle** when the report is a real SPA that needs npm packages, hot-reload local dev, or git history.
- **Two data models within the off-platform pattern.** Either the SPA fetches a companion endpoint
  (`/b/<alias>`) whose request carries the logged-in session automatically, or `app.ts` sets `B.out` to
  a bootstrap `<script>` assigning `window[...]` globals — the latter requires an `objects/imports.ts`
  form-import round-trip.
- **A new prerequisite the plugin does not provide.** The off-platform model needs **Node 20+** and
  **deploy-lib** (installed from git), neither bundled into the plugin; the scaffold skill checks Node 20
  and stops (rather than installing it) if absent.
- **Source of truth and history move off-platform** for the Vite model — the report is a deploy target,
  and the canonical source lives in GitHub, linked via `package.json` `repository`.
- **The deploy-lib config-casing bug is an external dependency risk.** The docs pin `config.deployUrl`
  (camelCase) and link the upstream issue; if deploy-lib fixes or changes the key, the conventions file
  must be updated.

## References

- Spec: `.claude/specs/vite-merge-report-tooling/{requirements,design,tasks}.md` (full technical
  background, proven-facts table, and evidence locations in `HANDOFF.md`)
- Companion ADR: [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md)
  (the category-level content constraint governing the reference files)
- Related ADRs: [`plugin-distribution.md`](plugin-distribution.md),
  [`subagents-and-delegated-execution.md`](subagents-and-delegated-execution.md)
- Upstream deploy-lib: `github.com/BlueStep-Platform/deploy-lib` and the config-casing issue
  `github.com/BlueStep-Platform/deploy-lib/issues/30`
