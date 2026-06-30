#!/usr/bin/env node
import { intro, outro, cancel, log } from '@clack/prompts';
import { runPrompts, runInitPrompts } from './src/prompts.js';
import { scaffold, init } from './src/scaffold.js';
import { sync } from './src/sync.js';
import { getVersion } from './src/version.js';

const HELP = `bspecs — spec-driven BlueStep development with AI agents

Scaffold and maintain BlueStep projects with Claude Code skills, hooks, and
project conventions for spec-driven development.

Usage:
  bspecs new       Scaffold a brand-new project in a new subdirectory.
  bspecs init      Install the tooling into the current directory (non-destructive).
  bspecs sync      Sync infrastructure files in the current project.
  bspecs -v        Print version.
  bspecs -h        Print this help.

Options for bspecs sync:
  --silent         Suppress all output (used by the SessionStart hook).

bspecs init never overwrites an existing file (package.json has the b6p-cli
devDependency merged in) and reports what it skipped so you can rename/move and
re-run. Its client-name prompt is optional — press Enter for "BlueStep Client".
`;

function parseArgs(argv) {
  const flags = new Set(argv.filter(a => a.startsWith('-')));
  const positional = argv.filter(a => !a.startsWith('-'));
  if (flags.has('-v') || flags.has('--version')) return { mode: 'version' };
  if (flags.has('-h') || flags.has('--help'))    return { mode: 'help' };
  if (positional[0] === 'sync') return { mode: 'sync', silent: flags.has('--silent') };
  if (positional[0] === 'new')  return { mode: 'new' };
  if (positional[0] === 'init') return { mode: 'init' };
  return { mode: 'help' };
}

async function main() {
  const { mode, silent } = parseArgs(process.argv.slice(2));

  if (mode === 'version') {
    console.log(getVersion());
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

  if (mode === 'init') {
    const answers = await runInitPrompts();
    if (!answers) {
      cancel('Cancelled.');
      process.exit(0);
    }

    await init(answers);

    outro(
      `bspecs tooling installed in ${process.cwd()}\n` +
      `  Next steps:\n` +
      `    npm install   (if it did not run automatically)\n` +
      `    npx -p @bluestep-systems/b6p-cli b6p auth set   (platform credentials, once per machine)`
    );
    return;
  }

  // mode === 'new'
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
