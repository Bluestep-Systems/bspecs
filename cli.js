#!/usr/bin/env node
import { intro, outro, cancel, log } from '@clack/prompts';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runPrompts } from './src/prompts.js';
import { scaffold } from './src/scaffold.js';
import { sync } from './src/sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const HELP = `bspecs — spec-driven BlueStep development with AI agents

Scaffold a new BlueStep project with Claude Code skills, hooks, and
project conventions for spec-driven development.

Usage:
  bspecs           Run the interactive scaffolder in the current directory.
  bspecs sync      Sync infrastructure files in the current project.
  bspecs -v        Print version.
  bspecs -h        Print this help.

Options for bspecs sync:
  --silent         Suppress all output (used by the SessionStart hook).
`;

function parseArgs(argv) {
  const flags = new Set(argv.filter(a => a.startsWith('-')));
  const positional = argv.filter(a => !a.startsWith('-'));
  if (flags.has('-v') || flags.has('--version')) return { mode: 'version' };
  if (flags.has('-h') || flags.has('--help'))    return { mode: 'help' };
  if (positional[0] === 'sync') return { mode: 'sync', silent: flags.has('--silent') };
  return { mode: 'interactive' };
}

async function main() {
  const { mode, silent } = parseArgs(process.argv.slice(2));

  if (mode === 'version') {
    console.log(pkg.version);
    return;
  }
  if (mode === 'help') {
    console.log(HELP);
    return;
  }
  if (mode === 'sync') {
    await sync({ silent });
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
