import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { log } from '@clack/prompts';
import { ensureDir, copyTemplateTree, writeFile, applyTemplate, TEMPLATES_DIR, sha256 } from './utils.js';
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
      // CONTEXT7_API_KEY omitido: es una API key, no necesaria para re-renderizar templates
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
    CONTEXT7_API_KEY: answers.context7Key,
    SCAFFOLD_DATE: new Date().toISOString().split('T')[0],
  };

  copyTemplateTree('root', projectDir, vars);
  copyTemplateTree('claude', join(projectDir, '.claude'), vars, { makeExecutable: true });
  copyTemplateTree('module', join(projectDir, '.claude', 'templates'), vars);
  copyTemplateTree('vscode', join(projectDir, '.vscode'), vars);

  mirrorInstructionsToGithub(projectDir, vars);
  writeBspecsLock(projectDir, vars);

  log.success('Files generated.');

  checkPrettierOnPath();
  const b6pEnv = detectB6pEnvironment();
  reportB6pStatus(b6pEnv);
  if (b6pEnv) {
    writeB6pEnvFile(projectDir, b6pEnv);
  }

  if (answers.initGit) {
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
}

// Probe whether `command -v <name>` succeeds when invoked with the given
// shell prefix (e.g. "bash -lc" or "wsl zsh -ic" or "" for raw exec).
// Stderr is silenced because interactive shells often emit banners/warnings.
function probeCommand(name, shellPrefix) {
  try {
    const cmd = shellPrefix
      ? `${shellPrefix} "command -v ${name}"`
      : (process.platform === 'win32' ? `where ${name}` : `command -v ${name}`);
    execSync(cmd, { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

// Pick the user's preferred shell binary on Linux/macOS based on $SHELL,
// falling back to /bin/bash if $SHELL is unset or unrecognised.
function userShell() {
  const shell = process.env.SHELL && /\/(bash|zsh|sh|fish)$/.test(process.env.SHELL)
    ? process.env.SHELL
    : '/bin/bash';
  return shell;
}

// Build the list of shell prefixes worth probing for a binary on this host.
// Order matters — first match wins.
//
// Two flag variants are tried per shell:
//   -lc → login shell. Loads ~/.zprofile or ~/.bash_profile. Clean (no banners)
//         but does NOT load .zshrc/.bashrc — and nvm typically lives there,
//         so this often misses node-installed binaries like b6p.
//   -ic → interactive shell. Loads .zshrc/.bashrc, so nvm works. May print
//         banners or warnings to stderr (silenced).
//
// On Linux/macOS we try the user's shell with both flags. On Windows we try
// native PATH first (where x.exe), then probe WSL zsh and bash with both
// flags (the WSL default shell isn't visible from this side).
function shellPrefixCandidates() {
  if (process.platform === 'win32') {
    return [
      '',                 // native install on Windows PATH
      'wsl zsh -lc',
      'wsl zsh -ic',
      'wsl bash -lc',
      'wsl bash -ic',
    ];
  }
  const shell = userShell();
  const result = [`${shell} -lc`, `${shell} -ic`];
  if (!shell.endsWith('/bash')) result.push('/bin/bash -lc', '/bin/bash -ic');
  return result;
}

function classifyPrefix(prefix) {
  return prefix.startsWith('wsl ') ? 'wsl' : 'native';
}

function detectEnvironmentFor(name) {
  for (const prefix of shellPrefixCandidates()) {
    if (probeCommand(name, prefix)) {
      return { location: classifyPrefix(prefix), shellPrefix: prefix };
    }
  }
  return null;
}

function checkPrettierOnPath() {
  if (detectEnvironmentFor('prettier')) return;
  const installCmd = process.platform === 'linux' || process.platform === 'darwin'
    ? 'npm i -g prettier'
    : 'npm i -g prettier  (in PowerShell)  or  wsl bash -lc "npm i -g prettier"  (in WSL)';
  log.warn(`prettier not found in either the native or WSL PATH. The prettier-on-save hook will be a no-op until you run: ${installCmd}`);
}

function detectB6pEnvironment() {
  return detectEnvironmentFor('b6p');
}

function reportB6pStatus(env) {
  if (env) {
    const authCmd = env.shellPrefix ? `${env.shellPrefix} 'b6p auth set'` : 'b6p auth set';
    log.info(`b6p CLI detected (location: ${env.location}). Run "${authCmd}" once if you have not configured credentials yet.`);
    return;
  }
  log.warn(
    [
      'b6p CLI not found in the native PATH' + (process.platform === 'win32' ? ' or WSL' : '') + '.',
      'The /b6p-pull, /b6p-push, and /b6p-audit skills will not work without it.',
      '',
      'Install it by cloning the upstream monorepo and linking the CLI package:',
      '',
      '    git clone git@github.com:Bluestep-Systems/vscode-extension.git ~/bluestep-vscode-extension',
      '    cd ~/bluestep-vscode-extension',
      '    npm install',
      '    npm run compile',
      '    cd packages/b6p-cli',
      '    npm link',
      '',
      'Verify with: b6p --help  (or: wsl bash -lc "b6p --help" from Windows if installed in WSL)',
      '',
      'Then configure your platform credentials (one-time):',
      '    b6p auth set',
      '',
      'After installing, run `/b6p-detect` in Claude Code to register the install location for this project.',
      '',
      'If the git clone fails with a permissions error, you need access to the',
      'Bluestep-Systems GitHub org. Ask in your team channel or contact a maintainer.',
    ].join('\n')
  );
}

function writeB6pEnvFile(projectDir, env) {
  const file = join(projectDir, '.claude', 'b6p-env.json');
  const payload = {
    shellPrefix: env.shellPrefix,
    location: env.location,
    detectedAt: new Date().toISOString(),
    detectedBy: 'bspecs scaffold',
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

// Generate .github/instructions/<name>.instructions.md from the same content
// rendered into .claude/instructions/<name>.md. Single source of truth.
function mirrorInstructionsToGithub(projectDir, vars) {
  const sources = [
    { src: 'claude/instructions/bsjs-development.md.template', dest: 'bsjs-development.instructions.md' },
    { src: 'claude/instructions/b6p-platform.md.template', dest: 'b6p-platform.instructions.md' },
  ];
  for (const { src, dest } of sources) {
    const raw = readFileSync(join(TEMPLATES_DIR, src), 'utf8');
    const rendered = applyTemplate(raw, vars);
    writeFile(join(projectDir, '.github', 'instructions', dest), rendered);
  }
}
