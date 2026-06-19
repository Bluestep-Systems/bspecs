import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '@clack/prompts';
import { TEMPLATES_DIR, applyTemplate, writeFile, sha256, enumerateClaudeTargets } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// Files the scaffolder writes once but sync must NOT manage afterwards.
// Empty today; add a templateSrc path (forward-slashed, e.g.
// 'claude/skills/foo/SKILL.md') to opt a future scaffold-once file out of sync.
const SYNC_EXCLUDE = [];

// Every file under templates/claude/** is synced infrastructure (skills, hooks,
// settings, spec-templates, instructions). Derived by walking the tree rather
// than a hardcoded list, so new files flow into `bspecs sync` and bspecs.lock
// automatically — no hand-maintained array to drift. templates/root/ (user-owned
// CLAUDE.md/README) and templates/module/ (scaffold-once) live outside this tree
// and are excluded by construction. Claude-only: no .github mirror.
export const SYNC_TARGETS = enumerateClaudeTargets(SYNC_EXCLUDE);

function findProjectRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, '.claude', 'bspecs.lock'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readLock(projectRoot) {
  return JSON.parse(readFileSync(join(projectRoot, '.claude', 'bspecs.lock'), 'utf8'));
}

function writeLock(projectRoot, obj) {
  writeFileSync(join(projectRoot, '.claude', 'bspecs.lock'), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function syncFiles(projectRoot, lock, silent) {
  const vars = lock.vars || {};
  const newFiles = {};
  let updated = 0;
  let skipped = 0;

  for (const target of SYNC_TARGETS) {
    const templatePath = join(TEMPLATES_DIR, target.templateSrc);
    if (!existsSync(templatePath)) continue;

    const newContent = applyTemplate(readFileSync(templatePath, 'utf8'), vars);
    const newHash = sha256(newContent);
    const destAbs = join(projectRoot, target.destRel);
    const lockHash = lock.files[target.destRel];

    if (!existsSync(destAbs)) {
      writeFile(destAbs, newContent);
      if (destAbs.endsWith('.sh')) {
        try { chmodSync(destAbs, 0o755); } catch { /* Windows */ }
      }
      newFiles[target.destRel] = newHash;
      updated++;
      if (!silent) log.info(`  added   ${target.destRel}`);
      continue;
    }

    const diskHash = sha256(readFileSync(destAbs, 'utf8'));

    if (lockHash !== undefined && diskHash !== lockHash) {
      // Usuario editó este archivo localmente — no tocar
      newFiles[target.destRel] = lockHash;
      skipped++;
      if (!silent) log.warn(`  skipped ${target.destRel}  (locally modified)`);
    } else {
      writeFile(destAbs, newContent);
      if (destAbs.endsWith('.sh')) {
        try { chmodSync(destAbs, 0o755); } catch { /* Windows */ }
      }
      newFiles[target.destRel] = newHash;
      if (diskHash !== newHash) {
        updated++;
        if (!silent) log.info(`  updated ${target.destRel}`);
      }
    }
  }

  return { updated, skipped, newFiles };
}

export async function sync({ silent = false } = {}) {
  try {
    const projectRoot = findProjectRoot(process.cwd());

    if (!projectRoot) {
      if (!silent) {
        console.error(
          'No bspecs.lock found. Run bspecs sync from a project scaffolded with bspecs 0.5.0 or later.\n' +
          'If this project was scaffolded earlier, re-run bspecs in the parent directory to re-scaffold.'
        );
      }
      return;
    }

    const lock = readLock(projectRoot);
    if (!silent) log.info(`Syncing infrastructure files in: ${projectRoot}`);

    const { updated, skipped, newFiles } = syncFiles(projectRoot, lock, silent);

    writeLock(projectRoot, {
      bspecs_version: pkg.version,
      synced_at: new Date().toISOString().split('T')[0],
      vars: lock.vars || {},
      files: newFiles,
    });

    if (!silent) {
      log.success(`Sync complete. Updated ${updated} file${updated !== 1 ? 's' : ''}, skipped ${skipped} (locally modified).`);
    }
  } catch (err) {
    if (!silent) throw err;
    // En modo --silent (hook SessionStart): nunca bloquear el startup de Claude Code
  }
}
