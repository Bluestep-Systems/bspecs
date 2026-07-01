# ADR: Plugin context-delivery model — what reaches the agent's context, and the residual gaps

**Status:** Accepted

**Date:** 2026-07-01

**Relates to:** [`plugin-distribution.md`](plugin-distribution.md) (the delivery decision this
verifies the context-mechanics of), [`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md)
(the on-demand read pattern preserved), [`path-scoped-rules-evaluation.md`](path-scoped-rules-evaluation.md)
(premises partially superseded — see G5).

## Context

The move to the `bluestep-tools` plugin ([`plugin-distribution.md`](plugin-distribution.md)) changed
*how* the shared BlueStep rules reach the agent — from files physically copied into every project's
`.claude/instructions/` tree to a `bluestep-reference` **skill** bundled in the plugin. During plugin
testing the question surfaced: **in a plain chat, does the agent still know the platform rules?** And
more broadly — did the migration silently drop capabilities the old CLI scaffold delivered?

This ADR records the answer, verified against the official Claude Code docs (skills, plugins-reference,
sub-agents, hooks, memory — all on `code.claude.com`, June/July 2026), plus a full old→new inventory
diff (git `dd00ff6^` vs current `plugin/`).

### What the docs establish (authoritative, not from memory)

1. **A plugin cannot ship always-on context.** > "A `CLAUDE.md` file at the plugin root is not loaded
   as project context. Plugins contribute context through skills, agents, and hooks rather than
   CLAUDE.md." There is no plugin memory/`rules/`/`imports` contributor. `claudeMd` (inline managed
   CLAUDE.md) is honored **only** in managed/policy settings, and a plugin's own `settings.json`
   supports only `agent`/`subagentStatusLine`. (plugins-reference, memory)
2. **Skill *descriptions* are always in context; bodies load on invocation.** > "skill descriptions
   are loaded into context so Claude knows what's available, but full skill content only loads when
   invoked." Auto-invocation is **model-decided, best-effort** — the docs give troubleshooting for
   under- and over-triggering and recommend hooks "to enforce behavior deterministically." (skills)
3. **Subagents inherit the memory hierarchy.** A non-fork subagent's startup context includes
   "every level of the memory hierarchy the main conversation loads, including `~/.claude/CLAUDE.md`,
   project rules, `CLAUDE.local.md`, and managed policy files. The built-in Explore and Plan agents
   skip this." (sub-agents)
4. **`${CLAUDE_PLUGIN_ROOT}` is substituted inline in agent/skill content**, and exported as an env
   var **only** to hook/MCP/LSP subprocesses — not guaranteed live in a Bash *tool* call's shell.
   (plugins-reference)
5. **Plugin hooks fire automatically once the plugin is enabled** — > "its hooks merge with your user
   and project hooks" — no per-project hooks block. (hooks)

## Decision

**The plugin context model is sound as designed; keep it. Record the residual gaps and their
mitigations rather than re-architecting.**

- **Always-on Tier-1 rules stay in the per-project `CLAUDE.md`, written by `/bluestep-init`** — not
  the plugin, because a plugin cannot supply always-on context (fact 1). This is not a workaround; it
  is the only correct home for it.
- **Deep rules stay on-demand via the `bluestep-reference` skill.** This matches the pre-plugin design
  ([`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md)) — the old
  `.claude/instructions/` tree was never auto-loaded either; `CLAUDE.md` pointed at `index.md` and the
  agent read one file on demand. The plugin swaps "read `index.md`" for "consult the skill"; the
  always-on `CLAUDE.md` pointer and the on-demand discipline are unchanged. Skill *descriptions* being
  always-on (fact 2) makes the reference at least as discoverable as the old file pointer.
- **Delegated `/spec-execute` is unaffected.** `b6p-task-implementer` inherits the project `CLAUDE.md`
  + rules (fact 3) and reaches the bundled reference via `${CLAUDE_PLUGIN_ROOT}` substituted in its
  agent body (fact 4).

### Inventory verification (nothing dropped)

Every old-scaffold item maps to a new home: skills/agents → `plugin/`; the `instructions/` tree →
`bluestep-reference` skill; hooks → `plugin/hooks/` (auto-fire); spec-templates → bundled in
`spec-create`; module README → bundled in `b6p-pull`; root files + `CLAUDE.md` + `settings.json` →
`/bluestep-init`. The only intentional removals: the `.github/instructions/` Copilot mirror (prior
ADR) and the `SessionStart bspecs sync` hook (replaced by `/plugin marketplace update` / `autoUpdate`).

## Residual gaps and mitigations

| # | Gap | Severity | Mitigation |
| --- | --- | --- | --- |
| G1 | **Install/enable cliff.** Until the plugin is installed+enabled (one-time confirm + network), the generated `CLAUDE.md` points at a `bluestep-reference` skill that does not exist. | Med | `/bluestep-init` announces the one-time install louder and notes "if the skill is unavailable, the plugin isn't installed → `/plugin install bluestep-tools@bluestep`"; managed-settings auto-install closes it for internal staff. |
| G2 | **Fuzzier access** — skill invoke (model-decided) vs deterministic file read. | Low | Keep the `CLAUDE.md` "consult … first" language and a trigger-rich skill `description`; hooks remain the lever for anything that must be deterministic. |
| G3 | **`$CLAUDE_PLUGIN_ROOT` not guaranteed in Bash tool calls.** grep/read instructions must live in skill/agent *content* (where the path is text-substituted), never rely on the shell env var. | Low | Audit the `bluestep-reference` SKILL.md and `b6p-task-implementer` grep lines — they already embed the var in content; keep it that way. |
| G4 | **Offline first-run** needs a marketplace fetch (old scaffold worked offline immediately). | Low | Accepted tradeoff. |
| G5 | **`path-scoped-rules-evaluation.md` premises shifted.** Docs now state subagents *do* inherit project rules (that ADR rejected partly on "they don't"). The core keying argument (B6P knowledge is intent-keyed, not path-keyed) still holds, so the rejection stands. | Low | Revisit that ADR's "subagent inheritance" premise when convenient; rules would still be project-level (`/bluestep-init`-written), not plugin-shippable. |

## Consequences

- **No re-architecture.** The plugin's context model is the correct shape given plugin limitations.
- **`/bluestep-init` owns the install-cliff mitigation (G1)** — the one Med-severity, genuinely-new
  failure mode. Follow-up work is scoped to that skill's prose, not the plugin structure.
- **The "does the agent know the rules in plain chat?" answer is: yes, on-demand** — same as before the
  plugin, with skill descriptions making it marginally more discoverable, gated on the plugin being
  installed (G1).

## References

- Docs: `code.claude.com/docs/en/{skills,plugins-reference,sub-agents,hooks,memory}`.
- ADRs: [`plugin-distribution.md`](plugin-distribution.md),
  [`instruction-tree-and-claude-only.md`](instruction-tree-and-claude-only.md),
  [`path-scoped-rules-evaluation.md`](path-scoped-rules-evaluation.md).
- Inventory: git `dd00ff6^` (last pre-migration scaffold) vs current `plugin/`.
