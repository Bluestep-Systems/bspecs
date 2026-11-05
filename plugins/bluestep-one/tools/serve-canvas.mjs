// Static server for an exported Claude Design canvas, for the design audit.
// Usage: node serve-canvas.mjs <dir> <port> [file]
// [file] is served at "/"; without it, the folder's only .dc.html (an error if it holds none or several).
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "");
const port = Number(process.argv[3] ?? 4178);
let entry = process.argv[4];
if (!process.argv[2]) {
  console.error("usage: node serve-canvas.mjs <dir> <port> [file]");
  process.exit(1);
}
if (!entry) {
  const pages = (await readdir(root)).filter((name) => name.endsWith(".dc.html"));
  if (pages.length !== 1) {
    console.error(`${root} holds ${pages.length} .dc.html files (${pages.join(", ")}); name the one to serve at /`);
    process.exit(1);
  }
  entry = pages[0];
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path === "/" ? `/${entry}` : path));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`serving ${root} (/ = ${entry}) on http://localhost:${port}`));
