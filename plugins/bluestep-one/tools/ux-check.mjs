#!/usr/bin/env node
/**
 * Judges a UX probe report against the project's thresholds: the build skill's UX check
 * (`node ux-check.mjs <report.json> [--config .claude/bluestep-one.json] [--json]`).
 *
 * Why: the gates before it check types, tests, copies and required fields, and the live check
 * is a look at a loaded screen. None of them sees a screen that takes seconds to fill, reads the
 * server once per row, moves its content once it has drawn, logs errors, or draws two buttons
 * with the same words. Those are measured here, on the served screen, with numbers a threshold
 * can stop.
 *
 * The report is what `tools/ux-probe.js` returns from the tab (`uxc.report()`), pasted into a
 * file: per step, time to first content, time to the last skeleton gone, the `/gql` POSTs until
 * idle, cumulative layout shift, console errors and failed requests; and the duplicate
 * accessible names of the screen (`uxc.names()`). The probe's header says how it is run.
 *
 * Thresholds come from `uxCheck` in `.claude/bluestep-one.json` (the cwd's, or `--config`), each
 * key falling back to DEFAULTS when missing. A number over its threshold, a step that never
 * went idle, a step with no content, or a screen that was not scanned for names stops the gate.
 *
 * Exit 0 when every number is under its threshold, 1 when one is over (each named with its
 * number and threshold), 2 on a usage error. `--probe` prints the probe's source to paste.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULTS = {
  firstContentMs: 1000,
  lastSkeletonMs: 3000,
  gqlPosts: 10,
  layoutShift: 0.1,
  consoleErrors: 0,
  failedRequests: 0,
  duplicateNames: 0,
  idleMs: 1500,
  maxMs: 30000,
  skeleton: '.animate-pulse, [aria-busy="true"]',
};

const HELP = `usage: node ux-check.mjs <report.json> [--config <bluestep-one.json>] [--json]
       node ux-check.mjs --probe
       node ux-check.mjs --help

Judges a UX probe report (tools/ux-probe.js, uxc.report() pasted into a file) against the
project's thresholds, uxCheck in .claude/bluestep-one.json (the cwd's, or --config), each key
falling back to its default:

  firstContentMs   ${DEFAULTS.firstContentMs}   ms from the step's start to the first text drawn (not a skeleton)
  lastSkeletonMs   ${DEFAULTS.lastSkeletonMs}   ms to the last skeleton gone; a skeleton still showing at idle stops
  gqlPosts         ${DEFAULTS.gqlPosts}     /gql POSTs from the step's start until idle
  layoutShift      ${DEFAULTS.layoutShift}    cumulative layout shift of the step (the browser's metric)
  consoleErrors    ${DEFAULTS.consoleErrors}      console.error calls, uncaught errors and rejections
  failedRequests   ${DEFAULTS.failedRequests}      requests answered 400 or over, or not answered
  duplicateNames   ${DEFAULTS.duplicateNames}      two focusable controls with one accessible name in one card or section
  idleMs           ${DEFAULTS.idleMs}   quiet (no DOM change, no /gql call) that ends a step
  maxMs            ${DEFAULTS.maxMs}  a step not idle by then stops the gate
  skeleton         ${DEFAULTS.skeleton}   what counts as a skeleton

Exit 0: every number under its threshold. Exit 1: one or more over, each printed with its number
and threshold, plus what the probe saw (operations, the largest shifts, the duplicate names).
Exit 2: a usage error or an unreadable report. --json prints the verdict as JSON instead.

--probe prints tools/ux-probe.js, to paste into the tab before the page is opened. The run:
reload the app shell, paste the probe, uxc.open("#/page/<id>"), await uxc.stop(), then
uxc.start("<label>") and a click for each further step, uxc.names(), uxc.report() into a file,
and this script on the file. The reference page in skills/reference/build/ux-check.md has
the gate.`;

/** The thresholds of a config file's `uxCheck`, over the defaults. `{ thresholds, source }`, or `{ error }`. */
export function loadThresholds(configPath) {
  if (!configPath) return { thresholds: { ...DEFAULTS }, source: "defaults" };
  if (!existsSync(configPath)) return { error: `no config at ${configPath}` };
  let json;
  try {
    json = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    return { error: `${configPath}: ${e.message}` };
  }
  const own = json && typeof json.uxCheck === "object" && json.uxCheck ? json.uxCheck : {};
  for (const key of Object.keys(own)) if (!(key in DEFAULTS)) return { error: `${configPath}: uxCheck.${key} is not a threshold (${Object.keys(DEFAULTS).join(", ")})` };
  return { thresholds: { ...DEFAULTS, ...own }, source: Object.keys(own).length > 0 ? configPath : `defaults (no uxCheck in ${configPath})` };
}

