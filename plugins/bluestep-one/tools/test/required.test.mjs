// node --test tools/  (from the plugin root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRequired, findWrites, importsOf, stripComments } from "../required.mjs";

const script = fileURLToPath(new URL("../required.mjs", import.meta.url));

function git(cwd, ...args) {
  const run = spawnSync("git", ["-C", cwd, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

function write(root, file, text) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
}

const MODULE_TEXT = "export type RequiredPolicy = Record<string, unknown>;\nexport function uncovered() { return []; }\n";
const WRITE = 'export const save = () => gql(`mutation { createFormRow(input: $x) { id } }`);\n';
const POLICY = 'import type { RequiredPolicy } from "../data/required";\nexport const POLICY: RequiredPolicy = {};\n';
const COVERAGE = 'const required = await import("../src/data/required.ts");\nconst policy = await import("../src/rules/policy.ts");\nrequired.uncovered([], policy.POLICY, new Set());\n';

/** A workspace with a source repo `lib` holding the module (one commit) and an empty repo `app`. */
function workspace(t) {
  const root = mkdtempSync(path.join(tmpdir(), "required-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const lib = path.join(root, "lib");
  mkdirSync(lib);
  git(lib, "init", "-q");
  write(lib, "src/data/required.ts", MODULE_TEXT);
  git(lib, "add", ".");
  git(lib, "commit", "-q", "-m", "first");
  const first = git(lib, "rev-parse", "--short", "HEAD");
  mkdirSync(path.join(root, "app", "src"), { recursive: true });
  return { root, lib, app: path.join(root, "app"), first };
}

/** `app` set up as a passing copy: the write, the module copied and used, the policy and its coverage test. */
function passingApp({ app, first }) {
  write(app, "src/data/write.ts", WRITE);
  write(app, "src/data/required.ts", MODULE_TEXT);
  write(app, "src/rules/policy.ts", POLICY);
  write(app, "src/entry/Entry.tsx", 'import { uncovered } from "../data/required";\n');
  write(app, "test/required.test.ts", COVERAGE);
  write(app, "README.md", `# app\n\n## Copied from other repos\n\n| Copy | Source | Source commit |\n| --- | --- | --- |\n| \`src/data/required.ts\` | \`lib/src/data/required.ts\` | \`${first}\` |\n`);
}

const cli = (root, ...args) => spawnSync(process.execPath, [script, ...args, "--root", root], { encoding: "utf8" });

test("stripComments drops comments and keeps strings", () => {
  const text = "/* createFormRow */\n// updateFormRow\nconst q = `setFieldData`; // trailing\nconst u = \"https://x/*\";\n";
  assert.equal(stripComments(text).includes("createFormRow"), false);
  assert.equal(stripComments(text).includes("updateFormRow"), false);
  assert.equal(stripComments(text).includes("setFieldData"), true);
  assert.equal(stripComments(text).includes("trailing"), false);
  assert.equal(stripComments(text).includes('"https://x/*"'), true);
});

test("importsOf reads static, dynamic and side-effect imports, relative ones only", () => {
  const text = 'import a from "./a";\nimport "./b.ts";\nconst c = await import("../c.ts");\nexport { d } from "./d";\nimport x from "node:fs";\n';
  assert.deepEqual(importsOf(text), ["./a", "./b.ts", "../c.ts", "./d"]);
});

test("a repo that writes no form passes", (t) => {
  const { root, app } = workspace(t);
  write(app, "src/Component.tsx", "// a comment naming createFormRow does not count\nexport const x = 1;\n");
  assert.equal(checkRequired(root, "app").state, "no-writes");
  assert.equal(cli(root, "app").status, 0);
});

test("each kind of write is found", (t) => {
  const { app } = workspace(t);
  write(app, "src/a.ts", "host.formEntries.submit(x);\n");
  write(app, "src/b.ts", "const s = host.formEntries.draftSession(slot, base);\n");
  write(app, "src/c.tsx", "useFormDraft(host.formEntries, slot, base);\n");
  write(app, "src/d.ts", "const m = `updateFormRow`;\n");
  assert.deepEqual(findWrites(app).map((w) => w.what).sort(), ["formEntries.create/submit/save", "formEntries.draftSession", "updateFormRow", "useFormDraft"]);
});

test("a write with no check fails and names what is missing", (t) => {
  const { root, app } = workspace(t);
  write(app, "src/data/write.ts", WRITE);
  const result = checkRequired(root, "app");
  assert.equal(result.state, "missing");
  assert.ok(result.missing.some((line) => line.startsWith("no src/data/required.ts")));
  assert.ok(result.missing.some((line) => line.startsWith("no coverage test")));
  const run = cli(root, "app");
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^MISSING app: writes forms \(createFormRow, in 1 file\(s\): src\/data\/write\.ts\)/m);
});

test("a write checked by host.formEntries.validate passes", (t) => {
  const { root, app } = workspace(t);
  write(app, "src/data/write.ts", WRITE);
  write(app, "src/entry/Entry.tsx", 'import { save } from "../data/write";\nconst report = host.formEntries.validate(def, values);\n');
  assert.equal(checkRequired(root, "app").state, "validate");
  assert.equal(cli(root, "app").status, 0);
});

test("a write in a file no validating file imports is not checked by validate", (t) => {
  const { root, app } = workspace(t);
  write(app, "src/data/write.ts", WRITE);
  write(app, "src/data/other.ts", "export const fix = () => gql(`mutation { updateFormRow(id: $id) { id } }`);\n");
  write(app, "src/entry/Entry.tsx", 'import { save } from "../data/write";\nconst report = host.formEntries.validate(def, values);\n');
  const result = checkRequired(root, "app");
  assert.equal(result.state, "missing");
  assert.ok(result.missing.some((line) => line.includes("the writes in src/data/other.ts")));
});

test("a React state setter named setFieldData is no form write", (t) => {
  const { app } = workspace(t);
  write(app, "src/a.tsx", "const [fieldData, setFieldData] = useState({});\nsetFieldData({ a: 1 });\nsetFieldData(next);\n");
  write(app, "src/b.ts", "gql(`mutation ($f: ID!) {\n  setFieldData(field: $f, value: $v)\n}`);\n");
  assert.deepEqual(findWrites(app).map((w) => w.file), ["src/b.ts"]);
});

test("a /* inside a string does not hide the code after it", (t) => {
  const { app } = workspace(t);
  write(app, "src/a.ts", 'const glob = "forms/*";\nexport const save = () => gql(`mutation { createFormRow(x: 1) { id } }`);\n/** a doc comment */\nconst re = /\\/*x/;\n');
  assert.deepEqual(findWrites(app).map((w) => w.what), ["createFormRow"]);
});

test("the module imported from its own folder or with a .js specifier counts as used", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "src/entry/Entry.tsx", "export const x = 1;\n");
  write(ws.app, "src/data/write.ts", 'import { uncovered } from "./required";\n' + WRITE);
  assert.equal(checkRequired(ws.root, "app").state, "module");
  write(ws.app, "src/data/write.ts", 'import { uncovered } from "./required.js";\n' + WRITE);
  assert.equal(checkRequired(ws.root, "app").state, "module");
});

test("a coverage test next to the code in src counts", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  rmSync(path.join(ws.app, "test"), { recursive: true });
  write(ws.app, "src/rules/policy.test.ts", 'import { POLICY } from "./policy";\nimport { uncovered } from "../data/required";\nuncovered([], POLICY, new Set());\n');
  assert.equal(checkRequired(ws.root, "app").state, "module");
});

