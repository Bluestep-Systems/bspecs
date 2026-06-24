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
  'package.json',
  '.claude/settings.json',
  '.claude/templates/README.md',
  '.claude/hooks/block-generated-files.sh',
  '.claude/hooks/block-tsc.sh',
  '.claude/hooks/prettier-on-save.sh',
  '.claude/instructions/bsjs-development.md',
  '.claude/instructions/b6p-platform.md',
  '.claude/skills/b6p-pull/SKILL.md',
  '.claude/skills/b6p-push/SKILL.md',
  '.claude/skills/b6p-audit/SKILL.md',
  '.claude/skills/spec-create/SKILL.md',
  '.claude/skills/spec-execute/SKILL.md',
  '.claude/skills/spec-status/SKILL.md',
  '.claude/skills/bug-fix/SKILL.md',
  '.claude/spec-templates/requirements.template.md',
  '.claude/spec-templates/design.template.md',
  '.claude/spec-templates/tasks.template.md',
  '.claude/instructions/index.md',
];
for (const rel of expected) {
  check(`exists: ${rel}`, existsSync(join(PROJECT_PATH, rel)));
}

// Claude-only: no GitHub Copilot mirror is scaffolded.
check('no .github/ mirror generated', !existsSync(join(PROJECT_PATH, '.github')));

// A5 (0.9.0): npx-b6p model — no shell-detection artifact, no /b6p-detect skill.
check('no .claude/b6p-env.json written', !existsSync(join(PROJECT_PATH, '.claude/b6p-env.json')));
check('no /b6p-detect skill scaffolded', !existsSync(join(PROJECT_PATH, '.claude/skills/b6p-detect')));

// Instruction subfolders land (reference/conventions/gotchas).
for (const dir of ['reference', 'conventions', 'gotchas']) {
  const p = join(PROJECT_PATH, '.claude/instructions', dir);
  check(`instructions/${dir}/ scaffolded`, existsSync(p) && statSync(p).isDirectory());
}

// No unsubstituted placeholders
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    // Skip installed deps and git internals — we only check scaffolded template output.
    // (b6p-cli now installs from public npm, so node_modules exists during the test.)
    if (e === 'node_modules' || e === '.git') continue;
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

// Context7 fully removed: no .vscode tree and no CONTEXT7 references in generated files.
check('no .vscode/mcp.json scaffolded', !existsSync(join(PROJECT_PATH, '.vscode/mcp.json')));
const noContext7 = walk(PROJECT_PATH).every((f) => {
  try { return !/Context7|CONTEXT7_API_KEY/.test(readFileSync(f, 'utf8')); }
  catch { return true; }
});
check('no Context7 references in generated files', noContext7);

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
check('hook NOT wired: require-wsl-for-b6p (removed in 0.9.0)', !cmds.some((c) => c.includes('require-wsl-for-b6p')));
check('hook wired: block-tsc', cmds.some((c) => c.includes('block-tsc')));
check('hook wired: prettier-on-save', cmds.some((c) => c.includes('prettier-on-save')));
check('settings.json allows npx invocations', (settings.permissions?.allow || []).some((p) => /npx/.test(p)));

// A5 (0.9.0): scaffolded package.json carries the b6p-cli devDependency for `npx b6p`.
const projectPkg = JSON.parse(readFileSync(join(PROJECT_PATH, 'package.json'), 'utf8'));
check('package.json declares b6p-cli devDependency', !!projectPkg.devDependencies?.['@bluestep-systems/b6p-cli']);
// Public-npm migration: @bluestep-systems/* resolves from the default registry with no
// token, so no scaffolded .npmrc is needed — confirm none is emitted.
check('no .npmrc scaffolded (public registry, no scope config needed)', !existsSync(join(PROJECT_PATH, '.npmrc')));

console.log(`\n${passed} passed, ${failed} failed.\n`);

// Clean up unless KEEP=1
if (!process.env.KEEP) {
  rmSync(PROJECT_PATH, { recursive: true, force: true });
}

process.exit(failed === 0 ? 0 : 1);
