# Gateway MCP: a smaller, faster tool list (November 3, 2026)

The tool list your AI client loads on every turn is about 40% smaller: from 83 tools and ~179 KB to
71 tools and ~104 KB. Tool results are also leaner. Nothing you could do before has been taken away,
but some tools were merged or renamed, and **the old names have no alias**. Update any saved
prompts, scripts or agent configs that use them. The `bluestep-tools` plugin 0.43.0 uses the new
names; run `/plugin marketplace update` to get it.

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
| `field` | `batch_fields` (handles one field or many) |

## Permissions

`set_permissions` works on any securable object (form, field, folder, script, option list, and so
on) and needs a `mode`, which decides what happens to the permissions you do **not** name:

- `MERGE` adds each named subject or changes its level. Everyone else keeps theirs.
- `ADD` adds each named subject that has no permission yet. An existing one is left as it is.
- `REMOVE` takes the named subjects off. Everyone else keeps theirs.
- `REPLACE` makes the list exactly what you send. Anyone not named is removed. Read the current
  list with `list_permissions` first: the built-in groups a new form starts with cannot be
  removed, so a REPLACE that leaves one out is refused.

`revoke_permission` still takes one subject off, and `list_permissions` and
`list_security_subjects` are unchanged. `create_script` takes the same `permissions` list, so a new
script can be runnable from the start.

## Creating and editing fields

- `batch_fields` and `form` CREATE no longer list every field type's settings up front. Call the new
  **`describe_field_type(type, action: CREATE | UPDATE)`** to get the exact settings for one type.
- The server now refuses settings a field type doesn't accept. It used to drop them silently. The
  error names the bad settings and tells you which `describe_field_type` call to make.
- On UPDATE, sending `null` is refused. To clear a value, use `"clear": ["<setting>"]`.
- On CREATE, sending a `fieldId` is refused, and `name` is required.
- `get_form` and `list_forms` (with `includeFields`) now report each field's `formatType`, which is
  the value you would send to create that field.

## Reading results

- Tool results no longer contain `null`s. A missing key means "no value", and a cleared setting is
  missing from the readback.
- `get_form` and `describe_form` take `compact: true`, which returns only `fieldId`, `label` and
  `fieldType` for each field. That is about half the size.
- When `get_full_schema` or the `get_schema` overview is too large to send whole, it now returns a
  type index instead of cut-off JSON. Call `get_schema(typeName)` for the details of a type.

## Why

Every tool your AI client can see is sent along with every message, whether you use it or not, so a
bloated tool list costs tokens, money and speed on every call. Many tools overlapped (separate "add"
and "remove" versions of the same action, four log readers), so they were merged into fewer, more
flexible ones. Stricter checks and leaner results also help the AI make fewer mistakes, so less is
spent on retries.