const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * One line of the verdict: `{ step, what, value, limit, over, note }`. `value` is a number, or a
 * short text when the probe could not measure it (then `over` says whether that stops).
 */
function line(step, what, value, limit, over, note) {
  const out = { step, what, value, limit, over };
  if (note) out.note = note;
  return out;
}

/** The verdict for one report: `{ lines, over: number, notes: string[] }`. Every line names what it judged. */
export function evaluate(report, thresholds = DEFAULTS) {
  const t = { ...DEFAULTS, ...thresholds };
  const lines = [];
  const notes = [];
  const steps = Array.isArray(report?.steps) ? report.steps : [];
  if (steps.length === 0) lines.push(line("-", "steps", "none", "1 or more", true, "the probe measured no step: uxc.open(hash) or uxc.start(label), then await uxc.stop()"));
  if (report?.frames === false) notes.push("layout shift was sampled: the pane painted no frame (hidden). A number near the threshold is not a pass; show the pane and run again.");
  for (const s of steps) {
    const label = s.label || "step";
    const first = number(s.firstContentMs);
    lines.push(first === null
      ? line(label, "first content", "none", `≤ ${t.firstContentMs} ms`, true, "no text was added to main during the step")
      : line(label, "first content", `${first} ms`, `≤ ${t.firstContentMs} ms`, first > t.firstContentMs));
    const seen = number(s.skeletonsSeen) ?? 0;
    const last = number(s.lastSkeletonMs);
    if (seen === 0) lines.push(line(label, "last skeleton gone", "none seen", `≤ ${t.lastSkeletonMs} ms`, false));
    else if (last === null || (number(s.skeletonsAtIdle) ?? 0) > 0) lines.push(line(label, "last skeleton gone", `${s.skeletonsAtIdle ?? "?"} still showing`, `≤ ${t.lastSkeletonMs} ms`, true, `${seen} seen at most`));
    else lines.push(line(label, "last skeleton gone", `${last} ms`, `≤ ${t.lastSkeletonMs} ms`, last > t.lastSkeletonMs, `${seen} seen at most`));
    const posts = number(s.gqlPosts) ?? 0;
    const ops = Array.isArray(s.gqlOps) ? s.gqlOps.map(([op, n]) => `${op} ×${n}`).join(", ") : "";
    lines.push(line(label, "/gql POSTs", posts, `≤ ${t.gqlPosts}`, posts > t.gqlPosts, ops || undefined));
    const cls = number(s.cls) ?? 0;
    const shifts = Array.isArray(s.shifts) ? s.shifts.map(([at, value, ...nodes]) => `${value} at ${at} ms${nodes.length ? ` (${nodes.join("; ")})` : ""}`).join(", ") : "";
    lines.push(line(label, "layout shift", cls, `≤ ${t.layoutShift}`, cls > t.layoutShift, [s.clsSource === "sampled" ? "sampled" : "", shifts].filter(Boolean).join(": ") || undefined));
    const errors = Array.isArray(s.consoleErrors) ? s.consoleErrors : [];
    lines.push(line(label, "console errors", errors.length, `≤ ${t.consoleErrors}`, errors.length > t.consoleErrors, errors.join(" | ") || undefined));
    const failed = Array.isArray(s.failed) ? s.failed : [];
    lines.push(line(label, "failed requests", failed.length, `≤ ${t.failedRequests}`, failed.length > t.failedRequests, failed.join(" | ") || undefined));
    if (s.timedOut) lines.push(line(label, "idle", `not by ${s.idleAtMs ?? "?"} ms`, `≤ ${t.maxMs} ms`, true, "the step never went quiet: a call still in flight, or the DOM kept changing"));
    else lines.push(line(label, "idle", `${s.idleAtMs ?? "?"} ms`, `≤ ${t.maxMs} ms`, false));
  }
  const dup = report?.duplicates;
  if (!Array.isArray(dup)) lines.push(line("screen", "duplicate names", "not scanned", `≤ ${t.duplicateNames}`, true, "run uxc.names() on the finished screen before uxc.report()"));
  else lines.push(line("screen", "duplicate names", dup.length, `≤ ${t.duplicateNames}`, dup.length > t.duplicateNames, dup.map((d) => `${JSON.stringify(d.name)} ×${d.count} (${d.role}) in ${d.in}`).join(", ") || undefined));
  if (number(report?.unnamed)) notes.push(`${report.unnamed} focusable control(s) with no accessible name (not a threshold; the live check should name them)`);
  if (report?.resources) notes.push(`component files: ${report.resources.fetched ?? 0} fetched, ${report.resources.cached ?? 0} from the HTTP cache${report.served && Object.keys(report.served).length ? `; served ${Object.entries(report.served).map(([n, sha]) => `${n}@${sha.slice(0, 7)}`).join(", ")}` : ""}`);
  return { lines, over: lines.filter((l) => l.over).length, notes };
}

