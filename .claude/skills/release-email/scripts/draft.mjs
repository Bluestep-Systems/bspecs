// draft.mjs — turn a rendered email into the files /release-email queues and checks.
//
// The outbox entry stores only the email BODY: the GraphQL write path renames document-level
// tags and escapes HTML comments (see templates/emailShell.ts). writeDraft() cuts the body out of
// the rendered document, swaps the two Outlook ghost-table comments for their markers, and proves
// that wrapEmailDocument(body, subject) gives back the exact document — so what Send emails is
// byte-for-byte what was rendered.
//
//   import { writeDraft } from "../.claude/skills/release-email/scripts/draft.mjs";
//   writeDraft(".release-email", "2026-10-01", { html, text, subject, payload });
//
// Writes <base>.html (the document Send will email), <base>.body.html (what the entry stores),
// <base>.txt and <base>.json ({ subject, payload }) — the inputs of `outbox.mjs queue`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { wrapEmailDocument } from "../templates/emailShell.ts";

const MSO_OPEN_RE = /<!--\[if mso\]><table[\s\S]*?<!\[endif\]-->/;
const MSO_CLOSE_RE = /<!--\[if mso\]><\/td><\/tr><\/table><!\[endif\]-->/;

export function toStoredBody(html, subject) {
  const open = html.match(/<body[^>]*>/);
  if (!open) throw new Error("no <body> in the rendered email");
  const body = html
    .slice(open.index + open[0].length, html.lastIndexOf("</body>"))
    .replace(MSO_OPEN_RE, "%%MSO_OPEN%%")
    .replace(MSO_CLOSE_RE, "%%MSO_CLOSE%%");
  const bad = body.match(/<!--|<\/?(html|head|body|meta|link|title)\b|&#39;/i);
  if (bad) throw new Error(`the body still holds ${JSON.stringify(bad[0])}, which the GraphQL write alters — strip comments, write apostrophes as plain '`);
  const titleEsc = subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const expected = html.replace(/<title>[^<]*<\/title>/, () => `<title>${titleEsc}</title>`);
  const rebuilt = wrapEmailDocument(body, subject);
  if (rebuilt !== expected) {
    let i = 0;
    while (i < rebuilt.length && rebuilt[i] === expected[i]) i++;
    throw new Error(`emailShell.ts no longer matches the template head at char ${i}: ${JSON.stringify(expected.slice(i, i + 60))} vs ${JSON.stringify(rebuilt.slice(i, i + 60))}`);
  }
  return { body, html: rebuilt };
}

export function writeDraft(dir, base, { html, text, subject, payload }) {
  const { body, html: doc } = toStoredBody(html, subject);
  writeFileSync(join(dir, `${base}.html`), doc);
  writeFileSync(join(dir, `${base}.body.html`), body);
  writeFileSync(join(dir, `${base}.txt`), text);
  writeFileSync(join(dir, `${base}.json`), JSON.stringify({ subject, payload }, null, 2) + "\n");
  return { htmlBytes: Buffer.byteLength(doc), bodyBytes: Buffer.byteLength(body), textBytes: Buffer.byteLength(text) };
}
