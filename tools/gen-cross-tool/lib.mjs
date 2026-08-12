// tools/gen-cross-tool/lib.mjs — shared helpers for the cross-tool generator:
// plugin-tree reading, frontmatter parse/strip, ${CLAUDE_PLUGIN_ROOT}
// reference scanning, the deterministic output writer, the structural
// self-test, and the Claude-ism denylist lint.
// Invariant: output is a pure function of plugin/** — sorted walks, no
// timestamps, no environment leakage, LF line endings.

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

// ---------- plugin tree ----------

// Recursive walk returning POSIX-relative file paths, sorted with a plain
// string compare (never localeCompare — locale is environment leakage).
export function walkSorted(rootAbs, prefix = '') {
  const out = [];
  const entries = readdirSync(rootAbs, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkSorted(join(rootAbs, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// Read the whole plugin tree into memory (it is small). Files carry their
// plugin-root-relative POSIX path and raw text.
export function readPluginTree(pluginRootAbs) {
  const files = walkSorted(pluginRootAbs).map((rel) => {
    const abs = join(pluginRootAbs, ...rel.split('/'));
    return { rel, abs, text: readFileSync(abs, 'utf8') };
  });
  return { root: pluginRootAbs, files };
}

// ---------- frontmatter ----------

// Parse simple `key: value` YAML frontmatter. Returns null when the file has
// none; otherwise { data, endLine } where endLine is the 1-based line number
// of the closing --- fence (lines 1..endLine are frontmatter).
export function parseFrontmatter(text) {
  const lines = text.split('\n');
  if ((lines[0] ?? '').trim() !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      const data = {};
      for (const line of lines.slice(1, i)) {
        const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (m) data[m[1]] = m[2].trim();
      }
      return { data, endLine: i + 1 };
    }
  }
  return null;
}

// Body of a file with its frontmatter block removed (for emitters that strip
// unsupported frontmatter and re-emit their own).
export function stripFrontmatter(text) {
  const fm = parseFrontmatter(text);
  if (!fm) return text;
  return text.split('\n').slice(fm.endLine).join('\n');
}

// ---------- ${CLAUDE_PLUGIN_ROOT} references ----------

// Matches the var, an optional (escaped) closing quote glued to it (the
// hooks.json style: "${CLAUDE_PLUGIN_ROOT}"/hooks/x.sh), then the path —
// which may contain one-level {a,b,c} brace groups.
const PLUGIN_ROOT_REF = /\$\{CLAUDE_PLUGIN_ROOT\}(?:\\?")?((?:\/[A-Za-z0-9_.{},-]+)*\/?)/g;

// Find every ${CLAUDE_PLUGIN_ROOT} reference in a file's text. Returns
// [{ line, ref }] where ref is plugin-root-relative ('' means the root
// itself), with leading/trailing slashes and sentence punctuation stripped.
export function scanPluginRootRefs(text) {
  const refs = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(PLUGIN_ROOT_REF)) {
      const ref = m[1].replace(/[.,;:]+$/, '').replace(/^\//, '').replace(/\/$/, '');
      refs.push({ line: i + 1, ref });
    }
  }
  return refs;
}

// Expand {a,b,c} brace groups into one path per alternative.
export function expandBraces(ref) {
  const m = ref.match(/\{([^}]*)\}/);
  if (!m) return [ref];
  return m[1]
    .split(',')
    .flatMap((part) => expandBraces(ref.slice(0, m.index) + part + ref.slice(m.index + m[0].length)));
}

// ---------- shared emitter transforms ----------

// Same as PLUGIN_ROOT_REF, but with the optional glued (escaped) closing quote
// as its OWN capture group, so an emitter can refuse the hooks.json style
// ("${CLAUDE_PLUGIN_ROOT}"/hooks/x.sh) instead of rewriting it inline.
const PLUGIN_ROOT_REF_QUOTED = /\$\{CLAUDE_PLUGIN_ROOT\}(\\?")?((?:\/[A-Za-z0-9_.{},-]+)*\/?)/g;

// Rewrite every ${CLAUDE_PLUGIN_ROOT} reference in `text` (a file emitted at
// `outRel` inside the target's plugin dir, same relative position as in the
// source tree) to a path relative to the file's own directory. No target tool
// exposes a plugin-root variable usable in prose, but every ref lives in a
// file whose own installed location is known — so relative paths hold (Codex
// caches the plugin structure verbatim; Cursor installs the tree as-is).
// Minimal edits: path swap only, plus " (relative to this file)" appended
// after the first rewritten ref in each file (outside code fences).
// `mapTarget(ref, where)` is the emitter's plugin-root-relative → output-path
// mapping; it must THROW on anything it cannot map. Every target is validated
// against the source plugin tree, so an unknown or missing target fails the
// run loudly — no silent passthrough (design edge case). `label` prefixes
// every error (the calling emitter's name).
export function rewriteRefs(text, outRel, treeRoot, mapTarget, label) {
  const dir = posix.dirname(outRel);
  const fm = parseFrontmatter(text);
  const fmEnd = fm ? fm.endLine : 0;
  const lines = text.split('\n');
  let inFence = false;
  let noteAdded = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (lineNo > fmEnd && /^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;

    let result = '';
    let last = 0;
    let notePos = -1;
    for (const m of lines[i].matchAll(PLUGIN_ROOT_REF_QUOTED)) {
      const where = `${outRel}:${lineNo}`;
      if (m[1]) {
        throw new Error(`${label}: ${where}: quoted hooks.json-style \${CLAUDE_PLUGIN_ROOT} ref in an emitted file — no inline mapping (hooks.json is re-emitted per tool)`);
      }
      const pathPart = m[2];
      const punct = pathPart.match(/[.,;:]+$/)?.[0] ?? '';
      const core = pathPart.slice(0, pathPart.length - punct.length);
      const trailingSlash = core.endsWith('/');
      const ref = core.replace(/^\//, '').replace(/\/$/, '');
      for (const expanded of expandBraces(ref)) {
        if (expanded.split('/').includes('..')) {
          throw new Error(`${label}: ${where}: \${CLAUDE_PLUGIN_ROOT} reference escapes the plugin tree: ${expanded}`);
        }
        if (expanded !== '' && !existsSync(join(treeRoot, ...expanded.split('/')))) {
          throw new Error(`${label}: ${where}: \${CLAUDE_PLUGIN_ROOT}/${expanded} does not exist — refusing to emit (no silent passthrough)`);
        }
        mapTarget(expanded, where); // mappability check per alternative
      }
      let rel = ref === '' ? posix.relative(dir, '') : posix.relative(dir, mapTarget(ref, where));
      if (rel === '') rel = '.'; // target is this file's own directory
      const replacement = rel + (trailingSlash ? '/' : '') + punct;
      result += lines[i].slice(last, m.index) + replacement;
      last = m.index + m[0].length;
      if (!noteAdded && !inFence && notePos === -1) notePos = result.length - punct.length;
    }
    if (last === 0) continue;
    result += lines[i].slice(last);
    if (notePos !== -1) {
      // Land the note after the code span/quote the path sits in, not inside it.
      let p = notePos;
      while (p < result.length && (result[p] === '`' || result[p] === '"' || result[p] === "'")) p++;
      result = `${result.slice(0, p)} (relative to this file)${result.slice(p)}`;
      noteAdded = true;
    }
    lines[i] = result;
  }
  return lines.join('\n');
}

// Drop the given frontmatter keys; warn on keys outside the known set. Unknown
// keys pass through (both targets ignore unknown frontmatter — LIVE on Codex,
// X2) but the warning means a new Claude Code field gets a deliberate mapping
// decision instead of silent drift. `label` prefixes the warning.
export function transformFrontmatter(text, dropKeys, knownKeys, sourceRel, label) {
  const fm = parseFrontmatter(text);
  if (!fm) return text;
  const lines = text.split('\n');
  const kept = [lines[0]];
  for (let i = 1; i < fm.endLine - 1; i++) {
    const key = lines[i].match(/^([A-Za-z0-9_-]+):/)?.[1];
    if (key && dropKeys.includes(key)) continue;
    if (key && !knownKeys.has(key)) {
      console.warn(`${label}: ${sourceRel}: unknown frontmatter key "${key}" passed through — give it a deliberate mapping`);
    }
    kept.push(lines[i]);
  }
  kept.push(...lines.slice(fm.endLine - 1));
  return kept.join('\n');
}

// ---------- deterministic writer ----------

// A file value in an emitter's output map is either a plain string, or
// { text, mode } for files that need an explicit mode (executable hook
// scripts: mode 0o755). These two normalize either shape.
export function contentText(content) {
  return typeof content === 'string' ? content : content.text;
}
export function contentMode(content) {
  return typeof content === 'string' ? undefined : content.mode;
}

// Wipe each declared output dir, then write `files` (repo-root-relative POSIX
// path → content) in sorted order, LF endings only. Refuses any path outside
// the declared dirs — nothing is ever written elsewhere. Files carrying a
// mode get chmod-ed after the write (deterministic: the wipe means every run
// re-applies the same mode; on Windows chmod is a near-no-op, which is fine —
// the committed exec bit comes from POSIX runs and CI).
export function writeOutputs(repoRootAbs, outputDirs, files) {
  const entries = Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [rel] of entries) {
    const escapes = rel.split('/').includes('..');
    const declared = outputDirs.some((d) => rel === d || rel.startsWith(`${d}/`));
    if (escapes || !declared) {
      throw new Error(`writeOutputs: "${rel}" is outside the declared output dirs [${outputDirs.join(', ')}]`);
    }
  }
  for (const dir of outputDirs) {
    rmSync(join(repoRootAbs, ...dir.split('/')), { recursive: true, force: true });
  }
  for (const [rel, content] of entries) {
    const abs = join(repoRootAbs, ...rel.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, String(contentText(content)).replace(/\r\n/g, '\n'), 'utf8');
    const mode = contentMode(content);
    if (mode !== undefined) chmodSync(abs, mode);
  }
}

// ---------- structural self-test ----------

// Assert the plugin tree parses: every skill ships a SKILL.md with name +
// description frontmatter, the three config files parse as JSON, and every
// ${CLAUDE_PLUGIN_ROOT} reference points at something that exists (no silent
// passthrough). Returns problem strings; empty means clean.
export function checkPluginStructure(tree) {
  const problems = [];
  const byRel = new Map(tree.files.map((f) => [f.rel, f]));

  const skillDirs = [...new Set(
    tree.files.filter((f) => f.rel.startsWith('skills/')).map((f) => f.rel.split('/')[1])
  )].sort();
  for (const dir of skillDirs) {
    const skill = byRel.get(`skills/${dir}/SKILL.md`);
    if (!skill) {
      problems.push(`skills/${dir}: missing SKILL.md`);
      continue;
    }
    const fm = parseFrontmatter(skill.text);
    if (!fm) {
      problems.push(`${skill.rel}: missing YAML frontmatter`);
    } else {
      if (!fm.data.name) problems.push(`${skill.rel}: frontmatter has no "name"`);
      if (!fm.data.description) problems.push(`${skill.rel}: frontmatter has no "description"`);
    }
  }

  for (const rel of ['.claude-plugin/plugin.json', '.mcp.json', 'hooks/hooks.json']) {
    const f = byRel.get(rel);
    if (!f) {
      problems.push(`${rel}: missing`);
      continue;
    }
    try {
      JSON.parse(f.text);
    } catch (err) {
      problems.push(`${rel}: invalid JSON — ${err.message}`);
    }
  }

  for (const f of tree.files) {
    for (const { line, ref } of scanPluginRootRefs(f.text)) {
      for (const expanded of expandBraces(ref)) {
        if (expanded.split('/').includes('..')) {
          problems.push(`${f.rel}:${line}: \${CLAUDE_PLUGIN_ROOT} reference escapes the plugin tree: ${expanded}`);
        } else if (expanded !== '' && !existsSync(join(tree.root, ...expanded.split('/')))) {
          problems.push(`${f.rel}:${line}: \${CLAUDE_PLUGIN_ROOT}/${expanded} does not exist`);
        }
      }
    }
  }

  return problems;
}

// ---------- Claude-ism denylist lint ----------

// Denylist (design: "Source-side de-Claude-ing"). These must not appear in
// shipped prose except where an allowance below applies. Regexes carry no /g
// flag on purpose (no lastIndex state across .test calls).
const DENYLIST = [
  ['AskUserQuestion', /AskUserQuestion/],
  ['/reload-plugins', /\/reload-plugins/],
  ['claude plugin install', /claude plugin install/],
  ['.claude/settings.json', /\.claude\/settings\.json/],
  ['model: haiku', /model:\s*haiku/],
  ['CLAUDE.md', /CLAUDE\.md/],
];

const INIT_SKILL = 'skills/bluestep-init/SKILL.md';
const PER_TOOL_LINE = /Claude Code|Cursor|Codex/;

// Lint shipped prose — every .md under plugin/**, plus the plugin.json
// description — for denylisted Claude-isms. An occurrence is allowed when ANY
// of these apply:
//   a. it sits in YAML frontmatter (covers allowed-tools, model:, skill
//      descriptions that name the supported tools);
//   b. the same line names a tool (Claude Code / Cursor / Codex) — explicitly
//      per-tool prose, the parenthetical convention from the de-Claude-ing;
//   c. it is inside the "### Claude Code" enablement subsection of the
//      bluestep-init SKILL.md (per-tool by construction; tracked via section
//      headers, code fences ignored);
//   d. for CLAUDE.md only: the line also mentions AGENTS.md (bridge-mechanism
//      explanations), OR the file is the bluestep-init SKILL.md — writing and
//      migrating the CLAUDE.md bridge file on every tool is that skill's job,
//      so the filename there is subject matter, not a Claude-ism.
// The plugin.json description gets NO allowances: it is the cross-tool
// storefront text, so any denylisted term there is always a finding.
export function lintClaudeIsms(tree) {
  const findings = [];
  for (const f of tree.files) {
    if (!f.rel.endsWith('.md')) continue;
    const fm = parseFrontmatter(f.text);
    const fmEnd = fm ? fm.endLine : 0;
    const lines = f.text.split('\n');
    let inFence = false;
    let ccSectionLevel = 0; // >0 while inside a "Claude Code" heading's section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;
      if (lineNo > fmEnd && /^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const heading = !inFence && lineNo > fmEnd && line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (heading) {
        const level = heading[1].length;
        if (ccSectionLevel && level <= ccSectionLevel) ccSectionLevel = 0;
        if (heading[2].trim() === 'Claude Code') ccSectionLevel = level;
      }
      for (const [name, re] of DENYLIST) {
        if (!re.test(line)) continue;
        if (lineNo <= fmEnd) continue; // (a)
        if (PER_TOOL_LINE.test(line)) continue; // (b)
        if (f.rel === INIT_SKILL && ccSectionLevel) continue; // (c)
        if (name === 'CLAUDE.md' && (line.includes('AGENTS.md') || f.rel === INIT_SKILL)) continue; // (d)
        findings.push(`${f.rel}:${lineNo}: denylisted "${name}" — ${line.trim().slice(0, 120)}`);
      }
    }
  }
  const manifest = tree.files.find((f) => f.rel === '.claude-plugin/plugin.json');
  if (manifest) {
    try {
      const description = JSON.parse(manifest.text).description ?? '';
      for (const [name, re] of DENYLIST) {
        if (re.test(description)) {
          findings.push(`.claude-plugin/plugin.json: denylisted "${name}" in the plugin description`);
        }
      }
    } catch {
      // Invalid JSON is checkPluginStructure's finding, not the lint's.
    }
  }
  return findings;
}
