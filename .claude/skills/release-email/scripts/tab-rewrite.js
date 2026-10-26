// Rewrites an unsent release-email outbox entry with the approved draft, then checks it
// Run only after the user approved the new draft and confirmed the entry is not signed, in a tab
// on the outbox org's site that `node outbox.mjs rewrite …` opened through its bridge page.
// Refuses a sent entry. Writes subject, emailHtml (the body), emailText and payloadJson — nothing
// else. Agents cannot delete rows, so a bad entry is fixed in place.
await (async () => {
  const KEY = "#release-email=";
  if (!location.hash.startsWith(KEY)) return "NO PAYLOAD: open the bridge page from outbox.mjs again, then run this script";
  const P = JSON.parse(decodeURIComponent(location.hash.slice(KEY.length)));
  history.replaceState(null, "", location.pathname + location.search);
  if (P.op !== "rewrite") return `WRONG SCRIPT: the payload is for ${P.op}`;

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
  const { outbox } = P.ids;
  const readEntry = (entry, names = Object.keys(outbox)) =>
    readFields(Object.fromEntries(names.map((n) => [n, outbox[n]])), "fieldData", `formEntry:"${entry}"`);
  const d = P.draft;
  const entry = P.entry;

  const { user } = await gql("{ user { id super } }");
  if (!user) return "NOT SIGNED IN: ask the user to sign in on the page that is open in the browser, then open the bridge again";

  const { sentAt } = await readEntry(entry, ["sentAt"]);
  if (sentAt) return `REFUSED (user ${user.id}): entry ${entry} was sent at ${sentAt}`;

  await gql("mutation($id:String!, $fv:JSON!){ updateFormRow(id:$id, fieldValues:$fv){ topId rowVersion } }", {
    id: entry,
    fv: { [outbox.subject]: d.subject, [outbox.emailHtml]: d.body, [outbox.emailText]: d.text, [outbox.payloadJson]: d.payloadJson },
  });

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
    `user ${user.id}: rewrote entry ${entry}`,
    ...rows.map(([, line]) => line),
    ok ? `OK — entry ${entry} matches the draft` : `MISMATCH — do not test-send or sign entry ${entry}`,
  ].join("\n");
})();
