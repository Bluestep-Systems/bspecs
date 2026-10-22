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
//       pass Cursor's preToolUse stdin straight to the shared script — it is
//       already {tool_name, tool_input} shaped — and map its exit-2 block to
//       Cursor's {"permission":"deny"} JSON; POSIX sh, no jq needed)
//   dist/cursor/bluestep-tools/hooks/hooks.json   (Cursor schema, version 1;
//       matcher-less on purpose — prove-out lesson: matchers are the fragile
//       part; each wrapper filters on tool_name itself)
//   dist/cursor/bluestep-tools/hooks/README.md    (wiring + what each
//       guardrail does on Cursor, and what is still unproven live)
//   dist/cursor/bluestep-tools/mcp.json    (plugin/.mcp.json with
//       ${B6PT_TOKEN} → ${env:B6PT_TOKEN} — Cursor's interpolation syntax,
//       proven live in prove-out C6)
//   .cursor-plugin/marketplace.json        (root marketplace; the plugin entry
//       carries only name/source/description — Cursor's marketplace schema
//       sets additionalProperties:false on an entry and rejects `version`
//       (issue #238: the whole import came back with 0 plugins). The plugin
//       dir is reached through metadata.pluginRoot + a bare source name, the
//       documented form; a "./"-prefixed source is not.)
//
// Hook wiring strategy: derived from plugin/hooks/hooks.json (discovered, not
// hardcoded — a 4th hook wired there is picked up automatically). Cursor's
// preToolUse event runs BEFORE any tool (Shell, Read, Write, Delete, MCP, …),
// carries {tool_name, tool_input} like Claude Code's PreToolUse, and blocks
// on {"permission":"deny"} (or exit 2). So every source PreToolUse group maps
// to preToolUse; the matcher only picks the tool-name filter the wrapper
// applies:
//   matcher "Bash"       → tools whose name contains Shell/Bash
//   matcher "Edit|Write" → tools whose name contains Write/Edit/Replace/Delete
// Any other source event/matcher fails the run loudly.
//
// Still unproven live (see hooks/README.md): the key Cursor's Write tool uses
// for the path inside tool_input. The shared scripts read file_path, path,
// target_file and relative_workspace_path; if Cursor uses yet another name
// the check matches nothing and the edit goes through unblocked.
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
// `compatibility` (Agent Skills spec, optional, advisory environment needs)
// passes through as-is.
const KNOWN_SKILL_FM = new Set(['name', 'description', 'allowed-tools', 'compatibility']);
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

// Map a source (Claude-schema) PreToolUse matcher to the ERE the Cursor
// wrapper applies to tool_name (every group lands on Cursor's preToolUse).
// Anything unrecognized fails loudly — a new kind of hook needs a deliberate
// wiring decision, not a silent guess.
function cursorToolFilterFor(matcher) {
  const parts = String(matcher ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => p === 'Bash')) return '[Ss]hell|[Bb]ash';
  if (parts.length && parts.every((p) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(p))) {
    return '[Ww]rite|[Ee]dit|[Rr]eplace|[Dd]elete';
  }
  throw new Error(`emit-cursor: hooks/hooks.json: no Cursor tool filter for matcher "${matcher}" — refusing to emit`);
}

