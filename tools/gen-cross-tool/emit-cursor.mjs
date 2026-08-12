// tools/gen-cross-tool/emit-cursor.mjs — Cursor emitter (content: task 8,
// hooks/MCP wiring: task 9).
//
// Scope decision (recorded per the design's task-8 decision point): this
// emitter produces the FULL native Cursor output. Cursor's built-in
// Claude-marketplace auto-import (seen live in the prove-out) is a bonus
// channel only — Cursor-only teammates have no Claude Code installed, so the
// native tree is the real delivery path.
//
// Emits:
//   dist/cursor/GENERATED.md                                (do-not-edit note)
//   dist/cursor/bluestep-tools/.cursor-plugin/plugin.json   (name/description/
//       version mirrored from plugin/.claude-plugin/plugin.json; skills/
//       agents/hooks/mcpServers path fields)
//   dist/cursor/bluestep-tools/skills/**   (allowed-tools stripped from
//       SKILL.md frontmatter; ${CLAUDE_PLUGIN_ROOT} refs rewritten relative)
//   dist/cursor/bluestep-tools/agents/*.md (tools:/model: frontmatter dropped)
//   dist/cursor/bluestep-tools/hooks/shared/*.sh  (byte-identical copies of
//       plugin/hooks/*.sh — the logic lives ONCE there, never forked)
//   dist/cursor/bluestep-tools/hooks/*-cursor.sh  (generated thin wrappers:
//       map Cursor hook stdin → Claude-style JSON → run the shared script →
//       map the result back; POSIX sh, fail open on any wrapper error)
//   dist/cursor/bluestep-tools/hooks/hooks.json   (Cursor schema, version 1;
//       matcher-less on purpose — prove-out lesson: matchers are the fragile
//       part, the scripts themselves decide)
//   dist/cursor/bluestep-tools/hooks/README.md    (wiring + the documented
//       degradation: the two edit guardrails are post-hoc/advisory on Cursor)
//   dist/cursor/bluestep-tools/mcp.json    (plugin/.mcp.json with
//       ${B6PT_TOKEN} → ${env:B6PT_TOKEN} — Cursor's interpolation syntax,
//       proven live in prove-out C6)
//   .cursor-plugin/marketplace.json        (root marketplace; nested ./-source
//       layout proven live in the task-1 prove-out, C1/G1)
//
// Hook wiring strategy: derived from plugin/hooks/hooks.json (discovered, not
// hardcoded — a 4th hook wired there is picked up automatically). Cursor has
// no blocking pre-edit event that carries the new content (prove-out C5,
// parked runtime question), so:
//   matcher "Bash"       → beforeShellExecution (blocking: deny JSON, exit 0)
//   matcher "Edit|Write" → afterFileEdit (fire-and-forget: POST-HOC/ADVISORY —
//       stdout is ignored, violations go to stderr → Cursor's hook logs; the
//       wrapper headers and hooks/README.md say so plainly, no pretend-block)
// Any other source event/matcher fails the run loudly.
//
// ${CLAUDE_PLUGIN_ROOT} rewrite strategy: Cursor exposes no plugin-root
// variable usable in prose, but every ref lives in a file whose own installed
// location is known — so each ref becomes a path RELATIVE to the containing
// file's directory (e.g. in skills/spec-execute/SKILL.md,
// ${CLAUDE_PLUGIN_ROOT}/skills/bluestep-reference/SKILL.md →
// ../bluestep-reference/SKILL.md). The rewrite itself is lib.mjs's shared
// rewriteRefs() (the Codex emitter uses it too); this module supplies only the
// Cursor target mapping below. The Claude manifest ref maps to the emitted
// Cursor manifest (.claude-plugin/plugin.json → .cursor-plugin/plugin.json —
// same name/description/version fields). Any ref this emitter cannot map, or
// whose target does not exist, FAILS the run loudly — no silent passthrough
// (design edge case).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contentText, parseFrontmatter, rewriteRefs, transformFrontmatter, walkSorted } from './lib.mjs';

const LABEL = 'emit-cursor';
const PLUGIN_NAME = 'bluestep-tools';
const OUT_PLUGIN = `dist/cursor/${PLUGIN_NAME}`;

// Frontmatter keys this emitter understands. Unknown keys pass through to
// Cursor (it ignores unknown keys per docs) but get a warning, so new Claude
// Code fields receive a deliberate mapping decision instead of silent drift.
const KNOWN_SKILL_FM = new Set(['name', 'description', 'allowed-tools']);
const KNOWN_AGENT_FM = new Set(['name', 'description', 'tools', 'model']);

