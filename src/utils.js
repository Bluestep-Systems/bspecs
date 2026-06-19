import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, readdirSync, statSync } from 'fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export function applyTemplate(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  );
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function writeFile(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf8');
}

export function readTemplate(relativePath) {
  return readFileSync(join(TEMPLATES_DIR, relativePath), 'utf8');
}

export function copyTemplateTree(srcRel, destAbs, vars, opts = {}) {
  const { makeExecutable = false, stripTemplateExt = true } = opts;
  const srcAbs = join(TEMPLATES_DIR, srcRel);
  if (!existsSync(srcAbs)) return;
  walk(srcAbs, srcAbs, destAbs, vars, { makeExecutable, stripTemplateExt });
}

function walk(rootSrc, src, dest, vars, opts) {
  for (const entry of readdirSync(src)) {
    const srcEntry = join(src, entry);
    const stats = statSync(srcEntry);
    if (stats.isDirectory()) {
      walk(rootSrc, srcEntry, join(dest, entry), vars, opts);
    } else {
      const targetName = opts.stripTemplateExt && entry.endsWith('.template')
        ? entry.slice(0, -'.template'.length)
        : entry;
      const destFile = join(dest, targetName);
      const raw = readFileSync(srcEntry, 'utf8');
      const rendered = applyTemplate(raw, vars);
      writeFile(destFile, rendered);
      if (opts.makeExecutable && destFile.endsWith('.sh')) {
        try { chmodSync(destFile, 0o755); } catch { /* Windows can't chmod, ignore */ }
      }
    }
  }
}

// Walk templates/claude/** and return one sync target per file:
//   { templateSrc, destRel }
// templateSrc is relative to TEMPLATES_DIR (forward-slashed, e.g.
//   'claude/instructions/reference/foo.md.template'); destRel maps it into the
// scaffolded project ('.claude/instructions/reference/foo.md') — leading
// 'claude/' becomes '.claude/', a trailing '.template' is stripped, subfolders
// preserved. This is the same transform copyTemplateTree applies, so it
// reproduces the formerly-hardcoded skills/hooks/settings/spec-template entries
// exactly and picks up the instructions tree automatically. Claude-only: no
// .github mirror target is emitted. `exclude` lists templateSrc paths to skip —
// the escape hatch for any future scaffold-once file under claude/.
export function enumerateClaudeTargets(exclude = []) {
  const root = join(TEMPLATES_DIR, 'claude');
  if (!existsSync(root)) return [];
  const skip = new Set(exclude);
  const targets = [];
  walkClaude(root, 'claude', skip, targets);
  return targets;
}

function walkClaude(absDir, relDir, skip, targets) {
  for (const entry of readdirSync(absDir).sort()) {
    const abs = join(absDir, entry);
    const rel = `${relDir}/${entry}`;
    if (statSync(abs).isDirectory()) {
      walkClaude(abs, rel, skip, targets);
    } else if (!skip.has(rel)) {
      const destRel = '.claude/' + rel.slice('claude/'.length).replace(/\.template$/, '');
      targets.push({ templateSrc: rel, destRel });
    }
  }
}

export function exists(path) {
  return existsSync(path);
}

export function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}
