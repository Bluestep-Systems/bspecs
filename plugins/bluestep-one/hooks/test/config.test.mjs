import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findRoot, loadConfig } from "../lib/config.mjs";

// A project with a config and a nested subfolder, plus a folder outside it.
function layout() {
  const base = mkdtempSync(join(tmpdir(), "root-"));
  const project = join(base, "project");
  const sub = join(project, "tmp", "deeper");
  const outside = join(base, "outside");
  mkdirSync(join(project, ".claude"), { recursive: true });
  mkdirSync(sub, { recursive: true });
  mkdirSync(outside);
  writeFileSync(
    join(project, ".claude", "bluestep-one.json"),
    JSON.stringify({ one: { host: "one.example.test", gitHost: "git.example.test" }, components: [] })
  );
  return { base, project, sub, outside };
}

function withEnv(value, fn) {
  const saved = process.env.CLAUDE_PROJECT_DIR;
  if (value === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = saved;
  }
}

test("finds the project from the project folder and from a subfolder", () => {
  const { base, project, sub } = layout();
  try {
    withEnv(undefined, () => {
      assert.equal(findRoot(project), resolve(project));
      assert.equal(findRoot(sub), resolve(project));
      const loaded = loadConfig(sub);
      assert.equal(loaded.status, "ok");
      assert.equal(loaded.root, resolve(project));
      assert.equal(loaded.config.one.host, "one.example.test");
    });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("outside any project: none, unless CLAUDE_PROJECT_DIR names one", () => {
  const { base, project, outside } = layout();
  try {
    withEnv(undefined, () => assert.equal(loadConfig(outside).status, "none"));
    withEnv(project, () => assert.equal(findRoot(outside), resolve(project)));
    withEnv(outside, () => assert.equal(findRoot(outside), null));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the nearest project wins over CLAUDE_PROJECT_DIR", () => {
  const { base, project, outside } = layout();
  const inner = join(project, "inner");
  mkdirSync(join(inner, ".claude"), { recursive: true });
  writeFileSync(join(inner, ".claude", "bluestep-one.json"), "{}");
  try {
    withEnv(project, () => assert.equal(findRoot(join(inner)), resolve(inner)));
    withEnv(project, () => assert.equal(findRoot(outside), resolve(project)));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
