// Queues the release email: creates one outbox entry from the approved draft, then checks it
// Run only after the user approved the draft (approval gate #1), in a tab on the outbox org's site
// that `node outbox.mjs queue …` opened through its bridge page. Refuses while an unsent entry
// exists. Writes subject, emailHtml (the body), emailText and payloadJson — nothing else.
await (async () => {
  const KEY = "#release-email=";
  if (!location.hash.startsWith(KEY)) return "NO PAYLOAD: open the bridge page from outbox.mjs again, then run this script";
  const P = JSON.parse(decodeURIComponent(location.hash.slice(KEY.length)));
  history.replaceState(null, "", location.pathname + location.search);
  if (P.op !== "queue") return `WRONG SCRIPT: the payload is for ${P.op}`;

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
  const { outbox, record, outboxForm } = P.ids;
  const readEntry = (entry, names = Object.keys(outbox)) =>
    readFields(Object.fromEntries(names.map((n) => [n, outbox[n]])), "fieldData", `formEntry:"${entry}"`);
  const d = P.draft;

  const { user } = await gql("{ user { id super } }");
  if (!user) return "NOT SIGNED IN: ask the user to sign in on the page that is open in the browser, then open the bridge again";

  const { formRows } = await gql(`{ formRows(id:"${outboxForm}", recordId:"${record}", limit:50){ rows { topId } } }`);
  const unsent = [];
  for (const { topId } of formRows.rows) if (!(await readEntry(topId, ["sentAt"])).sentAt) unsent.push(topId);
  if (unsent.length) return `REFUSED (user ${user.id}): unsent entries exist (${unsent.join(", ")}). Reuse one with rewrite after the human confirms it is not signed, or have it deleted in the UI.`;

  const created = await gql(
    "mutation($formId:String!, $recordId:String!, $fv:JSON!){ createFormRow(formId:$formId, recordId:$recordId, fieldValues:$fv){ topId rowVersion } }",
    {
      formId: outboxForm,
      recordId: record,
      fv: { [outbox.subject]: d.subject, [outbox.emailHtml]: d.body, [outbox.emailText]: d.text, [outbox.payloadJson]: d.payloadJson },
    },
  );
  const entry = created.createFormRow.topId;

  const e = await readEntry(entry);
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
    `user ${user.id}: created entry ${entry}`,
    ...rows.map(([, line]) => line),
    ok ? `OK — entry ${entry} matches the draft` : `MISMATCH — do not test-send or sign entry ${entry}`,
  ].join("\n");
})();
