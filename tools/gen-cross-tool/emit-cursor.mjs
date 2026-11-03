// tools/gen-cross-tool/emit-cursor.mjs — Cursor emitter (content: task 8,
// hooks/MCP wiring: task 9).
//
// Scope decision (recorded per the design's task-8 decision point): this
// emitter produces the FULL native Cursor output. Cursor's built-in
// Claude-marketplace auto-import (seen live in the prove-out) is a bonus
// channel only — Cursor-only teammates have no Claude Code installed, so the
// native tree is the real delivery path.
//
// Emits, for every crossTool: true plugin plugins/<name>/ (crossToolPlugins()
// in lib.mjs; crossTool: false plugins are skipped and left out of the
// marketplace):
//   dist/cursor/GENERATED.md                         (do-not-edit note, once)
//   dist/cursor/<name>/.cursor-plugin/plugin.json    (name/description/
//       version mirrored from plugins/<name>/.claude-plugin/plugin.json — and
//       nothing else from it: crossTool is NOT copied, Cursor's plugin
//       manifest schema is unproven for it; skills/agents/hooks/mcpServers
//       path fields, each only when that surface is present)
//   dist/cursor/<name>/skills/**   (allowed-tools stripped from SKILL.md
//       frontmatter; ${CLAUDE_PLUGIN_ROOT} refs rewritten relative)
//   dist/cursor/<name>/agents/*.md (tools:/model: frontmatter dropped)
//   dist/cursor/<name>/hooks/shared/*.sh  (byte-identical copies of
//       plugins/<name>/hooks/*.sh — the logic lives ONCE there, never forked)
//   dist/cursor/<name>/hooks/*-cursor.sh  (generated thin wrappers: pass
//       Cursor's preToolUse stdin straight to the shared script — it is
//       already {tool_name, tool_input} shaped — and map its exit-2 block to
//       Cursor's {"permission":"deny"} JSON; POSIX sh, no jq needed)
//   dist/cursor/<name>/hooks/hooks.json   (Cursor schema, version 1; each
//       entry carries a matcher AND the wrapper filters on tool_name itself)
//   dist/cursor/<name>/hooks/README.md    (wiring + what each guardrail does
//       on Cursor, derived from the plugin's own hooks.json, and what is
//       still unproven live)
//   dist/cursor/<name>/mcp.json    (plugins/<name>/.mcp.json with
//       ${B6PT_TOKEN} → ${env:B6PT_TOKEN} — Cursor's interpolation syntax,
//       proven live in prove-out C6)
//   .cursor-plugin/marketplace.json        (root marketplace; one entry per
//       emitted plugin, sorted, carrying only name/source/description —
//       Cursor's marketplace schema sets additionalProperties:false on an
//       entry and rejects `version` (issue #238: the whole import came back
//       with 0 plugins). Each plugin dir is reached through
//       metadata.pluginRoot + a bare source name, the documented form; a
//       "./"-prefixed source is not.)
//
// Optional surfaces (design §2 surface table): a plugin without
// skills/*/SKILL.md, agents/*.md, hooks/hooks.json or .mcp.json gets no
// output for that surface and no manifest field for it, and the matching
// check() gates are skipped for it.
//
// Hook wiring strategy: derived from plugins/<name>/hooks/hooks.json
// (discovered, not hardcoded — a new hook wired there is picked up automatically). Cursor's
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
import { contentText, crossToolPlugins, parseFrontmatter, rewriteRefs, transformFrontmatter, walkSorted } from './lib.mjs';

const LABEL = 'emit-cursor';
const OUT_ROOT = 'dist/cursor';
const outPluginDir = (plugin) => `${OUT_ROOT}/${plugin.name}`;

// Which optional surfaces a plugin carries (design §2 surface table) —
// decided by presence, used by emit() and by every check() gate.
function surfacesOf(tree) {
  const has = (pred) => tree.files.some((f) => pred(f.rel));
  return {
    skills: has((rel) => /^skills\/[^/]+\/SKILL\.md$/.test(rel)),
    agents: has((rel) => /^agents\/[^/]+\.md$/.test(rel)),
    hooks: has((rel) => rel === 'hooks/hooks.json'),
    mcp: has((rel) => rel === '.mcp.json'),
  };
}

// Frontmatter keys this emitter understands. Unknown keys pass through to
// Cursor (it ignores unknown keys per docs) but get a warning, so new Claude
// Code fields receive a deliberate mapping decision instead of silent drift.
// `compatibility` (Agent Skills spec, optional, advisory environment needs)
// passes through as-is.
const KNOWN_SKILL_FM = new Set(['name', 'description', 'allowed-tools', 'compatibility']);
const KNOWN_AGENT_FM = new Set(['name', 'description', 'tools', 'model']);

