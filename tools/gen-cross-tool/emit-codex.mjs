// tools/gen-cross-tool/emit-codex.mjs — Codex emitter (content: task 10,
// hooks/MCP/agents wiring: task 11).
//
// Emits:
//   dist/codex/GENERATED.md                                 (do-not-edit note)
//   dist/codex/bluestep-tools/.codex-plugin/plugin.json     (name + version +
//       description mirrored from plugin/.claude-plugin/plugin.json, plus the
//       "skills" path field — Codex path fields must be relative and
//       ./-prefixed)
//   dist/codex/bluestep-tools/skills/**    (same two transforms as Cursor:
//       allowed-tools stripped from SKILL.md frontmatter, ${CLAUDE_PLUGIN_ROOT}
//       refs rewritten relative — both from lib.mjs, shared, never forked)
//   dist/codex/bluestep-tools/hooks/shared/*.sh   (byte-identical copies of
//       plugin/hooks/*.sh — the guardrail logic lives ONCE there, never forked)
//   dist/codex/bluestep-tools/hooks/*-codex.sh    (generated POSIX-sh wrappers:
//       stdin passes through unchanged — Codex's hook stdin is Claude-identical
//       (LIVE, X3) — and the shared script's exit 2 + stderr becomes the pure
//       hookSpecificOutput deny JSON, the only live-proven block on Codex)
//   dist/codex/bluestep-tools/hooks/hooks.json    (Claude-compatible schema:
//       PreToolUse groups; commands resolve the wrapper via $PLUGIN_ROOT)
//   dist/codex/bluestep-tools/hooks/README.md     (wiring + the trust gate +
//       the best-effort apply_patch mapping)
//   dist/codex/bluestep-tools/.mcp.json           (the gateway server with
//       Codex's native bearer_token_env_var instead of an Authorization
//       header — proven live in X4)
//   dist/codex/bluestep-tools/agents/*.toml       (the three subagents as Codex
//       TOML — PAYLOAD, not a registered surface; see below)
//   dist/codex/bluestep-tools/agents/README.md    (how to install that payload)
//   .agents/plugins/marketplace.json       (root marketplace, Codex's
//       documented location; local source with a nested ./dist path — the shape
//       proven live in the task-1 prove-out, X1 + G1)
//
// Agents are PAYLOAD, never a manifest field: plugin-bundled subagents are not
// operational on Codex at all (prove-out X5 — the files land in the plugin
// cache but nothing registers), so the emitted TOML files ship via the
// /bluestep-init Codex enablement step, which copies them into the project's
// .codex/agents/ (or ~/.codex/agents/). Two consequences the emitter honors:
// agent names lose their hyphens (Codex accepts lowercase letters, digits and
// underscores only — X5), and a ${CLAUDE_PLUGIN_ROOT} reference in an agent
// body cannot become a relative path (the installed file no longer sits inside
// the plugin), so those degrade to prose naming the plugin-relative path.
//
// Hook rules, all locked by the X3 failure ladder (see prove-out.md):
//   * hook commands run with the SESSION cwd → scripts are located via the
//     PLUGIN_ROOT env var Codex sets for plugin hooks (CLAUDE_PLUGIN_ROOT is
//     its compat alias), never a manifest-relative path;
//   * exit codes are NOT a reliable deny (the Windows harness collapses them to
//     0/1; a nonzero exit just makes Codex "fail open"), so the wrappers
//     translate the shared script's exit 2 into the pure hookSpecificOutput
//     deny JSON with exit 0 — and emit NOTHING else on stdout, because any
//     extra output marks the hook run as failed;
//   * hooks fail OPEN on error → every wrapper error path exits 0 silently;
//   * hook definitions are trust-gated per release (hooks/README.md says so).
//
// Relative-path safety (prove-out X2/X1): Codex installs a plugin into a
// versioned cache (~/.codex/plugins/cache/<market>/<plugin>/<version>/) with
// the plugin structure preserved, and reads bundled skill resources on demand
// from there — so paths relative to the containing file hold at runtime.
//
// Description budget (design: "Codex description budget", prove-out X6): Codex
// spends a bounded slice of the context window on the skill catalog (~8k chars
// / ~2%). The catalog entry is plugin-prefixed ("bluestep-tools:<skill-name>",
// the one data point banked in X6) plus the skill's description, so this
// emitter sums that cost across all emitted skills and WARNS when it climbs
// near the cap. It never fails the build: the real cap is the tool's, we only
// have an estimate, and a warning that blocks a release on an estimate would be
// worse than a truncated catalog we can see in the task-14 smoke test.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  contentText,
  expandBraces,
  parseFrontmatter,
  rewriteRefs,
  stripFrontmatter,
  transformFrontmatter,
  walkSorted,
} from './lib.mjs';

const LABEL = 'emit-codex';
const PLUGIN_NAME = 'bluestep-tools';
const OUT_PLUGIN = `dist/codex/${PLUGIN_NAME}`;
const MARKETPLACE = '.agents/plugins/marketplace.json';

// Manifest path fields Codex reads (docs, re-confirmed in the prove-out's
// "Confirmed from docs" section). Used by check() to assert every path field
// present is ./-prefixed and actually exists in the emitted tree — so task
// 11's hooks/mcpServers additions are covered without editing check().
const MANIFEST_PATH_FIELDS = ['skills', 'hooks', 'mcpServers'];

// Frontmatter keys this emitter understands. Unknown keys pass through (Codex
// tolerates unknown frontmatter — LIVE, prove-out X2) but get a warning, so a
// new Claude Code field receives a deliberate mapping decision.
const KNOWN_SKILL_FM = new Set(['name', 'description', 'allowed-tools']);

// Agent frontmatter keys this emitter understands. `tools`/`model` are dropped
// (the Codex TOML carries name/description/developer_instructions only);
// anything else warns so a new field gets a deliberate mapping decision.
const KNOWN_AGENT_FM = new Set(['name', 'description', 'tools', 'model']);

// Soft budget: warn well under the ~8k-char catalog allowance so there is room
// to add a skill before anything truncates.
const BUDGET_CAP = 8000;
const BUDGET_WARN = 7000;

const GENERATED_MD = `# Generated tree — do not edit

Everything under \`dist/codex/\` is generated from \`plugin/**\` by
\`tools/gen-cross-tool\` (the Codex emitter). Never hand-edit these files:
the generator wipes and rewrites this whole tree on every run, so edits here
are lost — edit the source under \`plugin/\` instead and regenerate with:

    npm run gen
`;

