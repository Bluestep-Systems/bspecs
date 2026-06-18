# Design — [Feature Name]

**Status:** Drafting | Approved | Superseded

## Files / areas affected

Which parts of the repo this touches.

- `cli.js` / `src/*` — what changes
- `templates/*` — what changes (remember `.template` files strip the extension on copy)
- skills / instructions / docs — what changes

## Approach

High-level summary of how this will be implemented. Reference existing patterns and conventions from `CLAUDE.md`.

## Data / control flow

How the change behaves end to end. For scaffold logic, which template trees are copied and which variables are substituted.

## Edge cases

- ...

## Alignment with existing patterns

Which conventions from `CLAUDE.md` are being applied. If a new pattern is introduced, justify it — and consider whether it warrants an ADR in `docs/decisions/`.

## Risks

What could go wrong; how it's verified given there is no test suite (manual scaffold into a scratch dir, `node cli.js` checks, etc.).
