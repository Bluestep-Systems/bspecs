// Serves a console probe script to a BlueStep One tab and saves the answers the tab sends back,
// then exits: a way to probe BlueStep One as a staff user, from the desktop app's browser pane, with
// the answers saved straight to disk.
//
//   node probe-server.mjs <script.js> <out-dir> [--origin <url>] [--port <n>] [--minutes <n>]
//
// GET  /script.js                  the script (CORS for <origin>, also from Chrome)
// GET  /bridge.html                fetches the script same-origin and carries it to <origin>/gql in
//                                  the URL hash, for a tab that may not fetch loopback (the pane)
// GET  /sink.html#<name>=<json>    saves the hash as <out-dir>/<name>.json, for the same tab
// POST /save?name=<name>           saves the body as <out-dir>/<name>.json (CORS from <origin>)
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// The default origin is `one.host` of `.claude/bluestep-one.json` in the cwd; without that file, `--origin` is required.
const fromConfig = () => {
  try {
    const host = JSON.parse(readFileSync(path.join(process.cwd(), ".claude", "bluestep-one.json"), "utf8"))?.one?.host;
    return host ? "https://" + host : undefined;
  } catch { return undefined; }
};

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : dflt; };
const [script, outDir] = args;
if (!script || !outDir || script.startsWith("--")) {
  console.error("usage: node probe-server.mjs <script.js> <out-dir> [--origin <url>] [--port <n>] [--minutes <n>]");
  process.exit(2);
}
const origin = opt("origin", fromConfig());
if (!origin) {
  console.error("no origin: pass --origin <url> or set one.host in .claude/bluestep-one.json");
  process.exit(2);
}
const port = Number(opt("port", "4199"));
const minutes = Number(opt("minutes", "30"));
const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Private-Network": "true", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "content-type", "Cache-Control": "no-store" };
const html = (res, body) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(body); };
const save = (name, body) => {
  const clean = String(name || "").replace(/[^A-Za-z0-9_.-]/g, "");
  if (!clean) return null;
  mkdirSync(path.resolve(outDir), { recursive: true });
  writeFileSync(path.join(path.resolve(outDir), clean + ".json"), body);
  return "saved " + clean + " " + body.length;
};

http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:" + port);
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method === "POST" && u.pathname === "/save") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const said = save(u.searchParams.get("name"), body);
      res.writeHead(said ? 200 : 400, { ...cors, "Content-Type": "text/plain" });
      res.end(said || "name?");
    });
    return;
  }
  if (u.pathname === "/script.js") {
    res.writeHead(200, { ...cors, "Content-Type": "text/javascript; charset=utf-8" });
    return res.end(readFileSync(path.resolve(script)));
  }
  if (u.pathname === "/bridge.html") {
    // The pane opens this in the same tab; it goes back to <origin>/gql with the script in the hash.
    return html(res, `<!doctype html><title>probe bridge</title><p id="s">loading…</p><script>
fetch('/script.js',{cache:'no-store'}).then(r=>r.text()).then(t=>{
  location.href=${JSON.stringify(origin + "/gql#")}+encodeURIComponent(t);
});</script>`);
  }
  if (u.pathname === "/sink.html") {
    return html(res, `<!doctype html><title>probe sink</title><p id="s">saving…</p><script>
const raw=location.hash.slice(1); const i=raw.indexOf('=');
fetch('/save?name='+raw.slice(0,i),{method:'POST',body:decodeURIComponent(raw.slice(i+1))})
  .then(r=>r.text()).then(t=>{document.getElementById('s').textContent=t; history.replaceState(null,'',location.pathname);});
</script>`);
  }
  res.writeHead(404, cors);
  res.end();
}).listen(port, "127.0.0.1", () => console.log(`serving ${script} on ${port} for ${origin}, saving to ${outDir}, for ${minutes} min`));
setTimeout(() => process.exit(0), minutes * 60 * 1000);
