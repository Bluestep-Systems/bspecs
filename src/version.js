import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Reads the version from package.json on disk. This file lives in src/, so the
// manifest is one level up. (The SEA build-time injection was removed when the
// standalone binary was dropped — see the plugin-distribution spec.)
export function getVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}