/** The verdict as the lines the gate prints. */
export function format(report, verdict, source) {
  const out = [`ux-check  ${report?.page ?? "?"}  ${report?.at ?? ""}  (thresholds: ${source})`];
  let step = null;
  for (const l of verdict.lines) {
    if (l.step !== step) {
      step = l.step;
      out.push(step === "screen" ? "screen" : step === "-" ? "" : `step ${step}`);
    }
    const value = String(l.value).padStart(14);
    out.push(`  ${l.what.padEnd(20)}${value}   ${l.limit.padEnd(14)} ${l.over ? "OVER" : "ok"}${l.note ? `   ${l.note}` : ""}`);
  }
  for (const n of verdict.notes) out.push(`note: ${n}`);
  out.push(verdict.over === 0 ? "passed: every number under its threshold" : `STOPPED: ${verdict.over} over`);
  return out.join("\n");
}

function main(argv) {
  const args = [...argv];
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  if (args.includes("--probe")) {
    process.stdout.write(readFileSync(new URL("./ux-probe.js", import.meta.url), "utf8"));
    return 0;
  }
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const value = args[at + 1];
    args.splice(at, 2);
    return value;
  };
  const config = take("--config");
  const json = args.includes("--json");
  if (json) args.splice(args.indexOf("--json"), 1);
  const file = args[0];
  if (!file || args.length > 1 || (argv.includes("--config") && config === undefined)) {
    console.error(HELP.split("\n").slice(0, 3).join("\n"));
    return 2;
  }
  const configPath = config ?? (existsSync(path.resolve(".claude", "bluestep-one.json")) ? path.resolve(".claude", "bluestep-one.json") : undefined);
  const loaded = loadThresholds(configPath);
  if (loaded.error) {
    console.error(loaded.error);
    return 2;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`${file}: ${e.message}`);
    return 2;
  }
  const verdict = evaluate(report, loaded.thresholds);
  if (json) console.log(JSON.stringify({ page: report.page, at: report.at, thresholds: loaded.thresholds, ...verdict }, null, 2));
  else console.log(format(report, verdict, loaded.source));
  return verdict.over === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
