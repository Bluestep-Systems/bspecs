# Platform token `B6PT_TOKEN` — all tools (read by `/b6p-setup` step 1 when the token is absent)

The optional third once-per-machine item. Only platform authoring over the gateway MCP needs it; setup must stay skippable without it.


The BlueStep platform MCP is reached through a **single bundled gateway** at
`https://gateway.bluestep.net/mcp` that surfaces every org you are allowed to reach. It ships **inside the
`bluestep-tools` plugin** (as the plugin's `bluestep-gateway` MCP server) and **auto-registers** as soon as
the plugin is enabled and the `$B6PT_TOKEN` environment variable is set — there is **no per-org connect
flow and no hand-edited MCP config**. The only thing a user does is set the token once. The token is
**tool-independent**: it lives in the OS environment, so the same one serves every tool on the machine.

> **Fresh-session caveat.** Plugin-bundled MCP servers register when a session **starts**. After enabling the
> plugin or setting the token, the gateway tools appear only in a **new** session — and for a GUI-launched
> app that means quitting and reopening the app entirely, not just opening a new tab or window.

This step is **optional and non-destructive** — a project is often created before the token exists, so it
must be skippable. **First check whether the token is already set:**

```
test -n "$B6PT_TOKEN" && echo OK
```

- Prints `OK` → the token is already set; say so and move on. Note that the bundled gateway will register
  in the next fresh session; nothing more to do here.
- Prints nothing → offer the two one-time setup steps below (do not force them).

> **Access reality.** The `b6pt_` token requires super-user access (**Super tab → Global Users → Access
> Tokens**). If Organization Admin shows **no "Super" tab**, you can't self-create a token — **request a
> token / MCP enablement from BlueStep** rather than hunting for the screen. (A later 404 for a specific org
> = that org doesn't expose `/mcp`; see `conventions/mcp-platform-authoring.md`, don't retry.)

If you **do** have super-user access, the happy path is:

**1. Create the token (once, in any org — it works globally):**
BlueStep UI → **Tools → Organization Admin → Super tab → Global Users →** find yourself → edit (pencil) →
**Access Tokens → Create New Token**. Copy the `b6pt_…` value.

**2. Put it in the environment your agent tool runs in** (this differs by OS):

- Linux / WSL / macOS, **launched from a terminal**: add `export B6PT_TOKEN="b6pt_…"` to your shell
  profile (`~/.bashrc` / `~/.zshrc`), then open a new terminal.
- **Windows**: `setx B6PT_TOKEN "b6pt_…"` — **User scope** — then **fully restart the app** (quit it, don't
  just open a new terminal or window). A variable exported in a shell session never reaches a
  GUI-launched app; only the persisted User-scope variable does, and only for processes started after it
  was set.
- macOS / Linux, **launched from the GUI** (Spotlight / Dock / app icon): GUI apps do **not** read your
  shell profile, so an `export` in `.zshrc` will **not** reach them. Either launch from a terminal, run
  `launchctl setenv B6PT_TOKEN "b6pt_…"` (macOS; clears on logout), or set it in a user-level config the
  tool reads (Claude Code: the `env` block of `~/.claude/settings.json` in your home dir, never committed —
  or a gitignored `.claude/settings.local.json`; **never** the committed project settings file).

Then start a fresh session — the bundled gateway picks up the token automatically.

**Never** ask the user to paste the token into the chat, and never write the literal token into a file. The
bundled MCP config references the `B6PT_TOKEN` env var — never the literal value.

### Security & token handling

The `b6pt_` token is a **bearer credential for a global super-user** — whoever holds it can act as the user
across every org. Handle it accordingly, and be honest with the user about its limits.

- **Not encrypted at rest.** The token lives in plaintext in the `B6PT_TOKEN` env var (shell profile /
  Windows user env). It is user-private and uncommitted, but readable by any process running as the user.
  No agent tool offers an encrypted-header MCP mechanism, so plaintext-user-private is the floor. This is a
  **separate credential from the b6p CLI's**, set up independently: the CLI stores its own platform access
  token, encrypted, in `~/.b6p/` via `b6p auth set` — which refuses a `b6pt_` value — while this one lives in
  the `B6PT_TOKEN` env var and authenticates the gateway MCP. Both are bearer tokens, so keep them straight —
  configuring one does nothing for the other.
- **Recommend an expiry + least-privilege scopes at creation.** The Access Tokens screen has Scopes and
  Expires columns; a never-expiring, unscoped global-super token is the riskiest shape. Setting an expiry
  and scopes — and questioning whether it needs to be a global-super token at all — reduces risk more than
  anything about where the token is stored.
- **Never print, echo, or leak the token.** Never paste it into chat, never write the literal value into a
  committed file, never send it anywhere other than the gateway's `Authorization` header over HTTPS (which
  the bundled MCP config does via the env var). It grants global admin — a leaked value is a full platform
  compromise. If exposed, tell the user to **Revoke** it on that same screen and **rotate**.
