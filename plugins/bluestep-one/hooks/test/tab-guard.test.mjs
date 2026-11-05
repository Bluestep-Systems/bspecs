import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TICKET_FOLDER, ticketText } from "../lib/tab-script.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "tab-guard.mjs");

const CONFIG = {
  one: { host: "one.example.test", gitHost: "git.example.test" },
  testPrefix: "ZZ Test AB",
  components: [{ id: "900___1" }],
};

function project(config, raw) {
  const dir = mkdtempSync(join(tmpdir(), "tab-guard-"));
  if (config !== undefined || raw !== undefined) {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(join(dir, ".claude", "bluestep-one.json"), raw ?? JSON.stringify(config));
  }
  return dir;
}

// Each run gets its own temp folder, so tickets never meet the machine's.
function run(dir, toolName, toolInput, toolUseId = "toolu_test") {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd: dir, tool_name: toolName, tool_input: toolInput, tool_use_id: toolUseId }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: "", TEMP: dir, TMP: dir, TMPDIR: dir },
  });
  assert.equal(r.status, 0);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}

const JS = "mcp__Claude_Browser__javascript_tool";
const script = (query) => `await fetch("/gql", { method: "POST", body: JSON.stringify({ query: ${JSON.stringify(query)} }) })`;

function withProject(config, fn, raw) {
  const dir = project(config, raw);
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("does nothing without a config", () => {
  withProject(undefined, (dir) => {
    assert.equal(run(dir, JS, { text: script('mutation { deleteForm(id: "x") { id } }') }), null);
  });
});

test("a read passes", () => {
  withProject(CONFIG, (dir) => {
    assert.equal(run(dir, JS, { text: script('{ remoteObjects(ids: ["1"]) { id } }') }), null);
    assert.equal(run(dir, JS, { text: "document.title" }), null);
  });
});

test("a build or publish of an own component passes, with plain or escaped quotes", () => {
  withProject(CONFIG, (dir) => {
    assert.equal(run(dir, JS, { text: script('mutation { buildCustomComponent(id: "900___1") { sha state } }') }), null);
    assert.equal(run(dir, JS, { text: "q = 'mutation { publishCustomComponent(id: \"900___1\") { sha state } }'" }), null);
  });
});

test("a publish with no selection, or with an inline fragment, is still our own", () => {
  withProject(CONFIG, (dir) => {
    assert.equal(run(dir, JS, { text: script('mutation { publishCustomComponent(id: "900___1") }') }), null);
    const fragment = 'mutation { publishCustomComponent(id: "900___1") { topId ... on CustomComponentInterface { publishedSha } } }';
    assert.equal(run(dir, JS, { text: script(fragment) }), null);
  });
});

test("an id the hook cannot read, or a field hidden after a selection, is asked", () => {
  withProject(CONFIG, (dir) => {
    const templated = "for (const id of ids) await gq(`mutation { buildCustomComponent(id: \"${id}\") { sha } }`)";
    assert.equal(run(dir, JS, { text: templated }).permissionDecision, "ask");
    const hidden = script('mutation { publishCustomComponent(id: "900___1") { sha } deleteForm { id } }');
    assert.equal(run(dir, JS, { text: hidden }).permissionDecision, "ask");
  });
});

test("another component, a second field or any other mutation is asked, in plain words", () => {
  withProject(CONFIG, (dir) => {
    const other = run(dir, JS, { text: script('mutation { buildCustomComponent(id: "900___9") { sha } }') });
    assert.equal(other.permissionDecision, "ask");
    assert.equal(
      other.permissionDecisionReason,
      "This script would change data in BlueStep. Allow it only if you want Claude to make this change."
    );
    assert.doesNotMatch(other.permissionDecisionReason, /example\.test|ZZ Test/);
    const two = script('mutation { buildCustomComponent(id: "900___1") { sha } deleteForm(id: "x") { id } }');
    assert.equal(run(dir, JS, { text: two }).permissionDecision, "ask");
    const save = script('mutation($v: Int!) { updateFormRow(id: "r", fieldValues: {}, expectedVersion: $v) { id } }');
    assert.equal(run(dir, JS, { text: save }).permissionDecision, "ask");
  });
});

test("a batch is checked item by item, on both browsers", () => {
  withProject(CONFIG, (dir) => {
    const actions = [
      { name: "navigate", input: { url: "https://one.example.test/" } },
      { name: "javascript_tool", input: { text: script('mutation { createFormRow(formId: "f") { id } }') } },
    ];
    assert.equal(run(dir, "mcp__Claude_Browser__browser_batch", { actions }).permissionDecision, "ask");
    assert.equal(run(dir, "mcp__claude-in-chrome__browser_batch", { actions: actions.slice(0, 1) }), null);
    assert.equal(run(dir, "mcp__claude-in-chrome__javascript_tool", { text: actions[1].input.text }).permissionDecision, "ask");
  });
});

function leaveTicket(dir, id, text, ageMs = 0) {
  mkdirSync(join(dir, TICKET_FOLDER), { recursive: true });
  const file = join(dir, TICKET_FOLDER, id);
  writeFileSync(file, text);
  if (ageMs) utimesSync(file, new Date(Date.now() - ageMs), new Date(Date.now() - ageMs));
  return file;
}

test("the mod's ticket for this exact call stops the second ask, and stays for bluestep-tools' guard", () => {
  withProject(CONFIG, (dir) => {
    const text = script('mutation { deleteForm(id: "x") { id } }');
    const file = leaveTicket(dir, "toolu_1", ticketText(JS, [text]));
    assert.equal(run(dir, JS, { text }, "toolu_1"), null);
    // bluestep-tools' tab-guard.sh runs in parallel and reads the same file: taking it here made
    // that hook ask after Proceed.
    assert.equal(existsSync(file), true);
    // Left in place, the same ticket stops working once it is stale, and the sweep removes it.
    const past = new Date(Date.now() - 10 * 60 * 1000);
    utimesSync(file, past, past);
    assert.equal(run(dir, JS, { text }, "toolu_1").permissionDecision, "ask");
    assert.equal(existsSync(file), false);
  });
});

test("a ticket for another call, another script or from long ago is no ticket", () => {
  withProject(CONFIG, (dir) => {
    const text = script('mutation { deleteForm(id: "x") { id } }');
    leaveTicket(dir, "toolu_other", ticketText(JS, [text]));
    assert.equal(run(dir, JS, { text }, "toolu_2").permissionDecision, "ask");
    leaveTicket(dir, "toolu_3", ticketText(JS, [script('mutation { saveRow { id } }')]));
    assert.equal(run(dir, JS, { text }, "toolu_3").permissionDecision, "ask");
    const old = leaveTicket(dir, "toolu_4", ticketText(JS, [text]), 10 * 60 * 1000);
    assert.equal(run(dir, JS, { text }, "toolu_4").permissionDecision, "ask");
    assert.equal(existsSync(old), false);
    // An id that would lead out of the ticket folder is never read.
    writeFileSync(join(dir, "x"), ticketText(JS, [text]));
    assert.equal(run(dir, JS, { text }, "../x").permissionDecision, "ask");
    assert.equal(existsSync(join(dir, "x")), true);
  });
});

test("an unreadable config leaves no own component, so every mutation is asked and reads pass", () => {
  withProject(undefined, (dir) => {
    assert.equal(run(dir, JS, { text: script('mutation { buildCustomComponent(id: "900___1") { sha } }') }).permissionDecision, "ask");
    assert.equal(run(dir, JS, { text: "document.title" }), null);
  }, "{ not json");
});
