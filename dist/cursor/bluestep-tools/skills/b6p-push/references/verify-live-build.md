# Which build is live (read by `/b6p-push` step 5 after a publish, when `liveVerified` is `null`, or when a change does not show up)

A draft and the live version are separate. After a draft-only push the platform has the new code as a **draft** while the page keeps serving the last published build — both are true at once. When a change does not show up, check the push mode first, before theorising about caches, `config.json` or compilation.

Confirm what is live concretely, not by assumption:

- **Restore-point history.** After a publish, the new restore point sits at the top of the component's version history with the description just used.
- **The running build of a BSJS formula.** Through the `bluestep-gateway` MCP server's `invoke_org_tool`, call the inner `read_script_log` tool: the build's own `console.log` output identifies it. A `java.nio.file.NoSuchFileException: …/scripts/app` there means the script has no live build yet. How to reach inner tools: the `bluestep-reference` skill's `conventions/mcp-platform-authoring.md`.
- **Not the inner `read_script_draft` tool.** It reads the draft source, so it confirms the platform received the push but can never confirm what is live.

**A stale page render can look like a failed publish.** A formula's own on-page output — a message or modal it writes, rendered field output — can come from a cached page render, so a successful publish can look like the old version still runs. Hard-refresh and **re-trigger** it (re-save the record) before doubting the publish; do not re-push or roll back on an unchanged-looking page alone.
