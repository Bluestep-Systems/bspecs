import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, readdirSync, statSync } from 'fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { getEmbeddedTemplates } from './templates-embed.js';

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

// Read one template by its TEMPLATES_DIR-relative path. Reads from the embedded
// map when running as a baked binary, else from disk (the `node cli.js` dev path).
export function readTemplate(relativePath) {
  const rel = relativePath.split('\\').join('/');
  const embedded = getEmbeddedTemplates();
  if (embedded) {
    if (!(rel in embedded)) throw new Error(`Embedded template missing: ${rel}`);
    return embedded[rel];
  }
  return readFileSync(join(TEMPLATES_DIR, relativePath), 'utf8');
}

// Whether a template exists in the active source (embedded map or disk).
export function templateExists(relativePath) {
  const rel = relativePath.split('\\').join('/');
  const embedded = getEmbeddedTemplates();
  if (embedded) return rel in embedded;
  return existsSync(join(TEMPLATES_DIR, relativePath));
}

// Extra opts (all default off, so plain calls overwrite everything as before):
// skipExisting leaves existing dest files untouched (bspecs init); collect is a
// { written, skipped } accumulator of absolute paths; exclude lists source-relative
// paths (forward-slashed) to omit so the caller can handle them separately.
export function copyTemplateTree(srcRel, destAbs, vars, opts = {}) {
  const {
    makeExecutable = false,
    stripTemplateExt = true,
    skipExisting = false,
    collect = null,
    exclude = [],
  } = opts;
  const skip = new Set(exclude);
  const embedded = getEmbeddedTemplates();

  // Embedded (baked binary): walk the in-memory map's keys under srcRel. Mirrors
  // the disk walk below — same .template stripping, exclude, skipExisting,
  // collect, and .sh chmod — only the byte source differs.
  if (embedded) {
    const prefix = srcRel.replace(/\/+$/, '') + '/';
    for (const key of Object.keys(embedded).sort()) {
      if (!key.startsWith(prefix)) continue;
      const relFromSrc = key.slice(prefix.length); // forward-slashed, relative to srcRel
      if (skip.has(relFromSrc)) continue;
      const targetRel = stripTemplateExt ? relFromSrc.replace(/\.template$/, '') : relFromSrc;
      const destFile = join(destAbs, ...targetRel.split('/'));
      if (skipExisting && existsSync(destFile)) {
        if (collect) collect.skipped.push(destFile);
        continue;
      }
      const rendered = applyTemplate(embedded[key], vars);
      writeFile(destFile, rendered);
      if (makeExecutable && destFile.endsWith('.sh')) {
        try { chmodSync(destFile, 0o755); } catch { /* Windows can't chmod, ignore */ }
      }
      if (collect) collect.written.push(destFile);
    }
    return;
  }

  const srcAbs = join(TEMPLATES_DIR, srcRel);
  if (!existsSync(srcAbs)) return;
  walk(srcAbs, srcAbs, destAbs, vars, { makeExecutable, stripTemplateExt, skipExisting, collect, skip });
}

function walk(rootSrc, src, dest, vars, opts) {
  for (const entry of readdirSync(src)) {
    const srcEntry = join(src, entry);
    const stats = statSync(srcEntry);
    if (stats.isDirectory()) {
      walk(rootSrc, srcEntry, join(dest, entry), vars, opts);
    } else {
      const srcRelPath = relative(rootSrc, srcEntry).split('\\').join('/');
      if (opts.skip.has(srcRelPath)) continue;

      const targetName = opts.stripTemplateExt && entry.endsWith('.template')
        ? entry.slice(0, -'.template'.length)
        : entry;
      const destFile = join(dest, targetName);

      if (opts.skipExisting && existsSync(destFile)) {
        if (opts.collect) opts.collect.skipped.push(destFile);
        continue;
      }

      const raw = readFileSync(srcEntry, 'utf8');
      const rendered = applyTemplate(raw, vars);
      writeFile(destFile, rendered);
      if (opts.makeExecutable && destFile.endsWith('.sh')) {
        try { chmodSync(destFile, 0o755); } catch { /* Windows can't chmod, ignore */ }
      }
      if (opts.collect) opts.collect.written.push(destFile);
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
  const skip = new Set(exclude);
  const embedded = getEmbeddedTemplates();
  if (embedded) {
    const targets = [];
    for (const key of Object.keys(embedded).sort()) {
      if (!key.startsWith('claude/') || skip.has(key)) continue;
      const destRel = '.claude/' + key.slice('claude/'.length).replace(/\.template$/, '');
      targets.push({ templateSrc: key, destRel });
    }
    return targets;
  }
  const root = join(TEMPLATES_DIR, 'claude');
  if (!existsSync(root)) return [];
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

// Add only-missing template devDependencies and the `b6p` script into an existing
// package.json (bspecs init); existing values are never changed. Returns merged
// JSON text, or null if the existing content isn't valid JSON (caller fails soft).
export function mergePackageJson(existingContent, templateContent) {
  let existing;
  try {
    existing = JSON.parse(existingContent);
  } catch {
    return null;
  }
  const template = JSON.parse(templateContent);

  const tplDeps = template.devDependencies || {};
  if (Object.keys(tplDeps).length > 0) {
    existing.devDependencies = existing.devDependencies || {};
    for (const [name, version] of Object.entries(tplDeps)) {
      if (!(name in existing.devDependencies)) existing.devDependencies[name] = version;
    }
  }

  const tplScripts = template.scripts || {};
  if ('b6p' in tplScripts) {
    existing.scripts = existing.scripts || {};
    if (!('b6p' in existing.scripts)) existing.scripts.b6p = tplScripts.b6p;
  }

  return JSON.stringify(existing, null, 2) + '\n';
}
