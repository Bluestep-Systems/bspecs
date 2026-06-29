import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Build-time injected version. In a Node SEA the on-disk package.json is not
// present (the binary is self-contained), so the bundler replaces
// `process.env.BSPECS_VERSION` with a string literal at bundle time — see the
// esbuild `--define` in scripts/build-binary.mjs (task A2). In the `node cli.js`
// dev path that env var is unset, so we fall back to reading package.json from
// disk (this file lives in src/, so the manifest is one level up).
const INJECTED = process.env.BSPECS_VERSION;

export function getVersion() {
  if (INJECTED) return INJECTED;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}