// Read plugin/hooks/hooks.json and derive [{ script, tools }] — discovered,
// not hardcoded, so a future 4th hook wired at the source is picked up here
// with zero emitter changes.
function readHookWiring(tree) {
  const src = tree.files.find((f) => f.rel === 'hooks/hooks.json');
  if (!src) throw new Error('emit-cursor: plugin/hooks/hooks.json missing');
  const config = JSON.parse(src.text);
  const wiring = [];
  for (const [event, groups] of Object.entries(config.hooks ?? {})) {
    // SessionStart carries only hooks/canary.sh, a Claude Code-only environment check (it
    // reports a missing JSON parser once per session). Not wired here on purpose: Cursor hooks
    // are a different surface, and the canary's report path is Claude Code's stderr handling.
    if (event === 'SessionStart') continue;
    if (event !== 'PreToolUse') {
      throw new Error(`emit-cursor: hooks/hooks.json: unmapped source hook event "${event}" — give it a Cursor wiring`);
    }
    for (const group of groups) {
      const tools = cursorToolFilterFor(group.matcher);
      for (const h of group.hooks ?? []) {
        const m = String(h.command ?? '').match(/\/hooks\/([A-Za-z0-9_.-]+\.sh)$/);
        if (!m) {
          throw new Error(`emit-cursor: hooks/hooks.json: cannot extract a hooks/*.sh script from command "${h.command}"`);
        }
        if (!tree.files.some((f) => f.rel === `hooks/${m[1]}`)) {
          throw new Error(`emit-cursor: hooks/hooks.json references hooks/${m[1]}, which does not exist`);
        }
        wiring.push({ script: m[1], tools });
      }
    }
  }
  if (!wiring.length) throw new Error('emit-cursor: hooks/hooks.json wires no hooks — unexpected');
  return wiring;
}

// Thin wrapper for a preToolUse hook. Cursor's preToolUse stdin is already
// {tool_name, tool_input, ...} — the same shape Claude Code's PreToolUse sends
// — so the wrapper passes it to the shared script untouched. The shared
// script parses it with its own jq → python3 → python → node chain and fails
// closed when it cannot (lib/hook-input.sh); the wrapper must not re-add a
// hard jq dependency in front of that, which is why it is parser-free.
//
// preToolUse is a permission hook: Cursor blocks on invalid or missing JSON,
// so every path prints one well-formed {"permission":...} line. The tool-name
// filter is a plain grep on the raw input (no matcher in hooks.json — the
// prove-out showed matchers are the fragile part), case-tolerant on purpose:
// Cursor documents `Write` and `Delete`, and its edit tool's exact name is
// not documented.
//
// String.raw: the body is shell, keep its backslashes as written.
function preToolUseWrapper(script, toolFilter) {
  return String.raw`#!/bin/sh
# Generated by tools/gen-cross-tool (emit-cursor) — do not edit; see
# dist/cursor/GENERATED.md. Cursor preToolUse wrapper around
# shared/${script}, a byte-identical copy of plugin/hooks/${script} —
# the guardrail logic lives ONCE there, never forked.
#
# Cursor's preToolUse stdin ({"tool_name":...,"tool_input":{...}}) is the
# shape the shared script already reads, so it goes through untouched. The
# shared script parses it with jq, python3, python or node — whichever is on
# PATH — and BLOCKS when none is (lib/hook-input.sh), so this wrapper needs
# no parser of its own. Exit 2 from the shared script becomes Cursor's
# {"permission":"deny"} with the script's message; anything else allows.
#
# Only tool names matching the filter below are checked; every other tool
# call is allowed untouched.

TOOL_FILTER='${toolFilter}'

allow() {
  printf '{"permission":"allow"}\n'
  exit 0
}

# Print a deny with the message JSON-escaped (no parser: tr + sed), exit 0.
deny() {
  MSG=$(printf '%s' "$1" | tr '\n\r\t' '   ' | sed 's/\\/\\\\/g; s/"/\\"/g')
  [ -n "$MSG" ] || MSG='BLOCKED by the BlueStep guardrail hook (the message could not be formatted: tr or sed missing).'
  printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}\n' "$MSG" "$MSG"
  exit 0
}

INPUT=$(cat 2>/dev/null) || deny "BLOCKED: the BlueStep guardrail hook (${script}) could not read its input, so it cannot tell whether this call is safe."
printf '%s' "$INPUT" | grep -Eq '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*('"$TOOL_FILTER"')' || allow

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd)
SHARED="$DIR/shared/${script}"
[ -f "$SHARED" ] || deny "BLOCKED: the BlueStep guardrail hook cannot find its script ($SHARED), so it cannot check this call. Reinstall or update the bluestep-tools plugin."

OUT=$(printf '%s' "$INPUT" | "$SHARED" 2>&1 >/dev/null)
STATUS=$?
if [ "$STATUS" -eq 2 ]; then
  deny "$OUT"
fi
allow
`;
}

