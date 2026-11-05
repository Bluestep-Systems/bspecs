// node --test tools/  (from the plugin root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { frames } from "../unpack-artifact.mjs";

const script = fileURLToPath(new URL("../unpack-artifact.mjs", import.meta.url));

const tag = (type, value) => `<script type="__bundler/${type}">${JSON.stringify(value)}</script>`;

/** A frame's bundled page: its .dc.html as the template, as the export packs it. */
const framePage = (title) =>
  `<!doctype html><html><body>${tag("template", `<html><head><title>${title}</title></head>\n<body>${title}</body></html>`)}</body></html>`;

/** An export page holding the given frames, the first gzipped, the rest plain. */
function exportPage(titles, order = titles.map((_, i) => `f${i}`)) {
  const manifest = Object.fromEntries(
    titles.map((title, i) => {
      const page = Buffer.from(framePage(title));
      return [`f${i}`, i === 0 ? { compressed: true, data: gzipSync(page).toString("base64") } : { compressed: false, data: page.toString("base64") }];
    }),
  );
  return `<!doctype html><html><head>${tag("manifest", manifest)}${tag("page_order", order)}</head></html>`;
}

test("frames come out in page order, named NN-<title>, page and source apart", () => {
  const list = frames(exportPage(["Title", "S1: list / empty"], ["f1", "f0"]));
  assert.deepEqual(list.map((f) => f.name), ["01-S1 list empty", "02-Title"]);
  assert.match(list[1].page, /__bundler\/template/);
  assert.equal(list[1].source, "<html><head><title>Title</title></head>\n<body>Title</body></html>");
});

test("a page that is not an export is refused", () => {
  assert.throws(() => frames("<html></html>"), /no __bundler\/manifest script/);
  assert.throws(() => frames(exportPage(["A"], ["missing"])), /page_order names missing/);
});

test("the CLI writes the .html and .dc.html of every frame", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "unpack-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, "export.html");
  writeFileSync(input, exportPage(["Title", "Screens"]));
  const out = path.join(dir, "out");
  const run = spawnSync(process.execPath, [script, input, out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(readdirSync(out).sort(), ["01-Title.dc.html", "01-Title.html", "02-Screens.dc.html", "02-Screens.html"]);
  assert.match(readFileSync(path.join(out, "02-Screens.dc.html"), "utf8"), /<title>Screens<\/title>/);
  assert.equal(spawnSync(process.execPath, [script], { encoding: "utf8" }).status, 2);
});
