#!/usr/bin/env node
/**
 * Says whether a component repo that writes Manage forms checks each form's own required fields
 * (`node required.mjs my-component [--source <repo>/src/data/required.ts]`).
 *
 * Why: a write over `/gql` (`createFormRow`, `updateFormRow`) skips the form's required fields,
 * and Manage then refuses every later save of that entry until every required field is filled. A
 * screen that keeps its own hand-typed list of required fields drifts from the form: a field
 * marked required in Build saves empty. So the list is read from the form definition, never typed by hand.
 *
 * A repo passes when nothing in `src` writes a form, or when it does one of these:
 *   - every file that writes calls `host.formEntries.validate(`, or is imported by a file that
 *     does (the host's own check against the definition); or
 *   - carries the shared module `src/data/required.ts` unchanged, uses it from `src`, and has a
 *     coverage test: a test file that imports the screen's policy (a module holding a
 *     `: RequiredPolicy =` value) and calls `uncovered(`.
 *
 * The module is a copy like any other: a row of the README's *Copied* table (`copies.mjs`) names
 * its source and commit. It must equal the source at that commit, and the source must not have
 * changed since. The repo that holds the source has no row: name it with `--source`, a path that
 * starts with the source repo's folder in this workspace, as the table's sources do. `--source`
 * on the repo's own module counts only when the repo lists no row for it and another repo of the
 * workspace copies it from there.
 *
 * What counts as a form write, outside comments: `createFormRow`, `updateFormRow`,
 * `setFieldData(<arg>:` (the mutation, not a React state setter), `formEntries.create(`,
 * `.submit(`, `.save(`, `.draftSession(` and `useFormDraft(`.
 *
 * Exit 0 when the repo passes, 1 when something is missing (each named), 2 on a usage error or a
 * repo with no `src`. `--root <dir>` checks another workspace (the tests).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCopies, parseCopies } from "./copies.mjs";

export const MODULE = "src/data/required.ts";

const WRITES = [
  [/\bcreateFormRow\b/, "createFormRow"],
  [/\bupdateFormRow\b/, "updateFormRow"],
  [/\bsetFieldData\s*\(\s*\w+\s*:/, "setFieldData"],
  [/\bformEntries\s*\.\s*(create|submit|save)\s*\(/, "formEntries.create/submit/save"],
  [/\bformEntries\s*\.\s*draftSession\s*\(/, "formEntries.draftSession"],
  [/\buseFormDraft\s*\(/, "useFormDraft"],
];
const VALIDATE = /\bformEntries\s*\.\s*validate\s*\(/;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const REGEX_BEFORE = /[(,=:[!&|?{};+\-*%<>~^]/;

/** The index just past the string or template literal that opens at `start`. A quoted string ends at its line's end at the latest. */
function stringEnd(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") i += 2;
    else if (c === quote) return i + 1;
    else if (c === "\n" && quote !== "`") return i;
    else i++;
  }
  return text.length;
}

/** The index just past the regex literal that opens at `start`. */
function regexEnd(text, start) {
  let i = start + 1;
  let inClass = false;
  while (i < text.length && text[i] !== "\n") {
    const c = text[i];
    if (c === "\\") i += 2;
    else if (c === "[") (inClass = true), i++;
    else if (c === "]") (inClass = false), i++;
    else if (c === "/" && !inClass) {
      i++;
      while (i < text.length && /[a-z]/i.test(text[i])) i++;
      return i;
    }
    else i++;
  }
  return i;
}

/** The text with every comment removed; strings, template literals and regex literals are kept (a mutation name lives in a string). */
export function stripComments(text) {
  let out = "";
  let prev = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      out += " ";
    } else if (c === '"' || c === "'" || c === "`" || (c === "/" && (prev === "" || REGEX_BEFORE.test(prev)))) {
      const end = c === "/" ? regexEnd(text, i) : stringEnd(text, i);
      out += text.slice(i, end);
      prev = c;
      i = end;
    } else {
      out += c;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return out;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXT.test(name)) out.push(full);
  }
  return out;
}

const rel = (repo, file) => path.relative(repo, file).split(path.sep).join("/");
const unify = (text) => text.replace(/\r\n/g, "\n");
const code = (file) => stripComments(readFileSync(file, "utf8"));

/** Every form write in `src`: `{ file, what }`, one per file and kind. The shared module itself is left out. */
export function findWrites(repo) {
  const found = [];
  for (const file of walk(path.join(repo, "src"))) {
    if (rel(repo, file) === MODULE) continue;
    const text = code(file);
    for (const [pattern, what] of WRITES) if (pattern.test(text)) found.push({ file: rel(repo, file), what });
  }
  return found;
}

