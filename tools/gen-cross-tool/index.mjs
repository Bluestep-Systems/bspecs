#!/usr/bin/env node
// tools/gen-cross-tool/index.mjs — CLI entry for the cross-tool plugin
// generator. No args: run every registered emitter over plugin/** and write
// its output tree. --check: structural self-test + the Claude-ism denylist
// lint (the CI gate); exits non-zero on any finding.
// Invariant: output is a pure function of plugin/** — sorted walks, no
// timestamps, no environment leakage, LF line endings.

// Fail fast below the supported engine floor (same as package.json engines).
// Static imports evaluate before this, but they are node builtins + lib.mjs,
// which load fine on the versions old enough to reach this line.
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.error(`gen-cross-tool: Node >= 18 required, running ${process.version}.`);
  process.exit(1);
}

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPluginStructure, lintClaudeIsms, readPluginTree, writeOutputs } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const PLUGIN_ROOT = join(REPO_ROOT, 'plugin');

// Emitter registry. Each specifier default-exports
//   { name, outputDirs, emit(pluginTree, ctx) }
// where outputDirs are repo-root-relative POSIX paths (e.g. 'dist/cursor',
// '.cursor-plugin') and emit() returns a plain object of repo-root-relative
// paths → file content. The writer wipes outputDirs and refuses to write
// anywhere else. An emitter may also export check(pluginTree, ctx) → problem
// strings for its own --check structural assertions (emitted manifests parse,
// every source skill present, zero unmapped ${CLAUDE_PLUGIN_ROOT} refs).
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

if (!existsSync(PLUGIN_ROOT)) {
  console.error(`gen-cross-tool: plugin tree not found at ${PLUGIN_ROOT}`);
  process.exit(1);
}

const tree = readPluginTree(PLUGIN_ROOT);

// ctx passed to emitters. version comes from the one shared manifest; in
// --check mode an unparsable manifest surfaces as a structural finding
// instead of a crash here.
let version;
try {
  version = JSON.parse(tree.files.find((f) => f.rel === '.claude-plugin/plugin.json')?.text ?? '{}').version;
} catch {
  version = undefined;
}
const ctx = { repoRoot: REPO_ROOT, pluginRoot: PLUGIN_ROOT, version };

const emitters = [];
for (const spec of EMITTER_SPECIFIERS) {
  emitters.push((await import(spec)).default);
}

if (!checkMode) {
  if (emitters.length === 0) {
    console.log(`gen-cross-tool: read ${tree.files.length} plugin files; no emitters registered yet — nothing to generate.`);
  } else {
    for (const emitter of emitters) {
      const files = emitter.emit(tree, ctx);
      writeOutputs(REPO_ROOT, emitter.outputDirs, files);
      console.log(`gen-cross-tool: ${emitter.name}: wrote ${Object.keys(files).length} files into ${emitter.outputDirs.join(', ')}`);
    }
  }
  process.exit(0);
}

// --check: source-side assertions always run; emitter self-tests when present.
if (emitters.length === 0) {
  console.log('gen-cross-tool: no emitters registered yet — running source structure checks + denylist lint only.');
}
const problems = [...checkPluginStructure(tree), ...lintClaudeIsms(tree)];
for (const emitter of emitters) {
  if (typeof emitter.check === 'function') problems.push(...emitter.check(tree, ctx));
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`gen-cross-tool --check: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`gen-cross-tool --check: OK (${tree.files.length} plugin files; structure + denylist lint clean).`);
