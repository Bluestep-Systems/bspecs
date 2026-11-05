// node --test tools/  (from the plugin root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULTS, evaluate, format, loadThresholds } from "../ux-check.mjs";

const script = fileURLToPath(new URL("../ux-check.mjs", import.meta.url));
const probe = fileURLToPath(new URL("../ux-probe.js", import.meta.url));

/** A report of one step that passes every default, with the names scanned. */
function good() {
  return {
    page: "#/page/1", at: "2026-01-01T00:00:00.000Z", frames: true, viewport: "1440x900",
    served: { "my-component": "0123456789abcdef" }, resources: { cached: 0, fetched: 3 },
    steps: [{
      label: "#/page/1", firstContentMs: 300, lastSkeletonMs: 1200, skeletonsSeen: 4, skeletonsAtIdle: 0,
      gqlPosts: 3, gqlOps: [["Page", 2], ["Rows", 1]], cls: 0.02, clsSource: "layout-shift",
      shifts: [[900, 0.02, "div Rows"]], consoleErrors: [], failed: [], idleAtMs: 2800, timedOut: false,
    }],
    duplicates: [], unnamed: 0,
  };
}

const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
const overs = (report, thresholds) => evaluate(report, thresholds).lines.filter((l) => l.over).map((l) => `${l.step}/${l.what}`);

test("a report under every threshold passes", () => {
  const verdict = evaluate(good());
  assert.equal(verdict.over, 0);
  assert.ok(format(good(), verdict, "defaults").includes("passed"));
  assert.ok(verdict.notes.some((n) => n.includes("3 fetched, 0 from the HTTP cache; served my-component@0123456")));
});

test("each number over its threshold is one stop, with the detail", () => {
  const report = good();
  const s = report.steps[0];
  s.firstContentMs = 1001;
  s.lastSkeletonMs = 3001;
  s.gqlPosts = 11;
  s.gqlOps = [["RowDetails", 10], ["Day", 1]];
  s.cls = 0.11;
  s.consoleErrors = ["TypeError: x is undefined"];
  s.failed = ["POST /gql → 500"];
  report.duplicates = [{ name: "Edit", role: "button", count: 2, in: 'section "Details"' }];
  const verdict = evaluate(report);
  assert.deepEqual(verdict.lines.filter((l) => l.over).map((l) => l.what), ["first content", "last skeleton gone", "/gql POSTs", "layout shift", "console errors", "failed requests", "duplicate names"]);
  const text = format(report, verdict, "defaults");
  assert.ok(text.includes("RowDetails ×10"));
  assert.ok(text.includes('"Edit" ×2 (button) in section "Details"'));
  assert.ok(text.includes("STOPPED: 7 over"));
});

test("what the probe could not measure stops: no content, a skeleton still showing, no idle, no name scan, no step", () => {
  const none = good();
  none.steps[0].firstContentMs = null;
  assert.deepEqual(overs(none), ["#/page/1/first content"]);
  const stuck = good();
  stuck.steps[0].lastSkeletonMs = null;
  stuck.steps[0].skeletonsAtIdle = 2;
  assert.deepEqual(overs(stuck), ["#/page/1/last skeleton gone"]);
  const late = good();
  late.steps[0].timedOut = true;
  assert.deepEqual(overs(late), ["#/page/1/idle"]);
  const unscanned = good();
  delete unscanned.duplicates;
  assert.deepEqual(overs(unscanned), ["screen/duplicate names"]);
  assert.deepEqual(overs({ steps: [], duplicates: [] }), ["-/steps"]);
});

test("a step that drew no skeleton passes that line", () => {
  const report = good();
  report.steps[0].skeletonsSeen = 0;
  report.steps[0].lastSkeletonMs = null;
  const l = evaluate(report).lines.find((l) => l.what === "last skeleton gone");
  assert.equal(l.value, "none seen");
  assert.equal(l.over, false);
});

test("a sampled layout shift and unnamed controls are notes, not stops", () => {
  const report = good();
  report.frames = false;
  report.steps[0].clsSource = "sampled";
  report.unnamed = 2;
  const verdict = evaluate(report);
  assert.equal(verdict.over, 0);
  assert.ok(verdict.notes.some((n) => n.startsWith("layout shift was sampled")));
  assert.ok(verdict.notes.some((n) => n.startsWith("2 focusable control(s) with no accessible name")));
});

test("thresholds come from uxCheck over the defaults, and an unknown key is refused", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "ux-check-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = path.join(dir, "bluestep-one.json");
  writeFileSync(config, JSON.stringify({ uxCheck: { gqlPosts: 2 } }));
  const loaded = loadThresholds(config);
  assert.equal(loaded.thresholds.gqlPosts, 2);
  assert.equal(loaded.thresholds.layoutShift, DEFAULTS.layoutShift);
  assert.equal(loaded.source, config);
  writeFileSync(config, JSON.stringify({ testPrefix: "ZZ Test AB" }));
  assert.ok(loadThresholds(config).source.startsWith("defaults"));
  writeFileSync(config, JSON.stringify({ uxCheck: { gqlPost: 2 } }));
  assert.match(loadThresholds(config).error, /uxCheck\.gqlPost is not a threshold/);
  assert.equal(loadThresholds(undefined).source, "defaults");
});

test("the command: exit 0 under, 1 over, 2 on usage; --help, --probe and --json", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "ux-check-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "report.json");
  writeFileSync(file, JSON.stringify(good()));
  assert.equal(run(file).status, 0);
  const config = path.join(dir, "bluestep-one.json");
  writeFileSync(config, JSON.stringify({ uxCheck: { gqlPosts: 2 } }));
  const over = run(file, "--config", config);
  assert.equal(over.status, 1);
  assert.ok(over.stdout.includes("STOPPED: 1 over"));
  assert.ok(over.stdout.includes(`thresholds: ${config}`));
  const json = run(file, "--config", config, "--json");
  assert.equal(json.status, 1);
  assert.equal(JSON.parse(json.stdout).over, 1);
  assert.equal(run().status, 2);
  assert.equal(run(file, "--config").status, 2);
  assert.equal(run(path.join(dir, "missing.json")).status, 2);
  const help = run("--help");
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes("firstContentMs"));
  const source = run("--probe");
  assert.equal(source.status, 0);
  assert.ok(source.stdout.includes("window.uxc = {"));
});

test("the probe parses and holds no mutation the tab guard would ask about", () => {
  const check = spawnSync(process.execPath, ["--check", probe], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  const text = spawnSync(process.execPath, [script, "--probe"], { encoding: "utf8" }).stdout;
  assert.equal(text.match(/\bmutation\b(?:\s+[A-Za-z_]\w*)?\s*[({]/g), null);
});
