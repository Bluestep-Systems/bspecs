# Installing bspecs (for a Claude Code session)

**Audience: an AI assistant (Claude Code).** A user has given you this repo link and
asked you to install the `bspecs` tool on their machine. They may not use a terminal —
do every step yourself with your own tool calls and report what happened. Do not ask the
user to run commands.

**Scope of this document: install only** — download the prebuilt binary and put it on the
`PATH`. This is fully non-interactive (no prompts). **Do not run `bspecs new` or
`bspecs init` as part of installing** — those are interactive (they prompt for a project
name, client, etc.) and would hang waiting for input you cannot provide. Scaffolding a
project is a separate step the user initiates later.

## What you are installing

`bspecs` ships as a **self-contained binary** (Node is embedded). The target machine needs
**no Node and no npm** — do not run `npm install` or `npx`. The binaries are attached to
the latest GitHub Release of `github.com/Bluestep-Systems/bspecs`.

It lives in a shared BlueStep bin directory that also holds the `b6p` binary:

| OS | Directory |
|----|-----------|
| Windows | `%LOCALAPPDATA%\BlueStep\bin\` |
| macOS | `~/.bluestep/bin/` |

## Step 1 — Determine OS and architecture

- **Windows** → asset `bspecs-win-x64.exe`
- **macOS, Apple Silicon** (`uname -m` → `arm64`) → asset `bspecs-macos-arm64`
- **macOS, Intel** (`uname -m` → `x86_64`) → asset `bspecs-macos-x64`

GitHub serves the newest release asset at a stable URL — no API call or token needed:
`https://github.com/Bluestep-Systems/bspecs/releases/latest/download/<asset>`

## Step 2 — Download, place, and PATH

### macOS

```bash
mkdir -p ~/.bluestep/bin

# Pick ONE asset for the detected architecture:
#   Apple Silicon: bspecs-macos-arm64    Intel: bspecs-macos-x64
ASSET=bspecs-macos-arm64   # or bspecs-macos-x64
curl -fL -o ~/.bluestep/bin/bspecs \
  "https://github.com/Bluestep-Systems/bspecs/releases/latest/download/$ASSET"

chmod +x ~/.bluestep/bin/bspecs
# Clear the quarantine flag so Gatekeeper doesn't block a locally downloaded binary:
xattr -d com.apple.quarantine ~/.bluestep/bin/bspecs 2>/dev/null || true
```

Ensure the directory is on `PATH`. Add this line to the user's shell profile (`~/.zshrc`
for the default macOS zsh; also `~/.bash_profile` if they use bash) **only if not already
present**:

```bash
export PATH="$HOME/.bluestep/bin:$PATH"
```

For the current session, also export it directly so you can verify immediately:
`export PATH="$HOME/.bluestep/bin:$PATH"`.

### Windows (PowerShell)

```powershell
$dir = "$env:LOCALAPPDATA\BlueStep\bin"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Invoke-WebRequest `
  -Uri "https://github.com/Bluestep-Systems/bspecs/releases/latest/download/bspecs-win-x64.exe" `
  -OutFile "$dir\bspecs.exe"

# Add the dir to the user PATH (persisted), only if not already there:
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$dir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$dir", "User")
}
# Make it available in the current session too:
$env:Path = "$env:Path;$dir"
```

Name it `bspecs.exe` (as above) so `bspecs` resolves on `PATH`. Invoking it from a shell
does not trigger a SmartScreen prompt (that only happens on GUI double-click).

## Step 3 — Verify

Run the version check. A freshly persisted `PATH` may not be visible until a new shell, so
fall back to the full path if `bspecs` isn't found yet:

```bash
bspecs -v        # macOS;  or:  ~/.bluestep/bin/bspecs -v
```

```powershell
bspecs -v        # Windows;  or:  & "$env:LOCALAPPDATA\BlueStep\bin\bspecs.exe" -v
```

It should print a version like `0.15.0`. If it does, the install succeeded — stop here and
tell the user bspecs is installed, and that they can now ask you to scaffold a project
(`bspecs new` / `bspecs init`) when they're ready.

## Notes

- **Platform credentials are separate.** The `b6p` CLI (in the same bin directory) needs
  BlueStep credentials set once per machine via `b6p auth set`. That is unrelated to
  installing bspecs and is not part of this document.
- **Updating:** re-run Step 2 — the `latest/download` URL always fetches the newest release,
  and the download overwrites the existing binary in place.
