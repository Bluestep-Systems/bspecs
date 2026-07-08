---
name: bluestep-mcp-connect
description: Connect to a BlueStep org's platform MCP server so the agent can run [PLATFORM] operations directly. Registers globally (user scope) via the claude CLI when available so it persists across all workspaces; falls back to a per-workspace .mcp.json (no CLI needed) otherwise. Use when the user wants to add or set up a BlueStep MCP connection for an org.
allowed-tools: Read Write Edit AskUserQuestion Bash(curl:*) Bash(test -n *) Bash(command -v *) Bash(claude mcp:*)
---

# /bluestep-mcp-connect — Connect to a BlueStep org MCP

The BlueStep platform exposes a **per-org MCP server** at `https://<org>.bluestep.net/mcp` (HTTP
transport). Connecting lets the agent perform `[PLATFORM]` operations directly (read/write a script
draft, create forms/fields/queries, wire dependencies, etc.) instead of the manual b6p-CLI / UI flow.

> This skill may also be invoked conversationally as the "not connected → offer to connect" step of the
> shared MCP `[PLATFORM]` authoring procedure (the `bluestep-reference` skill's
> `conventions/mcp-platform-authoring.md`). Per the fresh-session caveat below, connecting here does **not**
> unblock an in-flight authoring request in the current session — the tools register only in a new session,
> so that request must be re-asked after restart.

**Three facts drive this skill:**

- **One token, many orgs.** A single **global** `b6pt_` access token authorizes *every* org's MCP. The
  user creates it **once** in the BlueStep UI and it is reused for every org. It lives in the
  `B6PT_TOKEN` environment variable.
- **Global by default — when the `claude` CLI is available.** Registering at **user scope**
  (`claude mcp add … --scope user`) makes the connection persist across *all* workspaces on the machine —
  the common case for a single developer with several workspaces per org. This path uses the `claude`
  CLI, which is **not** a hard dependency of this plugin: it is on PATH only when Claude Code is run as
  the terminal CLI. If it is absent (desktop app, IDE extension), the skill falls back to the
  per-workspace **`.mcp.json`** path (step 3b), which needs **no external tool** — it just writes a file.
  The per-workspace path is also the deliberate choice for confining a sensitive org to one workspace,
  keeping the secret purely in the env var, or sharing config with a team.
- **A new MCP connection only goes live in a fresh session.** Claude Code registers MCP tools at
  startup, so after this skill runs the tools do **not** appear in the current session — the user must
  start a new one. Say so at the end, every time.

## Steps

### 0. Token preflight (do this first)

Check that the global token is present in the environment where Claude Code runs:

```
test -n "$B6PT_TOKEN" && echo OK
```

- Prints `OK` → continue.
- Prints nothing → **STOP.** Do not register anything. Tell the user:

  > This machine has no `B6PT_TOKEN` set, so the MCP connection would fail auth. Two one-time steps:
  >
  > **1. Create the token (once, in any org — it works globally):**
  > BlueStep UI → **Tools → Organization Admin → Super tab → Global Users →** find yourself → edit
  > (pencil) → **Access Tokens → Create New Token**. Copy the `b6pt_…` value.
  >
  > **2. Put it in the environment Claude Code runs in:**
  > - Linux / WSL / macOS: add `export B6PT_TOKEN="b6pt_…"` to your shell profile (`~/.bashrc` /
  >   `~/.zshrc`), then open a new terminal.
  > - Windows: `setx B6PT_TOKEN "b6pt_…"` (User scope), then restart the terminal / Claude Code.
  >
  > Then re-run `/bluestep-mcp-connect`.

  **Never** ask the user to paste the token into the chat, and never write the literal token into a file.

### 1. Get the org MCP URL

The URL is `https://<org-subdomain>.bluestep.net/mcp`. You cannot infer or guess the subdomain.

- If `$ARGUMENTS` is a `https://….bluestep.net/mcp` URL, use it.
- Otherwise ask the user:
  > What is the org's MCP URL? It looks like `https://<org>.bluestep.net/mcp` — copy the org subdomain
  > from the BlueStep address bar.
