---
name: bspecs-feedback
description: Send a bspecs tooling-change request (a rule, skill, subagent, hook, instruction, spec/module template, or the CLI) to the canonical bspecs repo as a prefilled GitHub issue. Use when you or the user notice something about the bspecs tooling itself that should change — local `.claude/` edits do not survive `bspecs sync`, so the fix has to go upstream.
---

# /bspecs-feedback — Send a tooling-change request upstream

This project's `.claude/` tree (skills, hooks, instructions, settings, this very file) is a **scaffolded copy** that `bspecs sync` overwrites. Editing it locally does not reach the canonical repo and does not survive the next sync. This skill routes feedback to **`github.com/Bluestep-Systems/bspecs`** as a prefilled GitHub issue, so a fix can land there and ship to every project.

It needs **no token and no backend**: the repo is public, the issue form is prefilled via a deep link, and GitHub authenticates the user through their existing browser session.

**Scope check first.** This skill is for the **bspecs tooling** (a skill is wrong, a hook misfires, an instruction template is misleading, a `CLAUDE.md` rule is stale, a missing capability), or for a B6P rule general enough to belong in **every** scaffolded project. For project-local B6P domain knowledge that only matters here, capture it locally instead (see the Self-improvement section of this project's `CLAUDE.md`).

## Steps

### 1. Draft from context — don't cold-quiz

The skill usually runs right after you and the user discussed the thing to change, so the relevant detail is already in the conversation. Draft the submission from it:

- **kind(s)** — one or more of: `add rule`, `change rule`, `remove rule`, `report error/bug`, `request capability`, `report friction`. Multi-valued — a misleading rule is often `report error/bug` **and** `change rule`.
- **target(s)** — one or more artifacts the feedback hits: instruction / skill / subagent / hook / settings-permission / spec template / module template / `CLAUDE.md` / CLI.
- **file_path**, **current_text**, **proposal** — see step 2.

Only when there is nothing to infer from (e.g. the user just types `/bspecs-feedback "the STOP messages are annoying"`) do you ask directly for kind(s) and target(s) and a one-line description.

### 2. Capture context conditioned on kind

The kind set drives what you collect (pull from the conversation first; read the tree to fill gaps):

- **change rule / remove rule** → the affected **file path** + the **current rule text quoted verbatim** (read it from the `.claude/` tree). Keep the excerpt focused — do not paste a whole file.
- **report error/bug** → a repro: what was run, what happened, what was expected.
- **request capability** → the use case: what the user is trying to do that no skill/hook/CLI feature supports.
- **add rule** → where the guidance should live + the proposed text.
- **report friction** → what is painful and why (no fix required).

Always capture the **bspecs version** — read `bspecs_version` from `.claude/bspecs.lock`:

```
node -e "try{const fs=require('fs');process.stdout.write(JSON.parse(fs.readFileSync('.claude/bspecs.lock','utf8')).bspecs_version||'unknown')}catch(e){process.stdout.write('unknown')}"
```

(Read + `JSON.parse` explicitly — `require('./.claude/bspecs.lock')` does **not** work, because Node's `require` only resolves `.js`/`.json`/`.node`, not a `.lock` extension.)

Fall back to `unknown` if the lock is missing; never block on it.

### 3. Confirm with the user

Show the drafted submission — kind(s), target(s), file path, and the proposal/rationale — and ask:

> File this to the bspecs repo?

Adjust whatever the user corrects. Do **not** file without explicit confirmation.

### 4. Build the prefilled issue link

Target the structured issue form (`feedback.yml`) and prefill its fields by `id`, applying the `feedback` label. Assemble and URL-encode with node's `URLSearchParams` (node is guaranteed present — it backs `npx b6p`):

```
node -e '
const fs=require("fs");
const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));   // {title, file_path, current_text, proposal, version}
const p=new URLSearchParams({template:"feedback.yml", labels:"feedback", ...f});
process.stdout.write("https://github.com/Bluestep-Systems/bspecs/issues/new?"+p.toString());
' /path/to/fields.json
```

Write the field values to a temp JSON file first (in the scratchpad) so multi-line `current_text` / `proposal` survive without shell-quoting pitfalls.

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
- **No local file fallback** (no `.jsonl`, no scratch capture as the "real" record). A scaffolded project is never meaningfully offline (the platform needs connectivity), and a local file never reaches the repo. The sole fallback for a failed auto-open is printing the URL.
- **Do not edit the local `.claude/` tree to "fix" the rule.** `bspecs sync` overwrites it; the fix must land in the repo via the issue.
- **Do not create `kind:*` labels** or pass them on `labels=` — only the `feedback` label exists; kind travels as text.
- **Do not file without the user's confirmation** (step 3).