// Map a plugin-root-relative target to its path inside the emitted Codex
// plugin dir. Throws on anything without a mapping (fail loudly).
function mapTarget(ref, where) {
  if (ref === '') return ''; // the plugin root itself
  if (ref === '.claude-plugin/plugin.json') return '.codex-plugin/plugin.json';
  if (ref === '.mcp.json') return '.mcp.json';
  if (ref === 'hooks/hooks.json') return 'hooks/hooks.json'; // the Codex-schema re-emit
  if (/^hooks\/[A-Za-z0-9_.-]+\.sh$/.test(ref)) return `hooks/shared/${ref.slice('hooks/'.length)}`;
  if (ref.startsWith('skills/')) return ref;
  throw new Error(`emit-codex: ${where}: no Codex mapping for \${CLAUDE_PLUGIN_ROOT}/${ref} — refusing to emit (agents are not bundleable on Codex, prove-out X5, so nothing may point at them as a plugin path)`);
}

function readManifest(tree) {
  const src = tree.files.find((f) => f.rel === '.claude-plugin/plugin.json');
  if (!src) throw new Error('emit-codex: plugin/.claude-plugin/plugin.json missing');
  return JSON.parse(src.text);
}

// ---------- agents → TOML (task 11) ----------

// Codex agent names accept lowercase letters, digits and underscores only —
// hyphens are rejected outright (prove-out X5), so every name loses them.
function codexAgentName(sourceName, where) {
  const name = String(sourceName).replaceAll('-', '_');
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`emit-codex: ${where}: agent name "${sourceName}" has no Codex-legal form (lowercase letters, digits and underscores only — prove-out X5)`);
  }
  return name;
}

// TOML single-line basic string.
function tomlBasic(value) {
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\t', '\\t')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
  return `"${escaped}"`;
}

// TOML multi-line string for a markdown body. Prefers the LITERAL form
// (''' … ''') so the markdown survives byte-for-byte with zero escaping —
// nothing mangles the backslashes and backticks in the code samples. Falls
// back to the BASIC form (""" … """) when the body itself contains the literal
// delimiter, escaping backslashes and the embedded triple quotes. Both forms
// force a trailing newline, so the body can never sit against the closing
// delimiter (which would make the quote run ambiguous).
function tomlMultiline(body) {
  const text = body.endsWith('\n') ? body : `${body}\n`;
  if (!text.includes("'''")) return `'''\n${text}'''`;
  const escaped = text.replaceAll('\\', '\\\\').replaceAll('"""', '\\"\\"\\"');
  return `"""\n${escaped}"""`;
}

// Minimal structural TOML reader for check(): enough to prove the emitted agent
// files are well-formed at the level we emit them (top-level `key = value`
// only, values either a single-line string or a triple-quoted block). Returns
// { key: rawValue }, or throws on an unbalanced block / unexpected line. Not a
// general TOML parser and not meant to be one — it exists so a malformed agent
// file fails `npm run gen:check` instead of Codex.
function parseSimpleToml(text) {
  const data = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!m) throw new Error(`line ${i + 1}: not a "key = value" line: ${line.slice(0, 60)}`);
    const [, key, rest] = m;
    const fence = rest.startsWith("'''") ? "'''" : rest.startsWith('"""') ? '"""' : null;
    if (!fence) {
      if (!/^(".*"|'.*')$/.test(rest.trim())) throw new Error(`line ${i + 1}: value of "${key}" is not a quoted single-line string`);
      data[key] = rest.trim().slice(1, -1);
      continue;
    }
    if (rest.trim() !== fence) throw new Error(`line ${i + 1}: "${key}" must open its ${fence} block with nothing after the delimiter`);
    const collected = [];
    let closed = false;
    for (i += 1; i < lines.length; i++) {
      if (lines[i].startsWith(fence)) {
        if (lines[i].trim() !== fence) throw new Error(`line ${i + 1}: trailing content after the closing ${fence}`);
        closed = true;
        break;
      }
      collected.push(lines[i]);
    }
    if (!closed) throw new Error(`"${key}": unterminated ${fence} block`);
    data[key] = `${collected.join('\n')}\n`;
  }
  return data;
}

// Same reference shape lib.mjs scans for, plus the optional code-span
// backticks glued to either side — the whole span becomes prose, so both
// backticks have to be consumed.
const AGENT_REF = /(`?)\$\{CLAUDE_PLUGIN_ROOT\}(\\?")?((?:\/[A-Za-z0-9_.{},-]+)*\/?)(`?)/g;

// Rewrite ${CLAUDE_PLUGIN_ROOT} references in an AGENT BODY. Unlike skills,
// agents do not stay inside the plugin on Codex: the enablement step copies
// them into the project's .codex/agents/ (prove-out X5), so a path relative to
// the emitted file would point nowhere at runtime. Documented degradation: the
// reference becomes prose that names the plugin-relative path and says where
// that path lives. Anything unmappable still fails the run loudly — the
// no-silent-passthrough rule holds for prose too.
// `lineOffset` is how many source lines were dropped ahead of `text` (the
// frontmatter block), so an error points at the line the author has to fix.
function rewriteAgentRefs(text, sourceRel, treeRoot, lineOffset = 0) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const where = `${sourceRel}:${lineOffset + i + 1}`;
    let result = '';
    let last = 0;
    for (const m of lines[i].matchAll(AGENT_REF)) {
      if (m[2]) {
        throw new Error(`emit-codex: ${where}: quoted hooks.json-style \${CLAUDE_PLUGIN_ROOT} ref in an agent body — no prose mapping (hooks.json is re-emitted per tool)`);
      }
      if ((m[1] === '`') !== (m[4] === '`')) {
        throw new Error(`emit-codex: ${where}: unbalanced code span around a \${CLAUDE_PLUGIN_ROOT} reference — refusing to guess where the prose replacement ends`);
      }
      const punct = m[3].match(/[.,;:]+$/)?.[0] ?? '';
      const shown = m[3].slice(0, m[3].length - punct.length).replace(/^\//, '');
      const ref = shown.replace(/\/$/, '');
      if (ref === '') {
        throw new Error(`emit-codex: ${where}: \${CLAUDE_PLUGIN_ROOT} used as the plugin root itself in an agent body — no prose mapping (name a concrete file or folder)`);
      }
      const alternatives = expandBraces(ref);
      let dirs = 0;
      for (const expanded of alternatives) {
        if (expanded.split('/').includes('..')) {
          throw new Error(`emit-codex: ${where}: \${CLAUDE_PLUGIN_ROOT} reference escapes the plugin tree: ${expanded}`);
        }
        const abs = join(treeRoot, ...expanded.split('/'));
        if (!existsSync(abs)) {
          throw new Error(`emit-codex: ${where}: \${CLAUDE_PLUGIN_ROOT}/${expanded} does not exist — refusing to emit (no silent passthrough)`);
        }
        if (statSync(abs).isDirectory()) dirs++;
      }
      if (dirs !== 0 && dirs !== alternatives.length) {
        throw new Error(`emit-codex: ${where}: \${CLAUDE_PLUGIN_ROOT}/${ref} mixes files and directories — refusing to pick a noun for the prose replacement`);
      }
      const plural = alternatives.length > 1;
      const noun = dirs ? (plural ? 'directories' : 'directory') : (plural ? 'files' : 'file');
      result += `${lines[i].slice(last, m.index)}the \`${shown}\` ${noun} bundled with the ${PLUGIN_NAME} plugin${punct}`;
      last = m.index + m[0].length;
    }
    if (last === 0) continue;
    lines[i] = result + lines[i].slice(last);
  }
  return lines.join('\n');
}