/** The relative module specifiers a file imports (static, dynamic and re-exports). */
export function importsOf(text) {
  const specs = [];
  for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g)) specs.push(m[1]);
  return specs;
}

/** The file a relative specifier names, trying the extensions TypeScript does (a `.js` specifier may name a `.ts` file). */
function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const stem = base.replace(/\.(m|c)?jsx?$/, "");
  const candidates = [base, ...[".ts", ".tsx", ".mts", ".js", ".mjs"].map((ext) => base + ext)];
  if (stem !== base) candidates.push(...[".ts", ".tsx", ".mts", ".cts"].map((ext) => stem + ext));
  candidates.push(path.join(base, "index.ts"), path.join(base, "index.tsx"));
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The test files (under `test/`, `tests/` or next to the code in `src/`) that import a policy and call `uncovered(`: `{ file, policy }`. */
export function findCoverageTests(repo) {
  const tests = ["test", "tests", "src"].flatMap((dir) => walk(path.join(repo, dir))).filter((file) => /\.test\.[a-z]+$/.test(file));
  const found = [];
  for (const file of tests) {
    const text = code(file);
    if (!/\buncovered\s*\(/.test(text)) continue;
    for (const spec of importsOf(text)) {
      const target = resolveImport(file, spec);
      if (target && /:\s*RequiredPolicy\s*=/.test(readFileSync(target, "utf8"))) {
        found.push({ file: rel(repo, file), policy: rel(repo, target) });
        break;
      }
    }
  }
  return found;
}

/** Whether a file in `src` other than the module imports a value from it (`import type` alone does not count). */
function moduleUsed(repo) {
  const own = path.join(repo, MODULE);
  return walk(path.join(repo, "src")).some((file) => {
    if (file === own) return false;
    const text = code(file).replace(/\bimport\s+type\s[^;]*?from\s*["'][^"']+["']/g, "");
    return importsOf(text).some((spec) => resolveImport(file, spec) === own);
  });
}

/**
 * The files that write and are not checked by `host.formEntries.validate`: a write file is checked
 * when it calls it, or when a file that calls it imports it. `{ validating, unchecked }`, repo-relative.
 */
export function validateCoverage(repo, writes) {
  const files = walk(path.join(repo, "src"));
  const validating = files.filter((file) => VALIDATE.test(code(file)));
  const reached = new Set(validating);
  for (const file of validating) {
    for (const spec of importsOf(code(file))) {
      const target = resolveImport(file, spec);
      if (target) reached.add(target);
    }
  }
  const unchecked = [...new Set(writes.map((w) => w.file))].filter((file) => !reached.has(path.join(repo, file)));
  return { validating: validating.map((file) => rel(repo, file)), unchecked };
}

function gitShow(cwd, ref) {
  const run = spawnSync("git", ["-C", cwd, "show", ref], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : null;
}

/** The repos of the workspace whose README lists `source` as the source of a copy. */
function copiedFrom(workspace, source) {
  const want = path.resolve(workspace, source);
  return readdirSync(workspace).filter((name) => {
    const readme = path.join(workspace, name, "README.md");
    if (!existsSync(readme)) return false;
    return (parseCopies(readFileSync(readme, "utf8")) ?? []).some((row) => path.resolve(workspace, row.source) === want);
  });
}

/** Whether the repo's copy of the module is the source, unchanged. `{ ok, detail }`. */
export function checkModule(workspace, repoDir, source) {
  const repo = path.resolve(workspace, repoDir);
  const own = path.join(repo, MODULE);
  if (!existsSync(own)) return { ok: false, detail: `no ${MODULE}` };
  const copies = existsSync(path.join(repo, "README.md")) ? checkCopies(workspace, repoDir) : { error: "no README.md" };
  const row = copies.verdicts?.find((v) => v.copy.replace(/^\.\//, "") === MODULE);
  if (source && path.resolve(workspace, source) === own) {
    if (row) return { ok: false, detail: `${MODULE} is copied from ${row.source} (README's Copied table), so this repo is not its source: drop --source` };
    const copiers = copiedFrom(workspace, source).filter((name) => path.resolve(workspace, name) !== repo);
    if (copiers.length === 0) return { ok: false, detail: `no repo in this workspace copies ${source}, so ${repoDir} is not the module's source` };
    return { ok: true, detail: `${MODULE} is the source (copied by ${copiers.join(", ")})` };
  }
  if (!row) {
    const where = copies.verdicts ? "is in no row of the README's Copied table" : `cannot be checked (${copies.error}): add a "Copied" table to the README`;
    return { ok: false, detail: `${MODULE} ${where}; list its source and commit` };
  }
  if (source && path.resolve(workspace, row.source) !== path.resolve(workspace, source)) {
    return { ok: false, detail: `${MODULE} is copied from ${row.source}, but the source is ${source}` };
  }
  if (row.state !== "unchanged") return { ok: false, detail: `${MODULE}: ${row.state === "changed" ? "the source changed since the copy" : "the copy cannot be checked"}: ${row.detail}` };
  const [sourceRepo, ...rest] = row.source.split("/");
  const original = gitShow(path.join(workspace, sourceRepo), `${row.commit}:${rest.join("/")}`);
  if (original === null) return { ok: false, detail: `cannot read ${row.source} at ${row.commit}` };
  if (unify(original) !== unify(readFileSync(own, "utf8"))) return { ok: false, detail: `${MODULE} differs from ${row.source} at ${row.commit}: carry it over unchanged` };
  return { ok: true, detail: `${MODULE} equals ${row.source} at ${row.commit}` };
}

/**
 * The verdict for one repo: `{ error }` on a usage error, else
 * `{ writes, state: "no-writes" | "validate" | "module" | "missing", missing: string[], notes: string[] }`.
 */
export function checkRequired(workspace, repoDir, { source } = {}) {
  const repo = path.resolve(workspace, repoDir);
  if (!existsSync(path.join(repo, "src"))) return { error: `no src folder in ${repo}` };
  const writes = findWrites(repo);
  if (writes.length === 0) return { writes, state: "no-writes", missing: [], notes: [] };
  const { validating, unchecked } = validateCoverage(repo, writes);
  const validateNotes = validating.map((file) => `host.formEntries.validate in ${file}`);
  if (validating.length > 0 && unchecked.length === 0) return { writes, state: "validate", missing: [], notes: validateNotes };
  const missing = [];
  const notes = [...validateNotes];
  const module = checkModule(workspace, repoDir, source);
  if (module.ok) notes.push(module.detail);
  else missing.push(module.detail);
  if (module.ok && !moduleUsed(repo)) missing.push(`nothing in src imports ${MODULE}`);
  const tests = findCoverageTests(repo);
  if (tests.length === 0) missing.push("no coverage test: a test file that imports the screen's RequiredPolicy and calls uncovered(");
  else for (const t of tests) notes.push(`coverage test ${t.file} (policy ${t.policy})`);
  if (missing.length > 0) {
    if (validating.length > 0) missing.push(`or check with host.formEntries.validate( the writes in ${unchecked.join(", ")} (no file that calls it imports them)`);
    else if (!existsSync(path.join(repo, MODULE))) missing.push("or call host.formEntries.validate( before each write");
  }
  return { writes, state: missing.length === 0 ? "module" : "missing", missing, notes };
}

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const value = args[at + 1];
    args.splice(at, 2);
    return value;
  };
  const root = take("--root");
  const source = take("--source");
  const workspace = path.resolve(root ?? ".");
  const repoDir = args[0];
  if (!repoDir || (root === undefined && argv.includes("--root")) || (source === undefined && argv.includes("--source"))) {
    console.error("usage: node required.mjs <component-repo-dir> [--source <repo>/src/data/required.ts] [--root <workspace>]");
    return 2;
  }
  const result = checkRequired(workspace, repoDir, { source });
  if (result.error) {
    console.error(result.error);
    return 2;
  }
  const kinds = [...new Set(result.writes.map((w) => w.what))].join(", ");
  const files = [...new Set(result.writes.map((w) => w.file))];
  if (result.state === "no-writes") console.log(`ok      ${repoDir}: writes no form`);
  else if (result.state === "missing") console.log(`MISSING ${repoDir}: writes forms (${kinds}, in ${files.length} file(s): ${files.join(", ")}) and does not check their required fields`);
  else console.log(`ok      ${repoDir}: writes forms (${kinds}) and checks required fields (${result.state === "validate" ? "host.formEntries.validate" : "shared module"})`);
  for (const note of result.notes) console.log(`  - ${note}`);
  for (const line of result.missing) console.log(`  missing: ${line}`);
  return result.state === "missing" ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
