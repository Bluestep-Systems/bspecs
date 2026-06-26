# Requirements — bspecs-feedback skill

**Status:** Drafting

## Context

End users working in a *scaffolded* project frequently notice that a bspecs rule, skill, hook, or instruction should change — but their `.claude/` tree is a scaffolded **copy** that `bspecs sync` overwrites, so editing it locally doesn't reach the canonical repo and doesn't survive. There is no in-session path to route that observation back to `github.com/Bluestep-Systems/bspecs`, so feedback is lost or never filed.

Source: [`TODO.md`](TODO.md) "Flow improvements → `/bspecs-feedback` skill". The TODO entry already settled the mechanism (prefilled GitHub issue links — no backend, no token, repo is public) and rejected the alternatives (baked-in token; server-side webhook endpoint). This spec implements that decision.

## Goals

- As an **end user mid-session in a scaffolded project**, I want to capture "this bspecs rule/skill/instruction should change" without derailing my current work, so the feedback reaches the canonical bspecs repo where a fix can actually land and survive `bspecs sync`.
- As a **bspecs maintainer**, I want submissions to arrive structured (kind, target, current rule text, rationale, version) so triage is fast and the *kind* maps to issue labels.

## Acceptance criteria

- [ ] A `bspecs-feedback` skill ships in the template tree (`templates/claude/skills/bspecs-feedback/SKILL.md`) and is therefore picked up automatically by `bspecs sync` (no hardcoded list to edit).
- [ ] Invoking the skill gathers session context for the feedback: **kind(s)**, **target(s)**, the affected file path + current rule text (when applicable), the proposed change/rationale, and the bspecs version.
- [ ] **Kind is multi-valued** — a submission may carry several of the 6 kinds at once (add rule, change rule, remove rule, report error/bug, request capability, report friction). Kind drives issue labels.
- [ ] **Target is multi-valued** — a submission may span several artifacts (instruction / skill / subagent / hook / settings-permission / spec template / module template / `CLAUDE.md` / the CLI). Target is a captured field, not a label.
- [ ] The *kind* set determines what context the skill auto-captures: change/remove → current rule text + file path; bug → repro; capability → use case.
- [ ] The skill builds a prefilled GitHub issue deep link (`…/issues/new?labels=feedback&title=…&body=…`, URL-encoded) against the public repo and auto-opens it (`xdg-open` / `wslview` / `open`), printing the URL as a fallback if opening fails (the only failure path — the user clicks the printed link).
- [ ] A structured GitHub issue form exists at `.github/ISSUE_TEMPLATE/feedback.yml` in the **bspecs repo** so prefilled submissions land in the right shape.
- [ ] The skill never requires a token, a `gh`-authenticated CLI, or any backend — auth is handled by the user's existing browser session at GitHub.

## Out of scope

- Any server-side endpoint or B6P webhook that files issues (explicitly rejected in the TODO).
- Embedding a GitHub token in the scaffold (rejected — bspecs ships to public npm and templates are public, so any baked-in secret is fully public).
- A `question / clarification` kind (considered and dropped).
- Automatically applying the proposed change to the local `.claude/` tree (it would be overwritten by `bspecs sync` anyway).
- Constraining kind or target to a single value.
- Any local `.jsonl` / file-based fallback. A scaffolded project only does useful work against the live platform (`b6p` needs connectivity), so "offline" is not a real state; and a local file never reaches the canonical repo, so it fails the core goal rather than supporting it. The sole failure path — auto-open fails — is covered by printing the prefilled URL.

## Open questions

- Does the `feedback.yml` issue form belong only in the bspecs repo, or should a copy also be scaffolded into consumer projects? (Leaning: repo-only — consumers file *into* bspecs, they don't host their own issues.)
