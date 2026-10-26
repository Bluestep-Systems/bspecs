// outbox.mjs — hands one /release-email step to a browser tab signed in to the outbox org.
//
// The org no longer serves GraphQL to MCP clients, so every read and write of the config and
// outbox forms runs from a tab, as POSTs to /gql (bluestep-reference gql-in-a-tab.md). This
// script never talks to the platform. It packs what the step needs (the ids, and for check / queue
// / rewrite the draft) into the URL hash of a one-time bridge page on 127.0.0.1; the bridge sends
// the tab to the org's site with that hash, and a tab script in this folder reads it:
//
//   node outbox.mjs read                         → tab-read.js     the watermarks and every entry
//   node outbox.mjs check <entry> <dir> <base>   → tab-read.js     byte-compare an entry with the draft
//   node outbox.mjs queue <dir> <base>           → tab-queue.js    create a new entry, then compare
//   node outbox.mjs rewrite <entry> <dir> <base> → tab-rewrite.js  overwrite an UNSENT entry, then compare
//   (any of them) --port <n>                     default 4317
//
// Only data travels in the hash, never code: each mutation is written out in its tab script, where
// the tab-guard hook and the user can read it. Ids come from ../ids.local.json, which lists only the
// fields the tab scripts may touch — never the recipient memos, never the Approval signature.
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wrapEmailDocument } from "../templates/emailShell.ts";

const IDS = JSON.parse(readFileSync(new URL("../ids.local.json", import.meta.url), "utf8"));
if (!IDS.host) throw new Error("ids.local.json has no host: add the outbox org's site, e.g. \"host\": \"www.example.net\"");

const argv = process.argv.slice(2);
const portAt = argv.indexOf("--port");
const port = portAt >= 0 ? Number(argv.splice(portAt, 2)[1]) : 4317;
const [op, ...args] = argv;
const usage = () => {
  console.error("usage: node outbox.mjs read | check <entry> <dir> <base> | queue <dir> <base> | rewrite <entry> <dir> <base> [--port <n>]");
  process.exit(64);
};

function loadDraft(dir, base) {
  const read = (ext) => readFileSync(join(dir, `${base}${ext}`), "utf8");
  const { subject, payload } = JSON.parse(read(".json"));
  const d = { subject, body: read(".body.html"), text: read(".txt"), payloadJson: JSON.stringify(payload, null, 2) + "\n" };
  // The tab compares the stored fields with these; this is the rest of the old check: the stored
  // body, wrapped, is the document that was rendered.
  if (wrapEmailDocument(d.body, d.subject) !== read(".html")) {
    throw new Error(`wrapEmailDocument(${base}.body.html) is not ${base}.html — re-run writeDraft before going on`);
  }
  return d;
}

const ids = { record: IDS.record, outboxForm: IDS.outboxForm, outbox: IDS.outbox, config: IDS.config };
let payload;
let tabScript;
if (op === "read" && args.length === 0) {
  payload = { op, ids };
  tabScript = "tab-read.js";
} else if (op === "check" && args.length === 3) {
  payload = { op, ids, entry: args[0], draft: loadDraft(args[1], args[2]) };
  tabScript = "tab-read.js";
} else if (op === "queue" && args.length === 2) {
  payload = { op, ids, draft: loadDraft(args[0], args[1]) };
  tabScript = "tab-queue.js";
} else if (op === "rewrite" && args.length === 3) {
  payload = { op, ids, entry: args[0], draft: loadDraft(args[1], args[2]) };
  tabScript = "tab-rewrite.js";
} else usage();

payload.madeAt = new Date().toISOString();
const target = `https://${IDS.host}/#release-email=${encodeURIComponent(JSON.stringify(payload))}`;
const page = `<!doctype html><title>release-email bridge</title><p>Opening ${IDS.host}…</p>
<script>location.replace(${JSON.stringify(target)});</script>`;

// One page, served once: the payload holds the email body, so it should not sit on a port.
const server = http.createServer((req, res) => {
  if (new URL(req.url, `http://127.0.0.1:${port}`).pathname !== "/bridge.html") {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(page);
  console.log(`bridge served: the tab is on ${IDS.host}. Run scripts/${tabScript} there.`);
  setTimeout(() => process.exit(0), 2000);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`1. In the browser pane, open http://127.0.0.1:${port}/bridge.html`);
  console.log(`2. Then run scripts/${tabScript} in that tab (javascript_tool).`);
  console.log(`(${op}: ${Buffer.byteLength(target)} B in the hash; this server stops after one page or 10 minutes)`);
});
setTimeout(() => { console.error("no one opened the bridge in 10 minutes; nothing was sent"); process.exit(1); }, 10 * 60 * 1000);