// Convert one plugin/agents/*.md into a Codex agent TOML file. `renames` maps
// every source agent name to its Codex name, so prose that addresses another
// agent uses the name Codex actually answers to (prove-out X5: per-tool prose
// must use the per-tool name).
function agentToml(f, treeRoot, renames) {
  const fm = parseFrontmatter(f.text);
  if (!fm) throw new Error(`emit-codex: ${f.rel}: missing YAML frontmatter — cannot build the agent TOML`);
  for (const key of Object.keys(fm.data)) {
    if (!KNOWN_AGENT_FM.has(key)) {
      console.warn(`emit-codex: ${f.rel}: unknown agent frontmatter key "${key}" dropped from the Codex TOML — give it a deliberate mapping`);
    }
  }
  const sourceName = fm.data.name;
  if (!sourceName) throw new Error(`emit-codex: ${f.rel}: frontmatter has no "name"`);
  if (!fm.data.description) throw new Error(`emit-codex: ${f.rel}: frontmatter has no "description"`);
  const name = codexAgentName(sourceName, f.rel);

  let description = fm.data.description;
  const stripped = stripFrontmatter(f.text);
  const blankLines = stripped.match(/^\n*/)[0].length;
  let body = rewriteAgentRefs(stripped.slice(blankLines), f.rel, treeRoot, fm.endLine + blankLines);
  if (!body.trim()) throw new Error(`emit-codex: ${f.rel}: empty body — nothing to put in developer_instructions`);
  for (const [from, to] of renames) {
    const re = new RegExp(`(?<![\\w/-])${from}(?![\\w-])`, 'g');
    description = description.replace(re, to);
    body = body.replace(re, to);
  }

  return `# Generated by tools/gen-cross-tool (emit-codex) — do not edit; see
# ../../GENERATED.md. Source: plugin/agents/${f.rel.slice('agents/'.length)}
#
# PAYLOAD, not a plugin surface: Codex does not load agents from plugins
# (prove-out X5 — bundled agent files are cached but never registered), so this
# file has to be copied into .codex/agents/. See README.md next to it.
name = ${tomlBasic(name)}
description = ${tomlBasic(description)}
developer_instructions = ${tomlMultiline(body)}
`;
}

const AGENTS_README = `# Codex subagents — generated payload, do not edit

Generated by \`tools/gen-cross-tool\` from \`plugin/agents/*.md\` (see
\`../../GENERATED.md\`); regenerate with \`npm run gen\`.

## Codex does not load agents from plugins

Installing this plugin does **not** give you these subagents. The task-1
prove-out (X5) confirmed it live: bundled agent files are copied into the
plugin cache and then **nothing registers** — no agent, no tool, no slash
entry, and nothing lands in \`~/.codex/agents/\` or the workspace
\`.codex/agents/\`. The plugin manifest has no \`agents\` field for the same
reason.

So these \`.toml\` files are **payload**: to use them, copy them into

- the project's \`.codex/agents/\` (per project), or
- \`~/.codex/agents/\` (all your projects).

Copy them yourself for now — the \`/bluestep-init\` Codex enablement section
tells you when. (Automated copying by the init skill is planned but not yet
shipped; until then this folder is the source and the copy is manual.)

## What the generator changed

- **Names lost their hyphens.** Codex accepts lowercase letters, digits and
  underscores only, so \`b6p-task-implementer\` becomes
  \`b6p_task_implementer\` (and so on). Prose inside the instructions was
  updated to match, since that is the name Codex answers to.
- **The markdown body became \`developer_instructions\`**; the Claude Code
  \`tools:\`/\`model:\` frontmatter was dropped (Codex has no equivalent
  fields here).
- **Plugin-path references became prose.** An instruction that pointed at a
  path inside the plugin now reads "the \`skills/…\` file bundled with the
  ${PLUGIN_NAME} plugin", because once the agent file sits in
  \`.codex/agents/\` it is no longer inside the plugin and no relative path
  would resolve. The agent has to find that file inside the installed plugin
  (\`~/.codex/plugins/cache/<marketplace>/${PLUGIN_NAME}/<version>/\`) — the
  same bundled reference tree the skills read.
`;

// Per-skill catalog cost: the plugin-prefixed name Codex shows plus the
// description text. Reads the frontmatter of the EMITTED SKILL.md so the
// numbers describe what Codex actually ingests.
function budgetEntries(files) {
  const entries = [];
  for (const [rel, content] of Object.entries(files)) {
    const m = rel.match(new RegExp(`^${OUT_PLUGIN}/skills/([^/]+)/SKILL\\.md$`));
    if (!m) continue;
    const fm = parseFrontmatter(contentText(content));
    const name = fm?.data.name || m[1];
    const description = fm?.data.description ?? '';
    entries.push({
      skill: m[1],
      description,
      cost: `${PLUGIN_NAME}:${name}`.length + description.length,
    });
  }
  return entries.sort((a, b) => (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0));
}

