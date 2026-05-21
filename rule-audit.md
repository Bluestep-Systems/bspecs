# Rule Audit — bspecs Template Sources

Working document. Every rule in the old template (`~/Custom Client Summary/CLAUDE.md` + `.github/instructions/*.md`) must be reviewed before being included in the new templates.

**Verdict legend:**

- **KEEP** — rule is correct as-is
- **REFORMULATE** — rule is partially right; needs rewording
- **DELETE** — rule is wrong, misleading, or unnecessary

---

## Group A — File and folder rules

| # | Source rule | Source location | Verdict | Corrected wording (if REFORMULATE) | Notes |
|---|---|---|---|---|---|
| A1 | Never edit `declarations/`, `B.d.ts`, `scriptlibrary.d.ts`, `Globals.d.ts` — platform-generated | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| A2 | `imports.ts` is platform-generated | b6p-platform.instructions.md, bsjs-development.instructions.md | **REFORMULATE** | "`imports.ts` is platform-generated. In newer modules it is deprecated and may not be present — in that case, imports are declared in `declarations.d.ts` instead." | — |
| A3 | MergeReport frontend (HTML/CSS/JS) goes in `static/`, NOT `scripts/` | CLAUDE.md, bsjs-development.instructions.md | **KEEP** | — | — |
| A4 | Module structure: `declarations/`, `draft/scripts/`, `draft/objects/`, `draft/static/`, `draft/info/` | CLAUDE.md, bsjs-development.instructions.md | **KEEP** | — | — |
| A5 | `.b6p_metadata.json` is auto-managed, never edit manually | inferred from b6p CLI behavior | **KEEP** | — | — |

---

## Group B — API and code patterns

| # | Source rule | Source location | Verdict | Corrected wording (if REFORMULATE) | Notes |
|---|---|---|---|---|---|
| B0 | Always call `.writable()` before writing any field | CLAUDE.md, b6p-platform.instructions.md (×3) | **DELETE** | "NEVER use `.writable()`. Field writability is configured on the platform." | Confirmed wrong by Fernando |
| B1 | Call `B.commit()` before post-saves fire or before reading newly written data | CLAUDE.md, b6p-platform.instructions.md | **REFORMULATE** | "`B.commit()` is called automatically by the platform when the script finishes. Only call it manually when you need to force a transaction mid-script — typically to make a newly created entry's ID available before the script ends." | — |
| B2 | Use `B.time`, not native `Date` | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| B3 | Email must go through `mail.bluestep.net` (no external SMTP) | CLAUDE.md, b6p-platform.instructions.md | **DELETE** | — | Not a real rule |
| B4 | `B.user` is null in scheduled/cron scripts — must guard | b6p-platform.instructions.md | **KEEP** | — | — |
| B5 | Queries are unit-scoped by default; call `clearSearchAndSort()` when re-scoping | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| B6 | Endpoints: only one output method (`response.out` / `stream` / `redirect`) per request | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| B7 | Endpoints: set `contentType` before writing the body | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| B8 | Never fabricate imports — query/form refs must exist in `imports.ts` or `scriptlibrary.d.ts` before use | b6p-platform.instructions.md | **REFORMULATE** | "Never fabricate query/form/field references. They must exist in `imports.ts` (older modules) or `declarations.d.ts` (newer modules) before use. If missing, add them on the platform and pull first." | — |
| B9 | Use bulkPriority() for large email sends | b6p-platform.instructions.md | **DELETE** | — | Tied to B3 (email host rule), which was deleted |

---

## Group C — Tooling and workflow

| # | Source rule | Source location | Verdict | Corrected wording (if REFORMULATE) | Notes |
|---|---|---|---|---|---|
| C1 | Compile each module independently with `tsc -p tsconfig.json` from inside `draft/` | CLAUDE.md, bsjs-development.instructions.md | **DELETE** | — | Compilation happens on the platform; Hook 3 enforces this |
| C2 | No top-level build script; each module compiles independently | CLAUDE.md | **DELETE** | — | Tied to C1, no longer relevant |
| C3 | `b6p` CLI runs in WSL only — prefix all commands with `wsl b6p` | (new, from Fernando) | **KEEP** | — | Hook 2 enforces this |
| C4 | Prettier config: print-width 120, tab-width 2, semicolons, trailingComma "es5" | .prettierrc | **KEEP** | — | Hook 4 enforces this on save |
| C5 | Naming: camelCase FIDs, matching query names, camelCase exports, descriptive module folder names | CLAUDE.md, b6p-platform.instructions.md | **DELETE** | — | FIDs and queries are defined on the platform; not enforceable from the workspace |

