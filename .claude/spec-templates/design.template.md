# Design — [Feature Name]

**Status:** Drafting | Approved | Superseded

## Files / areas affected

Which parts of the repo this touches.

- `plugins/<name>/**` — skills, agents, hooks, reference files: what changes
- `tools/gen-cross-tool/**` / `.github/workflows/*` — what changes
- docs / ADRs / repo-local `.claude/` skills — what changes

## Approach

High-level summary of how this will be implemented. Reference existing patterns and conventions from `CLAUDE.md`.

## Data / control flow

How the change behaves end to end. For plugin changes, what each surface (Claude Code, Cursor, Codex) gets after `npm run gen`.

## Edge cases

- ...

## Alignment with existing patterns

Which conventions from `CLAUDE.md` are being applied. If a new pattern is introduced, justify it — and consider whether it warrants an ADR in `docs/decisions/`.

## Risks

What could go wrong; how it's verified given there is no test suite (`npm run gen` + `gen:check`, `npm run test:hooks`, installing the plugin into a scratch project, etc.).