// Report the catalog cost: one info line always, plus a WARNING (never a
// failure) with the worst offenders when it nears the cap.
function reportBudget(entries) {
  const total = entries.reduce((sum, e) => sum + e.cost, 0);
  console.log(`emit-codex: skill description budget: ${total} chars across ${entries.length} skills (soft warn at ${BUDGET_WARN}, Codex catalog allowance ~${BUDGET_CAP}).`);
  if (total <= BUDGET_WARN) return;
  console.warn(`emit-codex: WARNING: the skill catalog costs ${total} chars, past the ${BUDGET_WARN}-char soft limit under Codex's ~${BUDGET_CAP}-char allowance — descriptions may get truncated or skills dropped from discovery. Shorten the longest ones (source: plugin/skills/<name>/SKILL.md frontmatter):`);
  const longest = [...entries].sort((a, b) => b.description.length - a.description.length).slice(0, 3);
  for (const e of longest) {
    console.warn(`emit-codex:   ${e.skill}: ${e.description.length} chars — ${e.description.slice(0, 80)}…`);
  }
}

// ---------- MCP (task 11) ----------

// Translate plugin/.mcp.json into the shape Codex actually authenticates with.
// Codex does NOT interpolate ${VAR} inside `headers` (prove-out X4: the request
// reached the gateway with an empty bearer and came back
// AUTHORIZATION_REQUIRED); its native form is `bearer_token_env_var`, which the
// same test then proved end to end. The env var name is read out of the source
// header rather than hardcoded, and anything that does not fit that pattern
// fails the run — a silently unauthenticated server is worse than no server.
function mcpConfig(tree) {
  const src = tree.files.find((f) => f.rel === '.mcp.json');
  if (!src) throw new Error('emit-codex: plugin/.mcp.json missing');
  const servers = JSON.parse(src.text).mcpServers ?? {};
  const out = {};
  for (const [name, config] of Object.entries(servers)) {
    const { headers, ...rest } = config;
    const auth = String(headers?.Authorization ?? headers?.authorization ?? '');
    const m = auth.match(/^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
    if (!m) {
      throw new Error(`emit-codex: plugin/.mcp.json: server "${name}" carries no "Authorization: Bearer \${VAR}" header — the Codex auth rewrite (bearer_token_env_var, prove-out X4) has nothing to translate, refusing to emit`);
    }
    for (const key of Object.keys(headers)) {
      if (!/^authorization$/i.test(key)) {
        throw new Error(`emit-codex: plugin/.mcp.json: server "${name}" sets header "${key}", which cannot be carried over — Codex does not interpolate \${VAR} in headers (prove-out X4); give it a deliberate mapping`);
      }
    }
    out[name] = { ...rest, bearer_token_env_var: m[1] };
  }
  if (!Object.keys(out).length) {
    throw new Error('emit-codex: plugin/.mcp.json declares no mcpServers — refusing to emit');
  }
  return `${JSON.stringify({ mcpServers: out }, null, 2)}\n`;
}

// ---------- hooks (task 11) ----------

// Map a source (Claude-schema) PreToolUse matcher to its Codex matcher and the
// wrapper flavor it needs. `Bash` is the tool name Codex really sends (LIVE,
// prove-out X3 stdin capture), so that one keeps its matcher. The edit hooks go
// out MATCHER-LESS: Codex intercepts file edits through `apply_patch`
// (documented) but that tool_input shape is unverified, so the wrapper filters
// on stdin instead of a matcher we would be guessing at.
function codexMatcherFor(matcher) {
  const parts = String(matcher ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => p === 'Bash')) return { matcher: 'Bash', kind: 'shell' };
  if (parts.length && parts.every((p) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(p))) {
    return { matcher: null, kind: 'edit' };
  }
  throw new Error(`emit-codex: hooks/hooks.json: no Codex wiring for matcher "${matcher}" — refusing to emit`);
}

// Read plugin/hooks/hooks.json and derive the groups to re-emit — discovered,
// not hardcoded, so a 4th hook wired at the source is picked up here with zero
// emitter changes.
function readHookWiring(tree) {
  const src = tree.files.find((f) => f.rel === 'hooks/hooks.json');
  if (!src) throw new Error('emit-codex: plugin/hooks/hooks.json missing');
  const config = JSON.parse(src.text);
  const groups = [];
  for (const [event, sourceGroups] of Object.entries(config.hooks ?? {})) {
    if (event !== 'PreToolUse') {
      throw new Error(`emit-codex: hooks/hooks.json: unmapped source hook event "${event}" — give it a Codex wiring`);
    }
    for (const group of sourceGroups) {
      const { matcher, kind } = codexMatcherFor(group.matcher);
      const scripts = [];
      for (const h of group.hooks ?? []) {
        const m = String(h.command ?? '').match(/\/hooks\/([A-Za-z0-9_.-]+\.sh)$/);
        if (!m) {
          throw new Error(`emit-codex: hooks/hooks.json: cannot extract a hooks/*.sh script from command "${h.command}"`);
        }
        if (!tree.files.some((f) => f.rel === `hooks/${m[1]}`)) {
          throw new Error(`emit-codex: hooks/hooks.json references hooks/${m[1]}, which does not exist`);
        }
        scripts.push(m[1]);
      }
      if (!scripts.length) throw new Error(`emit-codex: hooks/hooks.json: group with matcher "${group.matcher}" wires no scripts`);
      groups.push({ matcher, kind, scripts });
    }
  }
  if (!groups.length) throw new Error('emit-codex: hooks/hooks.json wires no hooks — unexpected');
  return groups;
}

// The one line every wrapper ends on: the shared script asked to block
// (exit 2), so translate its stderr into the ONLY deny Codex honors — the pure
// hookSpecificOutput JSON, exit 0, nothing else on stdout (prove-out X3 rounds
// 4-5). jq is fair game: the shared scripts already require it.
const DENY_JQ = `jq -Rsc '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:sub("\\n+$";"")}}'`;

