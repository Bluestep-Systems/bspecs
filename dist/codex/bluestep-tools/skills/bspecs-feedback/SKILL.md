---
name: bspecs-feedback
description: Send a bspecs tooling-change request (a rule, skill, subagent, hook, reference file, spec/module template, or a shipped AGENTS.md rule) upstream to the team's tracker. Use when you or the user notice something about the bluestep-tools plugin itself that should change — the plugin is a read-only shared install, so a lasting fix has to land upstream in the repo.
---

# /bspecs-feedback — Send a tooling-change request upstream

Use this to send a change to the `bluestep-tools` plugin upstream. The installed plugin files are read-only, so editing them doesn't reach the canonical repo — a lasting fix has to land there. The skill POSTs the feedback to the **BlueHQ intake endpoint**, which files a ClickUp task and a GitHub issue on the right repo (`bspecs` / `b6p-cli` / `web`) and returns their links. No GitHub/ClickUp account needed.

The skill POSTs to this endpoint (a concrete, live URL — not a placeholder). Assign it to a shell variable so the `curl` step below can reference `$FEEDBACK_ENDPOINT_URL`:

```bash
FEEDBACK_ENDPOINT_URL="https://bluehq.bluestep.net/b/bspecs-feedback"
```

**Scope check first.** This skill is for the **bluestep-tools plugin** (a skill is wrong, a hook misfires, a `bluestep-reference` file is misleading, a shipped `AGENTS.md` rule is stale, a missing capability), or for a B6P rule general enough to belong in **every** project. For project-local B6P domain knowledge that only matters here, capture it locally instead (see the Self-improvement section of this project's `AGENTS.md`).

## Steps

### 1. Draft from context — don't cold-quiz

The skill usually runs right after you and the user discussed the thing to change, so the relevant detail is already in the conversation. Draft the submission from it — the free-text account, the taxonomy, **and** the routing:

- **kind(s)** — one or more of: `add rule`, `change rule`, `remove rule`, `report error/bug`, `request capability`, `report friction`. Multi-valued — a misleading rule is often `report error/bug` **and** `change rule`.
- **target(s)** — one or more artifacts the feedback hits: instruction / skill / subagent / hook / settings-permission / spec template / module template / `AGENTS.md / CLAUDE.md` / CLI.
- **file_path**, **current_text**, **description** (the submitter's authoritative account + the proposal/rationale) — see step 2.
- **routing** — infer from context:
  - **repo** — which repo the fix lands in: `bspecs` (the plugin, skills, hooks, reference), `b6p-cli` (the `b6p` component-sync CLI), or `web`. Default `bspecs` when unsure.
  - **labels** — triage hints as a short list. The endpoint keeps any label that begins with one of four allowed **prefixes** — `type:`, `area:`, `priority:`, `status:` — dropping the rest and defaulting to `status:triage` when none survive; the text after the prefix is free-form (not checked against a value list). Surviving labels surface only as a text-line on the generated GitHub issue, never as GitHub labels or ClickUp fields. Typical hints: `type:rule` / `type:bug` / `type:capability`, `area:plugin-skill` / `area:hook` / `area:reference`, `priority:p1` / `priority:p2`. Best-effort — fine to leave thin. (Full contract: the "Routing allow-list" reference in `docs/bluehq-feedback-endpoint-setup.md`.)

Only when there is nothing to infer from (e.g. the user just types `/bspecs-feedback "the STOP messages are annoying"`) do you ask directly for kind(s), target(s), and a one-line description.

### 2. Capture context conditioned on kind

The kind set drives what you collect (pull from the conversation first; read the tree to fill gaps):

- **change rule / remove rule** → the affected **file path** + the **current rule text quoted verbatim** (`currentText`). Read it from wherever the artifact actually lives: a plugin file under `../../` (relative to this file) (`skills/`, `agents/`, `hooks/`, or `skills/bluestep-reference/` for a platform rule), or this project's own `AGENTS.md` for a project rule. In the payload, quote the plugin-relative path (e.g. `skills/b6p-push/SKILL.md`), not the absolute plugin-root path. Keep the excerpt focused — do not paste a whole file.
- **report error/bug** → a repro: what was run, what happened, what was expected.
- **request capability** → the use case: what the user is trying to do that no skill/hook/CLI feature supports.
- **add rule** → where the guidance should live + the proposed text.
- **report friction** → what is painful and why (no fix required).

Fold the proposal/rationale/repro/use-case into the **`description`** field (the submitter's authoritative words). `filePath` and `currentText` are separate structured fields.

Always capture the **plugin version** — `Read` `../../.codex-plugin/plugin.json` and take its `version` field. Use the Read tool, not a shelled-out runtime (the POST step assumes only a shell is present). Fall back to `unknown` if the manifest is missing or unreadable; never block on it.

Always capture the **runtime environment** — you know which tool you are running in (a Claude Code session knows it's Claude Code; a Cursor agent knows it's Cursor; a Codex agent knows it's Codex). State it as one short string: the tool, the tool version when known, and the surface (desktop app / CLI / IDE extension) — e.g. `Claude Code (desktop app)`, `Cursor 2.4 (IDE)`, `Codex (ChatGPT desktop app)`. Ask the user only if genuinely unsure; fall back to `unknown` rather than blocking. Older endpoint deployments ignore this key, so sending it is always safe.

### 3. Conditional AI-failure questionnaire

**Only** when the feedback is "**the AI built a component wrong or incomplete**" (an AI-output failure) do you capture the four structured axes. Draft each from the conversation and ask **only** what cannot be inferred:

Use **exactly these values** — they are the tracker's field options; the endpoint maps them to ClickUp fields and **silently drops anything off-list**, so do not invent new ones:

- **component** — what was being built (one of): `form`, `merge-report`, `formula`, `endpoint`, `scheduled`, `query`, `permissions`.
- **modes** — how it failed, multi-valued (any of): `missing-fields`, `wrong-logic`, `permissions`, `structure`, `incomplete`, `wrong-tool`, `hallucination`.
- **severity** — one of: `blocking` / `major` / `minor` / `cosmetic` (the endpoint maps this to the ClickUp priority).
- **ai** — the AI's confidence vs. correctness (one of): `confident-wrong` (produced the broken output with no warning) or `flagged-uncertainty` (warned it was unsure).

**Skip this entirely** for rule-wording, capability, or friction feedback — those four axes must stay **absent** from the payload (do not send an empty `failure` object).

### 4. Capture reporter identity

Read the reporter's name and email from git config so the tracker records who filed it (restoring what a GitHub account used to supply):

```
git config user.name
git config user.email
```

Carry these into the confirm step. Do **not** add a separate prompt unless git config is empty. The reporter **email is required** — when the item is eventually closed, an automated notification (what happened: shipped / won't fix / duplicate / …) is emailed to this address, so there is no anonymous filing. If `git config user.email` is empty, ask the user for an email address; do not POST without one. The endpoint rejects payloads with a missing or implausible email.

### 5. Confirm with the user

Show the drafted submission — kind(s), target(s), file path, description/proposal, the routing (repo + labels), the runtime environment, the failure axes **if** the questionnaire fired, and the **reporter line** — then ask:

> File this to the bspecs tracker?

The reporter line is **editable but not skippable**: the user may correct the name/email, but the email must be present (it receives the automated close-out notification). Adjust whatever the user corrects. Do **not** file without explicit confirmation.

### 6. POST to the BlueHQ endpoint

Send one JSON body to `$FEEDBACK_ENDPOINT_URL` (the live intake URL assigned at the top of this file) via `curl`. No browser, no runtime assumption beyond a shell.

Payload shape (include `failure` **only** for AI-output-failure feedback; `reporter` with a valid `email` is **required** — the endpoint rejects the POST without it):

```jsonc
{
  "kind": ["change rule"],            // taxonomy, multi
  "target": ["skill"],                // taxonomy, multi
  "description": "…submitter's authoritative account + proposal…",
  "filePath": "skills/b6p-push/SKILL.md",
  "currentText": "…verbatim excerpt…",
  "pluginVersion": "X.Y.Z",           // from plugin.json; "unknown" if unreadable
  "environment": "Cursor 2.4 (IDE)",  // runtime tool + version + surface; "unknown" if unsure
  "reporter": { "name": "Jane Dev", "email": "jane@example.com" },  // REQUIRED (email) — receives the close-out notification
  "routing": { "repo": "bspecs", "labels": ["type:rule", "area:plugin-skill", "priority:p2"] },
  "failure": {                         // present ONLY for AI-output-failure feedback
    "component": "form",
    "modes": ["missing-fields", "wrong-logic"],
    "severity": "major",
    "ai": "confident-wrong"
  }
}
```

Build the body as a here-doc (or a `--data-binary @-` pipe) and POST it:

```bash
curl -sS -X POST "$FEEDBACK_ENDPOINT_URL" \
  -H "Content-Type: application/json" \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  --data-binary @- <<'JSON'
{ …assembled payload… }
JSON
```

The `-w '\nHTTP_STATUS:%{http_code}\n'` flag appends the status code on its own trailing line after the response body, so a single call yields both — split the last `HTTP_STATUS:` line off to read the code and treat the rest as the body. A 2xx is success; anything else is a failure (see step 7). On success the endpoint returns `{ "taskUrl": "...", "issueUrl": "..." }`.

### 7. Show the returned links

Print the **ClickUp task URL** and the **GitHub issue URL** the endpoint returned, so the user can follow the report.

- On **success**, print both links.
- On **partial failure** — the endpoint returns a `taskUrl` but no `issueUrl` (the task was saved but the GitHub issue step failed), or returns an error — report **exactly** what happened: which artifact was created, which was not, and the error text. The task is the system of record, so feedback is not lost even if the issue step failed.
- On **total failure** (no response, non-2xx, unreachable endpoint) — say the intake was unreachable and offer to retry; do **not** claim the feedback was filed.

Never claim a success the endpoint did not confirm.

## What this skill must NOT do

- **Single path: always the endpoint.** Do **not** create the ClickUp task directly — e.g. via a ClickUp MCP — even if such a connection is present, and do **not** fall back to it if the endpoint is down (a direct create would skip the GitHub issue and isn't the supported path). On failure, report the error and let the user retry.
- **Do not edit the installed plugin files to "fix" the rule** — they're read-only; the fix lands in the repo via the tracker.
- **Do not file without the user's confirmation** (step 5).
