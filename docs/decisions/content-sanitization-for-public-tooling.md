# ADR: Customer-derived working-memory does not belong in publicly distributed tooling

**Status:** Accepted

**Date:** 2026-06-30

## Context

bspecs's scaffolded tooling — especially the on-demand instruction tree (now the `bluestep-reference`
plugin skill) — was authored by harvesting lessons from real customer engagements. The content is
publicly distributed three ways: the public GitHub repo, the public npm package (`templates/` shipped
in the tarball), and, as of [`plugin-distribution.md`](plugin-distribution.md), a public plugin
marketplace.

A pre-publication sensitivity audit (during the `plugin-distribution` spec, Phase 0) found the
instruction tree carried **customer-derived working-memory** mixed into otherwise-generic engineering
guidance. By **category** (deliberately not enumerated with literal values here — see the re-leak
guard):

- customer organization identifiers (subdomains) and internal file/script IDs used as "confirmed
  working on …" provenance tails;
- an internal product name and its confidential go-to-market / branding strategy;
- an employee's name;
- regulated-industry domain context — sector-specific record types, field names, and workflows that
  identify the nature of the customers;
- confidential business metrics (revenue / margin / satisfaction figures and an internal
  sales-pipeline dashboard).

No credentials or secrets were present. Crucially, the *technical* lesson each file teaches
(BsJs/RelateScript patterns, platform gotchas) is **generic and worth keeping** — only the provenance
and business context wrapped around it leaks.

## Decision

1. **Customer-derived working-memory must not ship in publicly distributed tooling.** Tooling content
   is generic platform-development knowledge. Provenance ("confirmed on `<org>/<id>`"), client-/
   employee-identifying detail, internal product strategy, domain-identifying terminology, and
   business metrics are stripped; the generic technique stays.

2. **Audit-before-publish is a gate.** Before publishing — or widening distribution of — tooling
   content, run a sensitivity audit (a maintained grep token set of known identifiers plus judgment
   on domain/business framing) and sanitize: remove pure-IP files, redact provenance/business framing
   in place, keep the generic technique. This gate ran as Phase 0 of `plugin-distribution` and blocks
   the marketplace going live.

3. **Re-leak guard.** The audit's purpose is defeated if its outputs re-publish what it removes.
   Therefore **every committed artifact — this ADR, the spec, commit messages, instruction files —
   describes removed content by category and rationale only, never by quoting the literal customer
   names, employee name, file IDs, domain terms, or business figures.** The literal identifiers live
   only in **gitignored** work files (`.claude/specs/**/*.local.md`), used to drive the redaction grep
   and then deleted.

4. **Authoring guidance going forward.** When capturing a platform lesson, write the *generic* rule.
   Do not paste the originating component's org/ID, the client's domain specifics, or "X asked for
   this" attribution into shared instruction content.

## Consequences

- The instruction tree keeps its engineering value while shedding customer-identifying provenance;
  this is now a standing content policy, not a one-off cleanup.
- **The exposure is closed only in the working tree, not in git history.** The pre-sanitization
  content remains reachable in prior commits of the public repo (and in already-published npm
  tarballs). A history purge (e.g. `git filter-repo`) and npm version handling is a **separate,
  tracked follow-up** — out of scope here, but a real residual risk to act on.
- The maintained token-grep set is the practical tool for both the gate and any future re-audit.

## References

- Spec: `.claude/specs/plugin-distribution/` (Phase 0 — content sanitization)
- Companion ADR: [`plugin-distribution.md`](plugin-distribution.md)
- The sanitization landed in a dedicated, category-safe commit (`chore(security): sanitize
  customer-derived content from public instruction tree`).
- Literal token set + per-file disposition: the gitignored `sanitization-tokens.local.md` work file
  (never committed).
