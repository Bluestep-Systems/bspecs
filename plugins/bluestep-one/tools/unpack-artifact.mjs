#!/usr/bin/env node
// Unpack the HTML export of a Design artifact (claude.ai, the canvas's Share › Export › HTML) into
// one pair of files per frame, for the design check, as a standalone Claude Design Project HTML zip
// was unzipped before.
// Usage: node unpack-artifact.mjs <export.html> <out dir>
//
// The export is one page whose `__bundler/manifest` script holds each frame as a gzip+base64 page,
// itself a bundled page whose `__bundler/template` is the frame's .dc.html (the same format as a
// standalone export). For each frame, in the canvas's order (`__bundler/page_order`), this writes:
//   NN-<frame title>.html     the frame's bundled page, which unpacks itself in the browser: serve it
//                             with serve-canvas.mjs (name it as the file to serve) and read it with
//                             computed-styles.js; `window.BluestepUi.version` in its console is the
//                             design-system version the frame was drawn with
//   NN-<frame title>.dc.html  its source, to read and cite by line in design-audit.md
// The .dc.html refers to its scripts by the bundle's ids, so it does not render alone.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

function block(page, type) {
  const match = page.match(new RegExp(`<script type="__bundler/${type}"[^>]*>\\s*([\\s\\S]*?)\\s*</script>`));
  if (!match) throw new Error(`no __bundler/${type} script`);
  return JSON.parse(match[1]);
}

function entry(manifest, id) {
  const item = manifest[id];
  if (!item) throw new Error(`page_order names ${id}, which the manifest does not hold`);
  const bytes = Buffer.from(item.data, "base64");
  return (item.compressed ? gunzipSync(bytes) : bytes).toString("utf8");
}

const slug = (text) =>
  text.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "frame";

/** The frames of an export page, in order: { name, page, source }. */
export function frames(exportPage) {
  const manifest = block(exportPage, "manifest");
  const order = block(exportPage, "page_order");
  return order.map((id, i) => {
    const page = entry(manifest, id);
    const source = block(page, "template");
    const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? id;
    return { name: `${String(i + 1).padStart(2, "0")}-${slug(title)}`, page, source };
  });
}

export async function unpack(input, outDir) {
  const list = frames(await readFile(input, "utf8"));
  await mkdir(outDir, { recursive: true });
  for (const { name, page, source } of list) {
    await writeFile(join(outDir, `${name}.html`), page);
    await writeFile(join(outDir, `${name}.dc.html`), source);
  }
  return list.map(({ name, source }) => ({ name, lines: source.split("\n").length }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [input, outDir] = process.argv.slice(2);
  if (!input || !outDir) {
    console.error("usage: node unpack-artifact.mjs <export.html> <out dir>");
    process.exit(2);
  }
  try {
    for (const { name, lines } of await unpack(input, outDir)) console.log(`${name}  (${lines} source lines)`);
  } catch (error) {
    console.error(`${input}: ${error.message} (is it a Design artifact's HTML export?)`);
    process.exit(1);
  }
}
