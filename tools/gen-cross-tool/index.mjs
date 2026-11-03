#!/usr/bin/env node
// tools/gen-cross-tool/index.mjs — CLI entry for the cross-tool plugin
// generator. No args: discover every plugins/<name>/, run every registered
// emitter over them and write its output tree. --check: discovery asserts +
// structural self-test + the Claude-ism denylist lint + the b6p CLI floor
// lint + shared-copy identity + each emitter's own check (the CI gate); exits
// non-zero on any finding.
// Invariant: output is a pure function of plugins/** — sorted walks, no
// timestamps, no environment leakage, LF line endings.

// Fail fast below the supported engine floor (same as package.json engines).
// Static imports evaluate before this, but they are node builtins + lib.mjs,
// which load fine on the versions old enough to reach this line.
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.error(`gen-cross-tool: Node >= 18 required, running ${process.version}.`);
  process.exit(1);
}

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLUGINS_DIR,
  checkPluginStructure,
  checkSharedCopies,
  discoverPlugins,
  emittedShapeView,
  lintClaudeIsms,
  lintCliFloor,
  writeOutputs,
} from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const PLUGINS_ROOT = join(REPO_ROOT, PLUGINS_DIR);

// Emitter registry. Each specifier default-exports
//   { name, outputDirs, emit(plugins, ctx) }
// where plugins is the discovered array of { name, dir, manifest, tree } (every
// plugin; the emitter builds only the crossTool: true ones — crossToolPlugins()
// in lib.mjs), outputDirs are repo-root-relative POSIX paths (e.g.
// 'dist/cursor', '.cursor-plugin') and emit() returns ONE flat object of
// repo-root-relative paths → file content covering every plugin it emits plus
// its marketplace. The writer wipes outputDirs and refuses to write anywhere
// else. An emitter may also export check(plugins, ctx) → problem strings for
// its own --check structural assertions (emitted manifests parse, every source
// skill present, zero unmapped ${CLAUDE_PLUGIN_ROOT} refs). The version to
// mirror is per plugin: plugin.manifest.version.
const EMITTER_SPECIFIERS = [
  './emit-cursor.mjs', // content (task 8) + hooks/MCP wiring (task 9)
  './emit-codex.mjs', // content (task 10) + hooks/MCP/agents-payload wiring (task 11)
];

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const unknown = args.filter((a) => a !== '--check');
if (unknown.length) {
  console.error(`gen-cross-tool: unknown argument(s): ${unknown.join(' ')} — usage: index.mjs [--check]`);
  process.exit(1);
}

// Discovery: every folder under plugins/ must be a well-formed, listed plugin.
// Any failure stops both modes — emitters and lints key on these names.
const { plugins, problems: discoveryProblems } = discoverPlugins(REPO_ROOT);
if (discoveryProblems.length) {
  for (const p of discoveryProblems) console.error(`FAIL ${p}`);
  console.error(`gen-cross-tool: ${discoveryProblems.length} plugin discovery problem(s).`);
  process.exit(1);
}

const ctx = { repoRoot: REPO_ROOT, pluginsRoot: PLUGINS_ROOT };
const fileCount = plugins.reduce((n, p) => n + p.tree.files.length, 0);
const pluginList = plugins.map((p) => `${p.name}${p.manifest.crossTool ? '' : ' (crossTool false)'}`).join(', ');

const emitters = [];
for (const spec of EMITTER_SPECIFIERS) {
  emitters.push((await import(spec)).default);
}

if (!checkMode) {
  if (emitters.length === 0) {
    console.log(`gen-cross-tool: read ${fileCount} files in ${plugins.length} plugin(s); no emitters registered yet — nothing to generate.`);
  } else {
    for (const emitter of emitters) {
      const files = emitter.emit(plugins, ctx);
      writeOutputs(REPO_ROOT, emitter.outputDirs, files);
      console.log(`gen-cross-tool: ${emitter.name}: wrote ${Object.keys(files).length} files into ${emitter.outputDirs.join(', ')}`);
    }
  }
  process.exit(0);
}

// --check: source-side assertions run on each plugin's emitted-shape view
// (skills/, agents/, hooks/, manifest, .mcp.json); emitter self-tests when
// present. Findings are labelled plugins/<name>/<rel>.
if (emitters.length === 0) {
  console.log('gen-cross-tool: no emitters registered yet — running source structure checks + denylist lint only.');
}
const views = plugins.map((p) => ({ tree: emittedShapeView(p.tree), prefix: `${p.dir}/` }));
const problems = [
  ...views.flatMap(({ tree, prefix }) => [...checkPluginStructure(tree, prefix), ...lintClaudeIsms(tree, prefix)]),
  ...lintCliFloor(views, REPO_ROOT),
  ...checkSharedCopies(plugins),
];
for (const emitter of emitters) {
  if (typeof emitter.check !== 'function') continue;
  try {
    problems.push(...emitter.check(plugins, ctx));
  } catch (err) {
    problems.push(`${emitter.name}: check() threw — ${err.message}`);
  }
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`gen-cross-tool --check: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(
  `gen-cross-tool --check: OK (${plugins.length} plugin(s): ${pluginList}; ${fileCount} files; ` +
    'structure + denylist + CLI-floor lint + shared copies clean).'
);