const HOOKS_README = `# Cursor hook wiring — generated, do not edit

Generated by \`tools/gen-cross-tool\` from \`plugin/hooks/\` (see
\`../../GENERATED.md\`); regenerate with \`npm run gen\`. Layout:

- \`shared/\` — byte-identical copies of \`plugin/hooks/*.sh\` (and
  \`shared/lib/\` of their helper). The guardrail logic lives ONCE, in those
  sources; never fork or edit the copies.
- \`*-cursor.sh\` — generated thin wrappers, one per guardrail. Each filters
  on \`tool_name\`, hands Cursor's \`preToolUse\` stdin to its shared script
  unchanged, and turns the script's exit-2 block into Cursor's
  \`{"permission":"deny"}\`. Wrappers locate \`shared/\` via their own \`$0\`
  directory; Cursor runs plugin hooks from the plugin's install directory.
- \`hooks.json\` — the Cursor-schema hook config the plugin manifest points at.

## What each guardrail does on Cursor

| Guardrail | Cursor event | Tools checked | Behavior |
|---|---|---|---|
| block-generated-files | \`preToolUse\` | names containing Write / Edit / Replace / Delete | **Blocks** before the edit lands |
| canary | *(not wired)* | — | Claude Code-only SessionStart check; \`shared/canary.sh\` ships but nothing runs it on Cursor |

\`preToolUse\` runs before any tool and carries \`{tool_name, tool_input}\`, the
same shape Claude Code's \`PreToolUse\` sends, so the shared script decides
exactly as it does on Claude Code. The earlier wiring used \`afterFileEdit\`
(post-hoc, warn only) because \`preToolUse\` did not exist yet.

## Not yet proven live

- **The path key Cursor's Write tool sends.** The docs show \`tool_input\` only
  for \`Shell\` (\`command\`, \`working_directory\`). The shared script reads
  \`file_path\`, \`path\`, \`target_file\` and \`relative_workspace_path\`; if
  Cursor's edit tool uses another key the check matches nothing and the edit
  goes through. First thing to confirm on a real Cursor seat: hand-edit a
  \`declarations/\` file through the agent and expect a deny.
- **Windows.** Cursor runs hook commands through PowerShell on Windows; a
  \`.sh\` wrapper only runs there if \`.sh\` is associated with a POSIX shell.
  Untested.

## Deliberate choices

- **No matchers in hooks.json** — the task-1 prove-out showed matchers are the
  fragile part (tool names are surface-specific); each wrapper greps
  \`tool_name\` itself, case-tolerant, because Cursor documents \`Write\` and
  \`Delete\` but not the exact name of its edit tool.
- **No parser in the wrapper** — the shared script already falls back
  jq → python3 → python → node and blocks when none is on PATH. A wrapper
  that bails on a missing \`jq\` would silently disarm that (the same shape
  as the 77-day fail-open bug), so the wrapper is plain POSIX sh.
- **\`failClosed\` left unset** — Cursor's own fail-closed would turn a wrapper
  that cannot start at all (the Windows case above) into "every edit
  blocked". The wrapper itself does deny when its script is missing or its
  input is unreadable; only a wrapper that never runs falls open.
- **Relative command paths** — \`./hooks/*-cursor.sh\`, resolved by Cursor
  from the plugin's install directory (documented; \`CURSOR_PLUGIN_ROOT\`
  points there).
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
  for (const { script, tools } of wiring) {
    const wrapper = script.replace(/\.sh$/, '-cursor.sh');
    files[`${OUT_PLUGIN}/hooks/${wrapper}`] = { text: preToolUseWrapper(script, tools), mode: 0o755 };
    (hooksConfig.hooks.preToolUse ??= []).push({ type: 'command', command: `./hooks/${wrapper}` });
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

  // Root Cursor marketplace. The entry carries ONLY name/source/description:
  // Cursor's marketplace schema (cursor/plugins, schemas/marketplace.schema.json)
  // sets additionalProperties:false on a plugin entry, so a `version` key
  // makes the importer reject it and the import adds 0 plugins (issue #238).
  // The version lives in the plugin manifest above, where Cursor reads it.
  // The plugin dir is reached as metadata.pluginRoot + bare source name, the
  // form the official marketplace and the docs use; "./dist/..." is not.
  files['.cursor-plugin/marketplace.json'] = `${JSON.stringify({
    name: 'bluestep',
    owner: { name: 'BlueStep Systems' },
    metadata: { pluginRoot: 'dist/cursor' },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: PLUGIN_NAME,
        description: manifest.description,
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
  // The plugin manifest mirrors the Claude version; the marketplace entry must
  // NOT carry one (issue #238: Cursor's importer rejects the entry and the
  // import adds nothing), and its source must be the documented bare form.
  const manifestRel = `${OUT_PLUGIN}/.cursor-plugin/plugin.json`;
  try {
    const parsed = JSON.parse(contentText(files[manifestRel]));
    if (parsed.version !== ctx.version) {
      problems.push(`cursor: ${manifestRel}: version "${parsed.version}" does not mirror the Claude manifest ("${ctx.version}")`);
    }
  } catch (err) {
    problems.push(`cursor: ${manifestRel}: invalid JSON — ${err.message}`);
  }
  const marketRel = '.cursor-plugin/marketplace.json';
  try {
    const parsed = JSON.parse(contentText(files[marketRel]));
    const entry = parsed.plugins?.[0] ?? {};
    const allowed = new Set(['name', 'source', 'description', 'minClientVersions']);
    for (const key of Object.keys(entry)) {
      if (!allowed.has(key)) {
        problems.push(`cursor: ${marketRel}: plugin entry key "${key}" is not in Cursor's marketplace schema (additionalProperties:false) — the importer rejects the entry (#238)`);
      }
    }
    if (typeof entry.source !== 'string' || entry.source.startsWith('./') || entry.source.includes('/')) {
      problems.push(`cursor: ${marketRel}: source "${entry.source}" must be a bare plugin dir name under metadata.pluginRoot`);
    }
    if (parsed.metadata?.pluginRoot !== 'dist/cursor') {
      problems.push(`cursor: ${marketRel}: metadata.pluginRoot must be "dist/cursor"`);
    }
    if (entry.name !== PLUGIN_NAME) {
      problems.push(`cursor: ${marketRel}: entry name "${entry.name}" must match the plugin manifest name "${PLUGIN_NAME}"`);
    }
  } catch (err) {
    problems.push(`cursor: ${marketRel}: invalid JSON — ${err.message}`);
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

  // hooks.json parses; every hook sits on preToolUse (the blocking event);
  // every command it references exists and is executable.
  const hooksRel = `${OUT_PLUGIN}/hooks/hooks.json`;
  try {
    const cfg = JSON.parse(contentText(files[hooksRel] ?? ''));
    for (const event of Object.keys(cfg.hooks ?? {})) {
      if (event !== 'preToolUse') {
        problems.push(`cursor: ${hooksRel}: hook event "${event}" — guardrails must sit on preToolUse, the blocking event`);
      }
    }
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

  // No wrapper may bail on a missing parser: the shared script owns parsing
  // and fails closed; a `command -v jq || allow` in front of it disarms that.
  for (const [rel, content] of Object.entries(files)) {
    if (rel.startsWith(`${OUT_PLUGIN}/hooks/`) && rel.endsWith('-cursor.sh') && /command -v (jq|python3?|node)/.test(contentText(content))) {
      problems.push(`cursor: ${rel}: wrapper checks for a parser itself — the shared script owns that and fails closed`);
    }
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
