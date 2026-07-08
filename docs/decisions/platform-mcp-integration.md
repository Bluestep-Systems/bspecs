# ADR: Integrate the BlueStep platform MCP (connection now, operation migration phased)

**Status:** Accepted, scope narrowed. The connection tooling is accepted and shipped. **Component sync
(`/b6p-pull` / `/b6p-push` / `/b6p-audit`) stays on the b6p CLI permanently — it is not migrating to MCP.**
The MCP integration's job is the non-overlapping piece: automating `[PLATFORM]` authoring/wiring tasks the
CLI cannot do. See the **2026-07-08 scope-narrowing addendum** at the end.

**Date:** 2026-07-08

**Relates to:** [`plugin-distribution.md`](plugin-distribution.md) (which deferred "exposing b6p as an
MCP server" as out of scope), [`b6p-cli-distribution.md`](b6p-cli-distribution.md),
[`subagents-and-delegated-execution.md`](subagents-and-delegated-execution.md).

## Context

Two operation surfaces in the BlueStep workflow are currently **manual**:

1. **Component sync** — `/b6p-pull`, `/b6p-push`, `/b6p-audit` drive the standalone `b6p` CLI over
   WebDAV, authed by `b6p auth set` credentials in `~/.b6p/secrets.enc`.
2. **`[PLATFORM]` spec tasks** — adding an import (query/form/field) to a script, creating forms,
   fields, option lists, record types, views, etc. The agent **cannot** do these today; per the global
   CLAUDE.md rule ("new imports require a platform round-trip"), it must hand them back to a human who
   clicks through the BlueStep UI, then re-pull. These tasks *block* `/spec-execute`.

The platform now ships a **per-org MCP server** at `https://<org>.bluestep.net/mcp` (HTTP transport,
stateless Spring-AI `WebMvcStatelessServerTransport`, protocol `2025-06-18`). A connection probe against
a test org confirmed it authenticates and exposes ~80 tools covering nearly the whole admin surface —
including the exact operations that are manual today. This makes it worth revisiting the
`plugin-distribution.md` deferral: that ADR ruled out *wrapping the b6p CLI as an MCP server we build*;
this is different — the **platform itself** is now the MCP server, so we consume it rather than build it.

### Auth model (established by the probe)

- **One global token, many orgs.** A single `b6pt_` access token authorizes every org's MCP. The user
  creates it **once** in the UI (*Tools → Organization Admin → Super → Global Users → edit self →
  Access Tokens → Create New Token*) and reuses it for all orgs.
- **Per-org connection, global by default.** Each org is a distinct `mcpServers` entry
  (`bluestep-<subdomain>`). Default registration is **user scope** (`claude mcp add … --scope user`) so
  one setup persists across every workspace on the machine — chosen because BlueStep work is mostly
  single-developer with several workspaces per org, where per-workspace config is repetitive. The token
  is injected from `$B6PT_TOKEN` and resolved into the user-private, never-committed `~/.claude.json`.
  **Per-workspace `.mcp.json`** (with the literal `${B6PT_TOKEN}` reference, expanded at connect time —
  a feature that works **only** in `.mcp.json`, not user-scope config) is the opt-in alternative when an
  org must be confined to one workspace, the secret must stay purely in the env var, or config is
  team-shared.
- **This is a second, independent credential system** from the b6p CLI: MCP uses the global `b6pt_`
  token in `B6PT_TOKEN`; the b6p CLI uses `~/.b6p/secrets.enc` WebDAV creds. They do not overlap.

### Connection gotchas (baked into `/bluestep-mcp-connect`)

- MCP tools register only at **session startup** — a newly-added connection needs a fresh session.
- A curl `initialize` handshake (file-based body, `MCP-Protocol-Version: 2025-06-18`,
  `Accept: application/json, text/event-stream`) returns `200` and verifies token+URL **without** a
  restart. An inline shell body gets mangled → `400 Invalid message format` (not an auth failure).
- `${VAR}` expansion inside `.mcp.json` headers was buggy on older Claude Code builds; if a live
  session fails auth despite a `200` curl, update Claude Code or register at user scope with
  `claude mcp add --header` (value resolved at add-time).

## Decision

**Adopt platform MCP as a first-class capability, in two stages.**

- **Now (shipped in this change):** the `/bluestep-mcp-connect` skill (per-org; global user-scope by
  default, per-workspace opt-in; token injected from `$B6PT_TOKEN`) and an optional MCP step in
  `/bluestep-init`. No behavior change to the existing `/b6p-*` skills.
- **Follow-up (this ADR's roadmap, scope-narrowed 2026-07-08):** automate the `[PLATFORM]` authoring/wiring
  operations on MCP tools, approval-gated, proven against a live org. Component sync (pull/push/audit) is
  **not** in scope — it stays on the b6p CLI.

### MCP tool surface (probe inventory, grouped)

| Area | Representative tools |
|---|---|
| **BSJS scripts** (component sync + wiring) | `read_script_draft`, `write_script_draft`, `get_script_declarations`, `create_script`, `update_script`, `get_script`, `lookup_script_by_name`, `add_queries`/`remove_queries`, `add_forms`/`remove_forms`, `add_field_access`/`remove_field_access`, `add_record_types`/`remove_record_types`, `set_category_requirement`, `list_script_scope`, `list_form_dependencies`, `list_field_access`, `list_applicable_forms`/`list_applicable_fields` |
| **Schema authoring** (`[PLATFORM]` tasks) | `form`, `field`, `batch_fields`, `folder`, `record_type`, `attach_category_forms`, `option_list` (+ `create_option_list`, `update_option_list`, `option_list_item`, `option_group`), `view`, `create_mefr`, `reorder`, `run_formulas` |
| **Data entry** (with human-approval queue) | `form_entry`, `stage_form_entry`, `list_pending_changes`, `discard_pending_change`, `list_available_forms`, `describe_form`, `record` |
| **GraphQL / records** | `graphql_query`, `graphql_mutation`, `get_record`, `list_records`, `get_schema`, `get_full_schema` |
| **Permissions** | `list_permissions`, `grant_permission`, `revoke_permission`, `set_permissions`, `form_permission` |
| **Inventory / inspection** | `list_forms`, `get_form`, `list_folders`, `get_folder`, `list_record_types`, `get_record_type`, `list_option_lists`, `get_option_list`, `list_views`, `get_view`, `list_forms_with_fields`, `inspector` |
| **Logs / ops** | `read_script_log`, `search_script_log`, `read_organization_log`, `search_organization_log`, `get_available_pods` |
| **Users / sites / alerts** | `user`, `get_user`, `site`, `edit_site_styles`, `page`, `update_pagelet`, `document`, `document_folder`, `alert` |

### Manual → MCP mapping

| Manual today | MCP path | Notes / caveat |
|---|---|---|
| `/b6p-pull` (fetch source + `.d.ts`) | **stays on the b6p CLI — no MCP read/pull skill** (`read_script_draft` / `get_script_declarations` used only *inside* the Phase-4 authoring flow, to read declarations back after wiring) | Decided 2026-07-08: sync is not migrating. `get_script_declarations` returns a *reduced* declaration (script-type line + wired deps), not the full ambient typedef tree — fine for coding-against post-wiring, not a `/b6p-pull` replacement. |
| `/b6p-push` (deploy source) | **stays on the b6p CLI** | `write_script_draft` push pilot dropped. The CLI records sync metadata and has the VS Code fallback. |
| `/b6p-audit` (local vs platform) | **stays on the b6p CLI** | Depends on CLI sync metadata; not migrating. |
| `[PLATFORM]`: add query/form/field import | `add_queries`, `add_forms`, `add_field_access` (+ `list_applicable_*`) | **The payoff and the actual target** — removes the human round-trip that blocks `/spec-execute`. |
| `[PLATFORM]`: create form/field/option list/view/record type | `form`, `field`, `option_list`, `view`, `record_type`, … | Was UI-only; now agent-runnable. |
| New component | `create_script` | Returns a script id + editor URL. |

### Coexistence policy

- **Division of labor, not a transition.** The **b6p CLI owns component pull/push/audit** — permanently.
  **MCP owns `[PLATFORM]` authoring/wiring** (adding imports, creating forms/fields/option-lists/views/
  record-types) — the operations the CLI cannot do. There is no "MCP-primary, CLI-fallback" for sync and no
  planned CLI retirement; the earlier framing is superseded by the 2026-07-08 scope decision.
- **No MCP read/pull skill.** `read_script_draft` / `get_script_declarations` are used only *inside* the
  Phase-4 authoring flow — to read declarations back after wiring so a dependent `[CODE]` task can code
  against the new import. They do **not** replace a `/b6p-pull` (no CLI sync metadata, reduced
  declarations), there is no standalone MCP read/pull skill, and they must never be used to push.
- **`[PLATFORM]` authoring stays human-gated.** Each automated op is opt-in and surfaced for approval —
  consistent with the `/spec-execute` approval gate and the data-entry `stage_*` / `list_pending_changes`
  approval queue the platform itself enforces.
- **Two credentials coexist by design** — the b6p CLI's encrypted `~/.b6p/secrets.enc` (sync) and the
  `B6PT_TOKEN` MCP token (`[PLATFORM]` authoring). Not transitional; documented in `/bluestep-init`.

## Phased sequencing

1. **Connect + inventory** — `/bluestep-mcp-connect` + `bluestep-init` step. ✅
2. **~~Pilot one read op / parity gate~~** — **DESCOPED** (2026-07-08). The read-parity gate presupposed
   replacing `/b6p-pull`; sync stays on the CLI, so parity is moot and **no MCP read/pull skill ships** (an
   early `/b6p-pull-mcp` prototype was removed). Parity was measured once for the record (source pass,
   declarations structurally reduced) — see the addendum. Reading declarations back after wiring folds into
   Phase 4 as a step. ✅ (closed by descope)
3. **~~Pilot one write op~~** — **DESCOPED** (2026-07-08). `write_script_draft` push-to-draft dropped;
   push stays on the CLI.
4. **Automate `[PLATFORM]` tasks (now the primary work)** — teach `/spec-execute` (or a new subagent) to run
   `add_queries` / `add_forms` / `add_field_access` / schema-authoring tools for `[PLATFORM]`-tagged tasks,
   surfaced for approval. Prove-out bar: `get_script_declarations` output is **sufficient to code against**
   after wiring (not byte-parity); ambient typedefs come from the CLI-pulled tree or a bundled static set.
   Confirm in-session tool registration works in-app (curl handshake alone was verified before).
5. **Fold into skills + reference** — teach `/spec-execute` / a subagent + `bluestep-reference` + the
   scaffolded project `CLAUDE.md` the MCP `[PLATFORM]`-authoring flow (not an MCP-first sync story), then
   cut the release tag.

## Consequences

- **`[PLATFORM]` tasks become automatable** — the single biggest workflow unblock; specs stop stalling
  on human UI round-trips.
- **A second credential** to onboard (`B6PT_TOKEN`) alongside `b6p auth set`. Documented in
  `/bluestep-init` and `/bluestep-mcp-connect`; the token is create-once-use-everywhere, which softens
  it.
- **Global-default hygiene tradeoff.** User-scope registration resolves the token into `~/.claude.json`
  (user-private, uncommitted) rather than keeping it purely in the env var — accepted for the
  single-developer common case, and the token is injected from `$B6PT_TOKEN` so it never appears in a
  command literal or a committed file. Rotation then means re-running `claude mcp add`. The
  per-workspace `.mcp.json` path (secret only in the env var, auto-picked-up on rotation) remains
  available for anyone who wants stricter at-rest hygiene or containment.
- **The `claude` CLI is not a hard dependency.** The global path uses `claude mcp add`, which is on PATH
  only when Claude Code runs as the terminal CLI. bspecs otherwise depends on no `claude` binary (only
  the standalone `b6p`). So `/bluestep-mcp-connect` **degrades gracefully**: it uses the CLI when present
  and falls back to writing a per-workspace `.mcp.json` (no external tool) when not — never blocking and
  never auto-installing. When the CLI is absent it *offers* (does not run) the **npm-free** native CLI
  installer (`~/.local/bin`, no admin — installing Claude Code does **not** require npm; npm is only an
  alternative install channel), and otherwise proceeds per-workspace. Desktop-app users, whose MCP
  servers are account-managed via claude.ai rather than local files, are pointed at claude.ai
  custom-connector settings.
- **Per-org config cannot be bundled** in the plugin (no per-org URL in verbatim content) — it stays
  conversational via `/bluestep-mcp-connect`, consistent with the no-templating model of
  `plugin-distribution.md`.
- **Reliability caveat** — MCP connections depend on session-startup registration and header env-var
  expansion; the fallback to `b6p` must stay real until MCP operation is battle-tested.
- **Scope discipline** — the MCP exposes destructive/admin tools (`set_permissions`, `record` delete,
  `user` deactivate). The migration must not casually widen what the agent does; each automated op is
  opt-in and, where the platform offers one (`stage_*`), routed through the approval queue.

## Security & token handling

The `b6pt_` MCP token is a bearer credential for a **global super-user** — high privilege, broad blast
radius. What the integration does and does not protect:

- **Protected:** never committed (only `${B6PT_TOKEN}` appears in `.mcp.json`; `~/.claude.json` is
  uncommitted), never passed as a command literal (injected from `$B6PT_TOKEN`), transmitted over HTTPS,
  and the skill forbids printing it.
- **Not encrypted at rest** — plaintext in the env var and, on the global path, in `~/.claude.json`. This
  is weaker than the b6p CLI's encrypted `~/.b6p/secrets.enc`; Claude Code offers no encrypted-header MCP
  mechanism, so plaintext-user-private is the current floor. Where stronger at-rest hygiene is required,
  the per-workspace `.mcp.json` path (secret only in the env var) is preferred; an OS-keychain approach
  would need Claude Code support that does not exist today. This is a **known, accepted gap** against the
  original "securely stores the key" goal — surfaced, not hidden.
- **Token shape is the dominant risk.** As typically created the token is global-super, unscoped, and
  non-expiring. The mitigation that matters most is at creation time — set an expiry + least-privilege
  scopes, question whether it must be global-super, and revoke on exposure — more than where the token is
  stored.

## 2026-07-08 scope-narrowing addendum

After shipping the connection (`0.7.0`), we prototyped an MCP read to run the Phase-2 read-parity test,
then **narrowed the ADR's scope** and **removed the prototype** (there is no MCP read/pull skill).

**Decision: component sync stays on the b6p CLI permanently.** We are not migrating `/b6p-pull` /
`/b6p-push` / `/b6p-audit` onto MCP, and we ship **no MCP read/pull skill**. The CLI is the stronger home:
encrypted creds
(`~/.b6p/secrets.enc`) vs the plaintext `b6pt_` token; it records the sync metadata `/b6p-push` /
`/b6p-audit` depend on; it materializes the full `declarations/` tree; and it has the VS Code fallback.
This retires the "MCP-primary, CLI-fallback" coexistence idea and the "revisit CLI retirement" phase.
MCP's value is the **non-overlapping** `[PLATFORM]` authoring/wiring the CLI cannot do — the ADR's own
"single biggest workflow unblock."

**Parity test (for the record, not a gate).** Component "Teacher Header" (`MERGE_REPORT`, topId
`530024___463`, DAV `https://bkplayground.bluestep.net/files/1436589/`) on `bkplayground`, in a live MCP
session:

- **Source — PASS.** `draft/scripts/app.ts` byte-identical (27 B, no CRLF). `draft/info/{config,metadata}.json`
  absent in both (this MR has none). Other `read_script_draft` files (tsconfig, `static/*`, README,
  `.build/*`) matched the CLI file set. `read_script_draft` is faithful.
- **Declarations — structurally reduced (would fail a byte-parity gate).** `get_script_declarations`
  returns only the reduced script-type line (`declare const B: Bluestep.Relate.MergeReportB;`). It omits
  the CLI's `index.d.ts` `/// <reference>` preamble and all 7 ambient typedef files (`B.d.ts` ~747 KB,
  `Java.d.ts` ~205 KB, `Globals`, `Graal`, `Polyglot`, `console.graal`, `scriptlibrary`). Structural, not
  component-specific.

This is **not** recorded as a Phase-2 parity pass — but Phase 2 is closed by the descope, not by the
failure. The reduced declaration output is expected to be **sufficient to code against** post-wiring
(Phase 4's weak bar); the missing ambient typedefs come from the CLI-pulled tree or a bundled static set.

**In-session registration confirmed.** A newly-added connection does not hot-load into a running session
(verified: `claude mcp add` + a `200` handshake + `claude mcp list` "Connected", yet the
`mcp__bluestep-<subdomain>__*` tools were absent from the running session's tool registry). The tools
appear in a **fresh** session — which is where the parity test above was run.

**Consequences of the narrowing.** Phase 2 & 3 are closed/dropped; Phase 4 (`[PLATFORM]` authoring) is the
active work; the "revisit CLI retirement" phase is deleted; the deferred release tag is re-anchored (gate
on Phase 4, or cut a `0.7.0` tag now since the connection is complete standalone). The two credential
systems are now a **permanent** design property, not a transition state.

## References

- Connection probe: this session (handshake `200`, `tools/list` inventory of ~80 tools against a test org).
- Prior probes: sessions on `<org>.bluestep.net/mcp` (stateful transport, `Mcp-Session-Id`) — the newer
  endpoint is stateless.
- Skill: `plugin/skills/bluestep-mcp-connect/SKILL.md`; init step: `plugin/skills/bluestep-init/SKILL.md`.
