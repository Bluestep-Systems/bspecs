# BlueStep machine setup (bootstrap)

One command that gets your computer ready for the BlueStep AI tools. You run it once, in your own
terminal. It installs what is missing, signs you in where needed, and tells you what is left.

It does not need admin rights, and it never asks for an admin password.

## What it does

1. **Looks at your computer:** which AI apps you have (Claude, Cursor, Codex) and which tools are
   already there.
2. **Installs the tools** the BlueStep plugins need, for your user only: Git, Node.js, the GitHub
   CLI (`gh`), the `b6p` CLI, and the Claude Code CLI when you use Claude. Each one is a version we
   tested, and the script checks every download against a known fingerprint (SHA-256) before it
   uses it. A tool you already have that works and is new enough is left alone.
3. **Signs you in to GitHub** in your browser, so your computer can download the plugins.
4. **Saves your BlueStep platform token**, which you paste once. It is checked with BlueStep first,
   and it never shows on screen or in any log.
5. **Installs the plugins** for each AI app it found: `bluestep-tools` and `core-tools`, and, if you
   say yes, `phi-guard` and `one-tools`.
6. **Shows a summary:** one line per item, and what to do next.

On a test computer the first run took under ten minutes. Most of the waiting is downloads and the
GitHub sign-in.
Anything slow prints what it is doing and a "still working" line every 10 seconds.

## Before you start

- **Install your AI app first** (Claude, Cursor or Codex). The script sets up plugins only for the
  apps it finds.
- **Have your BlueStep platform token ready.** It starts with `b6pt_`. To create one, in BlueStep:
  Tools → Organization Admin → Super → Global Users → your user → Access Tokens → Create New Token
  (give it an expiry date). No Super tab? Then you cannot create one yourself: ask BlueStep for one.
  You can also skip it and run the script again later.
- **Have a GitHub account.** For `one-tools` (BlueStep One work, staff only), your account needs
  access to its private repo; the script checks that before it tries.

## Run it

Supported now: **Windows (64-bit Intel or AMD).** macOS and Linux are coming.

1. Open the Start menu, type **PowerShell**, and open **Windows PowerShell**. Open it normally, not
   with "Run as administrator".
2. Copy this line, paste it into the window (right-click pastes), and press Enter:

   ```powershell
   irm https://raw.githubusercontent.com/Bluestep-Systems/bluestep-ai/bootstrap-v1.0.0/bootstrap/bootstrap.ps1 | iex
   ```

3. When it is your turn, the window beeps and shows a **YOUR TURN** block that says what to do.
   They are numbered ("1 of 4"): the GitHub sign-in, the token, a yes/no for each of the two
   optional plugins, and a last one that says how to finish. A run on a computer that is already
   set up asks fewer, or none.
4. At the end, do what the last block says: **quit the app fully** (from the tray icon next to the
   clock → Quit; closing the window is not enough), open it again, open your project folder, and
   type `/b6p-setup`.

### Download, check, read, then run

If you would rather see the script before it runs:

