# Gateway MCP: a smaller, faster tool list (November 3, 2026)

The tool list your AI client loads on every turn is about 40% smaller: from 83 tools and ~179 KB to
71 tools and ~107 KB. Tool results are also leaner. Every capability is still there, but some tools
were merged or renamed and some arguments changed, and **the old names have no alias**. Update any
saved prompts, scripts or agent configs that use them. The `bluestep-tools` plugin 0.43.0 uses the
new names; run `/plugin marketplace update` to get it.

## Renamed or merged tools

| Old | New |
| --- | --- |
| `add_forms` / `remove_forms` | `script_forms` with `action: ADD \| REMOVE` |
| `add_queries` / `remove_queries` | `script_queries` with `action` |
| `add_field_access` / `remove_field_access` | `script_field_access` with `action` |
| `add_record_types` / `remove_record_types` | `script_record_types` with `action` |
| `read_script_log`, `search_script_log`, `read_organization_log`, `search_organization_log` | `read_log` with `scope: SCRIPT \| ORGANIZATION` and an optional `query` (default is now 80 lines) |
| `list_forms_with_fields` | `list_forms` with `includeFields: true` |
| `create_option_list`, `update_option_list` | `option_list` |
| `form_permission`, `grant_permission` | `set_permissions`, which now **requires** a `mode` (see below) |
| `set_permissions` with no `mode` | the same tool with `mode: REPLACE`, which keeps the old behavior |
| `field` | `batch_fields` (handles one field or many) |

## Arguments that changed

If you reuse an old call with the new tool name, check these:

- `form_permission`'s `formId` is now `objectId` on `set_permissions`.
- `grant_permission`'s single `permission` object is now a `permissions` array.
- `update_option_list`'s `displayName` is now `name` on `option_list`.
- The search log tools' `term` is now `query` on `read_log`.
- `remove_queries`' `queryIds: ["…"]` is now `queries: [{ queryId: "…" }]` on `script_queries`.
- `list_forms_with_fields`' `detail: fields` is now `includeFields: true` on `list_forms`. The
  default page is 25 forms.
- `field`'s top-level `formId` / `fieldId` and `field` object are now `formId` plus a `fields` array
  on `batch_fields`, with each field's `fieldId` inside its item.

## Permissions

`set_permissions` works on any securable object (form, record, field, folder, option list, and so
on) and needs a `mode`, which decides what happens to the permissions you do **not** name:

- `MERGE` adds each named subject or changes its level. Everyone else keeps theirs.
- `ADD` adds each named subject that has no permission yet. An existing one is left as it is.
- `REMOVE` takes the named subjects off. Everyone else keeps theirs. Each entry still needs a
  `type`, which is not read.
- `REPLACE` makes the list exactly what you send. Anyone not named is removed.

Read the current list with `list_permissions` first. The built-in groups a new form starts with
cannot be removed: a REPLACE that leaves one out, or a REMOVE that names one, is refused. The
`RELATE_LICENSES` alias is gone; name the "Relate Users" (or "Relate Licensees") group by the
`securitySubjectId` that `list_permissions` reports.

`revoke_permission`, `list_permissions` and `list_security_subjects` are unchanged.
`create_script` still takes the same `permissions` list, so a new script can be runnable from the
start.

## Creating and editing fields

- `batch_fields` and `form` CREATE no longer list every field type's settings up front. Call the new
  **`describe_field_type(type, action: CREATE | UPDATE)`** to get the exact settings for one type.
- The server now refuses settings a field type doesn't accept. It used to drop them silently. The
  error names the bad settings and tells you which `describe_field_type` call to make. In a
  `batch_fields` call, a refused item is listed in `errors` and the other items still apply.
- On UPDATE, sending `null` is refused. To clear a value, use `"clear": ["<setting>"]`.
- On CREATE, sending a `fieldId` is refused, and `name` is required.
- `get_form` and `list_forms` (with `includeFields`) now report each field's `formatType`, which is
  the value you would send to create that field.

## Reading results

- Results the server builds no longer contain `null`s. A missing key means "no value", and a
  cleared setting is missing from the readback.
- `get_form` and `describe_form` take `compact: true`, which returns only `fieldId`, `label` and
  `fieldType` for each field. That is half the size or less.
- When `get_full_schema` or the `get_schema` overview is too large to send whole, it now returns a
  type index instead of cut-off JSON. Call `get_schema(typeName)` for the details of a type.

## Why

Every tool your AI client can see is sent along with every message, whether you use it or not, so a
bloated tool list costs tokens, money and speed on every call. Many tools overlapped (separate "add"
and "remove" versions of the same action, four log readers), so they were merged into fewer, more
flexible ones. Stricter checks and leaner results also help the AI make fewer mistakes, so less is
spent on retries.
