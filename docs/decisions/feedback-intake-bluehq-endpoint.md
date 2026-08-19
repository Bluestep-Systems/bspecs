# ADR: Feedback intake moves to a public BlueHQ endpoint the agent POSTs to

**Status:** Accepted (2026-07-22). Supersedes [`bspecs-feedback-mechanism.md`](bspecs-feedback-mechanism.md). **Amended** by [`feedback-reporter-email.md`](feedback-reporter-email.md) (2026-07-23): reporter identity is now **required**, not optional — the same endpoint gained a `?hook=close` door that emails the reporter when their item is closed, so anonymous filing ended. **Further amended 2026-08-19** — the pipeline gained an unattended per-intake triage stage (see the **2026-08-19 unattended-triage addendum** at the end).

**Date:** 2026-07-22

**Relates to:** [`bspecs-feedback-mechanism.md`](bspecs-feedback-mechanism.md) (the superseded founding decision), [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) (the category-level rule this ADR is written to), [`platform-mcp-integration.md`](platform-mcp-integration.md) (the gateway-MCP option weighed and deferred here).

## Context

The founding feedback ADR ([`bspecs-feedback-mechanism.md`](bspecs-feedback-mechanism.md), 2026-06-26) built `/bspecs-feedback` as a **prefilled GitHub-issue deep link** against the public `Bluestep-Systems/bspecs` repo. Its whole no-token/no-backend design rested on one premise:

> *"the typical BlueStep dev is authenticated to GitHub in their browser."*

**That premise is false for the real submitters.** Many of the people building components with the plugin have **no GitHub account at all** (and are not members of the ClickUp space either). The deep link opens for them, but they hit a wall at GitHub's **Submit** button — filing an issue requires a logged-in GitHub account — and the feedback is silently lost.

A secondary pain compounds it: even for account-holders, the skill generated a **very long prefilled URL** and required a **browser round-trip** (click → open browser → review → submit). That friction is the opposite of the one-line, in-session confirmation the flow was meant to feel like.

Because the transport is being replaced anyway, this ADR also folds in the structured-failure-metadata ask of **issue #25** ("bspecs-feedback should capture structured failure metadata for AI-built components", ClickUp task `86baw0p08`). #25 wanted feedback grouped and trended by filterable axes (what was being built, what failed, how badly, was the AI confident). This ADR decides *where* those axes live.

## Decision

**Feedback intake moves to a public endpoint on BlueHQ (`bluehq.bluestep.net`) that the `/bspecs-feedback` skill POSTs a JSON body to — fully automated, no browser, no click.** The submitter needs **no account of any kind**; they never leave Claude Code.

- **No secret ships in the plugin.** The endpoint reads a ClickUp API token plus GitHub App credentials from a **single-entry form on the top-level office** on BlueHQ, server-side at runtime. The plugin holds only the (non-secret) intake URL.
- **The endpoint creates a ClickUp task on AI.List (`901414350506`)** as the system of record. The structured #25 axes become **ClickUp custom fields** (the filterable surface / #25's dashboard): `severity` maps to native **priority**, `stage`/lifecycle to native **status**, and `component`/`failure`/`ai` to dropdown/label custom fields. Options are pre-created once during setup; the endpoint sets from existing options, it does not mint them at runtime.
- **The GitHub issue is retained but derived, not the entry point.** The same endpoint generates a GitHub issue on the routed repo (`bspecs` / `b6p-cli` / `web`) via the **GitHub App**, then links the two (issue URL commented back on the task). This inverts the old pipeline: feedback is *born* in ClickUp (no account needed), and the issue is the downstream artifact.
- **Routing labels are agent-supplied and validated server-side against a fixed allow-list.** Claude has the richest session context, so it proposes `routing.repo` + `routing.labels`; the endpoint drops anything off the allow-list (default `bspecs` + `status:triage` on a miss). There is **no external LLM key on the endpoint**.
- **Reporter identity is captured optionally** — auto-filled from `git config user.name` / `user.email`, shown and editable at the confirm gate, skippable for anonymous filing — restoring the "who reported this" a GitHub account used to supply. *(**Amended 2026-07-23:** the reporter email is now **required** — editable, never skippable — because closure notifications are emailed to it; anonymous filing ended. See [`feedback-reporter-email.md`](feedback-reporter-email.md).)*
- **No per-axis GitHub labels are minted.** #25's filterable axes live as ClickUp custom fields; the generated GitHub issue carries a single `feedback` label plus a body text-line for the axes. Filtering lives in ClickUp, so label maintenance across the three repos stays near-zero and the GitHub App needs only `issues: write`.