test("--source on a repo that copies the module fails", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "src/data/required.ts", MODULE_TEXT + "// local tweak\n");
  const result = checkRequired(ws.root, "app", { source: "app/src/data/required.ts" });
  assert.equal(result.state, "missing");
  assert.match(result.missing[0], /is copied from lib\/src\/data\/required\.ts .*not its source/);
});

test("a README with no Copied table says so", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "README.md", "# app\n");
  assert.match(checkRequired(ws.root, "app").missing[0], /has no "Copied…" heading\): add a "Copied" table/);
});

test("the module copied unchanged, used, with a coverage test, passes", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  const result = checkRequired(ws.root, "app");
  assert.deepEqual(result.missing, []);
  assert.equal(result.state, "module");
  assert.ok(result.notes.includes("coverage test test/required.test.ts (policy src/rules/policy.ts)"));
  assert.equal(cli(ws.root, "app", "--source", "lib/src/data/required.ts").status, 0);
});

test("the source repo passes with --source once another repo copies it, and fails without it", (t) => {
  const ws = workspace(t);
  const { root, lib } = ws;
  write(lib, "src/data/write.ts", WRITE);
  write(lib, "src/rules/policy.ts", POLICY);
  write(lib, "src/entry/Entry.tsx", 'import { uncovered } from "../data/required";\n');
  write(lib, "test/required.test.ts", COVERAGE);
  assert.match(checkRequired(root, "lib", { source: "lib/src/data/required.ts" }).missing[0], /no repo in this workspace copies/);
  passingApp(ws);
  assert.equal(checkRequired(root, "lib", { source: "lib/src/data/required.ts" }).state, "module");
  const without = checkRequired(root, "lib");
  assert.equal(without.state, "missing");
  assert.match(without.missing[0], /cannot be checked \(no README\.md\)/);
});

test("a copy edited by hand fails", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "src/data/required.ts", MODULE_TEXT + "// local tweak\n");
  const result = checkRequired(ws.root, "app");
  assert.equal(result.state, "missing");
  assert.match(result.missing[0], /differs from lib\/src\/data\/required\.ts at \w+: carry it over unchanged/);
});

test("a copy whose source changed since fails", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.lib, "src/data/required.ts", MODULE_TEXT + "export const more = 1;\n");
  git(ws.lib, "commit", "-q", "-am", "fix the module");
  const result = checkRequired(ws.root, "app");
  assert.equal(result.state, "missing");
  assert.match(result.missing[0], /the source changed since the copy/);
});

test("a copy from another source than --source fails", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  const result = checkRequired(ws.root, "app", { source: "other/src/data/required.ts" });
  assert.match(result.missing[0], /copied from lib\/src\/data\/required\.ts, but the source is other\/src\/data\/required\.ts/);
});

test("the module carried but never imported fails", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "src/entry/Entry.tsx", "export const x = 1;\n");
  assert.deepEqual(checkRequired(ws.root, "app").missing, ["nothing in src imports src/data/required.ts"]);
});

test("a test that calls uncovered( without importing a policy is no coverage test", (t) => {
  const ws = workspace(t);
  passingApp(ws);
  write(ws.app, "test/required.test.ts", 'const required = await import("../src/data/required.ts");\nrequired.uncovered([], {}, new Set());\n');
  const result = checkRequired(ws.root, "app");
  assert.equal(result.state, "missing");
  assert.match(result.missing[0], /^no coverage test/);
});

test("usage errors exit 2", (t) => {
  const { root } = workspace(t);
  assert.equal(spawnSync(process.execPath, [script], { encoding: "utf8" }).status, 2);
  assert.equal(cli(root, "nope").status, 2);
});
