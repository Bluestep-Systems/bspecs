# Tasks — bspecs-feedback skill

**Status:** Complete

Each task references specific file paths and is small enough to ship in one `/spec-execute` invocation. Ordered so dependents come after what they depend on.

## Tasks

- [x] **1.** Add the GitHub issue form so prefilled submissions land structured. Create `.github/ISSUE_TEMPLATE/feedback.yml` with fields by `id`: `kind` (dropdown, multiple), `target` (dropdown, multiple), `file_path` (input), `current_text` (textarea), `proposal` (textarea), `version` (input); set `labels: [feedback]`. Check whether `.github/ISSUE_TEMPLATE/config.yml` exists; create it only if missing (keep the blank-issue route). — files: `.github/ISSUE_TEMPLATE/feedback.yml`, `.github/ISSUE_TEMPLATE/config.yml` (conditional)

- [x] **2.** Ensure the `feedback` label exists in the repo so the form's `labels: ["feedback"]` and the skill's `labels=feedback` actually apply (GitHub silently drops unknown labels). **Done** — created via:
  ```
  gh label create feedback --repo Bluestep-Systems/bspecs \
    --color 0E8A16 --description "bspecs tooling-change request (via /bspecs-feedback)"
  ```
  Single `feedback` label only — per-kind detail rides the issue body, not six `kind:*` labels. — files: (repo label; no source file)

- [x] **3.** Write the skill. Create `templates/claude/skills/bspecs-feedback/SKILL.md` (plain markdown, frontmatter `name`/`description`/`allowed-tools` like the `b6p-*` skills). Encode the four moves from the design: (a) **infer** kind(s)/target(s)/file_path/current_text/proposal from conversation context and **confirm** with the user, falling back to asking only when there's nothing to infer; (b) capture context conditioned on kind; (c) read `bspecs_version` from `.claude/bspecs.lock` (fall back to "unknown"); (d) build the `issues/new?template=feedback.yml&labels=feedback&…` deep link, URL-encoding via node's `URLSearchParams`, embedding kind(s)/target(s) as **text** in the title + `proposal` body as the prefill safety net (single `feedback` label only — multi-dropdown prefill is unreliable); (e) open with `wslview`/`xdg-open`/`open` and always print the URL. Include a "what this must NOT do" section (no token, no backend, no `.jsonl`). — files: `templates/claude/skills/bspecs-feedback/SKILL.md`

- [x] **4.** Amend the scaffolded Self-improvement section so the skill is discoverable at the moment a problem is noticed. In `templates/root/CLAUDE.md.template` (the "## Self-improvement" section), keep local capture for project-local B6P domain knowledge, but add a branch handing off to `/bspecs-feedback` when the fix is (a) a bspecs **tooling artifact** (skill / hook / instruction template / a `CLAUDE.md` rule that came from bspecs) whose local edit won't survive `bspecs sync`, or (b) a B6P rule general enough to belong in **every** scaffolded project. — files: `templates/root/CLAUDE.md.template`

- [x] **5.** Verify `bspecs sync` auto-discovers the new skill (no code change expected — `SYNC_TARGETS` is dynamic). Scaffold into a scratch dir, confirm `bspecs-feedback` appears under `.claude/skills/` and is listed in the written `bspecs.lock`. If discovery somehow misses it, fix in `src/sync.js`/`src/utils.js`; otherwise verification-only. — files: (verification; `src/sync.js`/`src/utils.js` only if a gap is found)

- [x] **6.** Add the ADR memorializing the mechanism choice. Create `docs/decisions/bspecs-feedback-mechanism.md` — prefilled GitHub issue link, no backend, no token; rejected alternatives: baked-in token, server-side webhook. Reference `TODO.md` where the reasoning originated. — files: `docs/decisions/bspecs-feedback-mechanism.md`

- [x] **7.** Update scaffolded-skills documentation. Add `bspecs-feedback` to the skills list in this repo's `CLAUDE.md` ("What gets scaffolded into every project") and to `README.md` if it enumerates skills. — files: `CLAUDE.md`, `README.md`

- [x] **8.** Record the change and close the loop. Add an `### Added` entry under a new version block in `CHANGELOG.md` (minor bump — new skill, repo issue form, Self-improvement cross-reference); tick the `/bspecs-feedback` item in `TODO.md`. — files: `CHANGELOG.md`, `TODO.md`

## Verification

No test suite — confirm manually:

- `node cli.js -h` still runs (no CLI regression).
- Scaffold into a scratch directory; confirm `.claude/skills/bspecs-feedback/SKILL.md` is present and `bspecs.lock` lists it; confirm the scaffolded `CLAUDE.md` Self-improvement section now references `/bspecs-feedback`.
- Invoke `/bspecs-feedback` in a scaffolded project; inspect the generated `issues/new?template=feedback.yml&…` URL before relying on auto-open; open it and confirm the GitHub issue form lands prefilled (kind carried as `labels=feedback` even if the form widget doesn't prefill multi-selects).
- Confirm the `feedback` label exists in the repo so the label actually applies.

## Wrap-up

- Keep this repo's `CLAUDE.md` / `README.md` in sync (task 7).
- Tick the `/bspecs-feedback` item in `TODO.md` (task 8).
- Note the change in `CHANGELOG.md` (task 8).
- No instruction file was added under `templates/claude/instructions/`, so there is no `index.md` entry to add.
- Claude-only: no `.github/` Copilot mirror for the skill. (The `.github/ISSUE_TEMPLATE/` files are the bspecs repo's own GitHub config, unrelated to the dropped Copilot mirror.)
