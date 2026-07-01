---
name: bspecs-feedback
description: Send a bspecs tooling-change request (a rule, skill, subagent, hook, reference file, spec/module template, or a shipped CLAUDE.md rule) to the canonical bspecs repo as a prefilled GitHub issue. Use when you or the user notice something about the bluestep-tools plugin itself that should change — the plugin is a read-only shared install, so a lasting fix has to land upstream in the repo.
---

# /bspecs-feedback — Send a tooling-change request upstream

The shared tooling (skills, subagents, hooks, the `bluestep-reference` platform rules, this very file) ships from the **`bluestep-tools` plugin** — a read-only install pulled from the `bluestep` marketplace, not a copy in this project's `.claude/` tree. Editing the installed plugin files does not reach the canonical repo and is overwritten on the next `/plugin marketplace update`. This skill routes feedback to **`github.com/Bluestep-Systems/bspecs`** as a prefilled GitHub issue, so a fix can land there and ship to every project on the next plugin update.

It needs **no token and no backend**: the repo is public, the issue form is prefilled via a deep link, and GitHub authenticates the user through their existing browser session.

**Scope check first.** This skill is for the **bluestep-tools plugin** (a skill is wrong, a hook misfires, a `bluestep-reference` file is misleading, a shipped `CLAUDE.md` rule is stale, a missing capability), or for a B6P rule general enough to belong in **every** project. For project-local B6P domain knowledge that only matters here, capture it locally instead (see the Self-improvement section of this project's `CLAUDE.md`).

## Steps

### 1. Draft from context — don't cold-quiz

The skill usually runs right after you and the user discussed the thing to change, so the relevant detail is already in the conversation. Draft the submission from it:

- **kind(s)** — one or more of: `add rule`, `change rule`, `remove rule`, `report error/bug`, `request capability`, `report friction`. Multi-valued — a misleading rule is often `report error/bug` **and** `change rule`.
- **target(s)** — one or more artifacts the feedback hits: instruction / skill / subagent / hook / settings-permission / spec template / module template / `CLAUDE.md` / CLI.
- **file_path**, **current_text**, **proposal** — see step 2.

Only when there is nothing to infer from (e.g. the user just types `/bspecs-feedback "the STOP messages are annoying"`) do you ask directly for kind(s) and target(s) and a one-line description.

### 2. Capture context conditioned on kind

The kind set drives what you collect (pull from the conversation first; read the tree to fill gaps):

- **change rule / remove rule** → the affected **file path** + the **current rule text quoted verbatim**. Read it from wherever the artifact actually lives: a plugin file under `${CLAUDE_PLUGIN_ROOT}/` (`skills/`, `agents/`, `hooks/`, or `skills/bluestep-reference/` for a platform rule), or this project's own `CLAUDE.md` for a project rule. In the issue, quote the plugin-relative path (e.g. `skills/b6p-push/SKILL.md`), not the absolute `${CLAUDE_PLUGIN_ROOT}` path. Keep the excerpt focused — do not paste a whole file.
- **report error/bug** → a repro: what was run, what happened, what was expected.
- **request capability** → the use case: what the user is trying to do that no skill/hook/CLI feature supports.
- **add rule** → where the guidance should live + the proposed text.
- **report friction** → what is painful and why (no fix required).

Always capture the **plugin version** — `Read` `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` and take its `version` field. Use the Read tool, not a shelled-out runtime (step 4 assumes no `node`/`npm` is present). Fall back to `unknown` if the manifest is missing or unreadable; never block on it.

### 3. Confirm with the user

Show the drafted submission — kind(s), target(s), file path, and the proposal/rationale — and ask:

> File this to the bspecs repo?

Adjust whatever the user corrects. Do **not** file without explicit confirmation.

### 4. Build the prefilled issue link

Target the structured issue form (`feedback.yml`) and prefill its fields by `id`, applying the `feedback` label. **Build the URL yourself** — percent-encode each field value (space → `%20`, newline → `%0A`, and `&`/`#`/`=`/`+` in values) and assemble the query string. Do **not** shell out to `node` or assume any runtime is present — this skill must work anywhere the plugin is enabled (there is no npm/node guarantee).

- Base: `https://github.com/Bluestep-Systems/bspecs/issues/new`
- Query params, each value percent-encoded: `template=feedback.yml`, `labels=feedback`, `title=…`, `file_path=…`, `current_text=…`, `proposal=…`, `version=…`.

Multi-line `current_text` / `proposal` are fine — encode newlines as `%0A`.

**Kind/target safety net.** The form's `kind` and `target` are multi-select dropdowns, and GitHub's query-param prefill for multi-selects is unreliable — and we use a **single `feedback` label** (no `kind:*` labels), so kind cannot ride the `labels=` param either. Therefore **embed kind(s) and target(s) as text** so the signal never gets lost:

- Put a short kind summary in the **title**, e.g. `[feedback] change rule: b6p-push auth preflight wording`.
- Lead the **proposal** field with a `Kind: … · Target: …` line, then the rationale/repro/use-case.

`current_text`, `proposal`, `title`, `file_path`, `version` prefill reliably (the textareas have no `render:` attribute, which is required for query-param prefill). The dropdowns are best-effort on top.

### 5. Open it, and always print the URL

Open with the platform opener, falling back across environments, then echo the URL regardless:

```
url="<assembled url>"
( command -v wslview >/dev/null 2>&1 && wslview "$url" ) \
  || ( command -v xdg-open >/dev/null 2>&1 && xdg-open "$url" ) \
  || ( command -v open >/dev/null 2>&1 && open "$url" ) \
  || true
echo "$url"
```

If auto-open fails (headless, no opener), the printed URL is the fallback — the user clicks it. The user reviews the prefilled form in their browser and submits; GitHub handles auth. The form applies the `feedback` label on submit even if the `labels=` param is dropped.

## What this skill must NOT do

- **No token, no backend, no server call.** The only network action is the user's browser opening a public GitHub URL.
- **No local file fallback** (no `.jsonl`, no scratch capture as the "real" record). A project using this tooling is never meaningfully offline (the platform and marketplace need connectivity), and a local file never reaches the repo. The sole fallback for a failed auto-open is printing the URL.
- **Do not edit the installed plugin files to "fix" the rule.** They are a read-only shared install, overwritten on the next `/plugin marketplace update`; the fix must land in the repo via the issue.
- **Do not create `kind:*` labels** or pass them on `labels=` — only the `feedback` label exists; kind travels as text.
- **Do not file without the user's confirmation** (step 3).