const GENERATED_MD = `# Generated tree — do not edit

Everything under \`dist/cursor/\` is generated from \`plugin/**\` by
\`tools/gen-cross-tool\` (the Cursor emitter). Never hand-edit these files:
the generator wipes and rewrites this whole tree on every run, so edits here
are lost — edit the source under \`plugin/\` instead and regenerate with:

    npm run gen
`;

// Map a plugin-root-relative target to its path inside the emitted Cursor
// plugin dir. Throws on anything without a mapping (fail loudly).
function mapTarget(ref, where) {
  if (ref === '') return ''; // the plugin root itself
  if (ref === '.claude-plugin/plugin.json') return '.cursor-plugin/plugin.json';
  if (ref === '.mcp.json') return 'mcp.json';
  if (ref === 'hooks/hooks.json') return 'hooks/hooks.json'; // the Cursor-schema re-emit
  if (/^hooks\/[A-Za-z0-9_.-]+\.sh$/.test(ref)) return `hooks/shared/${ref.slice('hooks/'.length)}`;
  if (ref.startsWith('skills/') || ref.startsWith('agents/')) return ref;
  throw new Error(`emit-cursor: ${where}: no Cursor mapping for \${CLAUDE_PLUGIN_ROOT}/${ref} — refusing to emit`);
}

function readManifest(tree) {
  const src = tree.files.find((f) => f.rel === '.claude-plugin/plugin.json');
  if (!src) throw new Error('emit-cursor: plugin/.claude-plugin/plugin.json missing');
  return JSON.parse(src.text);
}

// ---------- hook wiring (task 9) ----------

// Map a source (Claude-schema) PreToolUse matcher to the Cursor event that
// carries the equivalent moment. Anything unrecognized fails loudly — a new
// kind of hook needs a deliberate wiring decision, not a silent guess.
function cursorEventFor(matcher) {
  const parts = String(matcher ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => p === 'Bash')) return 'beforeShellExecution';
  if (parts.length && parts.every((p) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(p))) {
    return 'afterFileEdit';
  }
  throw new Error(`emit-cursor: hooks/hooks.json: no Cursor event mapping for matcher "${matcher}" — refusing to emit`);
}

// Read plugin/hooks/hooks.json and derive [{ script, event }] — discovered,
// not hardcoded, so a future 4th hook wired at the source is picked up here
// with zero emitter changes.
function readHookWiring(tree) {
  const src = tree.files.find((f) => f.rel === 'hooks/hooks.json');
  if (!src) throw new Error('emit-cursor: plugin/hooks/hooks.json missing');
  const config = JSON.parse(src.text);
  const wiring = [];
  for (const [event, groups] of Object.entries(config.hooks ?? {})) {
    if (event !== 'PreToolUse') {
      throw new Error(`emit-cursor: hooks/hooks.json: unmapped source hook event "${event}" — give it a Cursor wiring`);
    }
    for (const group of groups) {
      const cursorEvent = cursorEventFor(group.matcher);
      for (const h of group.hooks ?? []) {
        const m = String(h.command ?? '').match(/\/hooks\/([A-Za-z0-9_.-]+\.sh)$/);
        if (!m) {
          throw new Error(`emit-cursor: hooks/hooks.json: cannot extract a hooks/*.sh script from command "${h.command}"`);
        }
        if (!tree.files.some((f) => f.rel === `hooks/${m[1]}`)) {
          throw new Error(`emit-cursor: hooks/hooks.json references hooks/${m[1]}, which does not exist`);
        }
        wiring.push({ script: m[1], event: cursorEvent });
      }
    }
  }
  if (!wiring.length) throw new Error('emit-cursor: hooks/hooks.json wires no hooks — unexpected');
  return wiring;
}