The transport change was a maintainer decision, driven by the account-wall failure and the long-prefill-URL / browser round-trip friction.

## Options considered

### A. Public intake endpoint on BlueHQ (chosen)

Fully automated — the agent POSTs; no submitter account of any kind, no browser, no click. **No secret is shipped** (tokens live only in the top-level-office form, read server-side). It **dogfoods the platform** (the intake is a BlueStep endpoint component, exactly what the platform is for) and keeps a **single credential holder**. Cost: it is a public open-write endpoint, so it needs spam guards, and it depends on an org admin provisioning a GitHub App (see Consequences). Chosen because it is the only option that clears the account wall *and* removes the browser round-trip while shipping no secret.

### B. ClickUp public form the submitter fills in a browser — rejected as the front door

A ClickUp public form needs no ClickUp account and supports URL-query prefill, so it clears the account wall. Rejected as the front door because it **still needs a click + browser round-trip and a long prefill URL** — the same friction that helped push us off the GitHub link — and it **cannot be reliably auto-submitted** (ClickUp forms may enforce reCAPTCHA and the submit endpoint is undocumented; bypassing a captcha is off-limits). ClickUp remains the *destination* (the task), just not the submitter-facing door.

### C. Gateway-MCP submit tool / relay — rejected / deferred

Route feedback through a submit tool on the bundled gateway MCP. Rejected/deferred because it depends on **each user having a working `b6pt_` token**, which is not universal (the token is separate from the plugin and not everyone has set one), and it is a heavier path than a single POST. Kept in reserve rather than built.

### D. Keep the prefilled GitHub-issue link (status quo) — rejected

This is the superseded design. Rejected because **the account wall is the entire problem**: submitters without a GitHub account cannot file, so keeping it fails the core goal.

**On the GitHub issue itself:** it is **retained**, but only as a **derived artifact** generated by the endpoint downstream of the ClickUp task — not as the entry point. Maintainers keep working fixes from the issue tracker without the submitter needing an account.

**On server-side triage:** a `B.ai` dedup / triage / title-normalization step on the endpoint (the one thing the in-session agent cannot do, since it cannot see other open tasks) is a natural fit but is **deferred to v2**. Routing stays agent-side for v1, where the session context is richest.

## Consequences

- **The three GitHub feedback pieces are retired.** `feedback-to-clickup.yml`, `feedback-triage.yml`, and the `feedback.yml` issue form are deleted — **feedback no longer touches GitHub Actions at all.** No dead workflow is left firing on a path that no longer exists.
- **A GitHub App is a hard prerequisite.** Cross-repo issue writes need a dedicated identity (the default Actions `GITHUB_TOKEN` cannot write issues cross-repo). A GitHub App scoped to `bspecs` + `b6p-cli` + `web` with `issues: write` must be **provisioned by an org admin** — a real blocker outside this repo, not to be assumed. (Fallback: a fine-grained PAT scoped to the three repos.)
- **The public open-write endpoint needs spam/abuse guards.** No shipped secret can gate a public plugin's caller, so the endpoint carries payload validation + size caps, rate-limiting, drop-on-malformed, and a downstream human triage gate (nothing is auto-accepted or auto-closed). All payload text is treated as data — routing/labels come only from the validated allow-list; the issue body is templated; nothing is executed. Bounded risk: the same exposure a public ClickUp form would have had.
- **The endpoint lives as a BlueStep component on BlueHQ — no committed in-repo copy.** Its source of truth is the platform component itself; the code is authored/edited via a **gitignored local working copy** (pulled with `b6p`, kept under `platform/U*/`, which `.gitignore` excludes) and shipped with `b6p push`. An earlier plan to keep a committed `platform/feedback-endpoint/` copy was dropped: the source references org-internal identifiers (the office named-query, form/field FIDs) that would need per-commit sanitizing, and the endpoint is internal infrastructure, not public plugin tooling — so it does not belong in the public tree. The plugin still ships only the (non-secret) intake URL.
- **Partial failure never loses feedback.** The ClickUp task is the system of record; if the GitHub step fails, the endpoint still returns the `taskUrl` plus an error note, and the skill surfaces it.
- **Two release mechanics.** The skill rewrite + version bump ship on a plugin version bump + `plugin-vX.Y.Z` tag; the workflow/form deletions and docs ship on merge to `main`. The platform setup lands first so the new path works before the old one is deleted.

## References

