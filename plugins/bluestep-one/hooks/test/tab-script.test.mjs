import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, fetchOrigins, mutationTexts } from "../lib/tab-script.mjs";

test("mutationTexts gives each mutation to its closing brace, quotes put back", () => {
  const script = 'const query = "mutation { saveRow(input: { name: \\"ZZ Test\\" }) { id } }"; fetch("/gql")';
  assert.deepEqual(mutationTexts(script), ['mutation { saveRow(input: { name: "ZZ Test" }) { id } }']);
  assert.equal(classify(script, new Set()), "other");
});

test("mutationTexts cuts a mutation that never closes", () => {
  const [text] = mutationTexts("mutation { " + "a ".repeat(400), 50);
  assert.ok(text.endsWith(" …"));
  assert.ok(text.length <= 52);
});

test("fetchOrigins lists only absolute fetch targets", () => {
  assert.deepEqual(fetchOrigins('fetch("/gql"); fetch(`https://Other.Example.test/gql`, {})'), ["https://other.example.test"]);
});

test("variableTexts shows the values a script sends, however it names them", async () => {
  const { variableTexts } = await import("../lib/tab-script.mjs");
  const inline = 'body: JSON.stringify({ query, variables: { id: "900___2", fv: { "900___3": "12" }, v: 21 } })';
  assert.deepEqual(variableTexts(inline), ['{ id: "900___2", fv: { "900___3": "12" }, v: 21 }']);
  const declared = 'const variables = { name: "a } b" };\nfetch("/gql", { body: JSON.stringify({ query, variables }) })';
  assert.deepEqual(variableTexts(declared), ['{ name: "a } b" }']);
  const named = 'const vars = { v: 2 };\nconst body = JSON.stringify({ query, variables: vars })';
  assert.deepEqual(variableTexts(named), ["{ v: 2 }"]);
  assert.deepEqual(variableTexts("const variables = {};"), []);
  assert.ok(variableTexts("variables: { a: " + "1, ".repeat(400), 40)[0].endsWith(" …"));
});

test("summaryOf reads the comment a script opens with, and nothing else", async () => {
  const { summaryOf } = await import("../lib/tab-script.mjs");
  assert.equal(summaryOf("\n  // Saves Item A's quantity as 12 on the test record\nconst q = 1;"), "Saves Item A's quantity as 12 on the test record");
  assert.equal(summaryOf("/* Saves one test row */\nfetch()"), "Saves one test row");
  assert.equal(summaryOf("const q = 1; // too late"), undefined);
  assert.equal(summaryOf(""), undefined);
  assert.ok(summaryOf("// " + "x".repeat(300), 50).endsWith(" …"));
});

test("buildsAndPublishes lists each build and publish with its id, in order", async () => {
  const { buildsAndPublishes } = await import("../lib/tab-script.mjs");
  const script =
    'q("mutation { buildCustomComponent(id: \\"900___1\\") { sha } }"); q(`mutation P { publishCustomComponent(id: "900___1") { ... on CustomComponentInterface { publishedSha } } }`)';
  assert.deepEqual(buildsAndPublishes(script), [
    { action: "build", id: "900___1" },
    { action: "publish", id: "900___1" },
  ]);
  assert.deepEqual(buildsAndPublishes('q("mutation { saveRow(id: \\"1\\") { id } }")'), []);
});

test("NOTIFIER builds the system notification from stdin, the text escaped, and takes it back by its tag", async () => {
  const { NOTIFIER } = await import("../lib/tab-script.mjs");
  const { spawnSync } = await import("node:child_process");
  const run = (input) => {
    const r = spawnSync(process.execPath, ["-e", NOTIFIER], { input: JSON.stringify(input), env: { ...process.env, BLUESTEP_ONE_NOTIFY_DRY: "1" }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const link = "claude://code/continue?session=local_fe91e789-efbf";
  const shown = run({ title: "BlueStep One · Tab guard", text: "Saves <Item A> & 'B' on the test record", tag: "toolu_01AB/x", link });
  const unlinked = run({ title: "t", text: "x", tag: "a", link: "https://elsewhere.example.test" });
  const removed = run({ tag: "toolu_01AB/x", remove: true });
  if (process.platform === "win32") {
    const decode = (argv) => Buffer.from(argv.at(-1), "base64").toString("utf16le");
    const script = decode(shown);
    assert.equal(shown[0], "powershell");
    assert.match(script, /Saves &lt;Item A&gt; &amp; &apos;B&apos; on the test record/);
    assert.match(script, /\$t\.Tag = 'toolu_01ABx'/);
    // A click opens the session; a link that is not one is dropped.
    assert.match(script, /<toast scenario="reminder" activationType="protocol" launch="claude:\/\/code\/continue\?session=local_fe91e789-efbf">/);
    assert.match(script, /content="Open session" activationType="protocol"/);
    assert.doesNotMatch(decode(unlinked), /elsewhere|activationType="protocol"/);
    assert.match(decode(removed), /History\.Remove\('toolu_01ABx', 'tab-guard', \$app\)/);
  } else {
    assert.deepEqual(shown.slice(-2), ["BlueStep One · Tab guard", "Saves <Item A> & 'B' on the test record"]);
    assert.deepEqual(removed, []);
  }
});