- If the user gives only a subdomain or a display name, confirm the full `https://<subdomain>.bluestep.net/mcp`
  form back to them before using it. Do **not** fabricate a subdomain from a display name.

### 2. Derive the server key

The key namespaces the entry so multiple orgs coexist: `bluestep-<subdomain>`
(e.g. `https://acme.bluestep.net/mcp` → `bluestep-acme`).

### 3. Choose the registration path

Detect whether the `claude` CLI is available:

```
command -v claude >/dev/null 2>&1 && echo CLI || echo NO_CLI
```

- `CLI` → use **3a (global)** by default, unless the user asked for containment / team-shared config
  (then 3b).
- `NO_CLI` → the global path needs the `claude` CLI, which isn't on PATH here. **Do not auto-install
  anything.** Offer the user a choice:
  - **Per-workspace now** (3b) — works immediately, no install. Default to this if the user is unsure.
  - **Install the CLI for global** — the Claude Code CLI installs **npm-free** into user space
    (`~/.local/bin`, no admin) via the official native installer (Linux/WSL/macOS:
    `curl -fsSL https://claude.ai/install.sh | bash`; Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`).
    Give the command for the user to run themselves; confirm the exact command against the current Claude
    Code install docs, as these can change. After installing and opening a new terminal, re-run
    `/bluestep-mcp-connect`.
  - **Desktop app** — add it as a custom connector in the user's claude.ai connector settings (URL
    `https://<subdomain>.bluestep.net/mcp`, Authorization `Bearer <b6pt_ token>`), since the desktop app
    manages MCP servers through the account, not local files. (Note: "Claude Code installed" does not
    imply a `claude` binary on PATH — only the terminal CLI guarantees that.)

### 3a. Register globally (default)

Run — passing the token **by env-var reference, never a literal** (the shell resolves `$B6PT_TOKEN` into
the user-private `~/.claude.json`; the value never appears in a committed file or in what you type):

```
claude mcp add --transport http "bluestep-<subdomain>" "https://<subdomain>.bluestep.net/mcp" \
  --header "Authorization: Bearer $B6PT_TOKEN" \
  --scope user
```

Let Claude Code manage the transport's `Accept` negotiation — do not add an `Accept` header here (it is
only needed for the raw curl check in step 4).

> **Rotation note:** because the resolved token is stored (not the `${VAR}` reference), rotating the
> token means re-running this command. `claude mcp add` overwrites an existing same-name entry.

If the user instead wants **containment / secret-only-in-env / team-shared config**, use 3b.

### 3b. Register per-workspace (opt-in alternative)

Merge a `bluestep-<subdomain>` entry into the workspace-root `.mcp.json`, **non-destructively** — add or
replace only this org's key, leave every other server entry untouched. This path keeps the secret purely
in the env var (runtime `${VAR}` expansion works in `.mcp.json`), so nothing sensitive is written to disk:

```json
{
  "mcpServers": {
    "bluestep-<subdomain>": {
      "type": "http",
      "url": "https://<subdomain>.bluestep.net/mcp",
      "headers": {
        "Authorization": "Bearer ${B6PT_TOKEN}",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

Use the literal `${B6PT_TOKEN}` reference — **never** substitute the actual token value. Caveat: if
`B6PT_TOKEN` is unset when a session opens, Claude Code fails to parse the whole config at startup;
mention that the env var must be set wherever the workspace is opened.

### 4. Verify the endpoint answers (handshake, no restart needed)

A live `initialize` handshake confirms the URL + token before the user restarts. Write the body to a temp
file (an inline shell string gets mangled → `400 Invalid message format`), then:

```
printf '%s' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"bluestep-mcp-connect","version":"1.0"}}}' > "${TMPDIR:-/tmp}/mcp-init.json"