// Generated POSIX-sh wrapper around one shared guardrail script. `kind` is
// 'shell' (Bash matcher — stdin passes straight through) or 'edit'
// (matcher-less — the wrapper decides whether this tool call is an edit).
function hookWrapper(script, kind) {
  const filter = kind === 'shell'
    ? `# Codex's hook stdin is Claude Code-identical (LIVE — the X3 stdin capture
# showed session_id / tool_name / tool_input.command verbatim), so it is passed
# through UNCHANGED: no field mapping, and the shared script stays the single
# source of truth for what counts as a violation.
PAYLOAD="$INPUT"
`
    : `# No matcher in hooks.json for the edit hooks, so this fires on every
# PreToolUse and filters here.
#   * Edit / Write / MultiEdit / NotebookEdit — the Claude Code-compatible tool
#     names, whose stdin the shared script already understands: passed through
#     UNCHANGED.
#   * apply_patch — Codex's documented file-edit interception point, but its
#     tool_input shape is UNVERIFIED (see hooks/README.md). Best effort: pull a
#     file path and the incoming text out of the fields that plausibly carry
#     them; if the shape is unrecognizable, fail open rather than guess.
#   * anything else — not an edit, nothing to check.
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || exit 0
case "$TOOL" in
  Edit|Write|MultiEdit|NotebookEdit)
    PAYLOAD="$INPUT"
    ;;
  apply_patch)
    PAYLOAD=$(printf '%s' "$INPUT" | jq -c '
      (.tool_input // {}) as $ti
      | (($ti.file_path // $ti.path // $ti.filename
          // (($ti.changes // {}) | if type == "object" then (keys | first) else null end)) // "") as $path
      | (($ti.content // $ti.new_content // $ti.new_string // $ti.patch // $ti.input // "")) as $text
      | if ($path | type) == "string" and $path != "" and ($text | type) == "string"
        then {tool_name: "Write", tool_input: {file_path: $path, content: $text}}
        else empty
        end' 2>/dev/null) || exit 0
    [ -n "$PAYLOAD" ] || exit 0
    ;;
  *)
    exit 0
    ;;
esac
`;

  return `#!/bin/sh
# Generated by tools/gen-cross-tool (emit-codex) — do not edit; see
# dist/codex/GENERATED.md. Codex PreToolUse wrapper around
# shared/${script}, a byte-identical copy of plugin/hooks/${script} —
# the guardrail logic lives ONCE there, never forked.
#
# Why a wrapper when Codex's hook contract is Claude Code-shaped (prove-out X3,
# .claude/specs/cross-tool-plugin-output/prove-out.md): the INPUT needs no
# mapping, but the OUTPUT does. Exit codes are not a reliable deny on Codex —
# its Windows harness collapses them to 0/1, and a nonzero exit only makes Codex
# report a failed hook and CONTINUE (fail open). The one live-proven block is
# the pure hookSpecificOutput JSON on stdout with exit 0, and any other stdout
# gets rejected as invalid pre-tool-use JSON. So: run the shared script,
# translate exit 2 + stderr into that JSON, and in every other case exit 0 with
# NOTHING on stdout.
#
# Script location: hook commands run with the SESSION cwd, never the plugin dir
# (X3, second root cause), so shared/ is found through PLUGIN_ROOT — the env var
# Codex sets for plugin hooks; CLAUDE_PLUGIN_ROOT is its documented compat alias
# and held the identical value live. A $0-based guess is the last resort.
#
# Defensive by design: hooks fail open, so every error path here exits 0
# silently. A crashing wrapper is a silently dead guardrail, and a wrapper bug
# must never hard-block the user.

INPUT=$(cat 2>/dev/null) || exit 0
[ -n "$INPUT" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

ROOT="\${PLUGIN_ROOT:-}"
[ -n "$ROOT" ] || ROOT="\${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$ROOT" ]; then
  ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." 2>/dev/null && pwd) || exit 0
fi
SHARED="$ROOT/hooks/shared/${script}"
[ -f "$SHARED" ] || exit 0

${filter}
MSG=$(printf '%s' "$PAYLOAD" | "$SHARED" 2>&1 >/dev/null)
STATUS=$?
[ "$STATUS" -eq 2 ] || exit 0

printf '%s' "$MSG" | ${DENY_JQ} || exit 0
exit 0
`;
}

const HOOKS_README = `# Codex hook wiring — generated, do not edit

Generated by \`tools/gen-cross-tool\` from \`plugin/hooks/\` (see
\`../../GENERATED.md\`); regenerate with \`npm run gen\`. Layout:

- \`shared/\` — byte-identical copies of \`plugin/hooks/*.sh\`. The guardrail
  logic lives ONCE, in those sources; never fork or edit the copies.
- \`*-codex.sh\` — generated thin wrappers. Codex's hook **stdin** is Claude
  Code-identical, so nothing is remapped on the way in; what the wrappers do is
  translate the shared script's exit 2 into the deny shape Codex honors (below).
- \`hooks.json\` — the hook config the plugin manifest points at, in the
  Claude-compatible schema (\`PreToolUse\` groups).

## ⚠ Hooks do nothing until you trust them

Codex **silently skips** plugin hooks that have not been reviewed. On the
plugin's page the Hooks section shows "needs review before it can run" with
**Review / Trust all** buttons (in the CLI: \`/hooks\`). Until you do that, the
guardrails are simply off — there is no log, no warning, no difference from a
broken hook. Trust is per hook *definition*, so **every release that changes a
hook needs re-trusting.**

## How a block actually happens

The task-1 prove-out walked the whole failure ladder here
(\`.claude/specs/cross-tool-plugin-output/prove-out.md\`, X3):

1. **Untrusted** hooks never run (above).
2. Hook commands run with the **session cwd**, not the plugin dir, so a
   plugin-relative command path just fails to resolve. Every command here is
   \`sh -c '"$PLUGIN_ROOT"/hooks/…'\` and each wrapper finds \`shared/\` through
   \`$PLUGIN_ROOT\` (\`$CLAUDE_PLUGIN_ROOT\` is the compat alias).
3. **Exit codes are not a reliable deny.** Codex's Windows harness collapses
   hook exit codes to 0/1, and a nonzero exit means "hook failed" — Codex
   reports it and **continues** the tool call. The documented exit-2 block is
   therefore unreachable there; the POSIX path is still to be confirmed.
4. The one deny that works is the **pure \`hookSpecificOutput\` JSON** on stdout
   with **exit 0**. Extra top-level keys get rejected ("invalid pre-tool-use
   JSON output"), which marks the hook run failed — i.e. fails open. So the
   wrappers print exactly that object and nothing else, ever.

Because hooks fail open on any error, the wrappers are defensive everywhere: no
jq, no \`$PLUGIN_ROOT\`, missing shared script, unparsable stdin → exit 0,
silently.

## What is wired, and what is still provisional

| Guardrail | Matcher | Status |
|---|---|---|
| block-tsc | \`Bash\` | Proven live — \`Bash\` is the tool name Codex sends, and the deny was verified falsifiably (the blocked command never ran) |
| block-generated-files | *(none)* | Fires on every PreToolUse; the wrapper filters |
| block-inline-frontend | *(none)* | Fires on every PreToolUse; the wrapper filters |

The two edit guardrails are matcher-less on purpose. Codex intercepts file
edits through **\`apply_patch\`** (documented), but its \`tool_input\` shape has
not been verified, so the wrappers accept either form:

- \`Edit\`/\`Write\`/\`MultiEdit\`/\`NotebookEdit\` (Claude Code-compatible) —
  passed through unchanged, fully supported;
- \`apply_patch\` — **best effort, pending verification.** The wrapper looks for
  a file path (\`file_path\`, \`path\`, \`filename\`, or the first key of a
  \`changes\` object) and the incoming text (\`content\`, \`new_content\`,
  \`new_string\`, \`patch\`, \`input\`). If the real shape uses other field
  names, the wrapper does not recognize it and fails open — the guardrail is
  skipped, nothing breaks. Confirming the shape on WSL and fixing the mapping is
  task 14 of the cross-tool-plugin-output spec.
`;