// Thin wrapper for a blocking shell hook (beforeShellExecution). Cursor stdin
// carries {command, cwd, ...}; the shared script expects Claude-style
// {tool_name, tool_input.command} and blocks with exit 2 + stderr; Cursor
// blocks on stdout {"permission":"deny",...} with exit 0. jq is fair game:
// the shared scripts already require it.
function shellWrapper(script) {
  return `#!/bin/sh
# Generated by tools/gen-cross-tool (emit-cursor) — do not edit; see
# dist/cursor/GENERATED.md. Cursor beforeShellExecution wrapper around
# shared/${script}, a byte-identical copy of plugin/hooks/${script} —
# the blocking logic lives ONCE there, never forked.
#
# Maps Cursor's stdin ({"command":...,"cwd":...}) to the Claude-style JSON
# the shared script expects ({"tool_name":"Bash","tool_input":{"command":..}}),
# runs it, and maps its exit-2 block to Cursor's deny JSON (exit 0).
# No matcher in hooks.json on purpose — the script itself decides (prove-out
# lesson: matchers are the fragile part).
#
# Defensive by design: Cursor hooks fail open, so ANY wrapper error must end
# in {"permission":"allow"} — a crashing wrapper is a silently dead guardrail,
# and a wrapper bug must never hard-block the user.

allow() {
  printf '{"permission":"allow"}\\n'
  exit 0
}

INPUT=$(cat 2>/dev/null) || allow
command -v jq >/dev/null 2>&1 || allow
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd) || allow
SHARED="$DIR/shared/${script}"
[ -f "$SHARED" ] || allow

CLAUDE_INPUT=$(printf '%s' "$INPUT" \\
  | jq -c '{tool_name:"Bash",tool_input:{command:(.command // "")}}' 2>/dev/null) || allow
[ -n "$CLAUDE_INPUT" ] || allow

MSG=$(printf '%s' "$CLAUDE_INPUT" | "$SHARED" 2>&1 >/dev/null)
STATUS=$?
if [ "$STATUS" -eq 2 ]; then
  printf '%s' "$MSG" | jq -Rsc '{permission:"deny",user_message:.,agent_message:.}'
  exit 0
fi
allow
`;
}

// Thin wrapper for an edit hook, degraded on Cursor (afterFileEdit). Cursor
// has no blocking pre-edit event carrying the new content (prove-out C5), so
// this fires AFTER the edit: it cannot block, and it says so — violations go
// to stderr (Cursor's hook logs); stdout is ignored for afterFileEdit.
function editWrapper(script) {
  return `#!/bin/sh
# Generated by tools/gen-cross-tool (emit-cursor) — do not edit; see
# dist/cursor/GENERATED.md. Cursor afterFileEdit wrapper around
# shared/${script}, a byte-identical copy of plugin/hooks/${script} —
# the guardrail logic lives ONCE there, never forked.
#
# DEGRADED ON CURSOR — POST-HOC / ADVISORY ONLY. Cursor has no blocking
# pre-edit hook event that carries the new content (prove-out C5,
# .claude/specs/cross-tool-plugin-output/prove-out.md), so this runs AFTER
# the edit already landed and cannot block or undo it. On a violation the
# shared script's message goes to stderr, which lands in Cursor's hook logs
# (afterFileEdit stdout is ignored). Until Cursor ships a blocking pre-edit
# event, this guardrail is advisory on Cursor — it does not pretend to block.
# See hooks/README.md.
#
# Maps Cursor's stdin ({"file_path":...,"edits":[{"old_string","new_string"}]})
# to the Claude-style JSON the shared script expects, joining the edits'
# new_strings as the incoming content.
#
# Defensive by design: Cursor hooks fail open, so ANY wrapper error exits 0
# silently — a crashing wrapper is a silently dead guardrail.

INPUT=$(cat 2>/dev/null) || exit 0
command -v jq >/dev/null 2>&1 || exit 0
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd) || exit 0
SHARED="$DIR/shared/${script}"
[ -f "$SHARED" ] || exit 0

CLAUDE_INPUT=$(printf '%s' "$INPUT" \\
  | jq -c '{tool_name:"Edit",tool_input:{file_path:(.file_path // ""),new_string:([.edits[]?.new_string // empty] | join("\\n"))}}' 2>/dev/null) || exit 0
[ -n "$CLAUDE_INPUT" ] || exit 0

MSG=$(printf '%s' "$CLAUDE_INPUT" | "$SHARED" 2>&1 >/dev/null)
STATUS=$?
if [ "$STATUS" -eq 2 ]; then
  printf '%s\\n' "POST-HOC on Cursor (edit already applied, cannot block): $MSG" >&2
fi
exit 0
`;
}

