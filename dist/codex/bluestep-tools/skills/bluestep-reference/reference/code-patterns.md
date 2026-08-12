# Code Patterns

Common code patterns and examples for BlueStep.js development.

## Contents

- [Query Patterns](#query-patterns)
- [Merge Report Patterns](#merge-report-patterns)
- [Endpoint Patterns](#endpoint-patterns)
- [Error Handling Patterns](#error-handling-patterns)
- [Performance Patterns](#performance-patterns)
- [Component Import Pattern](#component-import-pattern)
- [Debugging Patterns](#debugging-patterns)

## Query Patterns

```typescript
// Simple query
B.queries.byFID['staffQuery'].query().forEach((record: Bluestep.Relate.Record) => {
  console.log(record.forms.nameForm.fields.firstName.opt().orElse(''));
});

// Query with filtering (Java collections have no .filter()/.map())
const results = [];
B.queries.byFID['staffQuery'].query().forEach((record: Bluestep.Relate.Record) => {
  const email = record.forms.contact.fields.email.opt().orElse('');
  if (email.endsWith('@company.com')) results.push(record);
});
```

The examples above run an ad-hoc query (read-only). For configured queries exposed as directly-iterable top-level variables (via the platform form-import config) and writable-context rules, see [api-patterns](api-patterns.md#query-access-patterns).

## Merge Report Patterns

Server code (`scripts/app.ts`) can access `B`; client code (`static/script.js`) runs in the browser and cannot. Bridge the two with `window` variables.

### Server-side setup

```typescript
// scripts/app.ts - renders the page container
const dashboardId = 'dashboard_123';
const isSuper = B.optUser.map(u => u.isGlobalSuper()).orElse(false);

const vars = `
  <script>
    window.dashboardId = '${dashboardId}';
    window.isSuper = ${isSuper};
    window.endpointUrl = '/b/apiEndpoint';
  </script>
`;
B.net.pageContent('vars').HEADER_SCRIPTS_BOTTOM().addContent(vars).insert();

B.out = '<div id="app-container">Loading...</div>';
```

### `B.net.pageContent()` placements

`B.net.pageContent(lookup)` injects content into a specific location of the page. Chain one placement method, then `.addContent(html)`, then `.insert()`.

- `.HEADER_SCRIPTS_BOTTOM()` — bottom of the scripts section in `<head>` (most common for variables)
- `.HEADER_SCRIPTS_TOP()` — top of the scripts section in `<head>`
- `.HEADER_CSS_BOTTOM()` / `.HEADER_CSS_TOP()` — CSS section in `<head>`
- `.HEADER_TOP()` / `.HEADER_BOTTOM()` — top/bottom of `<head>`
- `.PAGE_END()` — near the bottom of the page (default)

### Passing per-row data (queue / lazy-init pattern)

When a merge-report column renders per-row data, use a queue + lazy-init pattern rather than a `window` global. This avoids a timing race where `DOMContentLoaded` fires before the inline `<script>` from `B.out` has executed.

```typescript
// scripts/app.ts - push the value and trigger init if ready
const clientId = name.fields.sysId.val();
B.out = `<script>
  (window._myPending = window._myPending || []).push("${clientId}");
  if (window._myInit) window._myInit();
</script>`;

// static/script.ts - define _myInit and self-call at load time (no DOMContentLoaded)
function initWidget(clientId: string): void {
  const root = document.getElementById('my-root') as HTMLElement | null;
  if (!root) return;
  // ... render using clientId
}

(window as any)._myInit = function(): void {
  const pending: string[] = (window as any)._myPending || [];
  (window as any)._myPending = [];
  while (pending.length) initWidget(pending.shift()!);
};

(window as any)._myInit(); // drain anything queued before this script loaded
```

Use a **unique namespace per report** (e.g. `_dpnBreakdownPending`) so multiple reports on the same page don't collide.

### Client-side initialization

```typescript
// static/script.js - main application logic
(async function() {
  const dashboardId = window.dashboardId;
  const endpointUrl = window.endpointUrl;
  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'loadDashboard', dashboardId })
    });
    const data = await response.json();
    if (data.success) initializeApp(data.config);
    else console.error('Failed to load:', data.error);
  } catch (error) {
    console.error('Error initializing:', error);
  }
})();
```

## Endpoint Patterns

Endpoints receive the HTTP request via `B.net.request` and respond via `B.net.response`.

### Request handling

```typescript
const { request } = B.net;
const id = request.optParameter('id').orElse('');   // Java Optional
const name = request.parameter('name');              // string or null
const bodyStr = request.content();                   // request body as string (JSON POST)
const body = JSON.parse(bodyStr);
const method = request.method();                     // "GET", "POST", ...
const contentType = request.optHeader('Content-Type').orElse('');
const path = request.path();                         // e.g. "/b/myEndpoint"
const query = request.queryString();                 // e.g. "id=123&page=2"
const fullUrl = request.fullUrl();
```

### Response handling

```typescript
const { response } = B.net;
response.out(JSON.stringify({ success: true, data: results })); // most common
response.contentType('application/json');
response.status(200);
response.header('Cache-Control', 'no-cache');
response.sendRedirect('/b/otherEndpoint');
```

### Action-based router

```typescript
// scripts/app.ts
try {
  const { request, response } = B.net;
  const action = request.optParameter('action').orElse('');

  let body: any = {};
  try { body = JSON.parse(request.content()); } catch (e) { /* not JSON, use parameters */ }

  switch (action) {
    case 'getData': {
      const queryFid = body.queryFid || request.optParameter('queryFid').orElse('');
      response.out(JSON.stringify({ success: true, data: getQueryData(queryFid) }));
      break;
    }
    case 'updateRecord': {
      updateRecord(body.recordId, body.updates);
      response.out(JSON.stringify({ success: true }));
      break;
    }
    default:
      response.out(JSON.stringify({ success: false, error: `Unknown action: ${action}` }));
  }
} catch (error) {
  console.error('Error in endpoint:', error);
  B.net.response.out(JSON.stringify({ success: false, error: error.message || String(error) }));
}
```

## Error Handling Patterns

### Try-catch with user feedback (client-side)

SweetAlert2 v8.18.4 API (`type:`, `result.value`) — not v11. See [common-gotchas](../gotchas/common-gotchas.md#sweetalert2-version-differences).

```typescript
async function performAction() {
  try {
    const result = await apiCall();
    if (result.success) {
      Swal.fire({ type: 'success', title: 'Success', text: 'Operation completed successfully' });
    } else {
      throw new Error(result.error || 'Operation failed');
    }
  } catch (error) {
    console.error('Error performing action:', error);
    Swal.fire({ type: 'error', title: 'Error', text: error.message || 'An error occurred' });
  }
}
```

### Validation pattern

```typescript
function validateInput(data: any): { valid: boolean, error?: string } {
  if (!data.name || data.name.trim() === '') return { valid: false, error: 'Name is required' };
  if (!data.email || !data.email.includes('@')) return { valid: false, error: 'Valid email is required' };
  return { valid: true };
}
```

## Performance Patterns

### Caching query results (client-side)

```typescript
const dataCache = new Map();

async function getQueryData(queryFid: string, forceRefresh = false) {
  if (!forceRefresh && dataCache.has(queryFid)) return dataCache.get(queryFid);
  const response = await fetch(endpointUrl, {
    method: 'POST',
    body: JSON.stringify({ action: 'getQueryData', queryFid })
  });
  const result = await response.json();
  if (result.success) { dataCache.set(queryFid, result.data); return result.data; }
  throw new Error(result.error || 'Failed to load data');
}
```

### Batch processing

```typescript
function processBatch(records: any[], batchSize = 100) {
  const results = [];
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    batch.forEach(record => results.push(processRecord(record)));
  }
  return results;
}
```

## Component Import Pattern

```typescript
// objects/helpers.ts
export function formatDate(date: any): string { /* ... */ return formatted; }
export function formatCurrency(amount: number): string { /* ... */ return formatted; }

// scripts/app.ts
import { formatDate, formatCurrency } from './objects/helpers';
const formatted = formatDate(dateValue);
```

A file only executes if it is imported — see [file-execution](file-execution.md).

## Debugging Patterns

```typescript
// At top of file
const DEBUG = false; // set to true for verbose logging

if (DEBUG) console.log('Processing record:', recordId);
console.error('Failed to load data:', error); // always log errors
```