- [`bspecs-feedback-mechanism.md`](bspecs-feedback-mechanism.md) — the superseded founding ADR (2026-06-26).
- [`../bluehq-feedback-endpoint-setup.md`](../bluehq-feedback-endpoint-setup.md) — the one-time human setup checklist (GitHub App, ClickUp fields, token form, endpoint deploy).
- [`../../.claude/specs/feedback-clickup-form/`](../../.claude/specs/feedback-clickup-form/) — requirements, design, tasks for this change.
- GitHub issue **#25** — "bspecs-feedback should capture structured failure metadata for AI-built components" (folded in here).
- ClickUp task **`86baw0p08`** (AI.List) — tracking task for this spec.
- [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) — the category-level committed-content rule this ADR follows.

## 2026-08-19 unattended-triage addendum

**The intake pipeline gains an unattended per-intake triage stage.** Every intake already fires a GitHub event — the endpoint files the routed issue as `bspecs-feedback-intake[bot]`. A new workflow, [`.github/workflows/triage-intake.yml`](../../.github/workflows/triage-intake.yml), consumes that event: on `issues: opened` (plus a `workflow_dispatch(issue_number)` test path) it runs `anthropics/claude-code-action@v1` to triage that one item minutes after filing, so the `Open` inbox drains at intake time and the interactive `/bspecs-triage` pass shrinks to confirming proposals. The bot's whole procedure is defined **once**, in the "Unattended half (per-intake bot)" section of `.claude/skills/bspecs-triage/SKILL.md` — the workflow prompt is a pointer to it, never a copy, so the two halves cannot drift.

**Trigger and guard.** A job-level `if` requires the issue author to be `bspecs-feedback-intake[bot]`, so a drive-by public-repo issue is a zero-cost skip that never starts the agent; the dispatch path re-verifies the author in-run. `allowed_bots` names that single bot (the action blocks bot actors by default — one explicit entry, never `*`), the prompt is fixed in the workflow (the bot cannot control what Claude is asked to do), and a `concurrency` group queues overlapping intakes without cancelling mid-run.

**Reversible-only boundary — closes are permanently excluded.** The unattended stage may only comment and move lanes: post the `🤖 [intake-triage]`-prefixed triage comment, tag/assign MCP defects, and move `Open` → `up next` / `blocked/waiting` — comment first, status last, with the status transition as the commit point, so a failed run leaves the task in `Open` (the retry signal). It never sets `Closed`, never writes `resolution` / `resolution-note` / `reporter`, never merges duplicates, never applies wont-fix, never ships a fix. Closes stay behind the interactive gate **permanently, not just in v1**: this ADR's close hook emails reporters on every resolved close, so any unattended close is an outward-facing email no human reviewed. Workflow permissions are `contents: read` + `issues: write` only — no code writes, no PRs.

**The `automation` field.** A dropdown on AI.List records automation candidacy: *empty* = not assessed → `candidate` (bot, and only when the field is empty) → `approved` / `rejected` (human, during `/bspecs-triage`). `rejected` is kept, not cleared — `approved / (approved + rejected)` is the bot-precision calibration signal. A future PR-drafting workflow (separate spec) consumes `approved` only; nothing in this system acts on the field. Field and option UUIDs are resolved at runtime via `GET /list/{id}/field`.

**Accepted residual risk: prompt injection in intake bodies.** The bot needs Bash with network access for the ClickUp API, so what stands between an injected instruction ("close this as shipped") and a `curl` is the untrusted-body prompt rule — stated in both the workflow prompt and the SKILL.md section — not a sandbox. Defense in depth around that rule: only endpoint-authored issues reach the bot at all (the guard), the prompt is fixed, `--max-turns 60` bounds the blast radius (30 proved too small for a full pass in the live canary), `contents: read` makes code changes impossible, secrets are never exposed to fork contexts (no `pull_request_target`; `issues` events run in base context), and every action lands as an auditable prefixed comment. Accepted and recorded here.

**Operator setup (one-time, manual).** Two repo secrets on `Bluestep-Systems/bspecs` — `ANTHROPIC_API_KEY` and `CLICKUP_API_TOKEN` (the workflow exposes it to the run as `CLICKUP_TOKEN`, the name the skill and scripts read) — plus creating the `automation` dropdown (options `candidate` / `approved` / `rejected`) on AI.List in the ClickUp UI (the API cannot create fields). ClickUp comments appear as the token owner; the `🤖 [intake-triage]` prefix is the provenance.

**No `CHANGELOG.md` entry.** The changelog is plugin-versioned and this stage touches nothing under `plugin/` — no version bump, no release; the bot goes live on merge plus the secrets. This addendum is the record.
