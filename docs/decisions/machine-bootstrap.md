# ADR: A machine bootstrap script the user runs, with pinned and hashed tools

**Status:** Accepted (2026-11-05). The Windows script (`bootstrap/bootstrap.ps1`) is bootstrap
1.0.0. The macOS and Linux script (`bootstrap/bootstrap.sh`) is planned and not written yet; the
macOS and Linux parts below are the plan for it.

**Date:** 2026-11-05

**Supersedes in part:** [`b6p-cli-distribution.md`](b6p-cli-distribution.md) (Option C's "print
the commands, no half-failed automatic setup") and [`setup-consolidation.md`](setup-consolidation.md)
(decision 6, README prompt 1, where the agent runs the npm install of `b6p`).

**Relates to:** [`platform-mcp-integration.md`](platform-mcp-integration.md) (the token is never
passed as a command literal), [`tooling-repo-consolidation.md`](tooling-repo-consolidation.md)
(the marketplace layout, the old repo name, and phase 3's internal marketplace for one-tools),
[`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) (the
script is public).

## Context

A new helper's setup on Windows (2026-11-03) took about an hour. Most of it went to things no
skill can do from inside a session:

- Node's only winget installer is a machine-wide MSI that asks for an admin password. The GitHub
  CLI's MSI does too. The helper had no admin rights.
- Without Node (or another JSON parser), the guardrail hooks fail closed and block every
  browser-pane call, so the setup's own checks could not run until Node was there.
- one-tools comes from a private repo. The desktop app said only "Plugin couldn't be installed"
  until git had a GitHub login.
- `b6p` was 0.4.0 and was still reported ok; `/b6p-push` stops below 0.8.1.

`/b6p-setup` step 1 only checks the machine and hands over commands. That is right for an agent:
it must never ask for a credential in chat or download a binary. But it makes every missing piece a
round trip through the user.

What only a person can do: sign in to GitHub in a browser, paste the platform token, click in a
GUI that has no command (Cursor), and quit and reopen the app.

## Decision

1. **A script the user runs in their own terminal, never the agent.** `bootstrap/bootstrap.ps1`
   (Windows) and, planned, `bootstrap/bootstrap.sh` (macOS, Linux). The run needs a browser
   sign-in and a secret, and the skills' rules keep both away from the agent. The agent's part is
   to hand over the one-liner (`/b6p-setup` step 1, when a machine item is missing or below its
   minimum) and to check the machine afterwards. "Never download a binary yourself" still binds the
   agent; a person who can read the script first is the line.
2. **Per user, no admin.** Node, gh and `b6p` go under `%LOCALAPPDATA%\BlueStep\tools\`. Git uses
   its own installer per user. The Claude Code CLI is set up with `claude install <pinned
   version>` when a Claude tool is on the machine. The script adds to the user `PATH` and the
   session's `PATH`, and never edits the machine `PATH` itself (see 7 for the Git installer). A tool that works and is at or above its
   minimum is left alone, never downgraded. After an install the tool is resolved the way a new
   shell would; if another copy still wins, the item says "needs you" with that copy's path. A tool
   that installs but does not run from the user folder (AppLocker, WDAC, antivirus) says "needs
   IT". The body is one function called on the last line, so a download cut off halfway runs
   nothing. Each step checks state before it acts, so a second run changes nothing that works and
   a stopped run continues.
3. **Pinned versions and SHA-256 in one versions file.**
   `plugins/bluestep-tools/skills/b6p-setup/assets/tool-versions.json` holds, per tool and per OS /
   architecture pair, the pinned version, the official download URL and its SHA-256 (for `b6p` from
   npm, the `integrity`), plus each tool's minimum. The script fetches it at its own tag and checks
   each download's hash against it before anything is unpacked or run; a wrong hash stops that item
   and installs nothing. The skills read the minimum `b6p` from the same file, so there is one
   number. CI checks the file (every `min` ≤ its `pinned`, the `b6p-push` frontmatter number equals
   the `b6p` minimum). A weekly workflow compares each pin with the latest release and opens or
   updates one issue; a Node security release is listed first. It never opens the bump PR. The file
   also holds where one-tools comes from (`plugins.one-tools`: plugin id, marketplace name and
   source, the repo to check access on), so the scripts name none of it.
4. **The token never touches a command line.** It is read once with hidden input from the
   terminal, checked against the gateway with a header built in the process, and only then stored.
   A refused token is never saved; when the gateway cannot be reached, the token is kept, unchecked,
   and the item says so. No `setx`, no `Start-Transcript`, and the log never holds it. Where it is
   stored, per OS:
   - **Windows:** the user environment variable `B6PT_TOKEN`, set in-process with
     `[Environment]::SetEnvironmentVariable('B6PT_TOKEN', <value>, 'User')`. It is plaintext in the
     user's registry, not a file. A program started afterwards sees it without a sign-out (measured).
     `b6p` gets its own copy through `b6p auth set`, with the token on its stdin.
   - **macOS (planned):** the login Keychain (`security add-generic-password … -w` with no value,
     so `security` prompts on the terminal itself), plus a LaunchAgent that at login reads the
     Keychain and calls `launchctl setenv`, because GUI apps read no shell profile and a plain
     `launchctl setenv` is lost at logout. No file holds the token. The cost: at login,
     `launchctl setenv` has the token in its arguments, so another local process could see it for a
     moment. That is less exposure than a file, and it is still exposure. Not proven yet.
   - **Linux (planned):** `~/.config/bluestep/b6pt.env`, mode 600, sourced from `~/.profile`.
   - Later, for Claude Code on every OS: plugin `userConfig` with `sensitive: true` (the OS secure
     store). A follow-up, not part of this.
5. **The scripts are their own release stream.** `bootstrap/version.json` holds the version;
   `release-tag.yml` tags `bootstrap-v<version>` on merge to `main` (tag-exists skip, no
   `--force`), and the Release notes carry the SHA-256 of each script and the one-liners pinned to
   that tag. The documented one-liner names the tag, and the "download, check the hash, read, run"
   form sits next to it. CI fails a change under `bootstrap/**` or to `tool-versions.json` without a
   `bootstrap/version.json` bump that is not tagged yet, and fails when the script's own
   `$ScriptVersion` differs from `version.json` (the script cannot read that file when it runs
   through `iex`).
6. **Git on Windows: the per-user installer, with two fixed options.** `Git-<v>-64-bit.exe` from
   the Git for Windows release, run with `/VERYSILENT /NORESTART /CURRENTUSER /o:PathOption=Cmd`,
   and the script adds `/DIR=%LOCALAPPDATA%\Programs\Git`. It brings Git Credential Manager, which
   PortableGit and MinGit do not wire up. The first CI runs showed why both options are needed: the
   installer reuses the folder of an earlier Git install it finds in the registry, so `/DIR` is
   always passed (and the report says where Git went if it still lands elsewhere); and, run
   elevated, it reused that install's "Unix tools on PATH" choice, so `/o:PathOption=Cmd` keeps
   only Git's `cmd` folder on the `PATH`.
7. **Warn when elevated.** Run as administrator, the Git installer writes the machine `PATH` for
   every user instead of the user's own. The script does not need admin, so it says so, asks the
   user to reopen PowerShell normally, and waits 10 seconds before it goes on (Ctrl+C stops it).
8. **A special case for `b6p` 0.8.2's `auth set`.** On 0.8.2, `auth set` asks twice on a fresh
   store, and with the token on stdin the second question hits end of input and exits 1, after
   the token was stored correctly (measured). On a store that already holds a token, a piped token
   is ignored. So the script runs `b6p auth clear`, then pipes the token, and treats exit 1 as
   success only when the output names that second question and `~\.b6p\secrets.enc` was rewritten.
   When a `b6p` release ships the single-prompt `auth set` and `auth status`, the pin moves to it
   and this case goes.
9. **Plugins: read first, never remove.** On Claude Code the script reads the marketplace
   registration first. Absent → it adds it at user scope. Registered under the repo's old name,
   from managed settings, or from another source → it leaves it as it is and installs against it.
   It never runs `marketplace remove`, which uninstalls the plugins and deletes their saved data.
   one-tools installs only after `gh api` shows the GitHub login can read its repo; otherwise the
   item says to ask for access and the rest goes on. Codex: the same read-first add, then
   `codex plugin add`. Cursor has no command for this, so the report lists the clicks.

Exit code (when run as a file): 0 when no item failed, also when some say "needs you" or "needs
IT"; 1 when an item failed or the run stopped early.

## Consequences

**Good.** One command, at most two answers that are the user's (the GitHub sign-in and the token)
plus the opt-in choices, and no admin password. Measured on a clean Windows 11 account without
admin rights (`.claude/specs/machine-bootstrap/tasks.md`, task 7): about seven and a half minutes,
three of them the GitHub sign-in; no UAC prompt; every tool at its pinned version; the token in no
process command line, log or history; after a full app restart, all plugins loaded and `/b6p-setup`
step 1 reported every machine item ok. A second run took 8 seconds and changed nothing. A tool
version is a value in one file, checked by CI and watched weekly.

**Costs and risks.**

- **A runnable artifact outside `plugins/`.** The generator does not see it, and it has no unit
  suite. The `bootstrap-smoke` CI job runs it on `windows-latest`: a dry run under Windows
  PowerShell 5.1 and PowerShell 7, a real run with `-SkipToken -SkipPlugins`, a check that each
  tool resolves at its pinned version, then a second run that must change nothing. GitHub's
  runners have admin, so the no-admin claim is checked only by hand, per release.
- **Whoever can move a `bootstrap-v*` tag changes what helpers run.** The published hash lets a
  careful user notice; the tag ruleset below is the control.
- **Pins go stale.** The weekly issue is the control; a bump is one change to the versions file
  plus a re-test.
- **The token is plaintext at rest on Windows** (the user registry), as it was with `setx`. What
  changes is that it is never on a command line. On macOS the plan has the short `launchctl setenv`
  exposure named above.
- **The skills still hand over per-item commands** for a machine where the script is not
  available (macOS and Linux today) or for a user who prefers them.

**Not observed yet.** The `irm … | iex` one-liner from a published tag; the GitHub, token and
plugin steps under PowerShell 7 (CI runs only the tool steps there); a run stopped halfway and run
again; anything on macOS or Linux.

## Open admin step

After the first merge: a repository ruleset that blocks moving or deleting `bootstrap-v*` tags. Until
it exists, a tag can be moved by anyone with push rights. Then confirm that the first
`bootstrap-v1.0.0` Release shows the script's SHA-256.

## Testing

Where each kind of test runs (GitHub runners, the Hyper-V VM for Windows without admin, a real Mac
with a standard account, a pilot laptop under device management) is in
[`docs/windows-test-vm.md`](../windows-test-vm.md) → "Where this fits: the test matrix". Each
bootstrap release gets one full run on a clean Windows account without admin, in that VM.

## References

- Spec: `.claude/specs/machine-bootstrap/{requirements,design,tasks}.md` (the design's "Prove-out"
  section and the task notes hold the measured results)
- Scripts: [`bootstrap/`](../../bootstrap/) — `bootstrap.ps1`, `version.json`,
  [`README.md`](../../bootstrap/README.md) (for users: the one-liner, options, undo)
- Versions file:
  [`tool-versions.json`](../../plugins/bluestep-tools/skills/b6p-setup/assets/tool-versions.json)
- CI / release: `.github/workflows/ci.yml` (versions-file check, bump check, `bootstrap-smoke`),
  `.github/workflows/release-tag.yml`, `.github/workflows/bootstrap-versions-check.yml`
