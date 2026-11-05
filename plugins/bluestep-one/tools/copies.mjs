#!/usr/bin/env node
/**
 * Says, for every file a component repo copied from another repo, whether the
 * source has changed since the copy (`node copies.mjs my-component`).
 *
 * Why: repos share no code, so a component copies what it needs (`gql.ts`,
 * `Alert`, `Checkbox`) from another one, and a later fix to the source does
 * not reach the copy (one fix then has to be made twice). Run it before each
 * publish and carry any fix over.
 *
 * The list is a table in the repo's README, under a heading that starts with
 * "Copied" (any level). The copy's path is relative to the repo; the source's
 * starts with the source repo's folder in this workspace; the commit is the
 * source repo's commit the copy was taken from:
 *
 *   ## Copied from other repos
 *
 *   | Copy | Source | Source commit |
 *   | --- | --- | --- |
 *   | `src/data/gql.ts` | `<other repo>/src/data/gql.ts` | `abc1234` |
 *
 * For each row it reads the source repo's git history: the commits after that
 * one that touch the file, and any edit not committed yet. Exit 0 when every
 * source is unchanged, 1 when one changed or could not be checked, 2 when the
 * README holds no list. `--root <dir>` checks another workspace (the tests).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cell = (text) => text.trim().replace(/^`(.*)`$/, "$1").trim();

/** The rows of the README's "Copied…" table: `{ copy, source, commit }`, in order. */
export function parseCopies(readme) {
  const lines = readme.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,6}\s+Copied\b/i.test(line));
  if (start < 0) return null;
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell);
    if (cells.length < 3 || /^:?-+:?$/.test(cells[0]) || /^copy$/i.test(cells[0])) continue;
    rows.push({ copy: cells[0], source: cells[1], commit: cells[2] });
  }
  return rows;
}

function git(cwd, args) {
  const run = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { ok: run.status === 0, out: (run.stdout ?? "").trim(), err: (run.stderr ?? "").trim() || run.error?.message || "" };
}

/** One verdict per row: `{ ...row, state: "unchanged" | "changed" | "error", detail }`. */
export function checkCopies(workspace, repoDir) {
  const repo = path.resolve(workspace, repoDir);
  const readmePath = path.join(repo, "README.md");
  if (!existsSync(readmePath)) return { error: `no README.md in ${repo}` };
  const rows = parseCopies(readFileSync(readmePath, "utf8"));
  if (rows === null) return { error: `${readmePath} has no "Copied…" heading` };
  const verdicts = rows.map((row) => {
    const [sourceRepo, ...rest] = row.source.split("/");
    const file = rest.join("/");
    const sourceDir = path.join(workspace, sourceRepo);
    if (!existsSync(path.join(repo, row.copy))) return { ...row, state: "error", detail: `the copy ${row.copy} is not in ${repoDir}` };
    if (!file || !existsSync(path.join(sourceDir, ".git"))) return { ...row, state: "error", detail: `${sourceRepo} is not a git repo in this workspace` };
    if (!git(sourceDir, ["cat-file", "-e", `${row.commit}^{commit}`]).ok) return { ...row, state: "error", detail: `${row.commit} is not a commit of ${sourceRepo}` };
    const since = git(sourceDir, ["log", "--format=%h %s", `${row.commit}..HEAD`, "--", file]);
    if (!since.ok) return { ...row, state: "error", detail: since.err };
    const pending = git(sourceDir, ["status", "--porcelain", "--", file]);
    const commits = since.out ? since.out.split("\n") : [];
    const notes = [];
    if (commits.length > 0) notes.push(`${commits.length} commit(s) since: ${commits.join("; ")}`);
    if (pending.out) notes.push("edits not committed yet");
    if (notes.length === 0) return { ...row, state: "unchanged", detail: "" };
    return { ...row, state: "changed", detail: `${notes.join("; ")}. See: git -C ${sourceRepo} diff ${row.commit} -- ${file}` };
  });
  return { verdicts };
}

function main(argv) {
  const args = [...argv];
  let workspace = process.cwd();
  const rootAt = args.indexOf("--root");
  if (rootAt >= 0) {
    workspace = path.resolve(args[rootAt + 1] ?? ".");
    args.splice(rootAt, 2);
  }
  const repoDir = args[0];
  if (!repoDir) {
    console.error("usage: node copies.mjs <component-repo-dir> [--root <workspace>]");
    return 2;
  }
  const result = checkCopies(workspace, repoDir);
  if (result.error) {
    console.error(result.error);
    return 2;
  }
  if (result.verdicts.length === 0) console.log(`${repoDir}: the list of copies is empty`);
  for (const v of result.verdicts) {
    const label = { unchanged: "ok     ", changed: "CHANGED", error: "ERROR  " }[v.state];
    console.log(`${label} ${v.copy} <- ${v.source} (${v.commit})${v.detail ? `: ${v.detail}` : ""}`);
  }
  return result.verdicts.every((v) => v.state === "unchanged") ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
