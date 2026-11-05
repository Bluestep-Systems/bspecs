// The UX probe of the build skill's UX check: what the served screen does while it opens,
// measured in the tab, as numbers `tools/ux-check.mjs` judges against the project's thresholds.
//
// Paste the whole file into the tab with `javascript_tool` (the desktop app's built-in browser
// pane, signed in, on the app shell after a full reload: `/`, which lands on the home page) before
// the page under check is opened, so the observers are in place from the first frame. Then:
//
//   uxc.open("#/page/<id>")         start a step and open that page (a hash route: the document
//                                   stays, the probe with it); a hash the tab already shows
//                                   opens nothing, so start from another page
//   uxc.start("<label>")            start a step at the next click or key press (open a
//                                   record, a tab, a card); uxc.start(label, { now: true })
//                                   starts it at once
//   await uxc.stop()                wait until the step is idle (no `/gql` call in flight and
//                                   `idleMs` with no DOM change or `/gql` call), or `maxMs`;
//                                   returns the step's numbers
//   uxc.names()                     scan the screen now for two focusable controls with the same
//                                   accessible name in one card or form section (uxc.names(root)
//                                   scans inside one element or selector; default `main`)
//   uxc.report()                    everything, compact (lists cut at 5): paste it into the
//                                   report file for ux-check.mjs
//   uxc.full()                      the same with every list whole; uxc.sink(4199) carries it
//                                   to probe-server.mjs's sink when it is too long for the tool
//   uxc.set({ idleMs, maxMs, skeleton })   change the waits or the skeleton selector
//
// Per step: time to first content (the first text added inside `main` that is not a skeleton),
// time to the last skeleton gone (`skeleton` selector; null with the count still showing at
// idle), the `/gql` POSTs until idle and their operations, cumulative layout shift from a
// PerformanceObserver on `layout-shift` (shifts within 500 ms of an input are left out, as the
// browser does), console errors with uncaught errors and rejections, and failed requests
// (status 400 and up, or a network error).
//
// A hidden pane paints no frame, so `layout-shift` entries never come (the probe checks for a
// frame when pasted: `frames`). It then samples positions after each DOM change instead and
// reports the shift the same way, marked `sampled`: a near miss there is not a pass. Show the
// pane (Ctrl+Shift+B in the app) and run again.
//
// The browser's HTTP cache cannot be emptied from a page. The reload before the paste empties the
// app's own state (its query results, the loaded components); the report says how many of the
// component's files came from the HTTP cache and which sha served them. A sha just published is
// new to the cache by construction.
(() => {
  if (window.uxc && typeof window.uxc.restore === "function") window.uxc.restore();

  const settings = { idleMs: 1500, maxMs: 30000, skeleton: '.animate-pulse, [aria-busy="true"]', cap: 5 };
  const steps = [];
  let current = null;
  let armed = null;
  let duplicates = null;
  let unnamed = null;
  let lastInputAt = -Infinity;
  const resources = { cached: 0, fetched: 0 };
  const served = {};
  const now = () => performance.now();
  const ms = (t) => Math.round(t);
  const scope = () => document.querySelector("main") || document.body;
  const text = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  const describe = (el) => {
    if (!el || !el.tagName) return String(el);
    const tag = el.tagName.toLowerCase();
    return `${tag}${el.id ? "#" + el.id : ""} ${text(el).slice(0, 40)}`.trim();
  };

  // Frames: a hidden pane runs no requestAnimationFrame, and no layout-shift entries come.
  let frames = null;
  {
    const started = now();
    const timer = setTimeout(() => { if (frames === null) frames = false; }, 1000);
    requestAnimationFrame(() => { if (now() - started < 1000) { frames = true; clearTimeout(timer); } });
  }

  // Inputs, for the 500 ms exclusion and for armed steps.
  const onInput = (e) => {
    lastInputAt = now();
    if (armed) { const label = armed; armed = null; begin(label); }
  };
  document.addEventListener("pointerdown", onInput, true);
  document.addEventListener("keydown", onInput, true);

  // Console errors and uncaught faults.
  const realError = console.error;
  const consoleErrors = (message) => { if (current) current.consoleErrors.push(String(message).slice(0, 160)); };
  console.error = (...args) => { consoleErrors(args.map((a) => (a && a.message) || a).join(" ")); return realError.apply(console, args); };
  const onError = (e) => consoleErrors(e.reason ? `unhandled rejection: ${e.reason.message || e.reason}` : e.message || "error");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);

  // `/gql` calls and failed requests, through fetch and XMLHttpRequest.
  const realFetch = window.fetch;
  const realOpen = XMLHttpRequest.prototype.open;
  const realSend = XMLHttpRequest.prototype.send;
  const isGql = (url) => { try { return new URL(String(url), location.href).pathname === "/gql"; } catch { return false; } };
  const opName = (body) => {
    try {
      const json = JSON.parse(body);
      const source = typeof json.query === "string" ? json.query : "";
      const head = /\b(query|mutation)\s+([A-Za-z_]\w*)/.exec(source);
      if (typeof json.operationName === "string" && json.operationName) return json.operationName;
      if (head) return head[2];
      const field = /\{\s*([A-Za-z_]\w*)/.exec(source);
      return field ? `{ ${field[1]} }` : "(anonymous)";
    } catch { return "(unreadable)"; }
  };
  const requestStart = (method, url, body) => {
    if (!current) return null;
    const gql = isGql(url) && String(method).toUpperCase() === "POST";
    if (gql) {
      current.inflight++;
      current.gqlPosts++;
      const op = opName(body);
      current.gqlOps[op] = (current.gqlOps[op] || 0) + 1;
    }
    current.lastActivity = now();
    return { gql, step: current, method: String(method).toUpperCase(), url: String(url) };
  };
  const requestEnd = (entry, status, failed) => {
    if (!entry) return;
    if (entry.gql) entry.step.inflight--;
    entry.step.lastActivity = now();
    const short = entry.url.replace(location.origin, "");
    if (failed || status >= 400) entry.step.failed.push(`${entry.method} ${short} → ${failed ? "network error" : status}`);
  };
  window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : input;
    const method = (init && init.method) || (input instanceof Request ? input.method : "GET");
    const body = init && typeof init.body === "string" ? init.body : null;
    const entry = requestStart(method, url, body);
    try {
      const res = await realFetch.apply(this, arguments);
      requestEnd(entry, res.status, false);
      return res;
    } catch (e) {
      requestEnd(entry, 0, true);
      throw e;
    }
  };
  XMLHttpRequest.prototype.open = function (method, url) { this.__uxc = { method, url }; return realOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    const entry = requestStart(this.__uxc?.method, this.__uxc?.url, typeof body === "string" ? body : null);
    this.addEventListener("loadend", () => requestEnd(entry, this.status, this.status === 0), { once: true });
    return realSend.apply(this, arguments);
  };

  // Resources: the component's files, from the cache or fetched, and the sha that served them.
  const resourceObserver = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const m = /\/component\/([^/]+)\/([0-9a-f]{7,40})\//.exec(e.name);
      if (!m) continue;
      served[m[1]] = m[2];
      if (e.transferSize === 0 && e.decodedBodySize > 0) resources.cached++;
      else resources.fetched++;
    }
  });
  resourceObserver.observe({ type: "resource", buffered: true });

  // Layout shift from the browser, when frames run.
  const shiftObserver = new PerformanceObserver((list) => {
    if (!current || frames === false) return;
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      addShift(e.startTime - current.t0, e.value, (e.sources || []).map((s) => describe(s.node)).filter(Boolean));
    }
  });
  shiftObserver.observe({ type: "layout-shift" });

  function addShift(atMs, value, nodes) {
    if (!current || atMs < 0) return;
    current.cls += value;
    current.shifts.push({ atMs: ms(atMs), value: Math.round(value * 1000) / 1000, nodes: nodes.slice(0, 3) });
  }

  // Sampled layout shift, for a pane that paints no frame: the start position of every leaf box
  // inside the scope, compared after each DOM change; impact = the viewport fraction the moved
  // boxes cover (old and new place, on a 10 px grid), distance = the largest move over the longer
  // viewport side, as the browser's metric is defined.
  let tracked = new Map();
  const leafBoxes = () => {
    const root = scope();
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = root; el; el = walker.nextNode()) {
      if (out.length > 4000) break;
      if (el.children.length > 0 && ![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      out.push([el, r.left, r.top, r.width, r.height]);
    }
    return out;
  };
  function sample() {
    const boxes = leafBoxes();
    if (current && !(now() - lastInputAt < 500)) {
      const grid = new Set();
      let maxMove = 0;
      const moved = [];
      for (const [el, left, top, width, height] of boxes) {
        const old = tracked.get(el);
        if (!old) continue;
        const move = Math.max(Math.abs(left - old[0]), Math.abs(top - old[1]));
        if (move < 1) continue;
        maxMove = Math.max(maxMove, move);
        moved.push(el);
        for (const [x, y] of [[old[0], old[1]], [left, top]]) {
          const x0 = Math.max(0, Math.floor(x / 10)), x1 = Math.min(Math.ceil(innerWidth / 10), Math.ceil((x + width) / 10));
          const y0 = Math.max(0, Math.floor(y / 10)), y1 = Math.min(Math.ceil(innerHeight / 10), Math.ceil((y + height) / 10));
          for (let gx = x0; gx < x1; gx++) for (let gy = y0; gy < y1; gy++) grid.add(gx * 1000 + gy);
        }
      }
      if (moved.length > 0) {
        const impact = grid.size / (Math.ceil(innerWidth / 10) * Math.ceil(innerHeight / 10));
        const distance = maxMove / Math.max(innerWidth, innerHeight);
        addShift(now() - current.t0, impact * distance, moved.map(describe));
      }
    }
    tracked = new Map(boxes.map(([el, left, top]) => [el, [left, top]]));
  }
  let sampleTimer = null;
  const scheduleSample = () => { if (frames === false && !sampleTimer) sampleTimer = setTimeout(() => { sampleTimer = null; sample(); }, 100); };

  // DOM changes: first content, the skeletons, and activity for the idle wait.
  const isSkeleton = (el) => el.matches && (el.matches(settings.skeleton) || !!el.closest(settings.skeleton));
  const countSkeletons = () => scope().querySelectorAll(settings.skeleton).length;
  const noteSkeletons = () => {
    if (!current) return;
    const count = countSkeletons();
    current.skeletonsSeen = Math.max(current.skeletonsSeen, count);
    if (count === 0 && current.skeletonsLast > 0) current.lastSkeletonMs = ms(now() - current.t0);
    current.skeletonsLast = count;
  };
  const mutations = new MutationObserver((records) => {
    if (!current) return;
    const root = scope();
    if (records.some((r) => root.contains(r.target))) current.lastActivity = now();
    if (current.firstContentMs === null) {
      outer: for (const r of records) {
        const nodes = r.type === "characterData" ? [r.target] : [...r.addedNodes];
        for (const n of nodes) {
          const el = n.nodeType === 3 ? n.parentElement : n;
          if (!el || !root.contains(el) || isSkeleton(el)) continue;
          if ((n.textContent || "").trim() && el.getClientRects().length > 0) { current.firstContentMs = ms(now() - current.t0); break outer; }
        }
      }
    }
    noteSkeletons();
    scheduleSample();
  });
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true });

  function begin(label) {
    if (current) finish(true);
    current = {
      label, t0: now(), lastActivity: now(), inflight: 0,
      firstContentMs: null, lastSkeletonMs: null, skeletonsSeen: 0, skeletonsLast: 0, skeletonsAtIdle: null,
      gqlPosts: 0, gqlOps: {}, cls: 0, shifts: [], consoleErrors: [], failed: [], idleAtMs: null, timedOut: false,
    };
    if (frames === false) sample();
    noteSkeletons();
  }
  function finish(timedOut) {
    const step = current;
    if (!step) return null;
    step.skeletonsAtIdle = countSkeletons();
    step.idleAtMs = ms(now() - step.t0);
    step.timedOut = timedOut;
    step.cls = Math.round(step.cls * 1000) / 1000;
    step.clsSource = frames === false ? "sampled" : "layout-shift";
    steps.push(step);
    current = null;
    return step;
  }
  const stepOut = (step, cap) => {
    const cut = (list) => (cap ? list.slice(0, cap) : list);
    const ops = Object.entries(step.gqlOps).sort((a, b) => b[1] - a[1]);
    return {
      label: step.label, firstContentMs: step.firstContentMs, lastSkeletonMs: step.lastSkeletonMs,
      skeletonsSeen: step.skeletonsSeen, skeletonsAtIdle: step.skeletonsAtIdle, gqlPosts: step.gqlPosts,
      gqlOps: cut(ops), cls: step.cls, clsSource: step.clsSource,
      shifts: cut([...step.shifts].sort((a, b) => b.value - a.value)).map((s) => [s.atMs, s.value, ...s.nodes.slice(0, cap ? 2 : 3)]),
      consoleErrors: cut(step.consoleErrors), failed: cut(step.failed), idleAtMs: step.idleAtMs, timedOut: step.timedOut,
    };
  };

  // Accessible names: enough of the accname algorithm for buttons, links, tabs and fields.
  const visible = (el) => el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"]');
  const textOf = (el) => {
    if (!el) return "";
    if (el.nodeType === 3) return el.data;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return "";
    if (el.tagName === "IMG") return el.getAttribute("alt") || "";
    if (el.tagName === "svg" || el.tagName === "SVG") { const t = el.querySelector("title"); return el.getAttribute("aria-label") || (t && t.textContent) || ""; }
    if (el.getAttribute && el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    return [...el.childNodes].map(textOf).join(" ");
  };
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  function accessibleName(el) {
    const by = el.getAttribute("aria-labelledby");
    if (by) { const n = clean(by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(" ")); if (n) return n; }
    const label = el.getAttribute("aria-label");
    if (label && clean(label)) return clean(label);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      if (el.type === "submit" || el.type === "button" || el.type === "reset") { if (clean(el.value)) return clean(el.value); }
      const labels = el.labels ? [...el.labels] : [];
      const n = clean(labels.map(textOf).join(" "));
      if (n) return n;
      return clean(el.getAttribute("placeholder") || el.getAttribute("title"));
    }
    const own = clean(textOf(el));
    return own || clean(el.getAttribute("title"));
  }
  const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"]';
  // A control's place: its card (the kit's Card, or anything named one) when it is in one, else its
  // nearest form section, else the root. Two cards may repeat a name; one card may not.
  const CARD = '[data-slot="card"], .bg-card, [class*="card" i]';
  const SECTION = 'form, fieldset, section, article, [role="group"], [role="region"], [role="dialog"], [role="tabpanel"]';
  const sectionOf = (el, root) => { const p = el.parentElement; return (p && (p.closest(CARD) || p.closest(SECTION))) || root; };
  // The section as the report names it: tag, id or role, and its title (aria-label, the element
  // it is labelled by, or its first heading or legend); then its number among the sections seen.
  const sectionName = (sec, nth) => {
    const by = sec.getAttribute("aria-labelledby");
    const heading = sec.querySelector("h1, h2, h3, h4, h5, h6, legend, [data-slot='card-title']");
    const title = clean(sec.getAttribute("aria-label") || (by && by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(" ")) || (heading && textOf(heading)) || "");
    const tag = sec.tagName.toLowerCase() + (sec.id ? "#" + sec.id : sec.getAttribute("role") ? `[${sec.getAttribute("role")}]` : "");
    return `${tag}${title ? " " + JSON.stringify(title.slice(0, 40)) : ""} (section ${nth})`;
  };
  window.uxc = {
    set(changes) { Object.assign(settings, changes); return { ...settings }; },
    open(hash) {
      if (!hash || !hash.startsWith("#")) throw new Error("uxc.open: a hash route, like #/page/<id>");
      if (location.hash === hash) throw new Error("uxc.open: the tab already shows that page; start from another one");
      begin(hash);
      location.hash = hash;
      return `started ${hash}${frames === false ? " (no frames: the pane is hidden, layout shift will be sampled)" : ""}`;
    },
    start(label, { now: atOnce = false } = {}) {
      if (atOnce) { begin(label || "step"); return `started ${label}`; }
      armed = label || "step";
      return `armed: the step starts at the next click or key press`;
    },
    stop() {
      return new Promise((resolve) => {
        if (!current) return resolve(armed ? "armed, nothing started yet" : "no step running");
        const step = current;
        const tick = () => {
          if (current !== step) return resolve("replaced by another step");
          const quiet = now() - step.lastActivity >= settings.idleMs;
          if (step.inflight <= 0 && quiet) return resolve(stepOut(finish(false), settings.cap));
          if (now() - step.t0 >= settings.maxMs) return resolve(stepOut(finish(true), settings.cap));
          setTimeout(tick, 100);
        };
        tick();
      });
    },
    names(root) {
      const base = typeof root === "string" ? document.querySelector(root) : root || scope();
      if (!base) throw new Error(`uxc.names: nothing matches ${root}`);
      const groups = new Map();
      const sections = new Map();
      let blank = 0;
      for (const el of base.querySelectorAll(CONTROLS)) {
        if (!visible(el) || el.disabled || el.getAttribute("aria-disabled") === "true") continue;
        const name = accessibleName(el);
        if (!name) { blank++; continue; }
        const role = el.getAttribute("role") || el.tagName.toLowerCase();
        const sec = sectionOf(el, base);
        if (!sections.has(sec)) sections.set(sec, sections.size + 1);
        const key = `${sections.get(sec)}\u0000${role}\u0000${name.toLowerCase()}`;
        groups.set(key, { sec, role, name, count: ((groups.get(key) || {}).count || 0) + 1 });
      }
      duplicates = [...groups.values()].filter((g) => g.count > 1).map((g) => ({ name: g.name, role: g.role, count: g.count, in: sectionName(g.sec, sections.get(g.sec)) }));
      unnamed = blank;
      return { duplicates, unnamed };
    },
    report(cap = settings.cap) {
      const cut = (list) => (cap && list ? list.slice(0, cap) : list);
      return JSON.stringify({
        page: location.hash, at: new Date().toISOString(), frames, viewport: `${innerWidth}x${innerHeight}`,
        served, resources, steps: steps.map((s) => stepOut(s, cap)),
        duplicates: cut(duplicates), unnamed,
      });
    },
    full() { return this.report(0); },
    sink(port = 4199) { location.href = `http://127.0.0.1:${port}/sink.html#ux-check=${encodeURIComponent(this.full())}`; },
    restore() {
      window.fetch = realFetch;
      XMLHttpRequest.prototype.open = realOpen;
      XMLHttpRequest.prototype.send = realSend;
      console.error = realError;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
      document.removeEventListener("pointerdown", onInput, true);
      document.removeEventListener("keydown", onInput, true);
      mutations.disconnect();
      shiftObserver.disconnect();
      resourceObserver.disconnect();
      delete window.uxc;
    },
  };
  return "uxc ready: uxc.open(hash) | uxc.start(label) | await uxc.stop() | uxc.names() | uxc.report()";
})();
