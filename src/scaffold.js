import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { log } from '@clack/prompts';
import { ensureDir, copyTemplateTree, applyTemplate, TEMPLATES_DIR, sha256 } from './utils.js';
import { SYNC_TARGETS } from './sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

function writeBspecsLock(projectDir, vars) {
  const files = {};
  for (const target of SYNC_TARGETS) {
    const templatePath = join(TEMPLATES_DIR, target.templateSrc);
    if (!existsSync(templatePath)) continue;
    const rendered = applyTemplate(readFileSync(templatePath, 'utf8'), vars);
    files[target.destRel] = sha256(rendered);
  }

  const lock = {
    bspecs_version: pkg.version,
    synced_at: new Date().toISOString().split('T')[0],
    vars: {
      PROJECT_NAME: vars.PROJECT_NAME,
      CLIENT_NAME: vars.CLIENT_NAME,
      PROJECT_DESCRIPTION: vars.PROJECT_DESCRIPTION,
      SCAFFOLD_DATE: vars.SCAFFOLD_DATE,
    },
    files,
  };

  writeFileSync(join(projectDir, '.claude', 'bspecs.lock'), JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

export async function scaffold(answers) {
  const projectDir = join(process.cwd(), answers.projectName);
  ensureDir(projectDir);

  const vars = {
    PROJECT_NAME: answers.projectName,
    CLIENT_NAME: answers.clientName,
    PROJECT_DESCRIPTION: answers.projectDescription,
    SCAFFOLD_DATE: new Date().toISOString().split('T')[0],
  };

  copyTemplateTree('root', projectDir, vars);
  copyTemplateTree('claude', join(projectDir, '.claude'), vars, { makeExecutable: true });
  copyTemplateTree('module', join(projectDir, '.claude', 'templates'), vars);

  writeBspecsLock(projectDir, vars);

  log.success('Files generated.');

  checkPrettierOnPath();
  installDependencies(answers.projectName, projectDir);

  if (answers.initGit) {
    if (isInsideGitRepo(projectDir)) {
      log.warn(
        'An existing git repository was found in a parent directory. Skipping git init to avoid nesting a repository inside another — initialize manually if that was intended.'
      );
    } else {
      try {
        execSync('git init', { cwd: projectDir, stdio: 'ignore' });
        execSync('git add -A', { cwd: projectDir, stdio: 'ignore' });
        execSync('git commit -m "chore: initial scaffold via bspecs"', {
          cwd: projectDir,
          stdio: 'ignore',
        });
        log.success('Git repository initialized.');
      } catch (err) {
        log.warn('Could not initialize git repository (git may not be installed).');
      }
    }
  } else {
    log.warn(
      'Skipped git init. The implementer agent relies on `git diff` to summarize its work — run `git init` in the project before using /spec-execute.'
    );
  }
}

// Detect whether the freshly created project directory sits inside an existing
// git repository (a parent has a .git). Running `git init` here would nest a
// repo inside another, which surprises users and breaks the implementer agent's
// `git diff`. Returns false if git is unavailable so the normal init path runs.
function isInsideGitRepo(dir) {
  try {
    const out = execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.toString().trim() === 'true';
  } catch {
    return false;
  }
}

// Best-effort check that prettier is reachable, so we can warn that the
// prettier-on-save hook will be a no-op until it is installed. The hook runs
// inside WSL on Windows, so we probe WSL there in addition to the native PATH.
// Stderr is silenced because interactive shells often emit banners/warnings.
// Warning only — this never blocks the scaffold.
function checkPrettierOnPath() {
  const probes = process.platform === 'win32'
    ? ['where prettier', 'wsl bash -lc "command -v prettier"', 'wsl zsh -ic "command -v prettier"']
    : ['command -v prettier'];
  for (const cmd of probes) {
    try {
      execSync(cmd, { stdio: ['ignore', 'ignore', 'ignore'] });
      return; // found
    } catch {
      // try the next probe
    }
  }
  const installCmd = process.platform === 'linux' || process.platform === 'darwin'
    ? 'npm i -g prettier'
    : 'npm i -g prettier  (in PowerShell)  or  wsl bash -lc "npm i -g prettier"  (in WSL)';
  log.warn(`prettier not found in either the native or WSL PATH. The prettier-on-save hook will be a no-op until you run: ${installCmd}`);
}

// Install the project's dependencies on a best-effort basis. We attempt
// `npm install` so the b6p CLI (a devDependency) is present without a manual
// step, but it can legitimately fail and we must NOT assume it will succeed:
// @bluestep-systems/b6p-cli installs anonymously from the public npm registry
// (no token, no ~/.npmrc), so the realistic failure mode is the machine being
// offline at scaffold time. On any failure we fall back to printing the manual
// install reminder rather than failing the scaffold or leaving the project
// half-installed. The skills invoke `npx b6p`, so `node_modules/.bin/b6p` must
// exist before the first b6p skill runs — hence the reminder on failure.
function installDependencies(projectName, projectDir) {
  log.info(`Installing dependencies in ${projectName} (npm install)…`);
  try {
    execSync('npm install', { cwd: projectDir, stdio: 'ignore' });
    log.success('Dependencies installed — b6p is ready via `npx b6p`.');
  } catch {
    log.warn(
      [
        'Could not run `npm install` automatically. Install dependencies by hand',
        'before using the b6p skills:',
        '',
        `    cd ${projectName}`,
        '    npm install',
        '',
        'This fetches @bluestep-systems/b6p-cli (a devDependency) so the /b6p-pull,',
        '/b6p-push, and /b6p-audit skills can run `npx b6p …`. It installs from the',
        'public npm registry with no token or ~/.npmrc setup — the most common cause',
        'of this failure is simply being offline.',
      ].join('\n')
    );
  }
}
