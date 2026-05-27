import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '@clack/prompts';
import { TEMPLATES_DIR, applyTemplate, writeFile, sha256 } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

export const SYNC_TARGETS = [
  // Skills (8)
  { templateSrc: 'claude/skills/b6p-audit/SKILL.md',    destRel: '.claude/skills/b6p-audit/SKILL.md' },
  { templateSrc: 'claude/skills/b6p-detect/SKILL.md',   destRel: '.claude/skills/b6p-detect/SKILL.md' },
  { templateSrc: 'claude/skills/b6p-pull/SKILL.md',     destRel: '.claude/skills/b6p-pull/SKILL.md' },
  { templateSrc: 'claude/skills/b6p-push/SKILL.md',     destRel: '.claude/skills/b6p-push/SKILL.md' },
  { templateSrc: 'claude/skills/bug-fix/SKILL.md',      destRel: '.claude/skills/bug-fix/SKILL.md' },
  { templateSrc: 'claude/skills/spec-create/SKILL.md',  destRel: '.claude/skills/spec-create/SKILL.md' },
  { templateSrc: 'claude/skills/spec-execute/SKILL.md', destRel: '.claude/skills/spec-execute/SKILL.md' },
  { templateSrc: 'claude/skills/spec-status/SKILL.md',  destRel: '.claude/skills/spec-status/SKILL.md' },
  // Hooks (4)
  { templateSrc: 'claude/hooks/block-generated-files.sh',  destRel: '.claude/hooks/block-generated-files.sh' },
  { templateSrc: 'claude/hooks/block-tsc.sh',              destRel: '.claude/hooks/block-tsc.sh' },
  { templateSrc: 'claude/hooks/prettier-on-save.sh',       destRel: '.claude/hooks/prettier-on-save.sh' },
  { templateSrc: 'claude/hooks/require-wsl-for-b6p.sh',   destRel: '.claude/hooks/require-wsl-for-b6p.sh' },
  // Settings (1)
  { templateSrc: 'claude/settings.json.template', destRel: '.claude/settings.json' },
  // Instructions — .claude/ (2)
  { templateSrc: 'claude/instructions/bsjs-development.md.template', destRel: '.claude/instructions/bsjs-development.md' },
  { templateSrc: 'claude/instructions/b6p-platform.md.template',     destRel: '.claude/instructions/b6p-platform.md' },
  // Instructions — .github/ mirrors (2)
  { templateSrc: 'claude/instructions/bsjs-development.md.template', destRel: '.github/instructions/bsjs-development.instructions.md' },
  { templateSrc: 'claude/instructions/b6p-platform.md.template',     destRel: '.github/instructions/b6p-platform.instructions.md' },
  // Spec templates (3)
  { templateSrc: 'claude/spec-templates/design.template.md',       destRel: '.claude/spec-templates/design.template.md' },
  { templateSrc: 'claude/spec-templates/requirements.template.md', destRel: '.claude/spec-templates/requirements.template.md' },
  { templateSrc: 'claude/spec-templates/tasks.template.md',        destRel: '.claude/spec-templates/tasks.template.md' },
];

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
