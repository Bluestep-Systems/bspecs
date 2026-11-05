// A wrapper on window.fetch for live checks of a component's states: its error and read-only screens
// are seen without another user, by failing its reads and refusing its writes inside the page.
//
// Paste the whole file into the browser console on a BlueStep One page, once the app has
// loaded (a wrapper set before the host's own start is lost). It changes what the page's
// `/gql` calls get back and sends nothing it stops. Then use the rules below on `fw`:
//
//   fw.delay("ListRows", 8000)     hold a read 8 s, then send it (a loading screen)
//   fw.empty("ListRows")           send the read, answer it with every list emptied and every
//                                     totalSize 0 (an empty state); fw.empty(op, "data.x.items")
//                                     empties one list only
//   fw.fail("ListRows")            answer a read with the server's INTERNAL error, HTTP 500,
//                                     without sending it (an error state)
//   fw.refuse()                       answer every mutation with a FORBIDDEN refusal, HTTP 200,
//                                     without sending it; fw.refuse("UpdateItem") one mutation
//                                     only; a second argument replaces the server's words
//   fw.conflict()                     answer every mutation with a version conflict, HTTP 200,
//                                     without sending it, in the server's words and shape
//                                     (CONCURRENT_MODIFICATION with currentVersion);
//                                     fw.conflict("UpdateView", 7) one mutation, at version 7
//   fw.change("Settings", "data.formRows.items.*.fieldValues.lockFlag", false)
//                                     send the read, answer it with one value changed; `*` is
//                                     every item of a list; or fw.change(op, (json) => { ... })
//   fw.ops()                          the operation names seen since the paste, to pick from
//   fw.log                            every call the wrapper touched: time, operation, action
//   fw.clear()                        drop every rule, keep the wrapper
//   fw.restore()                      put the real fetch back (a reload does it too)
//
// An operation is matched by its name: `operationName` in the POST body, else the name after
// `query` or `mutation`. A rule set without a name (`fw.refuse()`, `fw.conflict()`) matches every
// mutation. Rules stay until cleared, so check `fw.rules` before each confirm. The host's own writes go through
// `/gql` too and are stopped with the rest by `fw.refuse()`; that is harmless.
(() => {
  if (window.fw && typeof window.fw.restore === "function") {
    window.fw.restore();
  }
  const realFetch = window.fetch;
  const INTERNAL = { errors: [{ message: "An unexpected server error occurred.", extensions: { classification: "INTERNAL" } }] };
  const RIGHTS_WORDS = "You do not have [Edit] privileges for this Relate Form.";
  const rules = [];
  const log = [];
  const seen = new Map();

  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  async function bodyText(input, init) {
    if (init && typeof init.body === "string") return init.body;
    if (input instanceof Request) return input.clone().text();
    return null;
  }

  function parse(text) {
    try {
      const body = JSON.parse(text);
      if (Array.isArray(body)) return null;
      const source = typeof body.query === "string" ? body.query : "";
      const head = /\b(query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(source);
      const kind = head ? head[1] : /^\s*mutation\b/.test(source) ? "mutation" : "query";
      const name = typeof body.operationName === "string" && body.operationName ? body.operationName : head ? head[2] : "(anonymous)";
      return { kind, name };
    } catch {
      return null;
    }
  }

  function variables(text) {
    try {
      const body = JSON.parse(text);
      return body && typeof body.variables === "object" && body.variables !== null ? body.variables : {};
    } catch {
      return {};
    }
  }

  // The first value under one of these keys, anywhere in the variables.
  function find(node, keys) {
    if (node === null || typeof node !== "object") return undefined;
    for (const key of keys) if (key in node && typeof node[key] !== "object") return node[key];
    for (const value of Object.values(node)) {
      const hit = find(value, keys);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  function matches(rule, op) {
    if (rule.op === null) return op.kind === "mutation";
    return rule.op === op.name;
  }

  // A dotted path, `*` for every item of a list. Calls `at(parent, key)` on every place it reaches.
  function walk(node, parts, at) {
    if (node === null || typeof node !== "object" || parts.length === 0) return;
    const [part, ...rest] = parts;
    const keys = part === "*" ? Object.keys(node) : [part];
    for (const key of keys) {
      if (!(key in node)) continue;
      if (rest.length === 0) at(node, key);
      else walk(node[key], rest, at);
    }
  }

  function emptyAll(node) {
    if (Array.isArray(node)) {
      node.length = 0;
      return;
    }
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        if (key === "totalSize" && typeof node[key] === "number") node[key] = 0;
        else emptyAll(node[key]);
      }
    }
  }

  async function edited(response, edit) {
    const body = await response.clone().json();
    const out = edit(body) ?? body;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(JSON.stringify(out), { status: response.status, statusText: response.statusText, headers });
  }

  async function wrapped(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = ((init && init.method) || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "POST" || !/\/gql$/.test(new URL(url, location.href).pathname)) {
      return realFetch(input, init);
    }
    const text = await bodyText(input, init);
    const op = text === null ? null : parse(text);
    if (!op) return realFetch(input, init);
    seen.set(op.name, op.kind);
    const rule = rules.find((r) => matches(r, op));
    if (!rule) return realFetch(input, init);
    const note = (action) => {
      log.push({ at: new Date().toISOString(), op: op.name, kind: op.kind, action });
      console.info(`[fw] ${op.kind} ${op.name}: ${action}`);
    };
    switch (rule.action) {
      case "delay":
        note(`held ${rule.ms} ms, then sent`);
        await new Promise((resolve) => setTimeout(resolve, rule.ms));
        return realFetch(input, init);
      case "fail":
        note("answered INTERNAL 500, not sent");
        return json(500, INTERNAL);
      case "refuse":
        note("answered FORBIDDEN, not sent");
        return json(200, { errors: [{ message: rule.words, extensions: { code: "FORBIDDEN", classification: "FORBIDDEN" } }] });
      case "conflict": {
        // The server names the entry and both versions; take them from the request when it has them.
        const vars = variables(text);
        const id = find(vars, ["id", "rowId", "entryId"]) ?? "<id>";
        const expected = find(vars, ["expectedVersion"]);
        const current = rule.version ?? (typeof expected === "number" ? expected + 1 : 1);
        note(`answered CONCURRENT_MODIFICATION at version ${current}, not sent`);
        return json(200, {
          data: null,
          errors: [{
            message: `${id} is at version ${current}, not the expected ${expected ?? 0}: it was modified since it was read. Re-read it and decide again.`,
            extensions: { code: "CONCURRENT_MODIFICATION", currentVersion: current, classification: "CONCURRENT_MODIFICATION" },
          }],
        });
      }
      case "empty":
        note(rule.path ? `sent, ${rule.path} emptied` : "sent, every list emptied");
        return edited(await realFetch(input, init), (body) => {
          if (!rule.path) emptyAll(body.data);
          else walk(body, rule.path.split("."), (parent, key) => {
            if (Array.isArray(parent[key])) parent[key].length = 0;
          });
        });
      case "change":
        note(typeof rule.edit === "function" ? "sent, answer changed by a function" : `sent, ${rule.path} = ${JSON.stringify(rule.value)}`);
        return edited(await realFetch(input, init), (body) => {
          if (typeof rule.edit === "function") return rule.edit(body);
          let hits = 0;
          walk(body, rule.path.split("."), (parent, key) => {
            parent[key] = rule.value;
            hits += 1;
          });
          if (hits === 0) console.warn(`[fw] ${op.name}: nothing at ${rule.path}; the answer went through unchanged`);
        });
      default:
        return realFetch(input, init);
    }
  }

  function add(rule) {
    const at = rules.findIndex((r) => r.op === rule.op && r.action === rule.action);
    if (at >= 0) rules.splice(at, 1);
    rules.push(rule);
    return api;
  }

  const api = {
    rules,
    log,
    delay: (op, ms = 8000) => add({ op, action: "delay", ms }),
    empty: (op, path) => add({ op, action: "empty", path: path ?? null }),
    fail: (op) => add({ op, action: "fail" }),
    refuse: (op = null, words = RIGHTS_WORDS) => add({ op, action: "refuse", words }),
    conflict: (op = null, version) => add({ op, action: "conflict", version: version ?? null }),
    change: (op, pathOrEdit, value) =>
      add(typeof pathOrEdit === "function" ? { op, action: "change", edit: pathOrEdit } : { op, action: "change", path: pathOrEdit, value }),
    ops: () => Object.fromEntries(seen),
    clear: () => {
      rules.length = 0;
      return api;
    },
    restore: () => {
      rules.length = 0;
      if (window.fetch === wrapped) window.fetch = realFetch;
      delete window.fw;
      console.info(`[fw] real fetch restored; ${log.length} call(s) touched`);
      return log;
    },
  };

  window.fetch = wrapped;
  window.fw = api;
  console.info("[fw] wrapper on; rules: fw.delay, fw.empty, fw.fail, fw.refuse, fw.conflict, fw.change; fw.restore() to undo");
  return "fw ready";
})();
