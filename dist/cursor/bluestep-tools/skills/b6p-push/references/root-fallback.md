# `--root` push — a component never pulled with the CLI (read by `/b6p-push` step 4 when `--file` fails with `Missing metadata`)

`b6p push --file <path>` fails with `Missing metadata` when the component has no local sync metadata: it was never pulled through the CLI, so there is nothing to find the destination from. Push it explicitly:

```
b6p --yes --json push <target-url> --root "U######/<ComponentName>" [--snapshot --message "<description>"]
```

- `--root` is the component's **root** — the folder that *contains* `draft/`, not `draft/` itself. Pointing at `draft/` gives `Draft folder not found: .../draft/draft`.
- `<target-url>` has no local source. With the `bluestep-gateway` MCP server connected, look the script up by name through its `invoke_org_tool` (inner tool `lookup_script_by_name`; see the `bluestep-reference` skill's `conventions/mcp-platform-authoring.md`) and use the returned `webDavUrl`. Otherwise ask the user for the WebDAV URL.
- The step-3 choice still applies: carry `--snapshot --message "<description>"` if the user chose Publish. Do not try argument shapes until one works — a guess can land on a draft-only push that never compiles or goes live.
- Read the result exactly as in step 5. The commands the CLI prints there repeat the target URL and `--root`.
