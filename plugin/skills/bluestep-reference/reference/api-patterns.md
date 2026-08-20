# API Patterns

> **Note**: for the complete API reference, see `declarations/B.d.ts`. This file contains usage patterns and examples, not API documentation.

## Contents

- [Working with Java Optionals](#working-with-java-optionals)
- [Field Types and Access Patterns](#field-types-and-access-patterns)
- [mergeTag() Method](#mergetag-method)
- [Safe Field Value Extraction](#safe-field-value-extraction)
- [Record and Form Access](#record-and-form-access)
- [Multi-Entry Form (MEF) Entries](#multi-entry-form-mef-entries)
- [Query Access Patterns](#query-access-patterns)
- [Java Collections](#java-collections)
- [Writing Date and DateTime Fields](#writing-date-and-datetime-fields)
- [Committing Writes and Formula Triggers](#committing-writes-and-formula-triggers)
- [Endpoint (Maestro) Request/Response](#endpoint-maestro-requestresponse)
- [Merge Report Client-Side Integration](#merge-report-client-side-integration)
- [Base64 and Byte Arrays](#base64-and-byte-arrays)
- [Text Utilities (B.text)](#text-utilities-btext)
- [User and Session Access](#user-and-session-access)
- [Type Safety](#type-safety)

## Working with Java Optionals

⚠️ BlueStep uses Java optionals, NOT standard JavaScript undefined/null checks.

```typescript
// Get value with default
const value = field.opt().orElse('default value');

// Transform and unwrap
const transformed = field.opt().map(v => v.toUpperCase()).orElse('');

// Check if present
if (field.opt().isPresent()) {
  const value = field.opt().get();
}

// Chain operations
const result = field.opt().map(v => v.trim()).filter(v => v.length > 0).orElse('empty');
```

Common mistakes:

```typescript
// ❌ Wrong - JavaScript optional chaining doesn't work with Java optionals
const value = record.forms.someForm?.fields.someField?.val();
// ✅ Correct - use Java optional methods
const value = record.forms.someForm.fields.someField.opt().orElse('');

// ❌ Wrong - direct value access may throw
if (field.val()) { ... }
// ✅ Correct - check with the optional first
if (field.opt().isPresent()) { const value = field.opt().get(); }
```

## Field Types and Access Patterns

```typescript
// Text / Memo (MemoField behaves like a text field)
const text = textField.opt().orElse('');
const trimmed = textField.opt().map(v => v.trim()).orElse('');

// Number
const num = numberField.opt().orElse(0);

// Boolean
const bool = boolField.opt().orElse(false);
```

### Date/Time Fields (reading)

Date/Time fields return Java `LocalDateTime`, `LocalDate`, or `LocalTime` objects.

```typescript
const dateTime = dateTimeField.opt().orElse(null);
if (dateTime) {
  const year = dateTime.getYear();
  const month = dateTime.getMonthValue();
  const day = dateTime.getDayOfMonth();
  const isoString = dateTime.toString(); // ISO string (common pattern)
}
```

(For *writing* date/datetime fields, see [Writing Date and DateTime Fields](#writing-date-and-datetime-fields).)

### Document Fields

```typescript
const doc = docField.filename() ? { filename: docField.filename(), url: docField.permUrl() } : null;
```

### Signature Fields

```typescript
const sig = sigField.optTimeStamp().map(ts => ({
  user: sigField.optUser().map(u => u.fullName()).orElse(null),
  dateTime: ts
})).orElse(null);
```

### Single-Select Fields

`.val()` returns the `OptionItem` object, not a string, and `.selectedName()` does NOT exist. To get the display label, use `optSelected().map(o => o.displayName())`.

```typescript
// ✅ Correct
const qType: string = fields.questionType.optSelected().map((o: any) => o.displayName()).orElse('');

// ❌ Wrong - selectedName() does not exist on SingleSelectField
fields.questionType.selectedName();
// ❌ Wrong - String(o) returns the Java object toString, not the label
fields.questionType.opt().map((o: any) => String(o)).orElse('');
```

### Multi-Select Fields

```typescript
// Array of selected option names — .selectedNames() returns EList<string>; use .toArray()
const selectedNames = multiSelectField.selectedNames().toArray();
const count = multiSelectField.selectedCount();

// Selected OptionItem objects (for display name + export value)
multiSelectField.selected().forEach((item: Bluestep.Relate.OptionItem) => {
  const name = item.displayName();
  const exportValue = item.exportValue();
});
```

⚠️ Use `.toArray()` to convert an `EList` to a real JavaScript array before JSON serialization or array operations.

## mergeTag() Method

`mergeTag()` is available on all Field objects and generates the HTML for form-field components. It is used with the `fieldF` and `bsHorizFieldCol2F` components to produce properly formatted fields with labels, validation images, and inputs.

```typescript
field.mergeTag(options?: string): string
```

### Option codes

| Option Code | Description |
|------------|-------------|
| `""` (empty) | View-only field (read-only display) |
| `"L"` | Label only |
| `"H"` | Hint/tooltip |
| `"F"` | Editable field (input element) |
| `"I"` | Validation image (must be used with `"F"`) |

⚠️ The validation-image code `"I"` should only be used in combination with the editable-field code `"F"`. Codes can be combined in one string to generate multiple tags at once (e.g. `"FI"`, `"LF"`, `"LFI"`).

```typescript
const input    = field.mergeTag("F");   // editable field
const label    = field.mergeTag("L");   // label
const hint     = field.mergeTag("H");   // hint
const viewOnly = field.mergeTag("");    // view-only
const complete = field.mergeTag("LFI"); // label + field + validation image
```

### Using with `fieldF` / `bsHorizFieldCol2F`

```typescript
import { fieldF, bsHorizFormCol2F, bsHorizFieldCol2F } from 'genericComponents';

const firstNameField = record.forms.userInfo.fields.firstName;

// Separate calls
const fieldHtml = fieldF({
  label: firstNameField.mergeTag("L"),
  validationImg: firstNameField.mergeTag("I"),
  field: firstNameField.mergeTag("F")
});

// More efficient: generate field + validation together with "FI"
const fieldHtml2 = fieldF({
  label: firstNameField.mergeTag("L"),
  validationImg: '',
  field: firstNameField.mergeTag("FI")
});
```

Best practices: always use `mergeTag()` with `fieldF`/`bsHorizFieldCol2F` (they integrate with BlueStep's validation system); combine codes (`"FI"`/`"IF"`) rather than separate calls; never use `"I"` without `"F"`.

## Safe Field Value Extraction

```typescript
function getFieldValue(field: any, fieldType: string): any {
  switch (fieldType) {
    case 'Text Field':
    case 'Text Area Field':
    case 'Memo Field':
      return field.opt().orElse(null);
    case 'Number Field':
      return field.opt().orElse(null);
    case 'Boolean Field':
      return field.opt().orElse(false);
    case 'Date/Time Field':
      return field.opt().orElse(null); // Java date object
    case 'Document Field':
      return field.filename() ? { filename: field.filename(), url: field.permUrl() } : null;
    case 'Signature Field':
      return field.optTimeStamp().map(ts => ({
        user: field.optUser().map(u => u.fullName()).orElse(null),
        dateTime: ts
      })).orElse(null);
    case 'Multiple Select List Field':
      return (field as Bluestep.Relate.MultiSelectField).selectedNames().length > 0
        ? (field as Bluestep.Relate.MultiSelectField).selectedNames().toArray()
        : [];
    default:
      return field.opt().orElse(null);
  }
}
```

## Record and Form Access

Access forms and fields by direct property (the FID string). `byFID['...']` is unnecessary for runtime field/form access and should not be used (it appears only inside `require()` in the legacy `imports.ts` registration — see [Query Access Patterns](#query-access-patterns)). How a component *acquires* its FID name in the first place: [fid-alternate-identifier](fid-alternate-identifier.md).

```typescript
// ✅ Correct - direct property access
entry.fields.title.val()
client.forms.tasks
const value = record.forms.formName.fields.fieldName.opt().orElse('default');

// ❌ Wrong - byFID is unnecessary at runtime
entry.fields.byFID['title'].val()
client.forms.byFID['tasks']
```

### Linking to a record — `summaryUrl()`

There is no universal `/records/{id}` route. Use `record.summaryUrl()` for the relative URL to any record's page.

```typescript
const url = client.summaryUrl(); // e.g. "/<org>/connect/..."
// ❌ Wrong - no such universal route
const url = `/<org>/records/${clientId}`;
```

### Record lookup by ID — use the `sysId` field, not `id().shortId()`

`client.id().shortId()` returns the internal relate record ID, which does NOT resolve with `optById`. Use the `sysId` field from the `name` form.

```typescript
// ✅ Correct
const clientId = client.forms.name.fields.sysId.val();
// In a CURRENT_RECORD merge report:
const clientId = (name as any).fields.sysId.val();

// ❌ Wrong - shortId doesn't match what optById expects
const clientId = client.id().shortId();
```

<!-- CONFLICT: client-ID field key — one reference states the field key is `sysId` (not `systemID`/`systemId`) and that `id().shortId()` does NOT resolve with optById; some merge-report examples read `name.fields.systemID.val()`. This may be form/org-specific (the field key depends on the form's schema). Needs human confirmation of the canonical key. -->

## Multi-Entry Form (MEF) Entries

`mefReports` does NOT exist at runtime. Create entries on the form, and find them by iterating the form directly.

```typescript
// Create a new entry — newEntry() is on the form
const entry = client.forms.tasks.newEntry();
entry.fields.title.val('Task title');
entry.fields.status.val(false);
// ❌ Wrong - client.forms.tasks.mefReports.newEntry();

// Find a specific entry by ID — iterate the pre-loaded entries
let foundEntry: any = null;
for (const e of client.forms.tasks) {
  if (e.id().shortId() === entryId) { foundEntry = e; break; }
}
// ❌ Wrong - mefReports is undefined at runtime
// client.forms.tasks.mefReports.allEntries.query().optById(entryId);
```

- **Entry IDs:** use `entry.id().shortId()` to get the string ID for serialization or comparison — it matches when iterating.
- **Entry creation date:** `entry.created()` returns a Java `Instant`. Convert to compare against a `LocalDate`:

```typescript
const createdDate = B.time.LocalDate.ofInstant(entry.created(), B.time.ZoneId.systemDefault());
if (createdDate.isAfter(someLocalDate)) return; // e.g. exclude targets created after a note's service date
```

### Iterating single vs multi-entry forms

```typescript
const isMultiEntry = formMetaData.isMultiEntry();
if (isMultiEntry) {
  record.forms.multiEntryForm.entries().forEach((entry: any) => {
    const value = entry.fields.fieldName.opt().orElse('');
  });
} else {
  const value = record.forms.singleEntryForm.fields.fieldName.opt().orElse('');
}
```

## Query Access Patterns

Which queries, forms, and fields a script can use are defined by the component's **form-import config on the platform**, regenerated into `declarations/index.d.ts` on `b6p pull`. A configured query is available in `app.ts` as a **bare top-level variable** named after the query FID — directly iterable, no `.query()` call:

```typescript
// app.ts — the query is a top-level variable (configured on the platform, generated into declarations)
const unit = topLevelUnit[0];
const unitName = unit.forms.unitInformation.fields.unitName.opt().orElse('');
topLevelUnit.forEach((record: Record_topLevelUnit) => { /* ... */ });
```

To add a query/field, or make a form writable, update the form-import config **on the platform** and `b6p pull` — do not hand-edit `declarations/index.d.ts`. A configured query's top-level variable carries the writable transaction context, so writes go through it directly (writable access is set per form in the import config, not chained in code).

For an ad-hoc query that is *not* in the import config, run it explicitly. This is a fresh **read-only** execution — use it for reads only; writes against it fail:

```typescript
B.queries.byFID['staffQuery'].query().forEach((record: Bluestep.Relate.Record) => {
  console.log(record.forms.nameForm.fields.firstName.opt().orElse(''));
});
```

<details>
<summary>Legacy: <code>objects/imports.ts</code> registration (older modules only)</summary>

Older modules registered queries by hand in `objects/imports.ts` with `.require()`, which produced the same bare top-level variable and selected fields / writable context in code. **This file is not updated on pull and is not hand-written in current modules** — the platform form-import config replaces it. You may still encounter it:

```typescript
// objects/imports.ts (legacy)
{
  const forms = B.queries.byFID['topLevelUnit'].require().forms;
  forms.byFID['unitInformation'].require({fields: ['unitName']});
  // writable was an option INSIDE require(), never a chained .writable():
  forms.byFID['tasks'].mefReports.allEntries.require({fields: ['title','status'], writable: true});
}
```

</details>

## Java Collections

Query results and other Java collections do NOT have JavaScript array methods (`.filter()`, `.map()`). Use `.forEach()` and build an array.

```typescript
// ❌ Wrong
const filtered = query.query().filter(r => condition);
// ✅ Correct
const results = [];
query.query().forEach((record: any) => { if (condition) results.push(record); });
```

## Writing Date and DateTime Fields

Use `B.time`, never `Java.Time` — `Java.Time` is a TypeScript type namespace only and does not exist at runtime.

```typescript
// DateField — accepts B.time.LocalDate, B.time.Instant, or millis (number)
entry.fields.dueDate.dateVal(B.time.LocalDate.parse('2025-04-01'));
// ❌ Wrong - Java.Time is undefined at runtime
entry.fields.dueDate.dateVal(Java.Time.LocalDate.parse('2025-04-01'));

// DateTimeField — expects a ZonedDateTime, NOT epoch millis
entry.fields.completedAt.val(B.time.ZonedDateTime.now());
// ❌ Wrong - toEpochMilli() returns a Long → ClassCastException: Long cannot be cast to ZonedDateTime
entry.fields.completedAt.val(B.time.Instant.now().toEpochMilli());
```

(For setting search values against date fields in MEF queries, that format differs — see [date-format](../conventions/date-format.md). For the `.val()` vs `.dateTimeVal()` overload trap, see [datetime-field-write](datetime-field-write.md).)

## Committing Writes and Formula Triggers

- **Form-attached formulas have NO `B.commit()`.** There `B` is `Bluestep.Relate.CurrentRecordB`, which does not extend `IsCommitable`; field writes auto-flush when the form save completes. (Cross-record writes need the target form configured writable in the platform form-import config — legacy modules declared `writable: true` in `objects/imports.ts`.)
- **Endpoints, on-demand formulas, and scheduled formulas** — `B` IS `IsCommitable`; call `B.commit()` after writes.
- **The named `runFormula("name")` is the OnDemand trigger.** In RelateScript, `runFormula("name")` / `System.runFormula("name")` dispatches the named OnDemand formula to the task pod, detached from the current save transaction — it does not run the target inline within the save, so the caller needs no async handling. (Distinct from the **no-arg** `runFormula()`, which synchronously computes a field formula's own value and dispatches nothing.) Execution characteristics (task pod, ~5 s scheduler-queue delay) and the payload-carrying `FormulaScheduler` builder (`cur.runFormula(fid).message(…).start()`) are in [bsjs-development.md](../bsjs-development.md) → "OnDemand / Field Formula". How the target formula acquires the name that resolves it: [fid-alternate-identifier](fid-alternate-identifier.md).
- **Gate on create vs edit** in a form-attached formula (`cur` is a `FormEntry`):

```typescript
if (cur.entry().justCreated()) { /* first-save path */ }
if (!cur.entry().justCreated() && cur.entry().triggerFormulas()) { /* edit-only path */ }
```

## Endpoint (Maestro) Request/Response

In endpoint (Maestro) scripts, the HTTP request/response are on `B.net`. `B.request`, `B.response`, and `B.out` do NOT exist in this context (`B.out` is a merge-report construct).

```typescript
const { request, response } = B.net;
const action = request.parameter('action');     // string or null
const id = request.optParameter('id').orElse(''); // Java Optional
const body = JSON.parse(request.content() || '{}'); // request body as string
response.contentType('application/json; charset=UTF-8');
response.out(JSON.stringify({ success: true }));
```

(For the full request/response method surface and an action-based router, see [code-patterns](code-patterns.md). For the no-`delete`-method endpoint rule and output channel, see [endpoint-method-call](endpoint-method-call.md) and [endpoint-output-channel](endpoint-output-channel.md).)

## Merge Report Client-Side Integration

### Intercepting the save — wrap `window.submitForm`

BlueStep's save button is `<a href="javascript:submitForm('Relate','commit')">`, which calls `submitForm()` → `form.submit()`. **`form.submit()` does NOT fire `addEventListener('submit', ...)`.** Wrap `window.submitForm` to intercept the save:

```javascript
var _orig = window.submitForm;
window.submitForm = function() {
  // your logic here
  if (_orig) return _orig.apply(this, arguments);
};
```

### Disable widget inputs before the POST

If a merge report renders inputs with `name` attributes, BlueStep tries to save them as form fields and any unknown `name` causes "There was a problem storing the data." Disable widget inputs inside the override before calling through:

```javascript
var _orig = window.submitForm;
window.submitForm = function() {
  document.querySelectorAll('input[name^="tt-"], input[data-target-id], textarea[data-target-id]')
    .forEach(function(el) { el.disabled = true; });
  if (_orig) return _orig.apply(this, arguments);
};
```

(See also [named-controls-submit](named-controls-submit.md).)

### Script timing — native fields below the widget

A merge report's `<script>` is injected mid-page. Native BlueStep fields that render **after** the widget are not yet in the DOM when the script runs — defer those with `DOMContentLoaded`. Fields rendered **before** the script (inside the widget's own HTML) are accessible immediately.

```javascript
document.addEventListener('DOMContentLoaded', function() {
  var field = document.querySelector('[data-fid="treatmentTargetJSON"]');
  if (field) field.closest('tr').style.display = 'none';
});
```

(For passing per-row server data without a `DOMContentLoaded` race, see the queue/lazy-init pattern in [code-patterns](code-patterns.md).)

## Base64 and Byte Arrays

The base64 helpers take `Java.ByteArray`, not `string`. Convert with the I/O round-trip:

```typescript
const bytes = B.io.toByteArray(B.io.toInputStream(myString, "UTF-8"));

// Standard base64 — exposed on B
const standard = B.toBase64(bytes);
// URL-safe base64 — ONLY on B.text (RFC 4648 §5, e.g. Gmail messages/send raw field)
const encoded = B.text.toBaseUrl64(bytes);
// ❌ Wrong - B.toBaseUrl64 does not exist
const wrong = B.toBaseUrl64(bytes);
```

`B.io.toInputStream(input, charset?)` and `B.io.toByteArray(inputStream)` are the canonical pair — don't reach for `Java.type('java.lang.String')...getBytes(...)`.

## Text Utilities (B.text)

`B.text` (Bluestep.Text) provides platform-native string utilities mirroring RelateScript,
reachable from the merge-report/endpoint `B` object. **Reach for these before hand-rolling
escaping or regex.**

```typescript
// Formatted HTML → plain text (BSJS twin of Relate's toPlainText).
// Use to strip HTML from a formatted value before display.
const plain = B.text.toPlainText(value);

// Escaping for output contexts
const safeHtml = B.text.escapeHtml(value);              // HTML body text
const safeJs = B.text.escapeJs(value);                  // inside a JS string literal
const safeAttr = B.text.escapeJsInTagAttribute(value);  // JS inside an HTML tag attribute
const sanitized = B.text.xxsSafe(html);                 // sanitize HTML for safe output

// MessageFormat-style formatting (optional time zone)
const msg = B.text.messageFormat(format, zone);
```

`B.text` is also home to `toBaseUrl64` (see [Base64 and Byte Arrays](#base64-and-byte-arrays))
and a `B.text.csv` alias (see [csv-parsing](csv-parsing.md)).

## User and Session Access

```typescript
// B.optUser — Java Optional (preferred, safe)
const fullName = B.optUser.map(u => u.fullName()).orElse('Anonymous');
const isSuper = B.optUser.map(u => u.isGlobalSuper()).orElse(false);
const email = B.optUser.map(u => u.email()).orElse('');
if (B.optUser.isPresent()) {
  const user = B.optUser.get();
  // user.firstName(), user.fullName(), user.email(), user.userName()
  // user.unit(), user.record(), user.entry()
}

// B.user — direct access, returns User|null (equivalent to B.optUser.orElse(null)); prefer B.optUser
const user = B.user;
if (user) { const name = user.fullName(); }

// Layout detection
if (B.isLayout("MANAGE")) { /* Manage-specific behavior */ }
```

⚠️ `B.optUser` is a Java Optional — never serialize it directly into a template literal (it produces `"function () { [native code] }"`). Always resolve with `.map(...).orElse(...)` first.

## Type Safety

BlueStep APIs often return `any`. Add safety with casts/annotations and type guards.

```typescript
const value: string = field.opt().orElse('');

function isRecord(obj: any): obj is Bluestep.Relate.Record {
  return obj && typeof obj.recordId === 'function';
}
if (isRecord(someObj)) { const id = someObj.recordId(); }
```

(For broader TypeScript guidance, see the [BsJs development overview](../bsjs-development.md).)