1. Open the release page,
   [`bootstrap-v1.0.0`](https://github.com/Bluestep-Systems/bluestep-ai/releases/tag/bootstrap-v1.0.0).
   Its notes list the script's SHA-256.
2. In PowerShell, download it and compare the hash (put the hash from the release notes where it
   says `<hash>`):

   ```powershell
   irm https://raw.githubusercontent.com/Bluestep-Systems/bluestep-ai/bootstrap-v1.0.0/bootstrap/bootstrap.ps1 -OutFile bootstrap.ps1
   if ((Get-FileHash .\bootstrap.ps1 -Algorithm SHA256).Hash -eq '<hash>') { 'hash ok' } else { 'HASH MISMATCH - do not run it' }
   ```

3. Read it: `notepad .\bootstrap.ps1`.
4. Run it:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1
   ```

The release notes have the same commands with the hash already filled in.

## Options

Add an option after the file name when you run the downloaded file, for example
`powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 -DryRun`. With the one-line
form, use this shape instead (a plain `| iex` cannot take options):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Bluestep-Systems/bluestep-ai/bootstrap-v1.0.0/bootstrap/bootstrap.ps1))) -DryRun
```

| Option | What it does |
| --- | --- |
| `-DryRun` | Only looks and tells you what it would do. Downloads nothing, asks nothing, changes nothing (it writes only its log file). |
| `-SkipToken` | Skips the GitHub sign-in and the platform token. |
| `-SkipPlugins` | Skips the plugins (and the Claude Code CLI, which only that step needs). |
| `-PhiGuard` | Installs `phi-guard` without asking. It stops the AI agent when it is about to write what looks like real client data into a BlueStep project. |
| `-OneTools` | Installs `one-tools` without asking (Claude only; your GitHub account needs access to its private repo). |
| `-NoOptIns` | Does not ask about `phi-guard` or `one-tools` and does not install them. `-PhiGuard` and `-OneTools` still win. Plugins you already have are kept. |

## Reading the summary

Each item gets one status:

- **ok** — it was already fine. Nothing changed.
- **installed** — this run set it up.
- **needs you** — a step only you can do. The line says what, for example: another copy of a tool
  on your computer is found first and should be removed or updated, the token was refused, or the
  clicks Cursor needs.
- **needs IT** — the tool was installed in your user folder, but Windows would not run it from
  there. This is usually a company policy. Show IT the path in the line.
- **failed** — something went wrong. The line says what. Fix it and run the script again.
- **skipped** — you chose to skip it, or it does not apply to your computer.
- **would install** — only in a dry run: what a real run would do.

The summary also shows the path of the log file. The log is in
`%USERPROFILE%\.bluestep\bootstrap\`, one file per run, and it never holds your token.

## Run it again any time

It keeps what works. A second run on a ready computer takes a few seconds, asks nothing, and
changes nothing. If a run stopped halfway, or something broke later, or there is a new version of
the script, just run it again: it repairs what is missing.

## Undo

There is no automatic undo. To remove what the script added:

1. **Plugins** (Claude):
   `claude plugin uninstall bluestep-tools@bluestep`, then the same for `core-tools@bluestep`,
   `phi-guard@bluestep` and `one-tools@bluestep-internal` if you have them. Codex:
   `codex plugin remove` for each one. Cursor: remove them from its plugins screen.
2. **The `b6p` login:** `b6p auth clear`.
3. **The GitHub sign-in** (optional): `gh auth logout`.
4. **The platform token** in your user environment:

   ```powershell
   [Environment]::SetEnvironmentVariable('B6PT_TOKEN', $null, 'User')
   ```

   If you will not use the token again, also revoke it in BlueStep (the same Access Tokens screen).
5. **The tools:** delete the folder `%LOCALAPPDATA%\BlueStep\tools` (Node.js, gh and `b6p`). Do
   this after steps 2 and 3, which need `b6p` and `gh`.
6. **Git:** Settings → Apps → Installed apps → Git → Uninstall. This is the copy in
   `%LOCALAPPDATA%\Programs\Git`, installed for your user only.
7. **The PATH entries:** open the Start menu, type **environment variables**, open **Edit
   environment variables for your account**, select **Path** → **Edit**, and remove the lines that
   point into `%LOCALAPPDATA%\BlueStep\tools`. Remove `%USERPROFILE%\.local\bin` too, unless you use
   the Claude Code CLI.

Then quit and reopen your AI app.

## For maintainers

The script is pure ASCII and runs on Windows PowerShell 5.1 and PowerShell 7. The tool versions,
download URLs and hashes it uses are in
[`tool-versions.json`](../plugins/bluestep-tools/skills/b6p-setup/assets/tool-versions.json),
fetched at the script's own tag. A change under `bootstrap/` or to that file needs a bump of
`bootstrap/version.json` (and the matching `$ScriptVersion` in `bootstrap.ps1`); the merge to `main`
then tags `bootstrap-v<version>` and cuts its Release with the hashes. Why it works this way:
[`docs/decisions/machine-bootstrap.md`](../docs/decisions/machine-bootstrap.md).
