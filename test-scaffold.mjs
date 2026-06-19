import { rmSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { scaffold } from './src/scaffold.js';

const TEST_DIR = process.cwd();
const PROJECT_NAME = 'test-scaffold-output';
const PROJECT_PATH = join(TEST_DIR, PROJECT_NAME);

// Clean up any prior run.
if (existsSync(PROJECT_PATH)) {
  rmSync(PROJECT_PATH, { recursive: true, force: true });
}

await scaffold({
  projectName: PROJECT_NAME,
  clientName: 'Acme Corp',
  projectDescription: 'Smoke test for bspecs verifying generated context layout.',
  context7Key: 'test-key-123',
  initGit: false,
});

console.log('\n--- Verification ---\n');

let passed = 0;
let failed = 0;
const check = (label, cond) => {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else { console.log(`  FAIL  ${label}`); failed++; }
};

// File presence
const expected = [
  'CLAUDE.md',
  '.prettierrc',
  '.gitignore',
  'README.md',
  '.claude/settings.json',
  '.claude/templates/README.md',
  '.claude/hooks/block-generated-files.sh',
  '.claude/hooks/require-wsl-for-b6p.sh',
  '.claude/hooks/block-tsc.sh',
  '.claude/hooks/prettier-on-save.sh',
  '.claude/instructions/bsjs-development.md',
  '.claude/instructions/b6p-platform.md',
  '.claude/skills/b6p-pull/SKILL.md',
  '.claude/skills/b6p-push/SKILL.md',
  '.claude/skills/b6p-audit/SKILL.md',
  '.claude/skills/b6p-detect/SKILL.md',
  '.claude/skills/spec-create/SKILL.md',
  '.claude/skills/spec-execute/SKILL.md',
  '.claude/skills/spec-status/SKILL.md',
  '.claude/skills/bug-fix/SKILL.md',
  '.claude/spec-templates/requirements.template.md',
  '.claude/spec-templates/design.template.md',
  '.claude/spec-templates/tasks.template.md',
  '.vscode/mcp.json',
  '.claude/instructions/index.md',
];
for (const rel of expected) {
  check(`exists: ${rel}`, existsSync(join(PROJECT_PATH, rel)));
}

// Claude-only: no GitHub Copilot mirror is scaffolded.
check('no .github/ mirror generated', !existsSync(join(PROJECT_PATH, '.github')));

// Instruction subfolders land (reference/conventions/gotchas).
for (const dir of ['reference', 'conventions', 'gotchas']) {
  const p = join(PROJECT_PATH, '.claude/instructions', dir);
  check(`instructions/${dir}/ scaffolded`, existsSync(p) && statSync(p).isDirectory());
}

// No unsubstituted placeholders
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const allFiles = walk(PROJECT_PATH);
const filesWithPlaceholders = allFiles.filter((f) => {
  try { return /\{\{\w+\}\}/.test(readFileSync(f, 'utf8')); }
  catch { return false; }
});
check('no unsubstituted {{placeholders}}', filesWithPlaceholders.length === 0);
if (filesWithPlaceholders.length > 0) {
  console.log('     leftover in:', filesWithPlaceholders);
}

// mcp.json valid JSON, has the API key
const mcp = JSON.parse(readFileSync(join(PROJECT_PATH, '.vscode/mcp.json'), 'utf8'));
check('mcp.json is valid JSON', !!mcp.servers?.Context7);
check('mcp.json carries the supplied API key', mcp.servers?.Context7?.headers?.Authorization === 'Bearer test-key-123');

// gitignore protects mcp.json
const gi = readFileSync(join(PROJECT_PATH, '.gitignore'), 'utf8');
check('.gitignore covers .vscode/mcp.json', gi.includes('.vscode/mcp.json'));

// CLAUDE.md contains the description and unit id
const claudeMd = readFileSync(join(PROJECT_PATH, 'CLAUDE.md'), 'utf8');
check('CLAUDE.md has project description', claudeMd.includes('Smoke test for bspecs'));
check('CLAUDE.md has client name', claudeMd.includes('Acme Corp'));
check('CLAUDE.md explicitly forbids .writable()', /NEVER\*\*?\s+use\s+`?\.writable\(\)/i.test(claudeMd));
check('CLAUDE.md explicitly forbids tsc', /NEVER\*\*?\s+run\s+`?tsc/i.test(claudeMd));
check('CLAUDE.md describes Unit folders as b6p-pull-created', /U######|b6p pull/.test(claudeMd) && /Unit folder/i.test(claudeMd));
check('CLAUDE.md points at draft/README.md, not SPEC.md', /draft\/README\.md/.test(claudeMd) && !/\bSPEC\.md\b/.test(claudeMd));
check('No project-level SPEC.md scaffolded', !existsSync(join(PROJECT_PATH, 'SPEC.md')));
check('Module README template carries Overview heading', readFileSync(join(PROJECT_PATH, '.claude/templates/README.md'), 'utf8').includes('## Overview'));

// Spec workflow: tasks template carries [PLATFORM]/[CODE] convention and Deployment section
const tasksTpl = readFileSync(join(PROJECT_PATH, '.claude/spec-templates/tasks.template.md'), 'utf8');
check('tasks template defines [PLATFORM] prefix', tasksTpl.includes('[PLATFORM]'));
check('tasks template defines [CODE] prefix', tasksTpl.includes('[CODE]'));
check('tasks template has Deployment section', /^## Deployment/m.test(tasksTpl));

// (The old "no RelateScript mention anywhere" invariant was retired with the
// rules consolidation: the migrated reference tree intentionally documents
// RelateScript↔BSJS API equivalences and RelateScript-typed merge reports.)

// Settings.json valid + has all 4 hooks
const settings = JSON.parse(readFileSync(join(PROJECT_PATH, '.claude/settings.json'), 'utf8'));
const allHooks = [
  ...(settings.hooks?.PreToolUse || []),
  ...(settings.hooks?.PostToolUse || []),
].flatMap((g) => g.hooks || []);
const cmds = allHooks.map((h) => h.command);
check('hook wired: block-generated-files', cmds.some((c) => c.includes('block-generated-files')));
check('hook wired: require-wsl-for-b6p', cmds.some((c) => c.includes('require-wsl-for-b6p')));
check('hook wired: block-tsc', cmds.some((c) => c.includes('block-tsc')));
check('hook wired: prettier-on-save', cmds.some((c) => c.includes('prettier-on-save')));
check('settings.json allows wsl bash -lc invocations', (settings.permissions?.allow || []).some((p) => /wsl bash -lc/.test(p)));

console.log(`\n${passed} passed, ${failed} failed.\n`);

// Clean up unless KEEP=1
if (!process.env.KEEP) {
  rmSync(PROJECT_PATH, { recursive: true, force: true });
}

process.exit(failed === 0 ? 0 : 1);