const HOOKS_README = `# Cursor hook wiring — generated, do not edit

Generated by \`tools/gen-cross-tool\` from \`plugin/hooks/\` (see
\`../../GENERATED.md\`); regenerate with \`npm run gen\`. Layout:

- \`shared/\` — byte-identical copies of \`plugin/hooks/*.sh\`. The guardrail
  logic lives ONCE, in those sources; never fork or edit the copies.
- \`*-cursor.sh\` — generated thin wrappers. Each maps Cursor's hook stdin to
  the Claude-style JSON its shared script expects, runs it, and maps the
  result back to what the Cursor event supports. Wrappers locate \`shared/\`
  via their own \`$0\` directory, so they work regardless of the process cwd.
- \`hooks.json\` — the Cursor-schema hook config the plugin manifest points at.

## What blocks and what does not (documented degradation)

| Guardrail | Cursor event | Behavior on Cursor |
|---|---|---|
| block-tsc | \`beforeShellExecution\` | Blocking — deny JSON before the command runs |
| block-generated-files | \`afterFileEdit\` | **Post-hoc / advisory only** |
| block-inline-frontend | \`afterFileEdit\` | **Post-hoc / advisory only** |

Cursor has no blocking pre-edit hook event that carries the new file content
(prove-out C5, \`.claude/specs/cross-tool-plugin-output/prove-out.md\`), so the
two edit guardrails run AFTER the edit has landed and cannot block or undo
it. On a violation they write the shared script's message to stderr, which
lands in Cursor's hook logs. Until Cursor ships a blocking pre-edit event,
treat these two as advisory on Cursor — they do not pretend to block.

## Deliberate choices

- **No matchers in hooks.json** — the task-1 prove-out showed matchers are the
  fragile part (tool names are surface-specific); the scripts themselves
  decide whether to act.
- **Fail open on wrapper error** — Cursor hooks fail open anyway, so a
  crashing wrapper is a silently dead guardrail; every wrapper error path
  ends in \`{"permission":"allow"}\` (shell) or a silent \`exit 0\` (edit).
  A wrapper bug must never hard-block the user.
- **Relative command paths** — \`./hooks/*-cursor.sh\` matches the
  registration-proven prove-out plugin. Whether Cursor resolves these against
  the plugin root at *runtime* is still an open question for the task-14
  smoke test; the wrappers' \`$0\`-based resolution of \`shared/\` keeps them
  cwd-independent either way.
`;

function emit(tree) {
  const manifest = readManifest(tree);
  const files = {};

  for (const f of tree.files) {
    const isSkill = f.rel.startsWith('skills/');
    const isAgent = f.rel.startsWith('agents/');
    if (!isSkill && !isAgent) continue; // hooks/.mcp.json/manifest: emitted separately below
    let text = f.text;
    if (isSkill && f.rel.endsWith('/SKILL.md')) {
      text = transformFrontmatter(text, ['allowed-tools'], KNOWN_SKILL_FM, f.rel, LABEL);
    }
    if (isAgent) {
      text = transformFrontmatter(text, ['tools', 'model'], KNOWN_AGENT_FM, f.rel, LABEL);
    }
    text = rewriteRefs(text, f.rel, tree.root, mapTarget, LABEL);
    files[`${OUT_PLUGIN}/${f.rel}`] = text;
  }

  // Hooks (task 9): shared scripts verbatim + generated wrappers + Cursor-
  // schema hooks.json + the degradation README. Shared copies are byte-
  // identical and executable; wrappers are executable POSIX sh.
  for (const f of tree.files) {
    if (f.rel.startsWith('hooks/') && f.rel.endsWith('.sh')) {
      files[`${OUT_PLUGIN}/hooks/shared/${f.rel.slice('hooks/'.length)}`] = { text: f.text, mode: 0o755 };
    }
  }
  const wiring = readHookWiring(tree);
  const hooksConfig = { version: 1, hooks: {} };
  for (const { script, event } of wiring) {
    const wrapper = script.replace(/\.sh$/, '-cursor.sh');
    files[`${OUT_PLUGIN}/hooks/${wrapper}`] = {
      text: event === 'beforeShellExecution' ? shellWrapper(script) : editWrapper(script),
      mode: 0o755,
    };
    (hooksConfig.hooks[event] ??= []).push({ type: 'command', command: `./hooks/${wrapper}` });
  }
  files[`${OUT_PLUGIN}/hooks/hooks.json`] = `${JSON.stringify(hooksConfig, null, 2)}\n`;
  files[`${OUT_PLUGIN}/hooks/README.md`] = HOOKS_README;

  // MCP (task 9): same server config, Cursor's env-interpolation syntax
  // (${env:B6PT_TOKEN} — proven live, prove-out C6).
  const mcpSrc = tree.files.find((f) => f.rel === '.mcp.json');
  if (!mcpSrc) throw new Error('emit-cursor: plugin/.mcp.json missing');
  const mcpText = mcpSrc.text.replaceAll('${B6PT_TOKEN}', '${env:B6PT_TOKEN}');
  if (!mcpText.includes('${env:B6PT_TOKEN}')) {
    throw new Error('emit-cursor: plugin/.mcp.json carries no ${B6PT_TOKEN} reference — the token rewrite found nothing, refusing to emit');
  }
  files[`${OUT_PLUGIN}/mcp.json`] = mcpText;

  // Belt and suspenders: nothing emitted may still carry the variable.
  for (const [rel, content] of Object.entries(files)) {
    if (contentText(content).includes('${CLAUDE_PLUGIN_ROOT}')) {
      throw new Error(`emit-cursor: ${rel}: unrewritten \${CLAUDE_PLUGIN_ROOT} survived the transform — refusing to emit`);
    }
  }

  // Cursor plugin manifest.
  files[`${OUT_PLUGIN}/.cursor-plugin/plugin.json`] = `${JSON.stringify({
    name: PLUGIN_NAME,
    description: manifest.description,
    version: manifest.version,
    skills: './skills/',
    agents: './agents/',
    hooks: './hooks/hooks.json',
    mcpServers: './mcp.json',
  }, null, 2)}\n`;

  files['dist/cursor/GENERATED.md'] = GENERATED_MD;

  // Root Cursor marketplace — nested ./-prefixed source proven in the prove-out.
  files['.cursor-plugin/marketplace.json'] = `${JSON.stringify({
    name: 'bluestep',
    owner: { name: 'BlueStep Systems' },
    plugins: [
      {
        name: PLUGIN_NAME,
        description: manifest.description,
        version: manifest.version,
        source: `./${OUT_PLUGIN}`,
      },
    ],
  }, null, 2)}\n`;

  return files;
}