function emit(tree) {
  const manifest = readManifest(tree);
  const files = {};

  // Skills: verbatim except the two shared transforms. Everything else in the
  // source tree (agents, hooks, .mcp.json, the Claude manifest) is re-emitted
  // in its own Codex shape below.
  for (const f of tree.files) {
    if (!f.rel.startsWith('skills/')) continue;
    let text = f.text;
    if (f.rel.endsWith('/SKILL.md')) {
      text = transformFrontmatter(text, ['allowed-tools'], KNOWN_SKILL_FM, f.rel, LABEL);
    }
    text = rewriteRefs(text, f.rel, tree.root, mapTarget, LABEL);
    files[`${OUT_PLUGIN}/${f.rel}`] = text;
  }

  // Agents (task 11): TOML payload, NOT a plugin surface — prove-out X5. The
  // rename map is built first so prose in any body can address another agent by
  // the name Codex actually answers to.
  const agentFiles = tree.files.filter((f) => /^agents\/[^/]+\.md$/.test(f.rel));
  if (!agentFiles.length) throw new Error('emit-codex: plugin/agents/*.md missing — nothing to convert');
  for (const f of tree.files) {
    if (f.rel.startsWith('agents/') && !/^agents\/[^/]+\.md$/.test(f.rel)) {
      throw new Error(`emit-codex: plugin/${f.rel}: unexpected file under agents/ — only top-level *.md agent definitions convert to Codex TOML, give this one a deliberate mapping`);
    }
  }
  const renames = agentFiles.map((f) => {
    const sourceName = parseFrontmatter(f.text)?.data.name;
    if (!sourceName) throw new Error(`emit-codex: ${f.rel}: frontmatter has no "name"`);
    return [sourceName, codexAgentName(sourceName, f.rel)];
  });
  for (const f of agentFiles) {
    const name = codexAgentName(parseFrontmatter(f.text).data.name, f.rel);
    files[`${OUT_PLUGIN}/agents/${name}.toml`] = agentToml(f, tree.root, renames);
  }
  files[`${OUT_PLUGIN}/agents/README.md`] = AGENTS_README;

  // Hooks (task 11): shared scripts verbatim + generated wrappers + the
  // Claude-compatible hooks.json + the trust-gate/degradation README. Shared
  // copies and wrappers are executable POSIX sh.
  for (const f of tree.files) {
    if (f.rel.startsWith('hooks/') && f.rel.endsWith('.sh')) {
      files[`${OUT_PLUGIN}/hooks/shared/${f.rel.slice('hooks/'.length)}`] = { text: f.text, mode: 0o755 };
    }
  }
  const hooksConfig = { hooks: { PreToolUse: [] } };
  for (const group of readHookWiring(tree)) {
    const entry = {};
    if (group.matcher) entry.matcher = group.matcher;
    entry.hooks = group.scripts.map((script) => {
      const wrapper = script.replace(/\.sh$/, '-codex.sh');
      files[`${OUT_PLUGIN}/hooks/${wrapper}`] = { text: hookWrapper(script, group.kind), mode: 0o755 };
      // `sh -c` makes the $PLUGIN_ROOT expansion self-contained no matter how
      // Codex spawns the command (X3: commands run from the session cwd, so a
      // plugin-relative path never resolves).
      return { type: 'command', command: `sh -c '"$PLUGIN_ROOT"/hooks/${wrapper}'` };
    });
    hooksConfig.hooks.PreToolUse.push(entry);
  }
  files[`${OUT_PLUGIN}/hooks/hooks.json`] = `${JSON.stringify(hooksConfig, null, 2)}\n`;
  files[`${OUT_PLUGIN}/hooks/README.md`] = HOOKS_README;

  // MCP (task 11): same gateway server, Codex's native bearer_token_env_var
  // (prove-out X4 — a ${VAR} in headers is never interpolated).
  files[`${OUT_PLUGIN}/.mcp.json`] = mcpConfig(tree);

  // Belt and suspenders: nothing emitted may still carry the variable.
  for (const [rel, content] of Object.entries(files)) {
    if (contentText(content).includes('${CLAUDE_PLUGIN_ROOT}')) {
      throw new Error(`emit-codex: ${rel}: unrewritten \${CLAUDE_PLUGIN_ROOT} survived the transform — refusing to emit`);
    }
  }

  // Codex plugin manifest. Path fields must be relative and ./-prefixed. No
  // "agents" field on purpose: plugin-bundled subagents do not register on
  // Codex (prove-out X5), so agents/ is payload the enablement step installs.
  files[`${OUT_PLUGIN}/.codex-plugin/plugin.json`] = `${JSON.stringify({
    name: PLUGIN_NAME,
    version: manifest.version,
    description: manifest.description,
    skills: './skills/',
    hooks: './hooks/hooks.json',
    mcpServers: './.mcp.json',
  }, null, 2)}\n`;

  files['dist/codex/GENERATED.md'] = GENERATED_MD;

  // Root Codex marketplace, at Codex's documented location. The local source
  // with a nested ./dist path is what the prove-out installed from (X1), and
  // G1 confirmed the same shape resolves when the repo is added remotely with
  // `codex plugin marketplace add <owner>/<repo>`. No version here on purpose:
  // Codex reads it from the plugin's own manifest (that is what keys the
  // versioned install cache), so duplicating it would just be a second place
  // to drift.
  files[MARKETPLACE] = `${JSON.stringify({
    name: 'bluestep',
    interface: { displayName: 'BlueStep Tools' },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: { source: 'local', path: `./${OUT_PLUGIN}` },
        policy: { installation: 'AVAILABLE' },
      },
    ],
  }, null, 2)}\n`;

  reportBudget(budgetEntries(files));

  return files;
}

