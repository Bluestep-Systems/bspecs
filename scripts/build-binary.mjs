#!/usr/bin/env node
// Build a self-contained Node SEA (Single Executable Application) binary of bspecs.
//
// Usage:
//   node scripts/build-binary.mjs [--out <path>]
//
// Steps (per https://nodejs.org/api/single-executable-applications.html):
//   1. esbuild-bundle cli.js -> build/bspecs.cjs (ESM -> single CJS), baking the
//      package.json version into process.env.BSPECS_VERSION so the SEA needs no
//      on-disk package.json at runtime (see src/version.js, task A1).
//   2. Generate the SEA blob from sea-config.json.
//   3. Copy the running node executable to the output path.
//   4. Inject the blob with postject (+ macOS signature handling).
//
// Runs on the build host's own OS only — SEA cannot cross-compile, so CI invokes
// this once per target OS/arch (see .github/workflows/publish.yml, task A3).

import { build } from 'esbuild';
import { inject } from 'postject';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Walk templates/ into a { 'forward/slashed/path': contents } map relative to
// templates/. Baked into the binary so the SEA scaffolds with no on-disk
// templates/ dir (see src/templates-embed.js, task A2.5). All template files are
// text (.md/.json/.sh/.ts/.template), so utf8 is safe.
function collectTemplatesMap(templatesDir) {
  const map = {};
  const walkT = (absDir, relDir) => {
    for (const entry of readdirSync(absDir)) {
      const abs = join(absDir, entry);
      const rel = relDir ? `${relDir}/${entry}` : entry;
      if (statSync(abs).isDirectory()) walkT(abs, rel);
      else map[rel] = readFileSync(abs, 'utf8');
    }
  };
  walkT(templatesDir, '');
  return map;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const bundlePath = join(buildDir, 'bspecs.cjs');
const blobPath = join(buildDir, 'bspecs.blob');

// The fuse sentinel postject looks for in the node binary. This exact string is
// defined by Node's SEA implementation and must not be altered.
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc2b0ff';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// --out <path> overrides the default output location (CI passes the asset name).
const outIdx = process.argv.indexOf('--out');
const defaultOut = join(buildDir, isWin ? 'bspecs.exe' : 'bspecs');
const outPath = outIdx !== -1 ? resolve(process.argv[outIdx + 1]) : defaultOut;

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

mkdirSync(buildDir, { recursive: true });

// 1. Bundle ESM -> single CJS, baking in the version (matches src/version.js)
//    and embedding the template tree (matches src/templates-embed.js).
const templatesMap = collectTemplatesMap(join(root, 'templates'));
console.log(
  `[build-binary] bundling cli.js (version ${version}, ${Object.keys(templatesMap).length} templates embedded)`
);

// Replace src/templates-embed.js's dev stub with a generated module returning the
// real template map, so the bundled scaffolder reads templates from memory.
const embedTemplatesPlugin = {
  name: 'embed-templates',
  setup(b) {
    b.onLoad({ filter: /templates-embed\.js$/ }, () => ({
      contents: `export function getEmbeddedTemplates() { return ${JSON.stringify(templatesMap)}; }`,
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: [join(root, 'cli.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: bundlePath,
  plugins: [embedTemplatesPlugin],
  define: {
    'process.env.BSPECS_VERSION': JSON.stringify(version),
    // CJS output has no `import.meta`; esbuild would otherwise emit `{}` and
    // every `fileURLToPath(import.meta.url)` in src/*.js would receive undefined.
    // Point it at a __filename-derived URL declared in the banner below.
    'import.meta.url': 'importMetaUrl',
  },
  banner: {
    js: "const importMetaUrl = require('url').pathToFileURL(__filename).href;",
  },
});

// 2. Generate the SEA blob. Run from `root` so sea-config.json's relative paths resolve.
console.log('[build-binary] generating SEA blob');
execFileSync(process.execPath, ['--experimental-sea-config', join(root, 'sea-config.json')], {
  cwd: root,
  stdio: 'inherit',
});

// 3. Copy the running node executable to the output path.
console.log(`[build-binary] copying node -> ${outPath}`);
rmSync(outPath, { force: true });
copyFileSync(process.execPath, outPath);

// 4a. macOS: strip the existing signature before injecting (re-signed in 4c).
if (isMac) {
  try {
    execFileSync('codesign', ['--remove-signature', outPath], { stdio: 'inherit' });
  } catch {
    // Unsigned to begin with — nothing to remove.
  }
}

// 4b. Inject the blob (programmatic postject — avoids the npx-on-Windows shim).
console.log('[build-binary] injecting SEA blob');
await inject(outPath, 'NODE_SEA_BLOB', readFileSync(blobPath), {
  sentinelFuse: SEA_FUSE,
  machoSegmentName: isMac ? 'NODE_SEA' : undefined,
});

// 4c. macOS: ad-hoc re-sign so dyld/Gatekeeper will load the modified binary.
if (isMac) {
  execFileSync('codesign', ['--sign', '-', outPath], { stdio: 'inherit' });
}

console.log(`[build-binary] done -> ${outPath}`);
