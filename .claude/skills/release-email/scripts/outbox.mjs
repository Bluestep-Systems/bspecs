// outbox.mjs — the gateway calls /release-email makes, as one small CLI.
//
// Run with Git Bash node (B6PT_TOKEN is set there, not in WSL). It talks to the gateway MCP
// directly because a 25 KB email body is not something to hand-escape into a tool call. Ids come
// from ../ids.local.json, which lists only the fields this script may touch — never the recipient
// memos, never the Approval signature — so no command here can read or write them.
//
// Read-only:
//   node outbox.mjs watermarks                 the three watermarks on the config form
//   node outbox.mjs list                       every outbox entry: subject, testSentAt, sentAt, sendResult
//   node outbox.mjs check <entry> <dir> <base> byte-compare an entry against <dir>/<base>.* (from draft.mjs)
// Writes — each run is an approval-gated action in the session:
//   node outbox.mjs queue <dir> <base>         create a new entry, then check it
//   node outbox.mjs rewrite <entry> <dir> <base>
//                                              overwrite an UNSENT, UNSIGNED entry's content, then check it
//                                              (agents cannot delete rows, so a bad write is fixed in place)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wrapEmailDocument } from "../templates/emailShell.ts";

const IDS = JSON.parse(readFileSync(new URL("../ids.local.json", import.meta.url), "utf8"));
const TOKEN = process.env.B6PT_TOKEN;
if (!TOKEN) throw new Error("B6PT_TOKEN is not set — run from Git Bash");
const GATEWAY = "https://gateway.bluestep.net/mcp";

let session = null;
let rpcId = 0;
async function rpc(method, params, notify = false) {
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (session) headers["Mcp-Session-Id"] = session;
  const msg = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++rpcId, method, params };
  const r = await fetch(GATEWAY, { method: "POST", headers, body: JSON.stringify(msg) });
  const sid = r.headers.get("mcp-session-id");
  if (sid) session = sid;
  if (notify) return null;
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} HTTP ${r.status}: ${txt.slice(0, 300)}`);
  const json = (r.headers.get("content-type") || "").includes("text/event-stream")
    ? JSON.parse(txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean).pop())
    : JSON.parse(txt);
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error).slice(0, 300)}`);
  return json.result;
}
async function orgTool(tool, args) {
  const res = await rpc("tools/call", { name: "invoke_org_tool", arguments: { org: IDS.org, tool, arguments: args } });
  const t = (res.content || []).map((c) => c.text || "").join("");
  if (res.isError) throw new Error(`${tool}: ${t.slice(0, 500)}`);
  const j = JSON.parse(t);
  if (j.errors) throw new Error(`${tool}: ${JSON.stringify(j.errors).slice(0, 500)}`);
  return j.data;
}
const gql = (query) => orgTool("graphql_query", { query });
const mutate = (mutation, variables) => orgTool("graphql_mutation", { mutation, variables: JSON.stringify(variables) });

// One aliased query per call; values come back as strings ("" when empty).
async function readFields(fields, fn, target) {
  const q = "{ " + Object.entries(fields).map(([k, id]) => `${k}: ${fn}(field:"${id}", ${target}){ valueAsString }`).join(" ") + " }";
  const d = await gql(q);
  return Object.fromEntries(Object.keys(fields).map((k) => [k, d[k]?.valueAsString ?? ""]));
}
const readEntry = (entry, names = Object.keys(IDS.outbox)) =>
  readFields(Object.fromEntries(names.map((n) => [n, IDS.outbox[n]])), "fieldData", `formEntry:"${entry}"`);
const readWatermarks = () => readFields(IDS.config, "singleEntryFieldData", `record:"${IDS.record}"`);
async function listEntries() {
  const { formRows } = await gql(`{ formRows(id:"${IDS.outboxForm}", recordId:"${IDS.record}", limit:50){ totalSize rows { topId } } }`);
  if (formRows.totalSize > formRows.rows.length) console.log(`WARNING: ${formRows.totalSize} entries, only the first ${formRows.rows.length} listed`);
  const out = [];
  for (const { topId } of formRows.rows) out.push({ id: topId, ...(await readEntry(topId, ["subject", "testSentAt", "sentAt", "sendResult"])) });
  return out;
}