const GENERATED_MD = `# Generated tree — do not edit

Everything under \`dist/cursor/\` is generated from \`plugins/**\` by
\`tools/gen-cross-tool\` (the Cursor emitter). Never hand-edit these files:
the generator wipes and rewrites this whole tree on every run, so edits here
are lost — edit the source under \`plugins/<name>/\` instead and regenerate with:

    npm run gen
`;

// Map a plugin-root-relative target to its path inside the emitted Cursor
// plugin dir. Throws on anything without a mapping (fail loudly). Targets are
// validated against the source tree by rewriteRefs, so a ref to a surface
// the plugin does not carry fails there.
function mapTarget(ref, where) {
  if (ref === '') return ''; // the plugin root itself
  if (ref === '.claude-plugin/plugin.json') return '.cursor-plugin/plugin.json';
  if (ref === '.mcp.json') return 'mcp.json';
  if (ref === 'hooks/hooks.json') return 'hooks/hooks.json'; // the Cursor-schema re-emit
  if (/^hooks\/[A-Za-z0-9_.-]+\.sh$/.test(ref)) return `hooks/shared/${ref.slice('hooks/'.length)}`;
  if (ref.startsWith('skills/') || ref.startsWith('agents/')) return ref;
  throw new Error(`emit-cursor: ${where}: no Cursor mapping for \${CLAUDE_PLUGIN_ROOT}/${ref} — refusing to emit`);
}

// ---------- hook wiring (task 9) ----------

// Map a source (Claude-schema) PreToolUse matcher to the tool-name regex used
// twice on Cursor: as the hooks.json `matcher` (so the hook is not even
// started for Read/Grep/Shell/MCP calls — on Windows each start would pop a
// git-bash window, and an `allow` answered to a Shell call might skip the
// user's own approval) and as the wrapper's own grep (so a matcher Cursor
// evaluates differently than expected still cannot let an edit through).
// Substring, letter-case tolerant without (?i) — the matcher is a JS regex
// and Cursor documents `Write` and `Delete` but not its edit tool's name.
// Anything unrecognized fails loudly — a new kind of hook needs a deliberate
// wiring decision, not a silent guess.
const SHELL_FILTER = '[Ss]hell|[Bb]ash';
const EDIT_FILTER = '[Ww]rite|[Ee]dit|[Rr]eplace|[Pp]atch|[Dd]elete';

function cursorToolFilterFor(matcher, hooksRel) {
  const parts = String(matcher ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => p === 'Bash')) return SHELL_FILTER;
  if (parts.length && parts.every((p) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(p))) {
    return EDIT_FILTER;
  }
  throw new Error(`emit-cursor: ${hooksRel}: no Cursor tool filter for matcher "${matcher}" — give it a mapping or set crossTool false`);
}

