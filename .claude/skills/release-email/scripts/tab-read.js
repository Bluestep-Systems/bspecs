// Reads the release-email watermarks and outbox entries, or checks one entry against the draft.
// Read only. Run in a tab on the outbox org's site that `node outbox.mjs read` or
// `node outbox.mjs check …` opened through its bridge page (javascript_tool; the last expression is
// the result). Never reads the recipient memos or the Approval signature: ids.local.json has no id
// for them, so this script cannot name them.
await (async () => {
  const KEY = "#release-email=";
  if (!location.hash.startsWith(KEY)) return "NO PAYLOAD: open the bridge page from outbox.mjs again, then run this script";
  const P = JSON.parse(decodeURIComponent(location.hash.slice(KEY.length)));
  history.replaceState(null, "", location.pathname + location.search);
  if (P.op !== "read" && P.op !== "check") return `WRONG SCRIPT: the payload is for ${P.op}`;

  async function gql(query, variables = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const head = await fetch("/gql", { method: "HEAD", credentials: "same-origin" });
      const res = await fetch("/gql", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "B6P-CSRF-TOKEN": head.headers.get("B6P-CSRF-TOKEN") },
        body: JSON.stringify({ query, variables }),
      });
      const body = await res.json().catch(() => null);
      if (body?.errors) throw new Error(JSON.stringify(body.errors).slice(0, 300));
      if (res.status === 403 && attempt === 0) continue; // stale CSRF token: once more
      if (!res.ok || !body) throw new Error(`HTTP ${res.status}`);
      return body.data;
    }
  }
  async function readFields(fields, fn, target) {
    const q = "{ " + Object.entries(fields).map(([k, id]) => `${k}: ${fn}(field:"${id}", ${target}){ valueAsString }`).join(" ") + " }";
    const d = await gql(q);
    return Object.fromEntries(Object.keys(fields).map((k) => [k, d[k]?.valueAsString ?? ""]));
  }
  const { outbox, config, record, outboxForm } = P.ids;
  const readEntry = (entry, names = Object.keys(outbox)) =>
    readFields(Object.fromEntries(names.map((n) => [n, outbox[n]])), "fieldData", `formEntry:"${entry}"`);

  const { user } = await gql("{ user { id super } }");
  if (!user) return "NOT SIGNED IN: ask the user to sign in on the page that is open in the browser, then open the bridge again";
  const who = `user ${user.id}`;

  if (P.op === "read") {
    const marks = await readFields(config, "singleEntryFieldData", `record:"${record}"`);
    const { formRows } = await gql(`{ formRows(id:"${outboxForm}", recordId:"${record}", limit:50){ totalSize rows { topId } } }`);
    const lines = [who, `watermarks ${JSON.stringify(marks)}`];
    if (formRows.totalSize > formRows.rows.length) lines.push(`WARNING: ${formRows.totalSize} entries, only ${formRows.rows.length} listed`);
    for (const { topId } of formRows.rows) {
      const e = await readEntry(topId, ["subject", "testSentAt", "sentAt", "sendResult"]);
      lines.push(`${topId} ${e.sentAt ? "SENT " + e.sentAt : "UNSENT"} test=${e.testSentAt || "-"} ${e.subject.trim().slice(0, 70)}${e.sendResult ? " | " + e.sendResult.slice(0, 120) : ""}`);
    }
    return lines.join("\n");
  }

  const e = await readEntry(P.entry);
  const d = P.draft;
  const same = (label, want, got) => {
    if (want === got) return [true, `${label}: ${want.length} chars, identical`];
    let i = 0;
    while (i < got.length && got[i] === want[i]) i++;
    return [false, `${label}: DIFFERS at char ${i}: want ${JSON.stringify(want.slice(i, i + 40))} got ${JSON.stringify(got.slice(i, i + 40))}`];
  };
  const rows = [
    same("subject", d.subject, e.subject.trim()),
    same("emailHtml (stored body)", d.body, e.emailHtml),
    same("emailText", d.text, e.emailText),
    same("payloadJson", d.payloadJson, e.payloadJson),
  ];
  const ok = rows.every(([good]) => good);
  return [
    who,
    ...rows.map(([, line]) => line),
    `testSendRequested=${e.testSendRequested || "-"} testSentAt=${e.testSentAt || "-"} sentAt=${e.sentAt || "-"}`,
    e.sendResult ? `sendResult: ${e.sendResult.slice(0, 200)}` : "",
    ok ? `OK — entry ${P.entry} matches the draft` : `MISMATCH — do not test-send or sign entry ${P.entry}`,
  ].filter(Boolean).join("\n");
})();
