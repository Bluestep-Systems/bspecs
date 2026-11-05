// node --test tools/  (from the plugin root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCopies, parseCopies } from "../copies.mjs";

const script = fileURLToPath(new URL("../copies.mjs", import.meta.url));

function git(cwd, ...args) {
  const run = spawnSync("git", ["-C", cwd, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/** A workspace with a source repo `lib` (one commit) and a repo `app` that copied two of its files. */
function workspace(t) {
  const root = mkdtempSync(path.join(tmpdir(), "copies-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const lib = path.join(root, "lib");
  mkdirSync(path.join(lib, "src"), { recursive: true });
  git(lib, "init", "-q");
  writeFileSync(path.join(lib, "src", "gql.ts"), "export const a = 1;\n");
  writeFileSync(path.join(lib, "src", "Alert.tsx"), "export const b = 1;\n");
  git(lib, "add", ".");
  git(lib, "commit", "-q", "-m", "first");
  const first = git(lib, "rev-parse", "--short", "HEAD");
  const app = path.join(root, "app");
  mkdirSync(path.join(app, "src", "ui"), { recursive: true });
  writeFileSync(path.join(app, "src", "gql.ts"), "export const a = 1;\n");
  writeFileSync(path.join(app, "src", "ui", "Alert.tsx"), "export const b = 1;\n");
  writeFileSync(
    path.join(app, "README.md"),
    [
      "# app",
      "",
      "## Copied from other repos",
      "",
      "| Copy | Source | Source commit |",
      "| --- | --- | --- |",
      `| \`src/gql.ts\` | \`lib/src/gql.ts\` | \`${first}\` |`,
      `| \`src/ui/Alert.tsx\` | \`lib/src/Alert.tsx\` | \`${first}\` |`,
      "",
      "## The loop",
      "",
      "| not | a | copy |",
    ].join("\n"),
  );
  return { root, lib, first };
}

test("parseCopies reads the table under the Copied heading and stops at the next heading", () => {
  const rows = parseCopies("# x\n\n### Copied code\n\n| Copy | Source | Source commit |\n|---|---|---|\n| `a.ts` | `m/a.ts` | `abc1234` |\n\n## Next\n| b | c | d |\n");
  assert.deepEqual(rows, [{ copy: "a.ts", source: "m/a.ts", commit: "abc1234" }]);
  assert.equal(parseCopies("# no list here\n"), null);
});

test("every source unchanged since the copy", (t) => {
  const { root } = workspace(t);
  const { verdicts } = checkCopies(root, "app");
  assert.deepEqual(verdicts.map((v) => v.state), ["unchanged", "unchanged"]);
  const cli = spawnSync(process.execPath, [script, "app", "--root", root], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /^ok\s+src\/gql\.ts <- lib\/src\/gql\.ts/m);
});

test("a commit to one source after the copy marks that copy changed, and only that one", (t) => {
  const { root, lib, first } = workspace(t);
  writeFileSync(path.join(lib, "src", "Alert.tsx"), "export const b = 2;\n");
  git(lib, "commit", "-q", "-am", "fix the alert");
  const { verdicts } = checkCopies(root, "app");
  assert.deepEqual(verdicts.map((v) => v.state), ["unchanged", "changed"]);
  assert.match(verdicts[1].detail, /1 commit\(s\) since: \w+ fix the alert/);
  assert.match(verdicts[1].detail, new RegExp(`git -C lib diff ${first} -- src/Alert.tsx`));
  const cli = spawnSync(process.execPath, [script, "app", "--root", root], { encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /^CHANGED src\/ui\/Alert\.tsx/m);
});

test("an edit to a source not committed yet counts as a change", (t) => {
  const { root, lib } = workspace(t);
  writeFileSync(path.join(lib, "src", "gql.ts"), "export const a = 3;\n");
  const { verdicts } = checkCopies(root, "app");
  assert.equal(verdicts[0].state, "changed");
  assert.match(verdicts[0].detail, /edits not committed yet/);
});

test("a missing copy, an unknown commit and a missing source repo are errors, and a README with no list exits 2", (t) => {
  const { root } = workspace(t);
  writeFileSync(
    path.join(root, "app", "README.md"),
    "## Copied\n\n| Copy | Source | Source commit |\n|---|---|---|\n| `src/gone.ts` | `lib/src/gql.ts` | `HEAD` |\n| `src/gql.ts` | `lib/src/gql.ts` | `0000000` |\n| `src/gql.ts` | `nope/src/gql.ts` | `HEAD` |\n",
  );
  const { verdicts } = checkCopies(root, "app");
  assert.deepEqual(verdicts.map((v) => v.state), ["error", "error", "error"]);
  assert.match(verdicts[0].detail, /not in app/);
  assert.match(verdicts[1].detail, /not a commit of lib/);
  assert.match(verdicts[2].detail, /nope is not a git repo/);
  writeFileSync(path.join(root, "app", "README.md"), "# app\n");
  const cli = spawnSync(process.execPath, [script, "app", "--root", root], { encoding: "utf8" });
  assert.equal(cli.status, 2);
});
