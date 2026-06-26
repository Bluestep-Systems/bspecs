# ADR: How `/bspecs-feedback` routes tooling-change requests upstream

**Status:** Accepted (2026-06-26).

**Date:** 2026-06-26

## Context

A scaffolded project's `.claude/` tree (skills, hooks, instructions, settings, `CLAUDE.md`) is a **copy** that `bspecs sync` overwrites. When an end user — mid-session in a scaffolded project — notices that a bspecs rule, skill, hook, or instruction is wrong, missing, or painful, editing the local copy does not reach the canonical repo (`github.com/Bluestep-Systems/bspecs`) and does not survive the next sync. There was no in-session path to route that observation back to where a fix can actually land and ship to every project.

We wanted a capture-and-route step that: (a) needs **no backend and no secret** to maintain; (b) lets the user review before anything is filed; (c) lands submissions **structured** enough for fast triage; and (d) works for the typical BlueStep dev, who is authenticated to GitHub **in their browser** but usually does **not** have a configured `gh` CLI.

The reasoning originated in [`TODO.md`](../../TODO.md) ("Flow improvements → `/bspecs-feedback` skill"); this ADR memorializes the decision and the rejected alternatives. Implemented in the [`bspecs-feedback` spec](../../.claude/specs/bspecs-feedback/).

## Decision

**Build the feedback path as a prefilled GitHub issue deep link against the public repo, with a structured issue form — no token, no backend.**

- The `/bspecs-feedback` skill gathers session context (kind(s), target(s), affected file + current rule text, proposed change/rationale, bspecs version from `.claude/bspecs.lock`), then builds a `…/issues/new?template=feedback.yml&labels=feedback&…` deep link (URL-encoded via node's `URLSearchParams`) and auto-opens it (`wslview`/`xdg-open`/`open`), always printing the URL as the fallback.
- A structured issue form at [`.github/ISSUE_TEMPLATE/feedback.yml`](../../.github/ISSUE_TEMPLATE/feedback.yml) gives submissions a consistent shape.
- The repo is **public**, so the deep link needs no auth of its own — GitHub authenticates the user through their existing browser session, and the user gets a final review before filing.

## Options considered

### A. Prefilled public GitHub issue link (chosen)

No secret ships, no service runs. Browser-session auth is the most common case for devs. The user reviews before filing. The form keeps it structured. Only cost: GitHub's query-param prefill is limited for multi-select dropdowns and bounded URL length (see Consequences).

### B. Bake a GitHub token into the scaffold — rejected

bspecs ships to **public npm** and the templates live in a **public repo**, so any baked-in secret is fully public the moment it ships. A token that can file issues could be scraped and abused. Non-starter.

### C. A B6P webhook endpoint that files issues server-side — rejected

Technically works, but means **building and maintaining an endpoint** and **storing a token** server-side — exactly the backend the public-repo prefilled-link approach makes unnecessary. Cost without benefit.

### D. A local file fallback (`.jsonl`) — rejected

A scaffolded project only does useful work against the live platform (`b6p` needs connectivity), so "offline" is not a real state; and a local file never reaches the canonical repo, so it fails the core goal rather than supporting it. The sole failure path — auto-open fails — is covered by printing the prefilled URL. (See the `bspecs-feedback` requirements "Out of scope".)

### E. File via the `gh` CLI — rejected as the primary path

Most BlueStep devs are authenticated to GitHub in the browser but do **not** have a configured `gh` CLI, so a `gh`-based flow would fail for the common user. The browser deep link reaches everyone.

## Consequences

- **Single `feedback` label.** Kind is *not* carried as `kind:*` labels (GitHub silently drops unknown labels, and minting six labels is needless). The label must pre-exist in the repo — created once via `gh label create feedback …`.
- **Kind/target travel as text.** Because multi-select dropdown prefill via query param is unreliable, the skill embeds kind(s)/target(s) in the issue **title** and the `proposal` body (which prefill reliably) as the safety net; the form dropdowns are best-effort on top.
- **URL length.** GitHub truncates very long prefilled bodies (~8 KB); the skill keeps `current_text` excerpts focused rather than pasting whole files.
- **Form textareas carry no `render:` attribute** — required for query-param prefill to populate them.

## References

- [`TODO.md`](../../TODO.md) — original reasoning and rejected-alternatives list.
- [`.claude/specs/bspecs-feedback/`](../../.claude/specs/bspecs-feedback/) — requirements, design, tasks.
- [`install-friction-and-registry.md`](install-friction-and-registry.md) — the public-npm / no-token posture this builds on.
- [`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md) — the sync model that makes local `.claude/` edits non-durable.