curl -sS -i --max-time 25 -X POST "https://<subdomain>.bluestep.net/mcp" \
  -H "Authorization: Bearer $B6PT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  --data-binary @"${TMPDIR:-/tmp}/mcp-init.json"
```

Interpret the response:

- **`200`** with a JSON-RPC `result` (`serverInfo`, `capabilities`) → connection is good. For the global
  path, `claude mcp list` should also now show `bluestep-<subdomain>`.
- **`401` / `403`** → the token is missing/expired/invalid. Send the user back to step 0 to regenerate it
  (the `Regenerate` button on the same Access Tokens screen). Do not retry in a loop.
- **`400 Invalid message format`** → the request body/headers are wrong, not an auth failure. Re-send with
  the **file-based body** and the `MCP-Protocol-Version` header exactly as above.
- **Connection refused / DNS error / non-BlueStep response** → the URL/subdomain is wrong. Recheck with
  the user; do not retry blindly.

Do **not** print `$B6PT_TOKEN`; `curl -i` echoes only response headers, never the request's `Authorization`.

### 5. Report and tell the user to restart

Summarize:

```
Registered MCP server: bluestep-<subdomain>  →  https://<subdomain>.bluestep.net/mcp
Scope:                 user (global — available in every workspace)   [or: this workspace's .mcp.json]
Credential:            $B6PT_TOKEN (resolved into user-private ~/.claude.json)   [or: ${B6PT_TOKEN}, secret stays in env]
Handshake:             200 OK (serverInfo: <name/version>)

⚠ Start a NEW Claude Code session to load the connection — MCP tools register only at startup, so the
  mcp__bluestep-<subdomain>__* tools will not appear in this session.
```

Mention the counterpart option once: for the global path, note it can be confined to one workspace with
3b; for the per-workspace path, note it can be made global with `--scope user`. Remove later with
`claude mcp remove "bluestep-<subdomain>" --scope user` (global) or by deleting the key from `.mcp.json`.

## Security & token handling

The `b6pt_` token is a **bearer credential for a global super-user** — whoever holds it can act as the user
across every org. Handle it accordingly, and be honest with the user about its limits.

- **Not encrypted at rest.** The token lives in plaintext in the `B6PT_TOKEN` env var (shell profile /
  Windows user env) and, on the global path, is also written literally into `~/.claude.json`. Both are
  user-private and uncommitted, but readable by any process running as the user. This is weaker than the
  b6p CLI's encrypted `~/.b6p/secrets.enc` — Claude Code has no encrypted-header MCP mechanism, so
  plaintext-user-private is the floor.
- **Prefer the per-workspace `.mcp.json` path (3b) when at-rest hygiene matters** — it keeps the secret in
  exactly one place (the env var) via `${B6PT_TOKEN}`, so rotation/revocation is clean and nothing is
  copied into `~/.claude.json`.
- **Recommend an expiry + least-privilege scopes at creation.** The Access Tokens screen has Scopes and
  Expires columns; a never-expiring, unscoped global-super token is the riskiest shape. Setting an expiry
  and scopes (and questioning whether it needs to be a global-super token at all) reduces risk more than
  anything about where the token is stored.
- **Never print or leak the token, and never send it anywhere other than the org's own MCP endpoint** (as
  the `Authorization` header, over HTTPS — which steps 3a/4 do). Never write the literal value into a
  committed file or echo it to the transcript. It grants global admin — a leaked value is a full platform
  compromise. If exposed, tell the user to **Revoke** it on that same screen and rotate.

## What this skill must NOT do

- Do **not** guess or derive the org subdomain/URL from a display name — ask.
- Do **not** pass the literal `b6pt_` token on a command line or write it into a committed file — inject
  `$B6PT_TOKEN` (global) or reference `${B6PT_TOKEN}` (per-workspace).
- Do **not** overwrite or drop other orgs' entries when editing `.mcp.json` — merge only this org's key.
- Do **not** claim the connection works without the 200 handshake, and do **not** claim the tools are live
  in the current session — they require a restart.
- Do **not** ask the user to paste the token into the chat.
