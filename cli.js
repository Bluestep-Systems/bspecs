#!/usr/bin/env node
import { intro, outro, cancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runPrompts } from './src/prompts.js';
import { scaffold } from './src/scaffold.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const HELP = `bspecs — spec-driven BlueStep development with AI agents

Scaffold a new BlueStep project with Claude Code skills, hooks, and
project conventions for spec-driven development.

Usage:
  bspecs           Run the interactive scaffolder in the current directory.
  bspecs -v        Print version.
  bspecs -h        Print this help.
`;

function parseArgs(argv) {
  for (const a of argv) {
    if (a === '-v' || a === '--version') return { mode: 'version' };
    if (a === '-h' || a === '--help') return { mode: 'help' };
  }
  return { mode: 'interactive' };
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));

  if (mode === 'version') {
    console.log(pkg.version);
    return;
  }
  if (mode === 'help') {
    console.log(HELP);
    return;
  }

  intro('bspecs — spec-driven BlueStep development with AI agents');

  const answers = await runPrompts();
  if (!answers) {
    cancel('Cancelled.');
    process.exit(0);
  }

  await scaffold(answers);

  outro(
    `Project created at ${answers.projectName}\n` +
    `  Next steps:\n` +
    `    cd ${answers.projectName}\n` +
    `    wsl bash -lc 'b6p pull "<DAV URL>"'   (creates the U-folder and component skeleton)`
  );
}

main().catch((err) => {
  log.error(err.message || String(err));
  process.exit(1);
});
