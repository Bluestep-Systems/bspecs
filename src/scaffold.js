import { execSync } from 'child_process';
import { join } from 'path';
import { readFileSync } from 'fs';
import { log } from '@clack/prompts';
import { ensureDir, copyTemplateTree, writeFile, applyTemplate, TEMPLATES_DIR } from './utils.js';

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

  log.success('Files generated.');

  checkPrettierOnPath();
  checkB6pInstalled();

  if (answers.initGit) {
    try {
      execSync('git init', { cwd: projectDir, stdio: 'ignore' });
      execSync('git add -A', { cwd: projectDir, stdio: 'ignore' });
      execSync('git commit -m "chore: initial scaffold via bluestep-init"', {
        cwd: projectDir,
        stdio: 'ignore',
      });
      log.success('Git repository initialized.');
    } catch (err) {
      log.warn('Could not initialize git repository (git may not be installed).');
    }
  }
}

// Wrap a `command -v X` lookup based on where Node is running.
//
// - Linux (including WSL): the user's PATH is the one to inspect. Run `bash -lc`
//   directly so nvm/profile load and we see the same PATH the user sees.
// - Anywhere else (Windows-native Node, macOS): assume we need to reach into
//   WSL to find Linux-only tools. Use `wsl bash -lc`.
//
// Calling `wsl ...` from inside WSL is the bug this avoids — it either fails
// outright (no `wsl` binary in Linux) or invokes the Windows-side interop,
// which evaluates against the wrong PATH.
function loginShellPrefix() {
  return process.platform === 'linux' ? 'bash -lc' : 'wsl bash -lc';
}

function commandAvailable(name) {
  try {
    execSync(`${loginShellPrefix()} "command -v ${name}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkPrettierOnPath() {
  if (commandAvailable('prettier')) return;
  const installCmd = process.platform === 'linux'
    ? 'npm i -g prettier'
    : 'wsl bash -lc "npm i -g prettier"';
  log.warn(`prettier not found in the login-shell PATH. The prettier-on-save hook will be a no-op until you run: ${installCmd}`);
}

function checkB6pInstalled() {
  if (commandAvailable('b6p')) {
    const authCmd = process.platform === 'linux'
      ? "b6p auth set"
      : "wsl bash -lc 'b6p auth set'";
    log.info(`b6p CLI detected. Run "${authCmd}" once if you have not configured credentials yet.`);
    return;
  }
  log.warn(
    [
      'b6p CLI not found in the login-shell PATH. The /b6p-pull, /b6p-push, and /b6p-audit skills will not work without it.',
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
      'Verify with: b6p --help  (or: wsl bash -lc "b6p --help" from Windows)',
      '',
      'Then configure your platform credentials (one-time):',
      '    b6p auth set       (or: wsl bash -lc "b6p auth set" from Windows)',
      '',
      'If the git clone fails with a permissions error, you need access to the',
      'Bluestep-Systems GitHub org. Ask in your team channel or contact a maintainer.',
    ].join('\n')
  );
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