// --check structural self-test: re-emit in memory (any unmappable ref surfaces
// here as a finding, not a crash), then assert the on-disk output matches and
// honors the task-10 contracts.
function check(tree, ctx) {
  const problems = [];
  let files;
  try {
    files = emit(tree, ctx);
  } catch (err) {
    problems.push(`codex: emit failed — ${err.message}`);
    return problems;
  }

  // Disk must match a fresh emit exactly (stale output = finding).
  const diskRels = new Set();
  for (const dir of ['dist/codex', '.agents/plugins']) {
    const abs = join(ctx.repoRoot, ...dir.split('/'));
    if (!existsSync(abs)) {
      problems.push(`codex: ${dir}/ missing — run npm run gen`);
      continue;
    }
    for (const rel of walkSorted(abs)) diskRels.add(`${dir}/${rel}`);
  }
  for (const [rel, content] of Object.entries(files)) {
    if (!diskRels.has(rel)) {
      problems.push(`codex: ${rel} missing on disk — run npm run gen`);
    } else if (readFileSync(join(ctx.repoRoot, ...rel.split('/')), 'utf8') !== contentText(content).replace(/\r\n/g, '\n')) {
      problems.push(`codex: ${rel} is stale — run npm run gen`);
    }
  }
  for (const rel of diskRels) {
    if (!(rel in files)) problems.push(`codex: ${rel} on disk but not emitted — run npm run gen`);
  }

  // Every source skill reaches the output tree.
  const skillDirs = [...new Set(
    tree.files.filter((f) => f.rel.startsWith('skills/')).map((f) => f.rel.split('/')[1])
  )].sort();
  for (const dir of skillDirs) {
    if (!(`${OUT_PLUGIN}/skills/${dir}/SKILL.md` in files)) {
      problems.push(`codex: source skill ${dir} missing from the output tree`);
    }
  }

  // No unrewritten variable anywhere; no allowed-tools in emitted frontmatter.
  for (const [rel, content] of Object.entries(files)) {
    const text = contentText(content);
    if (text.includes('${CLAUDE_PLUGIN_ROOT}')) {
      problems.push(`codex: ${rel}: \${CLAUDE_PLUGIN_ROOT} occurrence in output`);
    }
    if (rel.endsWith('/SKILL.md')) {
      const fm = parseFrontmatter(text);
      if (fm && 'allowed-tools' in fm.data) problems.push(`codex: ${rel}: allowed-tools survived in frontmatter`);
    }
  }

  // Plugin manifest: parses, mirrors the shared version, and every path field
  // it carries is ./-prefixed (Codex requires it) and points at emitted files.
  const manifestRel = `${OUT_PLUGIN}/.codex-plugin/plugin.json`;
  try {
    const parsed = JSON.parse(contentText(files[manifestRel] ?? ''));
    if (parsed.name !== PLUGIN_NAME) problems.push(`codex: ${manifestRel}: name "${parsed.name}" is not "${PLUGIN_NAME}"`);
    if (parsed.version !== ctx.version) {
      problems.push(`codex: ${manifestRel}: version "${parsed.version}" does not mirror the Claude manifest ("${ctx.version}")`);
    }
    if (!parsed.description) problems.push(`codex: ${manifestRel}: no description`);
    if (parsed.agents !== undefined) {
      problems.push(`codex: ${manifestRel}: "agents" field present — plugin-bundled subagents do not register on Codex (prove-out X5); they ship via the enablement step`);
    }
    for (const field of MANIFEST_PATH_FIELDS) {
      const value = parsed[field];
      if (value === undefined) continue;
      if (!String(value).startsWith('./')) {
        problems.push(`codex: ${manifestRel}: "${field}" path "${value}" is not ./-prefixed (Codex requires relative ./ paths)`);
        continue;
      }
      const target = `${OUT_PLUGIN}/${String(value).slice(2).replace(/\/$/, '')}`;
      if (!Object.keys(files).some((rel) => rel === target || rel.startsWith(`${target}/`))) {
        problems.push(`codex: ${manifestRel}: "${field}" points at ${value}, which the emitter produced nothing for`);
      }
    }
  } catch (err) {
    problems.push(`codex: ${manifestRel}: invalid JSON — ${err.message}`);
  }

  // Marketplace: parses, and its single entry's ./-prefixed local source path
  // resolves to the emitted plugin dir (the manifest lives right there).
  try {
    const parsed = JSON.parse(contentText(files[MARKETPLACE] ?? ''));
    const entry = parsed.plugins?.[0];
    if (!entry) {
      problems.push(`codex: ${MARKETPLACE}: no plugins[] entry`);
    } else {
      if (entry.name !== PLUGIN_NAME) problems.push(`codex: ${MARKETPLACE}: entry name "${entry.name}" is not "${PLUGIN_NAME}"`);
      const path = entry.source?.path;
      if (entry.source?.source !== 'local' || !String(path ?? '').startsWith('./')) {
        problems.push(`codex: ${MARKETPLACE}: source must be {source:"local", path:"./…"} (the prove-out-proven shape), got ${JSON.stringify(entry.source)}`);
      } else if (!(`${String(path).slice(2)}/.codex-plugin/plugin.json` in files)) {
        problems.push(`codex: ${MARKETPLACE}: source path "${path}" does not hold an emitted .codex-plugin/plugin.json`);
      }
    }
  } catch (err) {
    problems.push(`codex: ${MARKETPLACE}: invalid JSON — ${err.message}`);
  }

  // ---- task-11 wiring assertions ----

  // Exec-bit checks only make sense on POSIX (Windows has no mode bits; the
  // committed bits come from POSIX runs and are re-verified by the Linux CI).
  const canCheckMode = process.platform !== 'win32';
  const executableOnDisk = (rel) => {
    try {
      return (statSync(join(ctx.repoRoot, ...rel.split('/'))).mode & 0o111) !== 0;
    } catch {
      return false;
    }
  };

  // hooks.json: parses, wires PreToolUse, and every command resolves its
  // wrapper through $PLUGIN_ROOT (never a session-cwd-relative path — the X3
  // failure that silently disabled the guardrails). Each wrapper exists and is
  // executable.
  const hooksRel = `${OUT_PLUGIN}/hooks/hooks.json`;
  try {
    const cfg = JSON.parse(contentText(files[hooksRel] ?? ''));
    const groups = cfg.hooks?.PreToolUse;
    if (!Array.isArray(groups) || !groups.length) {
      problems.push(`codex: ${hooksRel}: no PreToolUse groups — the guardrails would be unwired`);
    }
    for (const group of groups ?? []) {
      for (const entry of group.hooks ?? []) {
        const cmd = String(entry.command ?? '');
        const m = cmd.match(/^sh -c '"\$PLUGIN_ROOT"\/hooks\/([A-Za-z0-9_.-]+\.sh)'$/);
        if (!m) {
          problems.push(`codex: ${hooksRel}: command ${JSON.stringify(cmd)} does not resolve its script via "$PLUGIN_ROOT" (hook commands run with the session cwd — prove-out X3)`);
          continue;
        }
        const wrapperRel = `${OUT_PLUGIN}/hooks/${m[1]}`;
        if (!(wrapperRel in files)) {
          problems.push(`codex: ${hooksRel}: command references hooks/${m[1]}, which the emitter produced nothing for`);
        } else if (canCheckMode && !executableOnDisk(wrapperRel)) {
          problems.push(`codex: ${wrapperRel}: referenced by hooks.json but not executable on disk — run npm run gen`);
        }
      }
    }
  } catch (err) {
    problems.push(`codex: ${hooksRel}: invalid JSON — ${err.message}`);
  }

  // Every emitted .sh (wrappers + shared copies) carries the exec bit.
  if (canCheckMode) {
    for (const rel of Object.keys(files)) {
      if (rel.endsWith('.sh') && diskRels.has(rel) && !executableOnDisk(rel)) {
        problems.push(`codex: ${rel}: not executable on disk — run npm run gen`);
      }
    }
  }

  // Shared scripts are byte-identical to their plugin/hooks/*.sh sources.
  for (const f of tree.files) {
    if (!f.rel.startsWith('hooks/') || !f.rel.endsWith('.sh')) continue;
    const outRel = `${OUT_PLUGIN}/hooks/shared/${f.rel.slice('hooks/'.length)}`;
    const out = files[outRel];
    if (!out) {
      problems.push(`codex: ${outRel}: shared copy of ${f.rel} missing from the output`);
    } else if (contentText(out) !== f.text) {
      problems.push(`codex: ${outRel}: not byte-identical to plugin/${f.rel} — shared scripts must never be forked`);
    }
  }

  // MCP: parses, authenticates the Codex-native way (bearer_token_env_var), and
  // carries no header-based auth — Codex never interpolates ${VAR} in headers
  // (prove-out X4), so a header here would ship an unauthenticated server.
  const mcpRel = `${OUT_PLUGIN}/.mcp.json`;
  try {
    const parsed = JSON.parse(contentText(files[mcpRel] ?? ''));
    const servers = Object.entries(parsed.mcpServers ?? {});
    if (!servers.length) problems.push(`codex: ${mcpRel}: no mcpServers`);
    for (const [name, config] of servers) {
      if (!config.bearer_token_env_var) {
        problems.push(`codex: ${mcpRel}: server "${name}" has no bearer_token_env_var (the only auth form Codex honors — prove-out X4)`);
      }
      if (config.headers !== undefined) {
        problems.push(`codex: ${mcpRel}: server "${name}" carries a "headers" block — Codex does not interpolate \${VAR} there (prove-out X4)`);
      }
    }
  } catch (err) {
    problems.push(`codex: ${mcpRel}: invalid JSON — ${err.message}`);
  }

  // The token itself is never interpolated by Codex, so the literal ${…} form
  // must not appear anywhere in the output (it would look wired and silently
  // authenticate with an empty bearer).
  for (const [rel, content] of Object.entries(files)) {
    if (/\$\{B6PT_TOKEN\}/.test(contentText(content))) {
      problems.push(`codex: ${rel}: \${B6PT_TOKEN} occurrence — Codex does not interpolate it (prove-out X4); the env var goes in bearer_token_env_var`);
    }
  }

  // Agents: one TOML per source agent, Codex-legal names, structurally parsable,
  // and no hyphenated agent name left in the payload (Codex answers to the
  // underscored one — prove-out X5). Plus the install README, since the files
  // are useless without it.
  const agentFiles = tree.files.filter((f) => /^agents\/[^/]+\.md$/.test(f.rel));
  const sourceNames = agentFiles.map((f) => parseFrontmatter(f.text)?.data.name).filter(Boolean);
  for (const f of agentFiles) {
    const sourceName = parseFrontmatter(f.text)?.data.name;
    if (!sourceName) continue; // emit() already reported it
    let name;
    try {
      name = codexAgentName(sourceName, f.rel);
    } catch (err) {
      problems.push(`codex: ${err.message}`);
      continue;
    }
    const rel = `${OUT_PLUGIN}/agents/${name}.toml`;
    const text = contentText(files[rel] ?? '');
    if (!text) {
      problems.push(`codex: ${rel}: no TOML emitted for plugin/${f.rel}`);
      continue;
    }
    let parsed;
    try {
      parsed = parseSimpleToml(text);
    } catch (err) {
      problems.push(`codex: ${rel}: malformed TOML — ${err.message}`);
      continue;
    }
    if (parsed.name !== name) problems.push(`codex: ${rel}: name "${parsed.name}" is not the Codex-legal "${name}"`);
    if (!/^[a-z0-9_]+$/.test(String(parsed.name))) {
      problems.push(`codex: ${rel}: name "${parsed.name}" is not lowercase_underscore (Codex rejects anything else — prove-out X5)`);
    }
    if (!parsed.description) problems.push(`codex: ${rel}: no description`);
    if (!String(parsed.developer_instructions ?? '').trim()) {
      problems.push(`codex: ${rel}: developer_instructions is empty — the agent body did not survive`);
    }
    // Prose the model reads (description + instructions) must address agents by
    // the name Codex answers to. The generated comment header is exempt — it
    // cites the real source filename on purpose.
    for (const other of sourceNames) {
      for (const field of ['description', 'developer_instructions']) {
        if (String(parsed[field] ?? '').includes(other)) {
          problems.push(`codex: ${rel}: ${field} still says "${other}" — Codex only answers to "${other.replaceAll('-', '_')}" (prove-out X5)`);
        }
      }
    }
  }
  if (!(`${OUT_PLUGIN}/agents/README.md` in files)) {
    problems.push(`codex: ${OUT_PLUGIN}/agents/README.md missing — the TOML payload needs its install note (Codex does not register plugin agents)`);
  }

  return problems;
}

export default {
  name: 'codex',
  outputDirs: ['dist/codex', '.agents/plugins'],
  emit,
  check,
};
