---
description: Deep technical reference for BsJs (BlueStep TypeScript). Read when writing or modifying component code.
applyTo: "**/draft/scripts/**/*.ts"
---

# BsJs Development Reference

Deep reference for BlueStep TypeScript development. Critical rules live in `AGENTS.md`; this file covers patterns, APIs, and conventions that apply when actually writing code.

## Contents

- [Module structure](#module-structure)
- [The `B` object — core namespaces](#the-b-object--core-namespaces)
- [Reading and writing fields](#reading-and-writing-fields)
- [Patterns by script type](#patterns-by-script-type)
- [`info/` configuration](#info-configuration)
- [TypeScript configuration & Graal compatibility](#typescript-configuration--graal-compatibility)
- [Imports — never fabricate](#imports--never-fabricate)
- [TS narrowing pitfalls (Graal/Java types)](#ts-narrowing-pitfalls-graaljava-types)
- [Error handling](#error-handling)

## Module structure

```
<project-root>/
└── U######/                       ← Unit folder, created by `b6p pull`
    └── ComponentName/
        ├── declarations/          ← platform-generated, DO NOT EDIT
        │   ├── B.d.ts
        │   ├── scriptlibrary.d.ts
        │   ├── Globals.d.ts
        │   └── index.d.ts         ← platform-generated field/query/form declarations
        └── draft/
            ├── scripts/           ← TypeScript source
            │   ├── app.ts         ← entry point
            │   └── <feature>.ts   ← split modules
            ├── objects/
            │   └── imports.ts     ← legacy artifact in older modules; not updated on pull
            ├── static/            ← MergeReport only: HTML, CSS, client JS
            └── info/
                ├── config.json
                ├── metadata.json  ← identifies component type (read to know what this is)
                └── permissions.json
```

A project may contain multiple Unit folders, each with multiple components of varying types. **Module split convention:** split complex logic into focused files under `scripts/`. `app.ts` is the entry point.

**Multi-file components with ES imports are supported** (verified on the platform — `SMS Data Diagnostics`, `app.ts` importing `cleanupDuplicates.ts`). A sibling file `export`s a symbol and `app.ts` pulls it in with a standard relative ES import (no file extension); it links correctly on the platform (compiled at publish/snapshot). Use this to split a large `app.ts` into focused modules:

```typescript
// scripts/cleanupDuplicates.ts
export function cleanupDuplicates(): void { /* ... */ }

// scripts/app.ts
import { cleanupDuplicates } from "./cleanupDuplicates";
```

## The `B` object — core namespaces

`B` exposes 25 members; the ones below are the most used. For anything else — `B.db`, `B.io`,
`B.util`, `B.crypto`, `B.mail`, `B.find`, `B.org` among them — read the component's own
`declarations/B.d.ts`.

### `B.net` — outbound HTTP

```typescript
const response = B.net.fetch("https://api.example.com/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" }),
  timeout: 30000,
});

if (response.ok) {
  const data = JSON.parse(response.body);
}
```

### `B.ai` — model access

Model access runs inside the platform and bills to the tenant: a call needs only a prompt, with
provider, model, and credentials coming from tenant configuration. Synchronous, like the rest of the
surface.

```typescript
const res = B.ai.call({
  flag: "my-component-purpose",
  systemPrompt: "You write a one-line summary. Output only the summary.",
  message: text,
});
```

Agents, typed tools that fill Relate form entries, spend budgets, audio input, and AI write
provenance: [reference/ai-services.md](reference/ai-services.md).

### `B.time` — date/time

Use `B.time` for any date/time work. Native `Date` is not supported.

```typescript
const now = B.time.now();
const formatted = B.time.format(now, "yyyy-MM-dd HH:mm:ss");
const parsed = B.time.parse("2026-05-15", "yyyy-MM-dd");
```

#### Dates: reading, writing, and shipping to a browser

Three silent-failure facts — wrong output, not an error:

- **Writing a date/datetime field BY STRING accepts `M/D/YYYY h:mmAM`; an ISO 8601 string is
  rejected by a validation regex.** The `B.time.parse("2026-05-15", …)` example above primes
  exactly the wrong instinct — parse formats and string-write formats are different things. The
  verified accepted form is non-padded month/day/hour, no seconds, no space before the meridiem
  (e.g. `7/30/2026 2:05PM`); padded or seconds-bearing variants are unconfirmed. Scope this
  correctly: string writes are a **different path** from the typed `.val(zonedDateTime)` setter
  and the `.dateTimeVal(isoString)` overload (`reference/datetime-field-write.md` — those are not
  subject to this regex), and also a different path from `addSearch` query values
  (`conventions/date-format.md`).
- **Raw serialized date values use a 0-indexed month** — `6` = July in stored/serialized form
  (e.g. the XMLEncoder `xml` blobs `formRows` returns; see
  `reference/mcp-read-multi-entry-forms.md`). This does **not** apply to `B.time`/`java.time`
  values — `getMonthValue()` is 1-indexed (`reference/chronounit-months.md`). A one-month misread
  survives review; know which surface you're reading.
- **`ZonedDateTime.toString()` is NOT valid ISO 8601** — it appends the zone id in brackets
  (`2026-07-30T12:00:00-06:00[US/Mountain]`), and a browser `new Date(...)` on that returns
  `Invalid Date`. Rule: **emit `.toInstant().toString()` for any browser consumer.** The
  server-side value looks correct in a log; the failure only surfaces in the browser. (Zone
  handling: `reference/user-zone-id.md`.)

### `B.queries` — query objects

Queries are defined on the platform and exposed in `declarations/index.d.ts` (platform-generated). Reference them only after pulling.

```typescript
const results = B.queries.activeClients.execute();
for (const record of results) {
  // ...
}
```

That `B.queries.X` shape is what a **named-query import** produces. A **query-group import** — the query (or MEFR) wired into the script as a query group, e.g. via the MCP `add_queries` with a `groupId`, or the UI's query-group import — binds a **bare global const named after the group variable** instead, not `B.queries.X`:

```typescript
// declarations/index.d.ts shows: declare const projectTracker: RecordQuery_projectTracker
const rows = projectTracker.execute();
for (const record of rows) {
  // ...
}
```

The import style selects the binding, so check `declarations/index.d.ts` to see which one your script actually has — a `declare const <group>: RecordQuery_<group>` line means the bare-const shape. Identifiers come from declarations, never guessed. A query imported as a group has **no** `B.queries.<name>` entry: reaching for one returns `undefined` at runtime. (`reference/import-scope.md` covers import *scoping* — current-record vs named-query; this paragraph covers the resulting *binding shape*.)

**Unit scoping:** queries are unit-scoped by default. When re-using a query across units, call `clearSearchAndSort()` to reset filters:

```typescript
const query = B.queries.allRecords;
query.execute();             // current unit
query.clearSearchAndSort();
query.unit = otherUnit;
query.execute();             // other unit
```

### `B.exports` — cross-formula data

Used to pass data between formulas in the same execution context.

```typescript
B.exports.totalScore = computeScore();
B.clearExports();            // when starting fresh
```

### `B.user` — current user

`B.user` is **null** in scheduled / cron scripts. Always guard:

```typescript
if (B.user) {
  const userId = B.user.id;
}
```

### `B.commit()` — manual transaction commit

The platform calls `B.commit()` automatically when the script finishes. Only call it manually when:

- You need a newly created entry's ID before the script ends.
- You need post-saves to fire before subsequent reads.

```typescript
const newEntry = B.queries.someForm.getNewEntry();
newEntry.name.set("test");
B.commit();
const id = newEntry.id;      // now available
```

## Reading and writing fields

### Read

```typescript
const value = entry.fieldName.val();                          // current value
const exportValue = entry.statusField.selectedExportValue();  // dropdown export value
const all = entry.tagsField.allValues();                       // multi-select
```

`.val()` returns the field's value typed loosely (often `any`). When a field may be empty, prefer the Java-optional accessor with a default instead of null-checking the raw value:

```typescript
const name = entry.nameField.opt().orElse("");   // string, never null
const score = entry.scoreField.opt().orElse(0);
```

Because projects compile with `strict: false` (see "TypeScript configuration & Graal compatibility"), `.opt().orElse()` plus explicit annotations are the main defense against silent `null`/`undefined` bugs.

### Write

Do not call `.writable()`. Field writability is configured on the platform — if the field is not configured as writable for this script type, the write will throw at runtime. Write directly:

```typescript
entry.nameField.set("new value");
entry.statusField.setByExportValue("active");
entry.tagsField.add("priority");
entry.tagsField.remove("legacy");
```

### Multi-entry forms

```typescript
for (const entry of record.someForm.allEntries) {
  entry.field.set("value");
}

const newEntry = record.someForm.getNewEntry();
newEntry.name.set("new");

oldEntry.delete();
```

## Patterns by script type

### Post-Save

Runs after a record is saved. Use `justCreated()` to distinguish new vs. updated records. `curEntry` is the entry being saved.

```typescript
export function run(): void {
  if (curEntry.justCreated()) {
    sendWelcomeEmail();
  } else {
    syncToExternal();
  }
}
```

### Endpoint

Receives an HTTP request, returns a response. Everything hangs off **`B.net.request`** and
**`B.net.response`** — there is no bare `request`/`response` global; the HTTP objects hang off
`B.net`. (Wired imports can bind other globals — e.g. a query group's bare const, see `B.queries`
above — but the HTTP surface is only ever reached through `B.net`.)
Every member is a **method**: there are no settable properties, and the setters are **fluent**
(`status(400).contentType("text/plain")`). **Set `contentType` before writing the body. Use exactly
one output method per request** (`out`, `stream`, or `redirect`). The output-channel rules — `B.out`
vs `response.out()`, and why `status()`/`contentType()` belong in try/catch (they throw
`IllegalStateException` once the response is committed) — live in
`reference/endpoint-output-channel.md`; `request.method()` is a call, not a property
(`reference/endpoint-method-call.md`).

```typescript
export function run(): void {
  const action = B.net.request.optParameter("action").orElse("");
  switch (action) {
    case "list":  return listAll();
    case "get":   return getOne();
    default:      return badRequest();
  }
}

function listAll(): void {
  B.net.response.contentType("application/json; charset=UTF-8");
  B.net.response.out(JSON.stringify({ items: getItems() }));
}

function badRequest(): void {
  // fluent — methods, not properties. Safe here (nothing written yet); once output may have
  // started, wrap status()/contentType() in try/catch — see endpoint-output-channel.md.
  B.net.response.status(400).contentType("text/plain");
  B.net.response.out("Unknown action");
}
```

#### Streaming (large responses)

NDJSON pattern for streaming large datasets. `stream()` **takes a callback and returns void** — it
never returns a writable (`binaryStream(...)` has the same callback shape):

```typescript
B.net.response.contentType("application/x-ndjson");
B.net.response.stream(out => {
  for (const record of B.queries.largeQuery.execute()) {
    out.write(JSON.stringify({ id: record.id, name: record.name.val() }) + "\n");
  }
});
```

#### Redirect

```typescript
B.net.response.sendRedirect("/some/path");
```

Use `sendRedirect()` in endpoints — `redirect()` also exists but the platform's own docs say it
"may or may not work consistently" in an endpoint and point at `sendRedirect()` instead.

### MergeReport

Backend logic in `scripts/`; **frontend in `static/`** (R3). Inject content into pages via `pageContent()`:

```typescript
export function run(): void {
  pageContent("main").write(renderMain());
  HEADER_SCRIPTS_BOTTOM().write(`<script src="${staticUrl("client.js")}"></script>`);
  BODY().write(`<div class="footer">...</div>`);
}
```

### OnDemand / Field Formula

OnDemand formulas run on the **task pod** — well-suited for heavy or long-running work because they keep load off production pods. Trigger them asynchronously and let the result land in a record the caller can poll or react to.

**Critical latency caveat:** OnDemand has a ~5 second scheduler-queue delay before it starts, by design. This is fine for background / async work. It is the wrong tool for anything on a user's synchronous wait path — if a user is waiting for a response, an OnDemand hop adds ~5 s of irreducible latency before the work even begins. Prefer a synchronous task-pod **Endpoint** for user-facing create or update paths.

**How an OnDemand is triggered:** in RelateScript, `runFormula("name")` / `System.runFormula("name")` — the **named** form — IS the trigger: calling it dispatches the named OnDemand formula to the task pod, detached from the current save transaction (and subject to the ~5 s queue delay above). Confirmed by the platform team. The call never executes the target inline/synchronously within the save, so there is nothing to "make async" on the caller's side — do not caution users about it. (The **no-arg** `runFormula()` is a different thing entirely — the synchronous field-formula form below.)

```typescript
export function run(): void {
  const result = runFormula();
  B.message.info(`Result: ${result}`);
}
```

**Two distinct uses of `runFormula` — don't conflate them (and neither is the named
RelateScript trigger above):**

- **No-arg, in a field formula** (the example above): `const result = runFormula()` returns the
  computed value synchronously — it computes this field's own value, it dispatches nothing.
- **Invoke ANOTHER on-demand formula with a payload** — from a `FormEntry`, `runFormula(fid)`
  returns a **`FormulaScheduler`** builder:

  ```typescript
  cur.runFormula("<formula-fid>")
    .message(JSON.stringify({ recordId: cur.id().toString(), action: "recalc" }))
    .start();
  ```

  `.message(str)` attaches the payload the invoked formula reads on its side as its `message`
  variable; `.start()` enqueues it on the task pod (subject to the ~5 s scheduler delay above).
  The builder also has `.schedule()` and `.expireBy()` (see `FormulaScheduler` in
  `declarations/B.d.ts`). This is the core mechanic of a trigger → async-builder multi-formula
  pipeline. How the target formula acquires the name that resolves it:
  [reference/fid-alternate-identifier.md](reference/fid-alternate-identifier.md).

### Scheduled / cron

`B.user` is null. Use stored credentials or hardcoded service identities, and guard accordingly.

```typescript
export function run(): void {
  if (B.user) {
    log.warn("Scheduled script should not have a user context");
    return;
  }
  doScheduledWork();
}
```

### WebSocket push

```typescript
B.io.sendMessage(channelId, JSON.stringify({ type: "update", payload: data }));
```

## `info/` configuration

### `config.json` (required)

```json
{
  "language": "BsJs",
  "entryPoint": "scripts/app.ts"
}
```

### `metadata.json`

Identifies the component type. Examples:

- `"triggerType": "POST_SAVE"` — post-save
- `"triggerType": "ENDPOINT"` — endpoint
- `"triggerType": "ON_DEMAND"` — on-demand
- `"triggerType": "SCHEDULED"` — scheduled

### `permissions.json`

Defines who can execute / view this component. Managed on the platform; usually pulled, rarely hand-edited.

## TypeScript configuration & Graal compatibility

### tsconfig and strict mode

Each project root has a `tsconfig.json`. BlueStep projects run with **`strict: false`**, so the compiler will *not* catch every null/type error — compensate with `.opt().orElse()` and explicit type annotations. Typical settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": false,
    "moduleResolution": "node",
    "types": ["./declarations"]
  }
}
```

Do not run `tsc` locally (a hook blocks it). Compilation happens only at **publish/snapshot** (`b6p push --snapshot`) — a **plain push skips the TypeScript build entirely**, so pushing without a snapshot means the code has been compiled nowhere.

### Graal compatibility (server-side)

Server-side BsJs runs on **GraalVM**, not Node. Avoid relying on the newest language features there:

- Stage-3 / very new ECMAScript proposals
- Newer `Intl` APIs
- `WeakRef` and `FinalizationRegistry` (limited support)

Server-side `B.net.fetch` is **synchronous** — no `await`/Promise round-trip (see "`B.net` — outbound HTTP"). The `async`/`await` and browser `fetch().json()` patterns apply only to client JS shipped in a MergeReport's `static/`, which runs in the browser under normal compatibility rules.

## Imports — never fabricate

Query, form, and field references must exist in **the component you are editing**'s `declarations/index.d.ts` **before** you reference them in code. Form-field imports are per-component — another component's declarations file tells you nothing about this one. If a name is missing:

1. Add it to **this component's** form-import config on the platform.
2. Run `b6p pull "<DAV URL>"` to update this component's declarations.
3. Then reference it in TypeScript.

Hallucinating an import name is **not** caught at publish either: the push transpile runs without `declarations/`, so the fabricated name just joins the benign `Cannot find name` noise and the broken code ships. Verify every name against `declarations/index.d.ts` before using it — that check is the only gate.

## TS narrowing pitfalls (Graal/Java types)

Some TypeScript patterns fail silently with the Java types exposed by `B` (especially `Java.Time.Instant`, `Java.Time.ZonedDateTime`, and any `Optional`-like interface). Avoiding them upfront saves edit → diagnostic → fix cycles.

### Narrowing broken in closures

**Anti-pattern:**

```typescript
let latest: Java.Time.Instant | null = null;
collection.forEach((item) => {
  const inst = item.getInstant();
  if (!latest || inst.isAfter(latest)) {  // ❌ TS narrowing collapses to `never`
    latest = inst;
  }
});
```

TypeScript cannot guarantee that the captured variable is still non-null when the next line of the callback executes, so it collapses the type to `never` and `.isAfter()` stops existing.

**Solutions, in order of preference:**

1. **Compare primitive values** (best): avoid the nullable union entirely by using epoch millis, ISO strings, or a sentinel value.

   ```typescript
   let latestMs = -1;
   collection.forEach((item) => {
     const ms = item.getInstant().toEpochMilli();
     if (ms > latestMs) latestMs = ms;
   });
   ```

2. **Local alias with explicit type** (when the Java type must be kept): capture the variable in a `const` with the declared type before the comparison, forcing TS to re-narrow within the local scope.

   ```typescript
   let latest: Java.Time.Instant | null = null;
   collection.forEach((item) => {
     const inst = item.getInstant();
     const prev: Java.Time.Instant | null = latest;  // explicit alias
     if (prev === null || inst.isAfter(prev)) {
       latest = inst;
     }
   });
   ```

3. **Accumulate then reduce**: when the above feels forced, `forEach` into an array and sort/reduce outside the loop.

### Symptoms to recognize

- `Property '<x>' does not exist on type 'never'.` inside a callback that captures a nullable `let`: 99% of the time this is this pitfall.
- "Works the first time but breaks after refactoring to multi-step": suspect broken narrowing.

## Error handling

The platform surfaces uncaught exceptions in the script log. Patterns:

```typescript
try {
  const response = B.net.fetch(url, { timeout: 5000 });
  if (!response.ok) {
    log.error(`Upstream returned ${response.status}`);
    return;
  }
  process(response.body);
} catch (err) {
  log.error(`Fetch failed: ${err.message}`);
}
```

For endpoints, prefer explicit status codes over throwing:

```typescript
if (!validInput) {
  B.net.response.status(400).contentType("application/json; charset=UTF-8");
  B.net.response.out(JSON.stringify({ error: "invalid input" }));
  return;
}
```