const CLAUDE_BROWSER_MATCHER = /^mcp__\(?(?:Claude_Browser|claude-in-chrome)\b/;

// Read plugins/<name>/hooks/hooks.json and derive [{ script, tools }] —
// discovered, not hardcoded, so a new hook wired at the source is picked up
// here with zero emitter changes. Called only when the plugin carries a
// hooks/hooks.json (surfacesOf().hooks).
function readHookWiring(plugin) {
  const { tree } = plugin;
  const hooksRel = `${plugin.dir}/hooks/hooks.json`;
  const src = tree.files.find((f) => f.rel === 'hooks/hooks.json');
  if (!src) throw new Error(`emit-cursor: ${hooksRel} missing`);
  const config = JSON.parse(src.text);
  const wiring = [];
  for (const [event, groups] of Object.entries(config.hooks ?? {})) {
    // SessionStart carries only hooks/canary.sh, a Claude Code-only environment check (it
    // reports a missing JSON parser once per session). Not wired here on purpose: Cursor hooks
    // are a different surface, and the canary's report path is Claude Code's stderr handling.
    if (event === 'SessionStart') continue;
    if (event !== 'PreToolUse') {
      throw new Error(`emit-cursor: ${hooksRel}: unmapped source hook event "${event}" — give it a Cursor wiring or set crossTool false`);
    }
    for (const group of groups) {
      // hooks/tab-guard.sh guards Claude Code's own browser tools (the desktop app's pane and
      // Claude in Chrome). Cursor has neither, so it is not wired here; its script still ships
      // in shared/ like every hooks/*.sh.
      if (CLAUDE_BROWSER_MATCHER.test(String(group.matcher ?? ''))) continue;
      const tools = cursorToolFilterFor(group.matcher, hooksRel);
      for (const h of group.hooks ?? []) {
        const m = String(h.command ?? '').match(/\/hooks\/([A-Za-z0-9_.-]+\.sh)$/);
        if (!m) {
          throw new Error(`emit-cursor: ${hooksRel}: cannot extract a hooks/*.sh script from command "${h.command}" — give this a mapping or set crossTool false`);
        }
        if (!tree.files.some((f) => f.rel === `hooks/${m[1]}`)) {
          throw new Error(`emit-cursor: ${hooksRel} references hooks/${m[1]}, which does not exist`);
        }
        wiring.push({ script: m[1], tools });
      }
    }
  }
  if (!wiring.length) throw new Error(`emit-cursor: ${hooksRel} wires no hooks Cursor can run — set crossTool false or drop the hooks surface`);
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
// filter is a plain grep on the raw input, case-insensitive, duplicating the
// hooks.json matcher on purpose (see cursorToolFilterFor).
//
// Fail closed everywhere the wrapper itself can tell something is wrong: no
// input, a tool helper missing, the shared script missing or not starting
// (bash absent, exec bit lost — the latter has happened in this repo), or
// any exit other than 0/2. Only a wrapper Cursor never starts falls open.
//
// String.raw: the body is shell, keep its backslashes as written.
function preToolUseWrapper(plugin, script, toolFilter) {
  const name = plugin.name;
  return String.raw`#!/bin/sh
# Generated by tools/gen-cross-tool (emit-cursor) — do not edit; see
# dist/cursor/GENERATED.md. Cursor preToolUse wrapper around
# shared/${script}, a byte-identical copy of ${plugin.dir}/hooks/${script} —
# the guardrail logic lives ONCE there, never forked.
#
# Cursor's preToolUse stdin ({"tool_name":...,"tool_input":{...}}) is the
# shape the shared script already reads, so it goes through untouched. The
# shared script parses it with jq, python3, python or node — the first that
# actually reads it — and BLOCKS when none does (lib/hook-input.sh), so this wrapper needs
# no parser of its own. Exit 0 from the shared script allows; exit 2 becomes
# Cursor's {"permission":"deny"} with the script's message; ANY other outcome
# (script missing, bash missing, exec bit lost, crash) also denies — a
# guardrail that cannot run must not pretend the call is safe.
#
# Only tool names matching the filter below are checked (the same regex is
# the hooks.json matcher); every other tool call is allowed untouched.

TOOL_FILTER='${toolFilter}'
HOOK="BlueStep guardrail hook (${script})"

allow() {
  printf '{"permission":"allow"}\n'
  exit 0
}

# Print a deny with the message JSON-escaped (no parser: tr + sed), exit 0.
# Control characters are dropped so the JSON stays valid and Cursor shows the
# message instead of a schema error.
deny() {
  MSG=$(printf '%s' "$1" | tr '\n\r\t' '   ' | tr -d '\000-\010\013\014\016-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
  [ -n "$MSG" ] || MSG='BLOCKED by the BlueStep guardrail hook (the message could not be formatted: tr or sed missing).'
  printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}\n' "$MSG" "$MSG"
  exit 0
}

INPUT=$(cat 2>/dev/null) || deny "BLOCKED: the $HOOK could not read its input, so it cannot tell whether this call is safe."
[ -n "$INPUT" ] || deny "BLOCKED: the $HOOK received no input, so it cannot tell whether this call is safe."

# Tool-name filter. Newlines are flattened first so a pretty-printed payload
# cannot slip past a line-based grep. grep exit 1 = not an edit tool; any
# other failure (grep or tr missing) is unknown territory, so deny.
FLAT=$(printf '%s' "$INPUT" | tr -d '\n\r') || deny "BLOCKED: the $HOOK cannot inspect the tool name (tr failed), so it cannot tell whether this call is safe."
printf '%s' "$FLAT" | grep -Eqi '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*('"$TOOL_FILTER"')'
case $? in
  0) ;;
  1) allow ;;
  *) deny "BLOCKED: the $HOOK cannot inspect the tool name (grep failed), so it cannot tell whether this call is safe." ;;
esac

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd)
SHARED="$DIR/shared/${script}"
[ -f "$SHARED" ] || deny "BLOCKED: the $HOOK cannot find its script ($SHARED), so it cannot check this call. Reinstall or update the ${name} plugin."

# Run through bash explicitly: a lost exec bit must not turn into an allow.
OUT=$(printf '%s' "$INPUT" | bash "$SHARED" 2>&1 >/dev/null)
STATUS=$?
case "$STATUS" in
  0) allow ;;
  2) deny "$OUT" ;;
  *) deny "BLOCKED: the $HOOK failed to run (exit $STATUS: $OUT), so it cannot tell whether this call is safe. Reinstall or update the ${name} plugin." ;;
esac
`;
}

// What each source hook script does on Cursor, keyed by script name — the
// hooks README's "Behavior" column. A script the plugin ships with no entry
// here fails the run: a new guardrail needs its Cursor story written down.
const GUARDRAIL_NOTES = {
  'block-generated-files.sh': '**Blocks** before the edit lands (pending the live check below)',
  'phi-guard.sh':
    '**Blocks** a write that looks like real client data in a B6P project (pending the live check below). ' +
    "The project root is the hook's working directory, since Cursor sets no `CLAUDE_PROJECT_DIR`; if that is " +
    'not the project, the hook stays silent and the git `pre-commit` check is the gate',
  'canary.sh': "Claude Code-only SessionStart check; `shared/canary.sh` ships but nothing runs it on Cursor",
  'tab-guard.sh':
    "Guards Claude Code's own browser tools, which Cursor does not have; `shared/tab-guard.sh` ships but " +
    'nothing runs it on Cursor',
};

// The "Tools checked" column text for each wrapper tool filter.
const FILTER_NOTES = {
  [EDIT_FILTER]: 'names containing Write / Edit / Replace / Patch / Delete',
  [SHELL_FILTER]: 'names containing Shell / Bash',
};

// The guardrail table, derived from the plugin's own wiring: one row per
// top-level hooks/*.sh it ships — the scripts wired on Cursor first, in
// hooks.json order, then the unwired ones sorted by name.
function guardrailRows(plugin, wiring) {
  const scripts = plugin.tree.files
    .map((f) => f.rel.match(/^hooks\/([A-Za-z0-9_.-]+\.sh)$/)?.[1])
    .filter(Boolean);
  const wired = [...new Set(wiring.map((w) => w.script))];
  const unwired = scripts.filter((s) => !wired.includes(s)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const note = (script) => {
    const text = GUARDRAIL_NOTES[script];
    if (!text) {
      throw new Error(`emit-cursor: ${plugin.dir}/hooks/${script}: no GUARDRAIL_NOTES entry — say what it does on Cursor`);
    }
    return text;
  };
  const rows = [];
  let lastFilter;
  for (const script of wired) {
    const filter = wiring.find((w) => w.script === script).tools;
    const tools = filter === lastFilter ? 'same filter' : FILTER_NOTES[filter];
    lastFilter = filter;
    rows.push(`| ${script.replace(/\.sh$/, '')} | \`preToolUse\` | ${tools} | ${note(script)} |`);
  }
  for (const script of unwired) {
    rows.push(`| ${script.replace(/\.sh$/, '')} | *(not wired)* | — | ${note(script)} |`);
  }
  return rows.join('\n');
}

const hooksReadme = (plugin, wiring) => {
  const hasLib = plugin.tree.files.some((f) => f.rel.startsWith('hooks/lib/'));
  // The first live test names a write this plugin's own guardrail denies.
  const liveTest = wiring.some((w) => w.script === 'block-generated-files.sh')
    ? ' hand-edit a\n  `declarations/` file through the agent and expect a deny.'
    : '\n  in a B6P project, have the agent write a made-up phone number into a\n  committed file and expect a deny.';
  return `# Cursor hook wiring — generated, do not edit

Generated by \`tools/gen-cross-tool\` from \`${plugin.dir}/hooks/\` (see
\`../../GENERATED.md\`); regenerate with \`npm run gen\`. Layout:

- \`shared/\` — byte-identical copies of \`${plugin.dir}/hooks/*.sh\`${hasLib ? ` (and
  \`shared/lib/\` of their helper)` : ''}. The guardrail logic lives ONCE, in those
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
${guardrailRows(plugin, wiring)}

\`preToolUse\` runs before any tool and carries \`{tool_name, tool_input}\`, the
same shape Claude Code's \`PreToolUse\` sends, so the shared script decides
exactly as it does on Claude Code. The earlier wiring used \`afterFileEdit\`
(post-hoc, warn only) because \`preToolUse\` did not exist yet.

## Not yet proven live

- **The path key Cursor's Write tool sends.** The docs show \`tool_input\` only
  for \`Shell\` (\`command\`, \`working_directory\`). The shared script reads
  \`file_path\`, \`path\`, \`target_file\` and \`relative_workspace_path\`; if
  Cursor's edit tool uses another key the check matches nothing and the edit
  goes through. First thing to confirm on a real Cursor seat:${liveTest}
- **Windows.** Cursor runs hook commands through PowerShell on Windows. With
  the usual Git for Windows setup, PowerShell hands a \`.sh\` file to a separate
  git-bash window, drops stdin and reports exit 0 with no output — so the
  wrapper never really runs there and the hook falls open (no output with
  \`failClosed\` unset is an allow). Not tested inside Cursor itself. The
  \`matcher\` keeps that from happening on every Read/Grep/Shell call.
- **Whether an \`allow\` from this hook skips Cursor's own approval** for a
  tool. The docs do not say. The \`matcher\` keeps the hook off Shell and MCP
  calls, so the question only matters for edit tools.

## Deliberate choices

- **A \`matcher\` in hooks.json AND the same filter in the wrapper.** The
  task-1 prove-out showed matchers are the fragile part (tool names are
  surface-specific), which argued for none — but a hook that starts on every
  tool call pops a git-bash window per call on Windows and answers \`allow\` to
  Shell calls it knows nothing about. So the matcher limits where the hook
  starts, and the wrapper's own case-insensitive grep on \`tool_name\` decides
  independently; a matcher Cursor reads differently than expected still
  cannot let an edit through.
- **No parser in the wrapper** — the shared script already falls back
  jq → python3 → python → node and blocks when none is on PATH. A wrapper
  that bails on a missing \`jq\` would silently disarm that (the same shape
  as the 77-day fail-open bug), so the wrapper is plain POSIX sh.
- **The wrapper denies on every failure it can see** — no input, \`tr\` or
  \`grep\` missing, the shared script missing, \`bash\` missing, a lost exec bit
  (it runs the script through \`bash\` explicitly; this repo has lost that bit
  once already), any exit other than 0 or 2. Only a wrapper Cursor never
  starts falls open.
- **\`failClosed\` left unset** — Cursor's own fail-closed would turn the
  Windows case above into "every edit blocked" with no message. The wrapper's
  own denies cover everything else.
- **Relative command paths** — \`./hooks/*-cursor.sh\`, resolved by Cursor
  from the plugin's install directory (documented; \`CURSOR_PLUGIN_ROOT\`
  points there).
`;
};

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

// One plugin's Cursor tree, as repo-root-relative path → content. Optional
// surfaces (surfacesOf) produce nothing — no files, no manifest field — when
// the plugin does not carry them.
function emitPlugin(plugin) {
  const { tree, manifest } = plugin;
  const out = outPluginDir(plugin);
  const surfaces = surfacesOf(tree);
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
    // A skill asset that is a script (shebang: e.g. the git hooks /b6p-setup copies into a
    // project) keeps its exec bit, like the hook scripts below.
    files[`${out}/${f.rel}`] = isSkill && text.startsWith('#!') ? { text, mode: 0o755 } : text;
  }

  // Hooks (task 9): shared scripts verbatim + generated wrappers + Cursor-
  // schema hooks.json + the degradation README. Shared copies are byte-
  // identical and executable; wrappers are executable POSIX sh. Only when
  // the plugin carries hooks/hooks.json.
  if (surfaces.hooks) {
    for (const f of tree.files) {
      if (f.rel.startsWith('hooks/') && f.rel.endsWith('.sh')) {
        files[`${out}/hooks/shared/${f.rel.slice('hooks/'.length)}`] = { text: f.text, mode: 0o755 };
      }
    }
    const wiring = readHookWiring(plugin);
    const hooksConfig = { version: 1, hooks: {} };
    for (const { script, tools } of wiring) {
      const wrapper = script.replace(/\.sh$/, '-cursor.sh');
      files[`${out}/hooks/${wrapper}`] = { text: preToolUseWrapper(plugin, script, tools), mode: 0o755 };
      (hooksConfig.hooks.preToolUse ??= []).push({ type: 'command', command: `./hooks/${wrapper}`, matcher: tools });
    }
    files[`${out}/hooks/hooks.json`] = `${JSON.stringify(hooksConfig, null, 2)}\n`;
    files[`${out}/hooks/README.md`] = hooksReadme(plugin, wiring);
  }

  // MCP (task 9): same server config, Cursor's env-interpolation syntax
  // (${env:B6PT_TOKEN} — proven live, prove-out C6). Only when the plugin
  // carries .mcp.json.
  if (surfaces.mcp) {
    const mcpSrc = tree.files.find((f) => f.rel === '.mcp.json');
    const mcpText = mcpSrc.text.replaceAll('${B6PT_TOKEN}', '${env:B6PT_TOKEN}');
    if (!mcpText.includes('${env:B6PT_TOKEN}')) {
      throw new Error(`emit-cursor: ${plugin.dir}/.mcp.json carries no \${B6PT_TOKEN} reference — the token rewrite found nothing, refusing to emit`);
    }
    files[`${out}/mcp.json`] = mcpText;
  }

  // Belt and suspenders: nothing emitted may still carry the variable.
  for (const [rel, content] of Object.entries(files)) {
    if (contentText(content).includes('${CLAUDE_PLUGIN_ROOT}')) {
      throw new Error(`emit-cursor: ${rel}: unrewritten \${CLAUDE_PLUGIN_ROOT} survived the transform — refusing to emit`);
    }
  }

  // Cursor plugin manifest. Fields are picked one by one: nothing else from
  // the Claude manifest is copied (crossTool in particular — task 1 proved
  // only that Claude Code and a repo import tolerate it, not Cursor's plugin
  // manifest schema).
  const cursorManifest = { name: plugin.name, description: manifest.description, version: manifest.version };
  if (surfaces.skills) cursorManifest.skills = './skills/';
  if (surfaces.agents) cursorManifest.agents = './agents/';
  if (surfaces.hooks) cursorManifest.hooks = './hooks/hooks.json';
  if (surfaces.mcp) cursorManifest.mcpServers = './mcp.json';
  files[`${out}/.cursor-plugin/plugin.json`] = `${JSON.stringify(cursorManifest, null, 2)}\n`;

  return files;
}

function emit(plugins) {
  const emitted = [...crossToolPlugins(plugins)].sort(byName);
  const files = {};
  for (const plugin of emitted) Object.assign(files, emitPlugin(plugin));

  files[`${OUT_ROOT}/GENERATED.md`] = GENERATED_MD;

  // Root Cursor marketplace, one entry per emitted plugin, sorted. An entry
  // carries ONLY name/source/description: Cursor's marketplace schema
  // (cursor/plugins, schemas/marketplace.schema.json) sets
  // additionalProperties:false on a plugin entry, so a `version` key makes
  // the importer reject it and the import adds 0 plugins (issue #238). The
  // version lives in each plugin manifest, where Cursor reads it. A plugin
  // dir is reached as metadata.pluginRoot + bare source name, the form the
  // official marketplace and the docs use; "./dist/..." is not.
  files['.cursor-plugin/marketplace.json'] = `${JSON.stringify({
    name: 'bluestep',
    owner: { name: 'BlueStep Systems' },
    metadata: { pluginRoot: OUT_ROOT },
    plugins: emitted.map((plugin) => ({
      name: plugin.name,
      source: plugin.name,
      description: plugin.manifest.description,
    })),
  }, null, 2)}\n`;

  return files;
}

// Per-plugin contract assertions on the emitted set, each gated on the
// surfaces the plugin carries (design §2 surface table).
function checkPlugin(plugin, files, ctx, diskRels, executableOnDisk, canCheckMode) {
  const problems = [];
  const { tree } = plugin;
  const out = outPluginDir(plugin);
  const surfaces = surfacesOf(tree);

  // Every source skill is present (an empty loop for a plugin without skills).
  const skillDirs = [...new Set(
    tree.files.filter((f) => f.rel.startsWith('skills/')).map((f) => f.rel.split('/')[1])
  )].sort();
  for (const dir of skillDirs) {
    if (!(`${out}/skills/${dir}/SKILL.md` in files)) {
      problems.push(`cursor: source skill ${plugin.dir}/skills/${dir} missing from the output tree`);
    }
  }

  // The plugin manifest mirrors the Claude name and version, carries no
  // crossTool key, and has a path field for exactly the surfaces present.
  const manifestRel = `${out}/.cursor-plugin/plugin.json`;
  try {
    const parsed = JSON.parse(contentText(files[manifestRel]));
    if (parsed.name !== plugin.name) {
      problems.push(`cursor: ${manifestRel}: name "${parsed.name}" does not match the plugin folder "${plugin.name}"`);
    }
    if (parsed.version !== plugin.manifest.version) {
      problems.push(`cursor: ${manifestRel}: version "${parsed.version}" does not mirror the Claude manifest ("${plugin.manifest.version}")`);
    }
    if ('crossTool' in parsed) {
      problems.push(`cursor: ${manifestRel}: carries "crossTool" — the Cursor manifest must not copy it (task 1 decision)`);
    }
    const fields = [
      ['skills', surfaces.skills, './skills/'],
      ['agents', surfaces.agents, './agents/'],
      ['hooks', surfaces.hooks, './hooks/hooks.json'],
      ['mcpServers', surfaces.mcp, './mcp.json'],
    ];
    for (const [field, present, expected] of fields) {
      if (present && parsed[field] !== expected) {
        problems.push(`cursor: ${manifestRel}: "${field}" field missing or wrong (expected "${expected}")`);
      } else if (!present && field in parsed) {
        problems.push(`cursor: ${manifestRel}: "${field}" field present, but ${plugin.dir} carries no such surface`);
      }
    }
  } catch (err) {
    problems.push(`cursor: ${manifestRel}: invalid JSON — ${err.message}`);
  }

  // An absent surface leaves no output behind.
  const absentOutputs = [
    [surfaces.agents, `${out}/agents/`, 'agents/*.md'],
    [surfaces.hooks, `${out}/hooks/`, 'hooks/hooks.json'],
    [surfaces.mcp, `${out}/mcp.json`, '.mcp.json'],
  ];
  for (const [present, prefix, source] of absentOutputs) {
    if (present) continue;
    for (const rel of Object.keys(files)) {
      if (rel.startsWith(prefix)) problems.push(`cursor: ${rel}: emitted, but ${plugin.dir} has no ${source}`);
    }
  }

  // ---- task-9 wiring assertions ----

  // hooks.json parses; every hook sits on preToolUse (the blocking event);
  // every command it references exists and is executable.
  if (surfaces.hooks) {
    const hooksRel = `${out}/hooks/hooks.json`;
    try {
      const cfg = JSON.parse(contentText(files[hooksRel] ?? ''));
      for (const event of Object.keys(cfg.hooks ?? {})) {
        if (event !== 'preToolUse') {
          problems.push(`cursor: ${hooksRel}: hook event "${event}" — guardrails must sit on preToolUse, the blocking event`);
        }
      }
      for (const entries of Object.values(cfg.hooks ?? {})) {
        for (const entry of entries) {
          if (typeof entry.matcher !== 'string' || !entry.matcher.trim()) {
            problems.push(`cursor: ${hooksRel}: command "${entry.command}" has no matcher — it would start on every tool call`);
          }
          const cmd = String(entry.command ?? '');
          if (!cmd.startsWith('./')) {
            problems.push(`cursor: ${hooksRel}: command "${cmd}" is not plugin-relative (./…)`);
            continue;
          }
          const cmdRel = `${out}/${cmd.slice(2)}`;
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
  }

  // No wrapper may bail on a missing parser: the shared script owns parsing
  // and fails closed; a `command -v jq || allow` in front of it disarms that.
  for (const [rel, content] of Object.entries(files)) {
    if (rel.startsWith(`${out}/hooks/`) && rel.endsWith('-cursor.sh') && /\b(command -v|which|type|hash)\s+(jq|python3?|node)\b/.test(contentText(content))) {
      problems.push(`cursor: ${rel}: wrapper checks for a parser itself — the shared script owns that and fails closed`);
    }
  }

  // The SOURCE scripts keep their exec bit too (an edit from Windows over a
  // UNC path has reset one before; Claude Code runs them directly).
  if (canCheckMode) {
    for (const f of tree.files) {
      if (f.rel.startsWith('hooks/') && f.rel.endsWith('.sh') && !executableOnDisk(`${plugin.dir}/${f.rel}`)) {
        problems.push(`cursor: ${plugin.dir}/${f.rel}: source hook script is not executable — git update-index --chmod=+x`);
      }
    }
  }

  // Shared scripts are byte-identical to their plugins/<name>/hooks/*.sh sources.
  if (surfaces.hooks) {
    for (const f of tree.files) {
      if (!f.rel.startsWith('hooks/') || !f.rel.endsWith('.sh')) continue;
      const outRel = `${out}/hooks/shared/${f.rel.slice('hooks/'.length)}`;
      const emitted = files[outRel];
      if (!emitted) {
        problems.push(`cursor: ${outRel}: shared copy of ${plugin.dir}/${f.rel} missing from the output`);
      } else if (contentText(emitted) !== f.text) {
        problems.push(`cursor: ${outRel}: not byte-identical to ${plugin.dir}/${f.rel} — shared scripts must never be forked`);
      }
    }
  }

  // mcp.json parses, uses Cursor's ${env:…} token syntax, and carries no
  // bare ${B6PT_TOKEN} (which Cursor would not interpolate).
  if (surfaces.mcp) {
    const mcpRel = `${out}/mcp.json`;
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
  }

  return problems;
}

// --check structural self-test: re-emit in memory (any unmappable ref
// surfaces here as a finding, not a crash), then assert the on-disk output
// matches and honors the task-8 + task-9 contracts for every emitted plugin.
function check(plugins, ctx) {
  const problems = [];
  let files;
  try {
    files = emit(plugins, ctx);
  } catch (err) {
    problems.push(`cursor: emit failed — ${err.message}`);
    return problems;
  }

  // Disk must match a fresh emit exactly (stale output = finding).
  const diskRels = new Set();
  for (const dir of [OUT_ROOT, '.cursor-plugin']) {
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

  const emitted = [...crossToolPlugins(plugins)].sort(byName);
  for (const plugin of emitted) {
    problems.push(...checkPlugin(plugin, files, ctx, diskRels, executableOnDisk, canCheckMode));
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

  // Every emitted .sh (wrappers + shared copies) carries the exec bit.
  if (canCheckMode) {
    for (const rel of Object.keys(files)) {
      if (rel.endsWith('.sh') && diskRels.has(rel) && !executableOnDisk(rel)) {
        problems.push(`cursor: ${rel}: not executable on disk — run npm run gen`);
      }
    }
  }

  // The marketplace lists exactly the emitted plugins. No entry may carry a
  // version (issue #238: Cursor's importer rejects the entry and the import
  // adds nothing), and each source must be the documented bare form.
  const marketRel = '.cursor-plugin/marketplace.json';
  try {
    const parsed = JSON.parse(contentText(files[marketRel]));
    if (parsed.metadata?.pluginRoot !== OUT_ROOT) {
      problems.push(`cursor: ${marketRel}: metadata.pluginRoot must be "${OUT_ROOT}"`);
    }
    const entries = Array.isArray(parsed.plugins) ? parsed.plugins : [];
    if (!Array.isArray(parsed.plugins)) problems.push(`cursor: ${marketRel}: "plugins" must be an array`);
    const want = emitted.map((p) => p.name);
    const got = entries.map((e) => e?.name).sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`cursor: ${marketRel}: entries [${got.join(', ')}] must equal the crossTool plugins [${want.join(', ')}]`);
    }
    const allowed = new Set(['name', 'source', 'description', 'minClientVersions']);
    for (const entry of entries) {
      const label = `entry "${entry?.name}"`;
      for (const key of Object.keys(entry ?? {})) {
        if (!allowed.has(key)) {
          problems.push(`cursor: ${marketRel}: ${label} key "${key}" is not in Cursor's marketplace schema (additionalProperties:false) — the importer rejects the entry (#238)`);
        }
      }
      if (typeof entry?.source !== 'string' || entry.source.startsWith('./') || entry.source.includes('/')) {
        problems.push(`cursor: ${marketRel}: ${label} source "${entry?.source}" must be a bare plugin dir name under metadata.pluginRoot`);
        continue;
      }
      // pluginRoot + source must land on an emitted plugin manifest — two
      // wrong values that agree with each other must not pass — whose name
      // is the entry name.
      const resolved = `${parsed.metadata?.pluginRoot}/${entry.source}/.cursor-plugin/plugin.json`;
      if (!(resolved in files)) {
        problems.push(`cursor: ${marketRel}: ${label}: pluginRoot + source resolve to ${resolved}, which is not an emitted file`);
        continue;
      }
      let manifestName;
      try {
        manifestName = JSON.parse(contentText(files[resolved])).name;
      } catch {
        continue; // Already reported as invalid JSON by checkPlugin.
      }
      if (entry.name !== manifestName) {
        problems.push(`cursor: ${marketRel}: ${label} must match the plugin manifest name "${manifestName}"`);
      }
    }
  } catch (err) {
    problems.push(`cursor: ${marketRel}: invalid JSON — ${err.message}`);
  }

  return problems;
}

export default {
  name: 'cursor',
  outputDirs: ['dist/cursor', '.cursor-plugin'],
  emit,
  check,
};