---

## Group D — Component lifecycle

| # | Source rule | Source location | Verdict | Corrected wording (if REFORMULATE) | Notes |
|---|---|---|---|---|---|
| D1 | New B6P **components** (MergeReport, Endpoint, Formula) must be created on the platform, not locally. Inside an existing component, creating new `.ts` files locally is fine. | (refined from Fernando) | **KEEP** | — | — |
| D2 | Workspace is a local copy; the platform is source of truth | CLAUDE.md, b6p-platform.instructions.md | **KEEP** | — | — |
| D3 | Pull workflow: scripts come from the platform via `wsl b6p pull`, which updates `declarations/` and `.b6p_metadata.json` | CLAUDE.md | **REFORMULATE** | "`wsl b6p pull <component>` pulls a full component from the platform: it verifies file integrity per-file and only writes the files whose content changed. If the CLI fails, the VS Code b6p extension is an equivalent fallback." | — |
| D4 | Push workflow: local changes go back to the platform via `wsl b6p push` | CLAUDE.md | **REFORMULATE** | "`wsl b6p push <component>` pushes a full component back to the platform: it verifies file integrity per-file and only uploads the files whose content changed. If the CLI fails, the VS Code b6p extension is an equivalent fallback." | — |
| D5 | If two devs edit the same component, conflicts may need manual resolution | b6p-platform.instructions.md | **DELETE** | — | — |

---

## Final Rule Set (consolidated, ready for template generation)

19 rules audited. Outcome: **12 KEEP, 4 REFORMULATE, 6 DELETE.**

### File & folder rules

- **R1** (A1) — NEVER edit `declarations/`, `B.d.ts`, `scriptlibrary.d.ts`, `Globals.d.ts` — platform-generated. Enforced by Hook 1.
- **R2** (A2) — `imports.ts` is platform-generated. In newer modules it is deprecated and may not be present — in that case, imports are declared in `declarations.d.ts` instead.
- **R3** (A3) — In MergeReports: frontend code (HTML/CSS/JS) goes in `static/`, NOT in `scripts/`.
- **R4** (A4) — Module structure: `declarations/`, `draft/scripts/`, `draft/objects/`, `draft/static/`, `draft/info/`.
- **R5** (A5) — `.b6p_metadata.json` is auto-managed by the b6p CLI — never edit manually.

### API & code patterns

- **R6** (B0) — NEVER use `.writable()`. Field writability is configured on the platform, not requested in code.
- **R7** (B1) — `B.commit()` is called automatically by the platform when the script finishes. Only call it manually when you need to force a transaction mid-script — typically to make a newly created entry's ID available before the script ends.
- **R8** (B2) — Use `B.time`, not native JavaScript `Date`.
- **R9** (B4) — `B.user` is null in scheduled/cron scripts — must guard before use.
- **R10** (B5) — Queries are unit-scoped by default. Call `clearSearchAndSort()` when re-scoping the same query across units.
- **R11** (B6) — Endpoints: only one output method (`response.out` / `stream` / `redirect`) per request.
- **R12** (B7) — Endpoints: set `contentType` before writing the body.
- **R13** (B8) — Never fabricate query/form/field references. They must exist in `imports.ts` (older modules) or `declarations.d.ts` (newer modules) before use. If missing, add them on the platform and pull first.

### Tooling & workflow

- **R14** (C3) — `b6p` CLI runs in WSL only, and must be invoked through a **login shell** so nvm/PATH load. Always use `wsl bash -lc 'b6p ...'`. Plain `wsl b6p ...` skips the profile and fails with "command not found: b6p" because b6p is installed under `~/.nvm/...`. Enforced by Hook 2.
- **R15** (C4) — Prettier config: print-width 120, tab-width 2, semicolons, trailingComma "es5". Enforced by Hook 4 on save.
- **R16** (C1) — NEVER run `tsc` locally. Compilation is handled by the platform on push. Enforced by Hook 3.

### Component lifecycle

