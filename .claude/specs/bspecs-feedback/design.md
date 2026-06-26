# Design — bspecs-feedback skill

**Status:** Drafting

## Files / areas affected

- **NEW `templates/claude/skills/bspecs-feedback/SKILL.md`** — the skill itself, scaffolded into every project. Plain markdown, no `{{VAR}}` substitution needed (the repo URL is a constant; the version is read at runtime from `.claude/bspecs.lock`). Because `SYNC_TARGETS` is derived dynamically by walking `templates/claude/**` (`src/sync.js` → `enumerateClaudeTargets`), **no code change is needed** — adding this file makes `bspecs sync` / `bspecs.lock` pick it up automatically.
- **NEW `.github/ISSUE_TEMPLATE/feedback.yml`** — a GitHub issue *form* in the **bspecs repo only** (not scaffolded into consumer projects, per the requirements open-question lean). Defines the structured fields submissions land in.
- **NEW `.github/ISSUE_TEMPLATE/config.yml`** (only if not already present) — to keep the blank-issue route available alongside the form. Check first; create only if missing.
- **`templates/root/CLAUDE.md.template`** — amend the **Self-improvement** section (currently lines ~135–144). Today it routes every discovered rule into the scaffolded `CLAUDE.md` / `.claude/instructions/` tree — which is exactly the tree `bspecs sync` overwrites/regenerates, so tooling-level fixes are futile and nothing flows back to canonical bspecs. Add a branch: keep local capture for project-local B6P domain knowledge, but point to `/bspecs-feedback` when the fix is (a) a bspecs **tooling artifact** (skill / hook / instruction *template* / a `CLAUDE.md` rule that came from bspecs) whose local edit won't survive sync, or (b) a B6P rule general enough to belong in **every** scaffolded project (bspecs' shipped instruction templates). This makes the skill discoverable at the moment a user notices something wrong, not only when they recall the slash command.
- `CLAUDE.md` (this repo's own, **not** the template) — add `bspecs-feedback` to the scaffolded-skills list under "What gets scaffolded into every project".
- `README.md` — one line in the scaffolded-skills overview, if it enumerates skills.
- `CHANGELOG.md` — an `### Added` entry under a new version block.
- `TODO.md` — tick the `/bspecs-feedback` item.
- **Optionally** `docs/decisions/bspecs-feedback-mechanism.md` — short ADR memorializing the prefilled-link / no-backend / no-token choice and the two rejected alternatives (see "Alignment" below).

## Approach

A pure-markdown skill (same shape as the `b6p-*` skills) that instructs Claude through four moves:

1. **Infer, then confirm — don't cold-quiz.** The skill runs in the main session, so Claude usually already has the relevant discussion in context (the misleading rule, its file, the agreed fix). The common path: Claude **drafts** the submission from the conversation — `kind(s)`, `target(s)`, `file_path`, `current_text`, `proposal` — then shows that draft and asks the user to confirm or adjust, rather than asking the six fields cold. Both `kind` and `target` remain tag sets (multi-valued, never single-select). Only when the skill is invoked with no prior discussion to draw on (e.g. "file feedback that X is annoying") does Claude fall back to asking for `kind(s)`/`target(s)` directly.
2. **Capture context conditioned on kind** — the kind set drives what Claude auto-collects from the live session (pulled from the conversation first, read from the tree to fill gaps):
   - *change rule* / *remove rule* → the affected file path + the **current rule text** verbatim (Claude reads it from the `.claude/` tree).
   - *report error/bug* → a repro (what was run, what happened, what was expected).
   - *request capability* → the use case (what the user is trying to do that no skill/hook/CLI feature supports).
   - *add rule* → where the missing guidance should live + what it should say.
   - *report friction* → what's painful and why (no fix required).
   - Always capture the **bspecs version** by reading `bspecs_version` from `.claude/bspecs.lock`.
3. **Build the prefilled link** — construct a deep link against the **issue form**, prefilling form fields by their element `id` and applying the `feedback` label:
   ```
   https://github.com/Bluestep-Systems/bspecs/issues/new?template=feedback.yml&labels=feedback&title=<enc>&<field-id>=<enc>&…
   ```
   Encoding is done with a guaranteed-present tool — **node** (`encodeURIComponent`) — not by hand, so multi-line bodies and special characters survive.
4. **Open + fallback** — open the URL with the platform opener (`wslview` on WSL, else `xdg-open`, else `open`), and **always print the URL** so a failed auto-open degrades to a clickable link. GitHub's web UI handles auth via the user's existing browser session.

The scaffolded **Self-improvement** section (`templates/root/CLAUDE.md.template`) is the discovery surface for this skill: it already fires when a user/Claude notices an undocumented or wrong rule, so it gains a branch that hands off to `/bspecs-feedback` for anything that must reach canonical bspecs (tooling artifacts, or rules that belong in every project) rather than dying in the locally-synced tree.

## Data / control flow

```
/bspecs-feedback [free-text]
  → Claude drafts kind(s)/target(s)/file_path/current_text/proposal
        from the conversation already in context
        (falls back to asking only when there's nothing to infer from)
  → fills gaps: reads current rule text from the .claude/ tree per kind
  → reads bspecs_version from .claude/bspecs.lock
  → shows the draft; user confirms or adjusts
  → node: build + URL-encode the issues/new?template=feedback.yml&… link
  → wslview|xdg-open|open <url>  ; always echo <url>
  → user reviews the prefilled form in their browser and submits
```

The issue form `feedback.yml` fields (prefilled by `id`):

- `kind` — dropdown, multiple. *(See edge case: GitHub multi-select prefill is unreliable; since we keep a single `feedback` label (no `kind:*` labels), kind cannot ride `labels=` either — so kind/target are embedded as **text** in the title + the `proposal` body, which prefill reliably. The dropdowns are best-effort on top.)*
- `target` — dropdown, multiple (instruction / skill / subagent / hook / settings-permission / spec-template / module-template / CLAUDE.md / CLI).
- `file_path` — input.
- `current_text` — textarea (current rule text, when change/remove).
- `proposal` — textarea (proposed change + rationale).
- `version` — input (bspecs version).

## Edge cases

- **Auto-open fails** (no opener, headless) → URL is printed; user clicks it. This is the only failure path (no `.jsonl` fallback — see requirements Out of scope).
- **GitHub issue-form prefill limits** — query-param prefill is reliable for `input`/`textarea` fields by `id` (textareas only when they have no `render:` attribute); **multi-dropdown prefill is not guaranteed**. Mitigation: embed **kind(s)/target(s) as text** in the title and the `proposal` body so the signal lands even if the dropdowns don't prefill. (Originally this rode the `labels=` param, but task 2 settled on a single `feedback` label — no `kind:*` labels to apply — so text-embedding is the safety net.)
- **Labels must pre-exist in the repo** — `labels=feedback` is only applied if the `feedback` label exists. Task: ensure the `feedback` label exists in the repo. Keep it to the single `feedback` label; capture the per-kind detail in the form body rather than minting six `kind:*` labels (maintainers can relabel during triage).
- **URL length** — GitHub truncates very long prefilled bodies (~8 KB). Keep `current_text` excerpts focused; the skill should trim, not paste whole files.
- **`.claude/bspecs.lock` missing** (project predates 0.5.0 or hand-set-up) → fall back to "unknown" for the version and note it in the body; don't block submission.
- **No GitHub account** → the prefilled link still carries all content in the URL; the user hits GitHub's login/signup wall but loses nothing.

## Alignment with existing patterns

- **Single source of truth / Claude-only**: skill lives only in `templates/claude/skills/` — no `.github/` Copilot mirror (per `docs/decisions/instruction-tree-and-claude-only.md`).
- **Dynamic `SYNC_TARGETS`**: no hardcoded list edit — the new skill file is auto-discovered (per the same ADR).
- **No-token / public-repo posture**: consistent with the public-npm publishing decision (`docs/decisions/install-friction-and-registry.md`) — nothing secret ships in templates.
- **Skill shape**: mirrors `b6p-push`/`b6p-pull` (frontmatter `name`/`description`/`allowed-tools`; numbered Steps; explicit "what this must NOT do").
- **ADR**: the mechanism choice (prefilled link, no backend, no token) and its two rejected alternatives (baked-in token; server-side webhook) are non-obvious and already reasoned out in `TODO.md`. A short ADR in `docs/decisions/` is **warranted** to make that discoverable next to the other decisions — recommended, drafted as its own task.

## Risks

- **Issue-form prefill behavior is the main unknown** — verified manually by running the skill, opening the generated URL, and confirming the form lands prefilled (kind via label as the safety net). No test suite, so this is hand-verified.
- **Opener differences across environments** — verify `wslview` is the right call from the WSL-side Bash tool (hooks and Bash run in WSL per `CLAUDE.md`); fall back chain covers macOS/Linux.
- Verification overall: scaffold into a scratch dir, confirm `bspecs-feedback` appears under `.claude/skills/` and is listed in the freshly written `bspecs.lock`; invoke the skill and inspect the generated URL before relying on auto-open.