// --check structural self-test: re-emit in memory (any unmappable ref
// surfaces here as a finding, not a crash), then assert the on-disk output
// matches and honors the task-8 + task-9 contracts.
function check(tree, ctx) {
  const problems = [];
  let files;
  try {
    files = emit(tree, ctx);
  } catch (err) {
    problems.push(`cursor: emit failed — ${err.message}`);
    return problems;
  }

  // Disk must match a fresh emit exactly (stale output = finding).
  const diskRels = new Set();
  for (const dir of ['dist/cursor', '.cursor-plugin']) {
    const abs = join(ctx.repoRoot, ...dir.split('/'));
    if (!existsSync(abs)) {
      problems.push(`cursor: ${dir}/ missing — run npm run gen`);
      continue;
    }
    for (const rel of walkSorted(abs)) diskRels.add(`${dir}/${rel}`);
  }
  for (const [rel, content] of Object.entries(files)) {
    if (!diskRels.has(rel)) {
      problems.push(`cursor: ${rel} missing on disk — run npm run gen`);
    } else if (readFileSync(join(ctx.repoRoot, ...rel.split('/')), 'utf8') !== contentText(content).replace(/\r\n/g, '\n')) {
      problems.push(`cursor: ${rel} is stale — run npm run gen`);
    }
  }
  for (const rel of diskRels) {
    if (!(rel in files)) problems.push(`cursor: ${rel} on disk but not emitted — run npm run gen`);
  }

  // Contract assertions on the emitted set.
  const skillDirs = [...new Set(
    tree.files.filter((f) => f.rel.startsWith('skills/')).map((f) => f.rel.split('/')[1])
  )].sort();
  for (const dir of skillDirs) {
    if (!(`${OUT_PLUGIN}/skills/${dir}/SKILL.md` in files)) {
      problems.push(`cursor: source skill ${dir} missing from the output tree`);
    }
  }
  for (const [rel, content] of Object.entries(files)) {
    const text = contentText(content);
    if (text.includes('${CLAUDE_PLUGIN_ROOT}')) {
      problems.push(`cursor: ${rel}: \${CLAUDE_PLUGIN_ROOT} occurrence in output`);
    }
    if (rel.endsWith('/SKILL.md')) {
      const fm = parseFrontmatter(text);
      if (fm && 'allowed-tools' in fm.data) problems.push(`cursor: ${rel}: allowed-tools survived in frontmatter`);
    }
  }
  for (const rel of [`${OUT_PLUGIN}/.cursor-plugin/plugin.json`, '.cursor-plugin/marketplace.json']) {
    try {
      const parsed = JSON.parse(contentText(files[rel]));
      const version = rel.endsWith('marketplace.json') ? parsed.plugins?.[0]?.version : parsed.version;
      if (version !== ctx.version) {
        problems.push(`cursor: ${rel}: version "${version}" does not mirror the Claude manifest ("${ctx.version}")`);
      }
    } catch (err) {
      problems.push(`cursor: ${rel}: invalid JSON — ${err.message}`);
    }
  }

  // ---- task-9 wiring assertions ----

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

  // hooks.json parses; every command it references exists and is executable.
  const hooksRel = `${OUT_PLUGIN}/hooks/hooks.json`;
  try {
    const cfg = JSON.parse(contentText(files[hooksRel] ?? ''));
    for (const entries of Object.values(cfg.hooks ?? {})) {
      for (const entry of entries) {
        const cmd = String(entry.command ?? '');
        if (!cmd.startsWith('./')) {
          problems.push(`cursor: ${hooksRel}: command "${cmd}" is not plugin-relative (./…)`);
          continue;
        }
        const cmdRel = `${OUT_PLUGIN}/${cmd.slice(2)}`;
        if (!(cmdRel in files)) {
          problems.push(`cursor: ${hooksRel}: command "${cmd}" has no emitted file at ${cmdRel}`);
        } else if (canCheckMode && !executableOnDisk(cmdRel)) {
          problems.push(`cursor: ${cmdRel}: referenced by hooks.json but not executable on disk — run npm run gen`);
        }
      }
    }
  } catch (err) {
    problems.push(`cursor: ${hooksRel}: invalid JSON — ${err.message}`);
  }

  // Every emitted .sh (wrappers + shared copies) carries the exec bit.
  if (canCheckMode) {
    for (const rel of Object.keys(files)) {
      if (rel.endsWith('.sh') && diskRels.has(rel) && !executableOnDisk(rel)) {
        problems.push(`cursor: ${rel}: not executable on disk — run npm run gen`);
      }
    }
  }

  // Shared scripts are byte-identical to their plugin/hooks/*.sh sources.
  for (const f of tree.files) {
    if (!f.rel.startsWith('hooks/') || !f.rel.endsWith('.sh')) continue;
    const outRel = `${OUT_PLUGIN}/hooks/shared/${f.rel.slice('hooks/'.length)}`;
    const out = files[outRel];
    if (!out) {
      problems.push(`cursor: ${outRel}: shared copy of ${f.rel} missing from the output`);
    } else if (contentText(out) !== f.text) {
      problems.push(`cursor: ${outRel}: not byte-identical to plugin/${f.rel} — shared scripts must never be forked`);
    }
  }

  // mcp.json parses, uses Cursor's ${env:…} token syntax, and carries no
  // bare ${B6PT_TOKEN} (which Cursor would not interpolate).
  const mcpRel = `${OUT_PLUGIN}/mcp.json`;
  const mcpText = contentText(files[mcpRel] ?? '');
  try {
    JSON.parse(mcpText);
  } catch (err) {
    problems.push(`cursor: ${mcpRel}: invalid JSON — ${err.message}`);
  }
  if (!mcpText.includes('${env:B6PT_TOKEN}')) {
    problems.push(`cursor: ${mcpRel}: missing \${env:B6PT_TOKEN} reference`);
  }
  if (/\$\{B6PT_TOKEN\}/.test(mcpText)) {
    problems.push(`cursor: ${mcpRel}: bare \${B6PT_TOKEN} present — Cursor only interpolates the \${env:…} form`);
  }

  // The manifest must point at the emitted wiring files.
  try {
    const parsed = JSON.parse(contentText(files[`${OUT_PLUGIN}/.cursor-plugin/plugin.json`]));
    if (parsed.hooks !== './hooks/hooks.json') problems.push('cursor: manifest "hooks" field missing or wrong');
    if (parsed.mcpServers !== './mcp.json') problems.push('cursor: manifest "mcpServers" field missing or wrong');
  } catch {
    // Already reported as invalid JSON above.
  }

  return problems;
}

export default {
  name: 'cursor',
  outputDirs: ['dist/cursor', '.cursor-plugin'],
  emit,
  check,
};