- **R17** (D1) — NEVER create new B6P **components** (MergeReport, Endpoint, Formula) locally. They must be created on the platform first, then `wsl b6p pull`. Inside an existing component, creating new `.ts` files locally is fine.
- **R18** (D2) — The workspace is a local copy. The BlueStep platform is the source of truth.
- **R18a** (project shape) — A local project is a folder; it has no unit or type of its own. Unit folders (`U######/`) are created by `wsl b6p pull` when a component from a new unit is first pulled. A single project commonly spans multiple Unit folders, each containing components of mixed types (Endpoint, MergeReport, Formula, etc.). Component type is encoded in `draft/info/metadata.json` (`triggerType`), not in folder names. `bspecs` therefore does not prompt for unit ID or project type — those are determined by what you pull.
- **R18c** (task prefixes in specs) — Every task in `.claude/specs/<feature>/tasks.md` starts with one of two prefixes that says *where* the work happens:
  - `[PLATFORM]` — done in the BlueStep UI (creating a field, query, formula, component, permissions). **Not executable by `/spec-execute`**; the user does it manually and asks Claude to mark it `[x]`.
  - `[CODE]` — done in this workspace. Executable by `/spec-execute`.
  Ordering encodes dependencies: a `[CODE]` task that references a new field must be listed after the `[PLATFORM]` task that creates it. `/spec-execute` checks for unchecked `[PLATFORM]` prerequisites before running a `[CODE]` task.
  A `## Deployment` section at the bottom of `tasks.md` lists the components to push once `[CODE]` tasks are done; `[PUSH]` is not modeled as a task because it is a mechanical operation, not an approvable unit of work.
  This convention emerged from a real session where Claude self-improvised it; codifying it in the template prevents re-invention with inconsistent prefixes per feature.

- **R18b** (docs vs. specs lifecycle) — Two separate artifacts, separated by lifecycle:
  - `<Component>/draft/README.md` describes what the component **does today**. Lives inside `draft/` so it ships to the platform on push, which means anyone who pulls obtains the doc. Scaffolded by `/b6p-pull` when missing, by inferring from `app.ts`, `metadata.json`, `config.json` and (for MR) `static/index.html`; if Overview cannot be inferred, the skill asks the user. Updated in the same change when documented behavior changes.
  - `.claude/specs/<feature>/` describes what we are about to **change or add** (requirements → design → tasks), per feature. Created by `/spec-create`, deleted/archived when done.
  Per-component `SPEC.md` is **not used** — it conflated description (stable) with planning (volatile) and was redundant with the README that already exists in many modules.
- **R19** (D3 + D4) — Pull/push workflow:
  - `wsl bash -lc 'b6p pull "<DAV URL>"'` pulls a full component from the platform. **`b6p pull` requires a DAV URL** (copied from the component's page on the BlueStep platform UI), not a display name — there is no name-based lookup. It verifies file integrity per-file and only writes files whose content changed.
  - `wsl bash -lc 'b6p push --file "<path-inside-component>"'` pushes back to the platform; `--file` lets the CLI derive the destination DAV URL from local `.b6p_metadata.json`. Same per-file integrity check.
  - If the b6p CLI fails, the VS Code b6p extension is an equivalent fallback.

### Removed rules (with rationale)

- B3 (email via mail.bluestep.net) — DELETE: not a real platform rule
- B9 (`bulkPriority()` for bulk email) — DELETE: tied to B3
- C1 (compile each module with `tsc`) — DELETE: replaced by R16 (never run tsc locally)
- C2 (no top-level build) — DELETE: redundant after C1 removal
- C5 (naming conventions) — DELETE: FIDs/queries are defined on the platform, not enforceable from workspace
- D5 (conflict resolution) — DELETE: not common enough; CLI/extension handles most cases

### Critical rules destined for `CLAUDE.md` (always-loaded context)

Selected for blast-radius: rules where a silent violation costs the most.

1. R1 — never edit platform-generated files
2. R6 — never use `.writable()`
3. R16 — never run `tsc` locally
4. R17 — never create new components locally
5. R14 — always prefix `wsl` for `b6p`
6. R3 — MergeReport frontend in `static/`, not `scripts/`
7. R18 — workspace is a local copy; platform is source of truth
8. R13 — never fabricate query/form/field references

The remaining rules (R2, R4, R5, R7-R12, R15, R19) live in the instruction files as deeper reference.
