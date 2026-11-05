#!/usr/bin/env node
/**
 * Type-check one component repo with the TypeScript it has installed for
 * editor tooling (`node typecheck.mjs my-component`).
 *
 * Why a script and not a hand-run `tsc`: in a B6P merge-report workspace the
 * b6p CLI's transpile is the only build, and a hand-run tsc there has no
 * declarations wired up. A BlueStep One component repo is different: its
 * `tsconfig.json` paths resolve the seven downloaded `.d.ts`, and the build
 * skill requires a type check against fresh types before every publish. This
 * runs exactly the check the editor's Problems panel runs, from the terminal,
 * so an agent can read it.
 *
 * Uses the repo's own gitignored `node_modules/typescript` (7.x, the native
 * compiler), located through the package's `getExePath`.
 *
 * `--files <path>...` checks only those files (paths relative to the repo) and
 * what they import, through a temporary `tsconfig` beside the repo's that
 * extends it and is removed after. While tasks run in parallel, one task's
 * half-written file then does not fail another's check. The whole repo is
 * still checked before every push.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.cwd();
const repoArg = process.argv[2];
const filesAt = process.argv.indexOf("--files");
const files = filesAt >= 0 ? process.argv.slice(filesAt + 1) : null;
if (!repoArg || repoArg === "--files" || (files !== null && files.length === 0)) {
  console.error("usage: node typecheck.mjs <component-repo-dir> [--files <path>...]");
  process.exit(2);
}
const repo = path.resolve(workspace, repoArg);
const tsconfig = path.join(repo, "tsconfig.json");
if (!existsSync(tsconfig)) {
  console.error(`no tsconfig.json in ${repo}`);
  process.exit(2);
}

const requireFromRepo = createRequire(path.join(repo, "package.json"));
let exe;
try {
  // `lib/getExePath.js` is not in the package's `exports`, so it is reached by
  // file path from the package root rather than by subpath import.
  const root = path.dirname(requireFromRepo.resolve("typescript/package.json"));
  const mod = await import(pathToFileURL(path.join(root, "lib", "getExePath.js")).href);
  exe = mod.default();
} catch (cause) {
  console.error(`could not load typescript from ${repo}/node_modules: ${cause.message}`);
  console.error("install editor tooling first: npm i -D typescript @types/react@19 @types/react-dom@19");
  process.exit(2);
}

let project = tsconfig;
if (files !== null) {
  const missing = files.filter((file) => !existsSync(path.resolve(repo, file)));
  if (missing.length > 0) {
    console.error(`not in ${repo}: ${missing.join(", ")}`);
    process.exit(2);
  }
  // Beside the repo's own, so its relative `paths` and the repo's node_modules
  // (for `@types/react`) resolve as they do in a full check. `include` is
  // emptied: an extended config would otherwise inherit the whole `src`.
  project = path.join(repo, `tsconfig.files-${process.pid}.json`);
  const relative = files.map((file) => path.relative(repo, path.resolve(repo, file)).split(path.sep).join("/"));
  writeFileSync(project, JSON.stringify({ extends: "./tsconfig.json", files: relative, include: [] }, null, 2));
}

let result;
try {
  result = spawnSync(exe, ["-p", project, "--noEmit", "--pretty", "false"], {
    cwd: repo,
    stdio: "inherit",
  });
} finally {
  if (project !== tsconfig) {
    rmSync(project, { force: true });
  }
}
process.exit(result.status ?? 1);