function loadDraft(dir, base) {
  const read = (ext) => readFileSync(join(dir, `${base}${ext}`), "utf8");
  const { subject, payload } = JSON.parse(read(".json"));
  return { subject, payloadJson: JSON.stringify(payload, null, 2) + "\n", body: read(".body.html"), text: read(".txt"), html: read(".html") };
}
const contentFields = (d) => ({ [IDS.outbox.subject]: d.subject, [IDS.outbox.emailHtml]: d.body, [IDS.outbox.emailText]: d.text, [IDS.outbox.payloadJson]: d.payloadJson });

function same(label, want, got) {
  if (want === got) { console.log(`${label}: ${Buffer.byteLength(want)} B — identical`); return true; }
  let i = 0;
  while (i < got.length && got[i] === want[i]) i++;
  console.log(`${label}: want ${Buffer.byteLength(want)} B, got ${Buffer.byteLength(got)} B — DIFFERS at char ${i}: want ${JSON.stringify(want.slice(i, i + 50))} got ${JSON.stringify(got.slice(i, i + 50))}`);
  return false;
}
async function check(entry, d) {
  const e = await readEntry(entry);
  let ok = same("subject", d.subject, e.subject.trim());
  ok = same("emailHtml (stored body)", d.body, e.emailHtml) && ok;
  ok = same("emailText", d.text, e.emailText) && ok;
  ok = same("payloadJson", d.payloadJson, e.payloadJson) && ok;
  ok = same("sent document = wrapEmailDocument(stored, subject)", d.html, wrapEmailDocument(e.emailHtml, e.subject.trim())) && ok;
  console.log(`testSendRequested=${e.testSendRequested || "-"} testSentAt=${e.testSentAt || "-"} sentAt=${e.sentAt || "-"}`);
  if (e.sendResult) console.log(`sendResult: ${e.sendResult}`);
  console.log(ok ? `OK — entry ${entry} matches the draft` : `MISMATCH — do not test-send or sign entry ${entry}`);
  return ok;
}

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "release-email-outbox", version: "1" } });
await rpc("notifications/initialized", {}, true);

const [cmd, ...args] = process.argv.slice(2);
const need = (n, usage) => { if (args.length !== n) { console.error(`usage: node outbox.mjs ${usage}`); process.exit(64); } };
let ok = true;
switch (cmd) {
  case "watermarks":
    console.log(JSON.stringify(await readWatermarks(), null, 2));
    break;
  case "list":
    for (const e of await listEntries()) console.log(`${e.id}  ${e.sentAt ? "SENT " + e.sentAt : "UNSENT"}  test=${e.testSentAt || "-"}  ${e.subject}${e.sendResult ? "\n    " + e.sendResult : ""}`);
    break;
  case "check":
    need(3, "check <entry> <dir> <base>");
    ok = await check(args[0], loadDraft(args[1], args[2]));
    break;
  case "queue": {
    need(2, "queue <dir> <base>");
    const d = loadDraft(args[0], args[1]);
    const unsent = (await listEntries()).filter((e) => !e.sentAt);
    if (unsent.length) {
      console.error(`refusing: unsent entries exist (${unsent.map((e) => e.id).join(", ")}). Reuse one with \`rewrite\` after the human confirms it is not signed, or have it deleted in the UI.`);
      process.exit(3);
    }
    const r = await mutate(
      "mutation($formId:String!, $recordId:String!, $fv:JSON!){ createFormRow(formId:$formId, recordId:$recordId, fieldValues:$fv){ topId rowVersion } }",
      { formId: IDS.outboxForm, recordId: IDS.record, fv: contentFields(d) },
    );
    console.log(`created entry ${r.createFormRow.topId}`);
    ok = await check(r.createFormRow.topId, d);
    break;
  }
  case "rewrite": {
    need(3, "rewrite <entry> <dir> <base>");
    const d = loadDraft(args[1], args[2]);
    const { sentAt } = await readEntry(args[0], ["sentAt"]);
    if (sentAt) { console.error(`refusing: entry ${args[0]} was sent at ${sentAt}`); process.exit(3); }
    await mutate("mutation($id:String!, $fv:JSON!){ updateFormRow(id:$id, fieldValues:$fv){ topId rowVersion } }", { id: args[0], fv: contentFields(d) });
    console.log(`rewrote entry ${args[0]}`);
    ok = await check(args[0], d);
    break;
  }
  default:
    console.error("commands: watermarks | list | check <entry> <dir> <base> | queue <dir> <base> | rewrite <entry> <dir> <base>");
    process.exit(64);
}
process.exit(ok ? 0 : 2);
