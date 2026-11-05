<#
.SYNOPSIS
  BlueStep machine bootstrap for Windows: installs the tools the BlueStep agent plugins need,
  per user, with no admin rights.

.DESCRIPTION
  Run it in your own terminal (never from an agent). What it does, in order:
    1. Detects the OS, architecture and the agent tools present (Claude Code CLI, Claude desktop
       app, Cursor, Codex), prints its own version and opens a log file under
       %USERPROFILE%\.bluestep\bootstrap\.
    2. Loads tool-versions.json (pinned versions, download URLs, SHA-256) from this script's own
       release tag, or from -Ref / -VersionsFile.
    3. For node, git, gh, b6p and the Claude Code CLI: a copy that works and is at or above the
       minimum is left alone (never downgraded). A missing, old or broken one is downloaded at the
       pinned version, its SHA-256 is checked against tool-versions.json BEFORE it is unpacked or
       run, and it is installed per user under %LOCALAPPDATA%\BlueStep\tools\ (Git and the Claude
       CLI use their own per-user installers). The user PATH and this session's PATH are updated.
       If another copy still wins in a new shell, the item is reported as "needs you".
    4. GitHub login: when gh is not signed in, runs "gh auth login --web" in this console (you
       sign in in the browser), then "gh auth setup-git", so git can read private repos. When
       your git config has no GitHub credential helper yet, gh is set as that helper first, so
       gh does not ask "Authenticate Git with your GitHub credentials?" (undone if the sign-in
       does not finish).

  Every point where you must act shows a "YOUR TURN (n of N)" block with a beep, and the
  window title says "Waiting for you". Anything that takes more than a few seconds says what
  it is doing and prints "still working... N s" every 10 seconds.
    5. Platform token: keeps a B6PT_TOKEN the gateway accepts. Otherwise asks for it with hidden
       input, saves it as your user environment variable (in-process, not setx) and in b6p
       ("b6p auth set", token on its stdin), and checks it against the gateway.
    6. Plugins, for each agent tool found:
       - Claude Code (CLI and desktop app, which share ~\.claude): reads the "bluestep"
         marketplace registration first. Absent -> "claude plugin marketplace add" (user scope).
         Registered under the repo's old name, from managed settings, or from another source ->
         left exactly as it is, and the plugins install against it. A marketplace is never
         removed (that uninstalls its plugins and deletes their saved data). Then installs
         bluestep-tools and core-tools at user scope when they are not installed yet, and the
         opt-ins you choose: phi-guard, and one-tools (private: the GitHub login must be able to
         read its repo first; if not, you are told whom to ask and the rest goes on).
       - Codex: the same read-first rule for its marketplace, then "codex plugin add" for
         bluestep-tools and phi-guard if chosen (one-tools is Claude Code only). Codex asks you to
         trust each plugin's hooks once: Plugins -> the plugin -> Review -> trust.
       - Cursor: has no command for this; the report lists the clicks.
    7. Report: one table (item, status, detail), the script version, the log file, and the next
       step: quit the app fully, reopen it, open your project folder and run /b6p-setup.

  It never asks for elevation, never edits the machine PATH, never uses setx, and writes no
  secret to the screen or the log.

  Statuses in the report: ok (already fine, nothing changed), installed (done by this run),
  would install (dry run), needs you (a step only you can do; the detail says which), needs IT,
  failed, skipped.

.PARAMETER DryRun
  Read-only: detect, resolve and print what would be downloaded and installed, whether a GitHub
  login is needed, and whether a token and a b6p login are stored. Nothing is downloaded, no
  prompt is shown, the token is not sent anywhere, and nothing is written except the log file.

.PARAMETER VersionsFile
  Path to a local tool-versions.json, instead of the one at this script's release tag.

.PARAMETER Ref
  Git ref (branch, tag or commit) of Bluestep-Systems/bluestep-ai to load tool-versions.json from,
  instead of this script's release tag. Ignored when -VersionsFile is given.

.PARAMETER SkipToken
  Skip the GitHub login and platform token steps (steps 4-5). Both are reported as skipped.

.PARAMETER SkipPlugins
  Skip the plugin step (step 6). Also skips installing the Claude Code CLI, which only that step
  needs.

.PARAMETER PhiGuard
  Install the phi-guard opt-in plugin (Claude Code, Codex; Cursor gets the click) without asking.

.PARAMETER OneTools
  Install the one-tools opt-in plugin (Claude Code only) without asking. Needs read access to its
  private repo with your GitHub login.

.PARAMETER NoOptIns
  Do not ask about the opt-in plugins and do not install them. -PhiGuard and -OneTools still win
  for the one they name. Opt-ins already installed are kept either way.

.EXAMPLE
  # Run from a file you downloaded, checked and read:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 -DryRun

.EXAMPLE
  # One-liner with no options:
  irm https://raw.githubusercontent.com/Bluestep-Systems/bluestep-ai/bootstrap-v1.0.0/bootstrap/bootstrap.ps1 | iex

.EXAMPLE
  # One-liner with options (iex cannot pass parameters; a script block can):
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Bluestep-Systems/bluestep-ai/bootstrap-v1.0.0/bootstrap/bootstrap.ps1))) -DryRun

.NOTES
  Exit code (when run as a file): 0 when no item failed, also when some items say "needs you"
  or "needs IT"; 1 when any item failed or the run stopped early.
  This file must stay pure ASCII: Windows PowerShell 5.1 reads a BOM-less file as ANSI.
  The whole body is one function called on the last line, so a download cut off halfway runs
  nothing.
#>
param(
    [switch]$DryRun,
    [string]$VersionsFile,
    [string]$Ref,
    [switch]$SkipToken,
    [switch]$SkipPlugins,
    [switch]$PhiGuard,
    [switch]$OneTools,
    [switch]$NoOptIns
)

function Invoke-BlueStepBootstrap {
    param(
        [switch]$DryRun,
        [string]$VersionsFile,
        [string]$Ref,
        [switch]$SkipToken,
        [switch]$SkipPlugins,
        [switch]$PhiGuard,
        [switch]$OneTools,
        [switch]$NoOptIns
    )

    # Keep in step with bootstrap/version.json (the script cannot read that file under iex).
    $ScriptVersion = '1.0.0'
    $RepoSlug = 'Bluestep-Systems/bluestep-ai'
    $VersionsPathInRepo = 'plugins/bluestep-tools/skills/b6p-setup/assets/tool-versions.json'
    $GatewayUrl = 'https://gateway.bluestep.net/mcp'
    # The marketplace this repo serves. Its old repo name still works through GitHub's redirect
    # (docs/decisions/tooling-repo-consolidation.md, phase 2), so a registration under it is kept.
    $MarketplaceName = 'bluestep'
    $OldRepoSlug = 'Bluestep-Systems/bspecs'

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'

    # ---------------------------------------------------------------- run state

    $results = New-Object System.Collections.Generic.List[object]   # item, status, detail (report: task 6)
    $secrets = New-Object System.Collections.Generic.List[string]   # values Hide-Secret removes (token: task 5)
    $agents = [ordered]@{}                                          # agent tools found (step 6)
    $optIns = @{}                                                   # opt-in choices, asked once per run
    $runFlags = @{}                                                 # facts the report needs (one-tools ready)
    $turnState = @{ Used = 0; Last = ''; Planned = (New-Object System.Collections.Generic.List[string]) }   # YOUR TURN numbering
    $logFile = $null
    $toolsRoot = Join-Path $env:LOCALAPPDATA 'BlueStep\tools'
    $sessionPathBefore = $env:Path

    # ---------------------------------------------------------------- log and redaction

    function Register-Secret([string]$Value) {
        # Task 5 registers the token here as soon as it is read, before anything can print it.
        if ($Value -and $Value.Length -ge 4 -and -not $secrets.Contains($Value)) { $secrets.Add($Value) }
    }

    function Hide-Secret([string]$Text) {
        if ($null -eq $Text) { return '' }
        $out = $Text
        foreach ($s in $secrets) { $out = $out.Replace($s, '[redacted]') }
        # Token shapes, in case one reaches a message without being registered first.
        $out = [regex]::Replace($out, 'b6pt_[A-Za-z0-9_\-\.]+', 'b6pt_[redacted]')
        $out = [regex]::Replace($out, '\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+', '$1[redacted]')
        $out = [regex]::Replace($out, '(?i)(authorization:\s*(bearer|token|basic)\s+)\S+', '$1[redacted]')
        return $out
    }

    function Write-Log([string]$Message, [string]$Level = 'info') {
        $clean = Hide-Secret $Message
        if ($logFile) {
            $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $clean
            try { [IO.File]::AppendAllText($logFile, $line + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false))) } catch { }
        }
    }

    function Say([string]$Message, [string]$Level = 'info') {
        Write-Log $Message $Level
        $clean = Hide-Secret $Message
        switch ($Level) {
            'warn'  { Write-Host $clean -ForegroundColor Yellow }
            'error' { Write-Host $clean -ForegroundColor Red }
            'step'  { Write-Host ''; Write-Host $clean -ForegroundColor Cyan }
            'ok'    { Write-Host $clean -ForegroundColor Green }
            default { Write-Host $clean }
        }
    }

    function Add-Result([string]$Item, [string]$Status, [string]$Detail) {
        # Status: ok | installed | would install | needs you | needs IT | failed | skipped
        $results.Add([pscustomobject]@{ Item = $Item; Status = $Status; Detail = (Hide-Secret $Detail) })
        $level = switch ($Status) { 'ok' { 'ok' } 'installed' { 'ok' } 'failed' { 'error' } 'needs you' { 'warn' } 'needs IT' { 'warn' } default { 'info' } }
        Say ('  {0}: {1} - {2}' -f $Item, $Status, $Detail) $level
    }

    # ---------------------------------------------------------------- progress (waits the user can see)

    function Write-Activity([string]$What, [string]$Eta) {
        # One plain line before anything that can take more than a few seconds, so a silent wait
        # does not look stuck. It goes to the log too; the heartbeats below do not.
        if ($Eta) { Say "    $What - $Eta..." } else { Say "    $What..." }
    }

    function Wait-WithHeartbeat([scriptblock]$Until, [int]$TimeoutSec = 0, [scriptblock]$Note) {
        # Calls $Until (which itself waits up to about a second) until it returns $true, printing
        # "still working... N s" every 10 s to the console only. $Note may add a short text (e.g.
        # MB so far). $TimeoutSec 0 = no limit. Returns $true when done, $false on timeout.
        $hbClock = [Diagnostics.Stopwatch]::StartNew()
        $hbNext = 10
        while (-not (& $Until)) {
            $hbSec = $hbClock.Elapsed.TotalSeconds
            if ($TimeoutSec -gt 0 -and $hbSec -ge $TimeoutSec) {
                Write-Log ('    stopped waiting after {0} s' -f [int]$hbSec)
                return $false
            }
            if ($hbSec -ge $hbNext) {
                $hbExtra = ''
                if ($Note) { try { $hbExtra = [string](& $Note) } catch { $hbExtra = '' } }
                Write-Host ('      still working... {0} s{1}' -f $hbNext, $hbExtra) -ForegroundColor DarkGray
                $hbNext += 10
            }
        }
        Write-Log ('    finished after {0} s' -f [int]$hbClock.Elapsed.TotalSeconds)
        return $true
    }

    function Wait-NetTask($Task, [int]$TimeoutSec, [scriptblock]$Note) {
        # A .NET Task (WebClient download or upload) with heartbeats. WaitAny never throws for a
        # faulted task; the caller reads IsFaulted / Exception afterwards.
        $tasks = [Threading.Tasks.Task[]]@($Task)
        return (Wait-WithHeartbeat { [Threading.Tasks.Task]::WaitAny($tasks, 1000) -ge 0 } $TimeoutSec $Note)
    }

    # ---------------------------------------------------------------- your turn (questions)

    # Every point where the user must act shows the same block: a rule, "YOUR TURN (n of N) -
    # <title>", plain lines, then the question. n counts the blocks shown so far; N is n plus
    # the ones still planned (Get-PlannedTurns), so a skipped one lowers N instead of leaving
    # a gap. A retry of the same question keeps its number.

    function Get-TurnNumber([string]$Key) {
        if ($null -eq $turnState) { return @(1, 1) }
        if ($turnState.Last -ne $Key) {
            $turnState.Used++
            $turnState.Last = $Key
            [void]$turnState.Planned.Remove($Key)
        }
        return @($turnState.Used, ($turnState.Used + $turnState.Planned.Count))
    }

    function Skip-Turn([string[]]$Keys) {
        if ($null -eq $turnState) { return }
        foreach ($k in $Keys) { [void]$turnState.Planned.Remove($k) }
    }

    function Get-RuleWidth {
        $w = 72
        try { if (-not [Console]::IsOutputRedirected) { $w = $Host.UI.RawUI.WindowSize.Width - 1 } } catch { $w = 72 }
        if ($w -lt 40) { $w = 40 }
        if ($w -gt 120) { $w = 120 }
        return $w
    }

    function Show-TurnBlock([string]$Key, [string]$Title, [string[]]$Lines) {
        $num = Get-TurnNumber $Key
        $heading = 'YOUR TURN ({0} of {1}) - {2}' -f $num[0], $num[1], $Title
        Write-Log $heading
        Write-Host ''
        Write-Host ('=' * (Get-RuleWidth)) -ForegroundColor Yellow
        Write-Host $heading -ForegroundColor Black -BackgroundColor Yellow
        Write-Host ''
        foreach ($l in $Lines) { Write-Host (Hide-Secret $l) }
    }

    function Send-Attention {
        # A beep, only when a person is at a real console (never in a dry run or with redirected
        # output; a host without a console throws, which is ignored).
        if ($DryRun) { return }
        try { if (-not [Console]::IsOutputRedirected -and -not [Console]::IsInputRedirected) { [Console]::Beep() } } catch { }
    }

    function Enter-TurnWait([string]$Title) {
        # Beep and "Waiting for you: <title>" in the window title. Returns the old title for
        # Exit-TurnWait ($null when the title could not be read or set).
        if ($DryRun) { return $null }
        Send-Attention
        $old = $null
        try { $old = $Host.UI.RawUI.WindowTitle; $Host.UI.RawUI.WindowTitle = "Waiting for you: $Title" } catch { $old = $null }
        return $old
    }

    function Exit-TurnWait($Old) {
        if ($null -ne $Old) { try { $Host.UI.RawUI.WindowTitle = $Old } catch { } }
    }

    function Read-TurnAnswer([string]$Title, [string]$Question, [switch]$Secure) {
        # The question on its own line, while the title says we wait. Read-Host errors (no
        # terminal) reach the caller.
        Write-Host ''
        $old = Enter-TurnWait $Title
        try {
            if ($Secure) { return (Read-Host -Prompt $Question -AsSecureString) }
            return (Read-Host -Prompt $Question)
        } finally {
            Exit-TurnWait $old
        }
    }

    function Write-TurnEcho([string]$Text) {
        Write-Host ''
        Write-Host "-> $Text" -ForegroundColor Green
        Write-Log "-> $Text"
    }

    # ---------------------------------------------------------------- versions

    function ConvertTo-VersionParts([string]$Text) {
        # Accepts "v26.13.0", "git version 2.56.0.windows.4", "gh version 2.103.3 (...)",
        # "2.1.318 (Claude Code)". Returns an int array, or $null when no version is found.
        if (-not $Text) { return $null }
        $t = $Text -replace '\.windows\.', '.'
        $m = [regex]::Match($t, '\d+(\.\d+)+')
        if (-not $m.Success) { return $null }
        return ,([int[]]($m.Value.Split('.') | ForEach-Object { [int]$_ }))
    }

    function Compare-Version([string]$A, [string]$B) {
        # -1 / 0 / 1, part by part, missing parts count as 0 (git has four parts).
        $pa = ConvertTo-VersionParts $A
        $pb = ConvertTo-VersionParts $B
        $n = [Math]::Max($pa.Length, $pb.Length)
        for ($i = 0; $i -lt $n; $i++) {
            $x = if ($i -lt $pa.Length) { $pa[$i] } else { 0 }
            $y = if ($i -lt $pb.Length) { $pb[$i] } else { 0 }
            if ($x -lt $y) { return -1 }
            if ($x -gt $y) { return 1 }
        }
        return 0
    }

    function Get-VersionString([string]$Text) {
        $p = ConvertTo-VersionParts $Text
        if ($null -eq $p) { return $null }
        return ($p -join '.')
    }

    # ---------------------------------------------------------------- processes

    function ConvertTo-ArgString([string]$Arg) {
        if ($Arg -eq '') { return '""' }
        if ($Arg -notmatch '[\s"]') { return $Arg }
        return '"' + ($Arg -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
    }

    function Invoke-Captured([string]$FilePath, [string[]]$ArgumentList = @(), [int]$TimeoutSec = 60, [string]$StdinText, [string]$Activity, [string]$Eta) {
        # Runs a program with stdout/stderr captured and a timeout, so a stub that waits for
        # input or opens a window cannot hang the run. Never pass a secret in $ArgumentList;
        # a secret goes in $StdinText, which is written to the program's stdin and then closed.
        # With $Activity, prints "<Activity> - <Eta>..." first and a heartbeat every 10 s.
        $quoted = @($ArgumentList | ForEach-Object { ConvertTo-ArgString $_ })
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $ext = [IO.Path]::GetExtension($FilePath).ToLowerInvariant()
        if ($ext -eq '.cmd' -or $ext -eq '.bat') {
            $psi.FileName = $env:ComSpec
            $psi.Arguments = '/d /s /c "' + (ConvertTo-ArgString $FilePath) + ' ' + ($quoted -join ' ') + '"'
        } else {
            $psi.FileName = $FilePath
            $psi.Arguments = ($quoted -join ' ')
        }
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardInput = $true
        $psi.CreateNoWindow = $true
        # Windows PowerShell 5.1 (.NET Framework) opens the child's stdin with the console input
        # encoding and writes its preamble first: on a UTF-8 console that is a BOM in front of
        # the text. Switch to UTF-8 without a BOM while the process starts, then put it back.
        $savedInputEncoding = $null
        if ($StdinText) {
            try {
                if ([Console]::InputEncoding.GetPreamble().Length -gt 0) {
                    $savedInputEncoding = [Console]::InputEncoding
                    [Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
                }
            } catch { $savedInputEncoding = $null }
        }
        try {
            $p = [System.Diagnostics.Process]::Start($psi)
        } catch {
            return [pscustomobject]@{ ExitCode = -1; Output = ''; Error = $_.Exception.Message; TimedOut = $false; Started = $false }
        } finally {
            if ($savedInputEncoding) { try { [Console]::InputEncoding = $savedInputEncoding } catch { } }
        }
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        if ($StdinText) {
            try { $p.StandardInput.Write($StdinText); $p.StandardInput.Flush() } catch { }
        }
        try { $p.StandardInput.Close() } catch { }
        if ($Activity) {
            Write-Activity $Activity $Eta
            $finished = Wait-WithHeartbeat { $p.WaitForExit(1000) } $TimeoutSec
        } else {
            $finished = $p.WaitForExit($TimeoutSec * 1000)
        }
        if (-not $finished) {
            try { $p.Kill() } catch { }
            return [pscustomobject]@{ ExitCode = -1; Output = ''; Error = "timed out after $TimeoutSec s"; TimedOut = $true; Started = $true }
        }
        $p.WaitForExit()
        return [pscustomobject]@{
            ExitCode = $p.ExitCode; Output = $outTask.Result; Error = $errTask.Result; TimedOut = $false; Started = $true
        }
    }

    function Test-ToolCopy([string]$Path) {
        # Runs "<path> --version". Returns Works, Version, Note. A copy that does not start, exits
        # non-zero, times out or prints no version is broken (e.g. a Store alias stub).
        $r = Invoke-Captured $Path @('--version') 30
        $text = (($r.Output, $r.Error) -join "`n").Trim()
        $first = ($text -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
        if (-not $r.Started) { return [pscustomobject]@{ Works = $false; Version = $null; Note = "does not start: $($r.Error)" } }
        if ($r.TimedOut) { return [pscustomobject]@{ Works = $false; Version = $null; Note = $r.Error } }
        $v = Get-VersionString $text
        if ($r.ExitCode -ne 0 -or -not $v) {
            return [pscustomobject]@{ Works = $false; Version = $v; Note = "--version exit $($r.ExitCode): $first" }
        }
        return [pscustomobject]@{ Works = $true; Version = $v; Note = $first }
    }

    # ---------------------------------------------------------------- PATH

    function Split-PathList([string]$Value) {
        if (-not $Value) { return @() }
        return @($Value.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }

    function Get-NormalDir([string]$Dir) {
        try { $e = [Environment]::ExpandEnvironmentVariables($Dir) } catch { $e = $Dir }
        return $e.Trim().TrimEnd('\').ToLowerInvariant()
    }

    function Get-MachinePathRaw {
        $k = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager\Environment', $false)
        if (-not $k) { return '' }
        try { return [string]$k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } finally { $k.Close() }
    }

    function Get-UserPathRaw {
        $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $false)
        if (-not $k) { return '' }
        try { return [string]$k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } finally { $k.Close() }
    }

    function Get-NewShellDirs {
        # What a shell started now would get: machine PATH first, then user PATH, expanded.
        $dirs = @()
        foreach ($d in (Split-PathList (Get-MachinePathRaw)) + (Split-PathList (Get-UserPathRaw))) {
            $dirs += [Environment]::ExpandEnvironmentVariables($d)
        }
        return $dirs
    }

    function Find-InNewShell([string]$Name) {
        $exts = @(Split-PathList $env:PATHEXT)
        if ($exts.Count -eq 0) { $exts = @('.COM', '.EXE', '.BAT', '.CMD') }
        foreach ($d in Get-NewShellDirs) {
            foreach ($x in $exts) {
                try {
                    $c = Join-Path $d ($Name + $x)
                    if (Test-Path -LiteralPath $c -PathType Leaf) { return $c }
                } catch { }
            }
        }
        return $null
    }

    function Test-OnMachinePath([string]$Dir) {
        $n = Get-NormalDir $Dir
        foreach ($d in Split-PathList (Get-MachinePathRaw)) { if ((Get-NormalDir $d) -eq $n) { return $true } }
        return $false
    }

    function Send-EnvironmentChange {
        # Tells Explorer and other running programs that the user environment changed, so apps
        # started afterwards from the Start menu see the new PATH (what setx does, without setx).
        if (-not ('BlueStepBootstrap.NativeMethods' -as [type])) {
            Add-Type -Namespace BlueStepBootstrap -Name NativeMethods -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
        }
        $out = [UIntPtr]::Zero
        # HWND_BROADCAST = 0xffff, WM_SETTINGCHANGE = 0x1A, SMTO_ABORTIFHUNG = 0x2
        [void][BlueStepBootstrap.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$out)
    }

    function Add-UserPathEntry([string]$Dir) {
        # Appends $Dir to the user PATH if it is not there. Reads the raw value (keeps %VAR%
        # entries) and writes it back as REG_EXPAND_SZ. Returns $true when it changed something.
        $n = Get-NormalDir $Dir
        $raw = Get-UserPathRaw
        foreach ($d in Split-PathList $raw) { if ((Get-NormalDir $d) -eq $n) { return $false } }
        if ($DryRun) { Say "    would add to the user PATH: $Dir"; return $false }
        $new = if ($raw -and $raw.Trim()) { $raw.TrimEnd(';') + ';' + $Dir } else { $Dir }
        $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
        if (-not $k) { $k = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment') }
        try { $k.SetValue('Path', $new, [Microsoft.Win32.RegistryValueKind]::ExpandString) } finally { $k.Close() }
        try { Send-EnvironmentChange } catch { Write-Log "WM_SETTINGCHANGE broadcast failed: $($_.Exception.Message)" 'warn' }
        Say "    added to the user PATH: $Dir"
        return $true
    }

    function Add-SessionPathEntry([string]$Dir, [switch]$Front) {
        # This session only, so later steps of the run find the copy just installed.
        $n = Get-NormalDir $Dir
        $rest = @(Split-PathList $env:Path | Where-Object { (Get-NormalDir $_) -ne $n })
        if ($Front) { $env:Path = (@($Dir) + $rest) -join ';' } else { $env:Path = ($rest + @($Dir)) -join ';' }
    }

    function Sync-SessionPath {
        # A terminal opened before an earlier run (or before an installer) misses new user PATH
        # entries. Append whatever a new shell would have, so this run sees what a new shell sees.
        $have = @{}
        foreach ($d in Split-PathList $env:Path) { $have[(Get-NormalDir $d)] = $true }
        $added = 0
        foreach ($d in Get-NewShellDirs) {
            $n = Get-NormalDir $d
            if (-not $have.ContainsKey($n)) { $env:Path = $env:Path.TrimEnd(';') + ';' + $d; $have[$n] = $true; $added++ }
        }
        if ($added) { Write-Log "session PATH: appended $added entr(ies) from the registry PATH" }
    }

    # ---------------------------------------------------------------- downloads

    function New-EmptyDir([string]$Parent, [string]$Prefix) {
        $d = Join-Path $Parent ($Prefix + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
        [void](New-Item -ItemType Directory -Path $d -Force)
        return $d
    }

    function Remove-DirQuiet([string]$Dir) {
        if ($Dir -and (Test-Path -LiteralPath $Dir)) { try { Remove-Item -LiteralPath $Dir -Recurse -Force } catch { Write-Log "could not remove ${Dir}: $($_.Exception.Message)" 'warn' } }
    }

    function New-WebClient {
        # WebClient uses the system proxy (WebRequest.DefaultWebProxy, which main gives the
        # user's own credentials) on Windows PowerShell 5.1 and on PowerShell 7, and its Task
        # methods let the run print heartbeats while it waits.
        $wc = New-Object System.Net.WebClient
        $wc.Headers['User-Agent'] = "bluestep-bootstrap/$ScriptVersion (WindowsPowerShell)"
        return $wc
    }

    function Get-NetTaskError($Task) {
        # The WebException (or other error) inside a faulted Task.
        if ($Task.Exception -and $Task.Exception.InnerException) { return $Task.Exception.InnerException }
        return $Task.Exception
    }

    function Receive-WebFile([string]$Url, [string]$File, [int]$TimeoutSec = 1800) {
        # Throws with the reason when the download fails or takes longer than $TimeoutSec.
        $wc = New-WebClient
        try {
            $task = $wc.DownloadFileTaskAsync([Uri]$Url, $File)
            $sizeNote = {
                if (Test-Path -LiteralPath $File -PathType Leaf) {
                    $mb = (Get-Item -LiteralPath $File).Length / 1MB
                    if ($mb -ge 0.1) { return (' ({0} MB so far)' -f [Math]::Round($mb, 1).ToString([Globalization.CultureInfo]::InvariantCulture)) }
                }
                return ''
            }
            if (-not (Wait-NetTask $task $TimeoutSec $sizeNote)) {
                try { $wc.CancelAsync() } catch { }
                throw "no end after $TimeoutSec s"
            }
            if ($task.IsFaulted) { throw (Get-NetTaskError $task).Message }
            if ($task.IsCanceled) { throw 'cancelled' }
        } finally {
            $wc.Dispose()
        }
    }

    function Get-VerifiedDownload([string]$Url, [string]$Sha256, [string]$Dir, [string]$What, [string]$Eta) {
        # Downloads into its own empty folder and checks the SHA-256 from tool-versions.json
        # before the caller unpacks or runs anything. Throws with the URL on any failure.
        if ($Url -notmatch '^https://') { throw "refusing a non-HTTPS URL: $Url" }
        $name = [IO.Path]::GetFileName(([Uri]$Url).AbsolutePath)
        $file = Join-Path $Dir $name
        $label = if ($What) { $What } else { $name }
        $time = if ($Eta) { $Eta } else { 'about a minute' }
        Write-Log "    downloading $Url"
        Write-Activity "Downloading $label" $time
        try {
            Receive-WebFile $Url $file
        } catch {
            throw "download failed: $Url : $($_.Exception.Message)"
        }
        $got = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        if ($got -ine $Sha256) {
            Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
            throw "SHA-256 mismatch for $Url (expected $Sha256, got $got); nothing was installed from it"
        }
        Say "    SHA-256 ok ($($got.Substring(0, 12).ToLowerInvariant())...)"
        return $file
    }

    function Expand-ZipTo([string]$Zip, [string]$Dest) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($Zip, $Dest)
    }

    function Set-ToolFolder([string]$Source, [string]$Target) {
        # Replaces our own folder for a tool (never anything outside %LOCALAPPDATA%\BlueStep\tools).
        if (Test-Path -LiteralPath $Target) {
            $old = $Target + '.old-' + (Get-Date -Format 'yyyyMMddHHmmss')
            Rename-Item -LiteralPath $Target -NewName (Split-Path -Leaf $old)
            Remove-DirQuiet $old
        }
        [IO.Directory]::Move($Source, $Target)
    }

    function Find-Exe([string]$Root, [string]$Exe) {
        if (-not (Test-Path -LiteralPath $Root)) { return $null }
        $hit = Get-ChildItem -LiteralPath $Root -Filter $Exe -Recurse -File -ErrorAction SilentlyContinue |
            Sort-Object { $_.FullName.Length } | Select-Object -First 1
        if ($hit) { return $hit.FullName }
        return $null
    }

    # ---------------------------------------------------------------- per-tool install

    function Install-ZipTool([string]$Tool, [string]$Exe, $Asset, $Meta) {
        $dl = New-EmptyDir (Join-Path $toolsRoot '.download') $Tool
        $stage = New-EmptyDir (Join-Path $toolsRoot '.staging') $Tool
        try {
            $zip = Get-VerifiedDownload $Asset.url $Asset.sha256 $dl $Meta.Label $Meta.DlEta
            Write-Activity "Unpacking $($Meta.Label)" 'a few seconds'
            Expand-ZipTo $zip $stage
            # A zip with one top folder (node-vX-win-x64\) is flattened into tools\<tool>.
            $root = $stage
            $items = @(Get-ChildItem -LiteralPath $stage -Force)
            if ($items.Count -eq 1 -and $items[0].PSIsContainer) { $root = $items[0].FullName }
            if (-not (Find-Exe $root $Exe)) { throw "$Exe not found in $($Asset.url)" }
            $target = Join-Path $toolsRoot $Tool
            Set-ToolFolder $root $target
            $exePath = Find-Exe $target $Exe
            return (Split-Path -Parent $exePath)
        } finally {
            Remove-DirQuiet $dl
            Remove-DirQuiet $stage
        }
    }

    function Install-ExeTool([string]$Tool, [string]$Exe, $Asset, $Meta) {
        $dl = New-EmptyDir (Join-Path $toolsRoot '.download') $Tool
        try {
            $file = Get-VerifiedDownload $Asset.url $Asset.sha256 $dl $Meta.Label $Meta.DlEta
            $target = Join-Path $toolsRoot $Tool
            [void](New-Item -ItemType Directory -Path $target -Force)
            Copy-Item -LiteralPath $file -Destination (Join-Path $target $Exe) -Force
            return $target
        } finally {
            Remove-DirQuiet $dl
        }
    }

    function Get-GitInstallLocation {
        # Where Git for Windows' installer says Git lives (its Inno Setup uninstall entry), user
        # entry first. $null when there is none.
        $sub = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\Git_is1'
        foreach ($hive in [Microsoft.Win32.Registry]::CurrentUser, [Microsoft.Win32.Registry]::LocalMachine) {
            $k = $null
            try {
                $k = $hive.OpenSubKey($sub)
                if ($k) {
                    $v = [string]$k.GetValue('Inno Setup: App Path')
                    if (-not $v) { $v = [string]$k.GetValue('InstallLocation') }
                    if ($v) { return $v.TrimEnd('\') }
                }
            } catch { } finally { if ($k) { $k.Close() } }
        }
        return $null
    }

    function Install-GitTool($Asset, $Meta) {
        # Git for Windows' own installer, per user (Run 1: /VERYSILENT /NORESTART /CURRENTUSER,
        # no UAC, installs under %LOCALAPPDATA%\Programs\Git and adds its cmd folder to the user PATH).
        # The installer reuses the folder of an earlier Git install it finds in the registry (a
        # machine-wide Git in Program Files, first seen on a CI runner), so the per-user folder is
        # always passed with /DIR, which wins over the remembered one.
        $target = Join-Path $env:LOCALAPPDATA 'Programs\Git'
        $dl = New-EmptyDir (Join-Path $toolsRoot '.download') 'git'
        try {
            $file = Get-VerifiedDownload $Asset.url $Asset.sha256 $dl $Meta.Label $Meta.DlEta
            $instArgs = @($Asset.args | ForEach-Object { [string]$_ })
            if (-not ($instArgs | Where-Object { $_ -like '/DIR=*' })) { $instArgs += "/DIR=$target" }
            Write-Log "    running the Git installer: $([IO.Path]::GetFileName($file)) $($instArgs -join ' ')"
            $r = Invoke-Captured $file $instArgs 1200 -Activity 'Installing Git (no window opens)' -Eta 'about a minute'
            if ($r.ExitCode -ne 0) { throw "Git installer exit $($r.ExitCode) $($r.Error)" }
            $cmdDir = Join-Path $target 'cmd'
            if (Test-Path -LiteralPath (Join-Path $cmdDir 'git.exe')) { return $cmdDir }
            # Not where we asked: say where it went instead of a bare "missing".
            $actual = Get-GitInstallLocation
            if ($actual -and (Test-Path -LiteralPath (Join-Path $actual 'cmd\git.exe'))) {
                Say "    the Git installer used $actual (the folder of an earlier Git install), not $target" 'warn'
                return (Join-Path $actual 'cmd')
            }
            $where = if ($actual) { "; the installer reports its folder as $actual, left by an earlier Git install" } else { '' }
            throw "the Git installer finished but git.exe is not in $cmdDir$where"
        } finally {
            Remove-DirQuiet $dl
        }
    }

    function Install-ClaudeTool($Asset, [string]$Pinned, $Meta) {
        # Anthropic's binary, checked against our pin, then "claude.exe install <version>" sets up
        # the launcher under %USERPROFILE%\.local\bin (Run 1: a bare "install" moves to latest,
        # and it does not touch the user PATH, so the caller adds it).
        $dl = New-EmptyDir (Join-Path $toolsRoot '.download') 'claude'
        try {
            $file = Get-VerifiedDownload $Asset.url $Asset.sha256 $dl $Meta.Label $Meta.DlEta
            Write-Log "    running: claude.exe install $Pinned"
            $r = Invoke-Captured $file @('install', $Pinned) 1200 -Activity "Setting up the Claude Code CLI $Pinned" -Eta 'about a minute'
            Write-Log ("claude install output: " + (($r.Output, $r.Error) -join ' ').Trim())
            if ($r.ExitCode -ne 0) { throw "claude.exe install exit $($r.ExitCode): $((($r.Output, $r.Error) -join ' ').Trim())" }
            return (Join-Path $env:USERPROFILE '.local\bin')
        } finally {
            Remove-DirQuiet $dl
        }
    }

    function Invoke-ToolStep([string]$Tool, $Spec, [string]$Pair) {
        # One item: resolve, keep or install, then resolve again as a new shell would.
        $meta = @{
            # Label and DlEta: what the progress lines call it, and a rough download time.
            node   = @{ Exe = 'node.exe';   Kind = 'zip';       OurDir = (Join-Path $toolsRoot 'node');                  Label = 'Node.js';         DlEta = 'under a minute' }
            git    = @{ Exe = 'git.exe';    Kind = 'installer'; OurDir = (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd'); Label = 'Git';             DlEta = 'about a minute' }
            gh     = @{ Exe = 'gh.exe';     Kind = 'zip';       OurDir = (Join-Path $toolsRoot 'gh');                    Label = 'GitHub CLI (gh)'; DlEta = 'under a minute' }
            b6p    = @{ Exe = 'b6p.exe';    Kind = 'exe';       OurDir = (Join-Path $toolsRoot 'b6p');                   Label = 'b6p';             DlEta = 'under a minute' }
            claude = @{ Exe = 'claude.exe'; Kind = 'claude';    OurDir = (Join-Path $env:USERPROFILE '.local\bin');      Label = 'Claude Code CLI'; DlEta = 'one to three minutes' }
        }[$Tool]
        $min = [string]$Spec.min
        $pinned = [string]$Spec.pinned
        Say "[$Tool] minimum $min, pinned $pinned" 'step'

        # 1. What this shell resolves today.
        $cmd = Get-Command $Tool -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $why = $null
        if ($cmd) {
            $t = Test-ToolCopy $cmd.Source
            Say "    found $($cmd.Source): $(if ($t.Version) { $t.Version } else { 'no version' })"
            Write-Log "    $Tool --version: $($t.Note)"
            if ($t.Works -and (Compare-Version $t.Version $min) -ge 0) {
                Add-Result $Tool 'ok' "$($t.Version) at $($cmd.Source)"
                return
            }
            $why = if (-not $t.Works) { "broken ($($t.Note))" } else { "$($t.Version) is below $min" }
        } else {
            $why = 'not found'
        }
        Say "    $why"

        # 2. Our own copy may already be there (a run stopped before the PATH edit).
        $ourExe = Find-Exe $meta.OurDir $meta.Exe
        if ($ourExe -and $ourExe -ne $cmd.Source) {
            $t = Test-ToolCopy $ourExe
            if ($t.Works -and (Compare-Version $t.Version $min) -ge 0) {
                Say "    our copy is already installed: $ourExe ($($t.Version))"
                $binDir = Split-Path -Parent $ourExe
                if ($DryRun) {
                    [void](Add-UserPathEntry $binDir)
                    Add-Result $Tool 'would install' "PATH only: $binDir ($($t.Version))"
                    return
                }
                Complete-ToolStep $Tool $meta $binDir $min 'PATH fixed'
                return
            }
        }

        # 3. Download and install the pinned version.
        $assetProp = $Spec.assets.PSObject.Properties[$Pair]
        if (-not $assetProp -or -not $assetProp.Value.url) {
            Add-Result $Tool 'failed' "$why; tool-versions.json has no $Pair download for $Tool"
            return
        }
        $asset = $assetProp.Value
        if ($DryRun) {
            Say "    would download $($asset.url)"
            Say "    would check SHA-256 $($asset.sha256)"
            switch ($meta.Kind) {
                'installer' { Say "    would run it with: $(@($asset.args) -join ' ') /DIR=$(Split-Path -Parent $meta.OurDir)" }
                'claude'    { Say "    would run: claude.exe install $pinned (launcher in $($meta.OurDir))" }
                default     { Say "    would install it under $($meta.OurDir)" }
            }
            if ($meta.Kind -ne 'installer') { [void](Add-UserPathEntry $meta.OurDir) }
            if ($cmd -and (Test-OnMachinePath (Split-Path -Parent $cmd.Source))) {
                Say "    note: $($cmd.Source) is on the machine PATH and would still win in a new shell" 'warn'
            }
            Add-Result $Tool 'would install' "$pinned ($why)"
            return
        }
        try {
            $binDir = switch ($meta.Kind) {
                'zip'       { Install-ZipTool $Tool $meta.Exe $asset $meta }
                'exe'       { Install-ExeTool $Tool $meta.Exe $asset $meta }
                'installer' { Install-GitTool $asset $meta }
                'claude'    { Install-ClaudeTool $asset $pinned $meta }
            }
        } catch {
            Add-Result $Tool 'failed' $_.Exception.Message
            return
        }
        Complete-ToolStep $Tool $meta $binDir $min "$pinned installed"
    }

    function Complete-ToolStep([string]$Tool, $Meta, [string]$BinDir, [string]$Min, [string]$Done) {
        $exe = Join-Path $BinDir $Meta.Exe
        if (-not (Test-Path -LiteralPath $exe)) { Add-Result $Tool 'failed' "$exe is missing after the install"; return }
        $t = Test-ToolCopy $exe
        if (-not $t.Works) {
            # Installed but cannot run from the user folder: AppLocker / WDAC, or antivirus.
            Add-Result $Tool 'needs IT' "$exe does not run ($($t.Note)); ask IT whether programs may run from this folder"
            return
        }
        if ((Compare-Version $t.Version $Min) -lt 0) { Add-Result $Tool 'failed' "$exe reports $($t.Version), below $Min"; return }
        try {
            [void](Add-UserPathEntry $BinDir)
        } catch {
            Add-Result $Tool 'failed' "installed at $exe but the user PATH could not be updated: $($_.Exception.Message)"
            return
        }
        Add-SessionPathEntry $BinDir -Front
        # Resolve the way a new shell would: machine PATH first, then user PATH.
        $winner = Find-InNewShell $Tool
        if ($winner -and ((Get-NormalDir (Split-Path -Parent $winner)) -ne (Get-NormalDir $BinDir))) {
            $wt = Test-ToolCopy $winner
            $wv = if ($wt.Version) { $wt.Version } else { 'broken' }
            $where = if (Test-OnMachinePath (Split-Path -Parent $winner)) { 'the machine PATH' } else { 'earlier on the user PATH' }
            Add-Result $Tool 'needs you' "$Done at $exe, but a new shell finds $winner ($wv, $where) first; remove or update that copy"
            return
        }
        if (-not $winner) {
            Add-Result $Tool 'needs you' "$Done at $exe, but a new shell does not find it on the PATH"
            return
        }
        Add-Result $Tool 'installed' "$($t.Version) at $exe ($Done)"
    }

    # ---------------------------------------------------------------- detect (step 1)

    function Get-Platform {
        $isWin = $true
        if ($PSVersionTable.PSVersion.Major -ge 6) { $isWin = [bool]$IsWindows }
        if (-not $isWin) { return [pscustomobject]@{ Os = 'other'; Arch = ''; Pair = '' } }
        $a = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
        $arch = switch ($a) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } 'x86' { 'x86' } default { "$a".ToLowerInvariant() } }
        return [pscustomobject]@{ Os = 'windows'; Arch = $arch; Pair = "windows-$arch" }
    }

    function Find-AgentTools {
        $c = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $agents['Claude Code CLI'] = if ($c) { $c.Source } elseif (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.local\bin\claude.exe')) { (Join-Path $env:USERPROFILE '.local\bin\claude.exe') + ' (not on PATH)' } else { $null }
        # The desktop app installs as the MSIX package "Claude"; its per-user data folder is
        # %LOCALAPPDATA%\Packages\Claude_<publisher id>. Older installs used AnthropicClaude.
        $pkg = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Packages') -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue | Select-Object -First 1
        $old = Join-Path $env:LOCALAPPDATA 'AnthropicClaude'
        $agents['Claude desktop app'] = if ($pkg) { "MSIX package ($($pkg.Name))" } elseif (Test-Path -LiteralPath $old) { $old } else { $null }
        $cur = Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'
        $cc = Get-Command cursor -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $agents['Cursor'] = if (Test-Path -LiteralPath $cur) { $cur } elseif ($cc) { $cc.Source } else { $null }
        $cx = Get-Command codex -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $cxPkg = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Packages') -Directory -Filter 'OpenAI.Codex_*' -ErrorAction SilentlyContinue | Select-Object -First 1
        $agents['Codex'] = if ($cx) { $cx.Source } elseif ($cxPkg) { "MSIX package ($($cxPkg.Name))" } else { $null }
    }

    # ---------------------------------------------------------------- versions file (step 2)

    function Get-ToolVersions {
        if ($VersionsFile) {
            $p = (Resolve-Path -LiteralPath $VersionsFile).ProviderPath
            Say "versions file: $p (local, -VersionsFile)"
            $json = [IO.File]::ReadAllText($p)
        } else {
            $r = if ($Ref) { $Ref } else { "bootstrap-v$ScriptVersion" }
            $url = "https://raw.githubusercontent.com/$RepoSlug/$r/$VersionsPathInRepo"
            Say "versions file: $url"
            try {
                $json = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
            } catch {
                throw "could not load the versions file from $url : $($_.Exception.Message)"
            }
            if ($json -is [byte[]]) { $json = [Text.Encoding]::UTF8.GetString($json) }
        }
        $v = $json | ConvertFrom-Json
        if ($v.schema -ne 1) { throw "unsupported tool-versions.json schema '$($v.schema)' (this script reads schema 1)" }
        return $v
    }

    # ---------------------------------------------------------------- GitHub login (step 4)

    function Get-GhStatus([string]$Gh) {
        # "gh auth status" for github.com: LoggedIn, and the account line for the report.
        $r = Invoke-Captured $Gh @('auth', 'status', '--hostname', 'github.com') 30
        $text = (($r.Output, $r.Error) -join "`n")
        $m = [regex]::Match($text, 'Logged in to [^\r\n]*')
        $line = if ($m.Success) { $m.Value.Trim() } else { 'logged in to github.com' }
        return [pscustomobject]@{ LoggedIn = ($r.ExitCode -eq 0); Line = $line }
    }

    function Get-GitHelperKeys {
        # The two keys "gh auth setup-git --hostname github.com" writes.
        return @('credential.https://github.com.helper', 'credential.https://gist.github.com.helper')
    }

    function Get-GitHelperState([string]$Key) {
        # One git credential key in the global config, read only: absent | ours (gh's own
        # helper is the value git uses) | other | unknown (git missing or an unexpected answer).
        $git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $git) { return 'unknown' }
        $r = Invoke-Captured $git.Source @('config', '--global', '--get-all', $Key) 15
        if ($r.ExitCode -eq 1 -and -not ([string]$r.Output).Trim()) { return 'absent' }
        if ($r.ExitCode -ne 0) { return 'unknown' }
        # git uses the last value; setup-git writes "" then "!<gh> auth git-credential".
        $vals = ([string]$r.Output).Replace("`r", '').TrimEnd("`n").Split("`n")
        if ($vals[$vals.Length - 1] -match '^!\s*''?(?:[^'']*[\\/])?gh(?:\.exe)?''?\s+auth\s+git-credential') { return 'ours' }
        return 'other'
    }

    function Set-GhGitHelperFirst([string]$Gh) {
        # ours: gh will not ask. set: this run set it now (undo with Undo-GhGitHelper if the
        # sign-in fails). asks: left alone, gh asks "Authenticate Git...".
        $keys = Get-GitHelperKeys
        $main = Get-GitHelperState $keys[0]
        if ($main -eq 'ours') { return 'ours' }
        if ($main -ne 'absent') { return 'asks' }
        if ((Get-GitHelperState $keys[1]) -ne 'absent') { return 'asks' }
        $r = Invoke-Captured $Gh @('auth', 'setup-git', '--hostname', 'github.com', '--force') 60
        Write-Log "gh auth setup-git --force (before login): exit $($r.ExitCode) $((($r.Output, $r.Error) -join ' ').Trim())"
        if ($r.ExitCode -eq 0 -and (Get-GitHelperState $keys[0]) -eq 'ours') { return 'set' }
        Undo-GhGitHelper
        return 'asks'
    }

    function Undo-GhGitHelper {
        # Only after Set-GhGitHelperFirst found both keys absent: removing them restores ~\.gitconfig.
        $git = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $git) { return }
        foreach ($k in (Get-GitHelperKeys)) {
            $r = Invoke-Captured $git.Source @('config', '--global', '--unset-all', $k) 15
            Write-Log "git config --global --unset-all ${k}: exit $($r.ExitCode)"
        }
    }

    function Test-GhLoginFlag([string]$Gh, [string]$Flag) {
        # Read only: does this gh's "auth login --help" list the flag? (--clipboard is newer
        # than some gh versions at or above the minimum.)
        $r = Invoke-Captured $Gh @('auth', 'login', '--help') 30
        return ($r.ExitCode -eq 0 -and ((($r.Output, $r.Error) -join "`n") -match ('(?m)\s' + [regex]::Escape($Flag) + '\b')))
    }

    function Invoke-GitHubLoginStep {
        # gh auth status ok -> nothing to do (git may already have its own GitHub login, e.g.
        # Git Credential Manager; that is left alone). Otherwise gh auth login --web in this
        # console (the user answers gh's questions and signs in in the browser), then
        # gh auth setup-git, so git reads private repos for plugin installs and updates.
        $item = 'github login'
        Say '[github login]' 'step'
        $gh = Get-Command gh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $gh) { Add-Result $item 'needs you' 'gh is not installed (see the gh item); run this script again once it is'; return }
        $status = Get-GhStatus $gh.Source
        if ($status.LoggedIn) { Add-Result $item 'ok' $status.Line; return }
        if ($DryRun) { Add-Result $item 'would install' 'not signed in; would run: gh auth login --web, then gh auth setup-git'; return }

        # gh's "Authenticate Git with your GitHub credentials?" (seen twice in the first live
        # run). No gh auth login flag skips it (gh 2.101 --help). gh's source (v2.101.0,
        # pkg/cmd/auth/shared/git_credential.go) does not ask when git's helper for github.com is
        # already gh itself, and "gh auth setup-git --hostname github.com --force" sets that
        # before a login. That changes ~\.gitconfig, so it is done only when neither credential
        # key exists there yet (so removing them restores the file exactly), and they are
        # removed again when the sign-in does not finish. Otherwise gh asks, and the steps
        # below say to answer Y each time. setup-git still runs after the login either way.
        # A non-interactive gh (GH_PROMPT_DISABLED, internal/authflow/flow.go) would skip the
        # question too, but it only prints the URL and never opens the browser, so it is not used.
        $helper = Set-GhGitHelperFirst $gh.Source
        $clip = Test-GhLoginFlag $gh.Source '--clipboard'
        $loginArgs = @('auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web')
        if ($clip) { $loginArgs += '--clipboard' }
        $codeLine = if ($clip) { 'paste the code (it is already copied: Ctrl+V)' } else { 'type the code it showed here' }
        $lines = @('GitHub''s own tool (gh) signs you in now. Do this, in order:')
        if ($helper -eq 'asks') {
            $lines += '  1. When asked "Authenticate Git with your GitHub credentials?", type Y and'
            $lines += '     press Enter. It may ask the same question twice: answer Y both times.'
            $lines += '  2. When it shows a code and says "Press Enter", press Enter HERE (in this window).'
            $lines += "  3. A browser opens: $codeLine and approve."
        } else {
            $lines += '  1. When it shows a code and says "Press Enter", press Enter HERE (in this window).'
            $lines += "  2. A browser opens: $codeLine and approve."
            $lines += '  3. Come back to this window: the script goes on by itself.'
        }
        $lines += 'No browser? Open https://github.com/login/device yourself and enter the code there.'
        Show-TurnBlock 'github' 'GitHub sign-in' $lines
        Write-Host ''
        Write-Log "running: gh $($loginArgs -join ' ') (git helper: $helper)"
        $old = Enter-TurnWait 'GitHub sign-in'
        try {
            # Start-Process -NoNewWindow keeps gh on this console (its prompts need a terminal)
            # and out of this function's output.
            $p = Start-Process -FilePath $gh.Source -ArgumentList $loginArgs -NoNewWindow -Wait -PassThru
            $code = $p.ExitCode
        } catch {
            if ($helper -eq 'set') { Undo-GhGitHelper }
            Write-TurnEcho 'GitHub: not signed in (gh did not start)'
            Add-Result $item 'failed' "could not start gh auth login: $($_.Exception.Message)"
            return
        } finally {
            Exit-TurnWait $old
        }
        $status = Get-GhStatus $gh.Source
        if (-not $status.LoggedIn) {
            if ($helper -eq 'set') { Undo-GhGitHelper }
            Write-TurnEcho 'GitHub: not signed in (run this script again to retry)'
            Add-Result $item 'needs you' "gh auth login did not finish (exit $code); run this script again to retry"
            return
        }
        Write-TurnEcho 'GitHub: signed in'
        $sg = Invoke-Captured $gh.Source @('auth', 'setup-git', '--hostname', 'github.com') 60 -Activity 'Letting git use your GitHub sign-in' -Eta 'a few seconds'
        if ($sg.ExitCode -ne 0) {
            Add-Result $item 'failed' "$($status.Line), but gh auth setup-git failed (exit $($sg.ExitCode)): $((($sg.Output, $sg.Error) -join ' ').Trim())"
            return
        }
        Add-Result $item 'installed' "$($status.Line) (signed in; git uses the gh login)"
    }

    # ---------------------------------------------------------------- platform token (step 5)

    function Get-UserTokenValue {
        return [Environment]::GetEnvironmentVariable('B6PT_TOKEN', 'User')
    }

    function Set-TokenVariable([string]$Token) {
        # In-process registry write of the user variable (it also broadcasts the change), so the
        # value never reaches a command line; setx would put it in argv. Plus this session.
        if ((Get-UserTokenValue) -cne $Token) { [Environment]::SetEnvironmentVariable('B6PT_TOKEN', $Token, 'User') }
        $env:B6PT_TOKEN = $Token
    }

    function Get-B6pStoreState {
        # b6p keeps its login encrypted in ~\.b6p\secrets.enc. b6p 0.8.2 has no "auth status",
        # so this file (present, and rewritten by "auth set") is the only signal we have.
        $f = Join-Path $env:USERPROFILE '.b6p\secrets.enc'
        if (Test-Path -LiteralPath $f -PathType Leaf) {
            $i = Get-Item -LiteralPath $f -Force
            return [pscustomobject]@{ Path = $f; Exists = $true; Time = $i.LastWriteTimeUtc; Length = $i.Length }
        }
        return [pscustomobject]@{ Path = $f; Exists = $false; Time = $null; Length = -1 }
    }

    function Set-B6pLogin([string]$Token, [int]$TimeoutSec = 60) {
        # b6p auth clear, then the token on b6p auth set's stdin (never in its arguments).
        # Returns Ok and Detail.
        $b6p = Get-Command b6p -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $b6p) { return [pscustomobject]@{ Ok = $false; Detail = 'b6p is not installed (see the b6p item)' } }
        $c = Invoke-Captured $b6p.Source @('auth', 'clear') $TimeoutSec
        $cText = (($c.Output, $c.Error) -join ' ').Trim()
        Write-Log "b6p auth clear: exit $($c.ExitCode) $cText"
        if ($c.ExitCode -ne 0) { return [pscustomobject]@{ Ok = $false; Detail = "b6p auth clear exit $($c.ExitCode): $cText" } }
        $before = Get-B6pStoreState
        $r = Invoke-Captured $b6p.Source @('auth', 'set') $TimeoutSec -StdinText ($Token + "`n")
        $after = Get-B6pStoreState
        $text = (($r.Output, $r.Error) -join ' ').Trim()
        Write-Log "b6p auth set: exit $($r.ExitCode) $text"
        if ($r.TimedOut) { return [pscustomobject]@{ Ok = $false; Detail = "b6p auth set $($r.Error)" } }
        $rewritten = $after.Exists -and ((-not $before.Exists) -or $after.Time -ne $before.Time -or $after.Length -ne $before.Length)
        if ($r.ExitCode -eq 0) {
            # Exit 0 with this text means b6p kept an older token: the clear did not take.
            if ($text -match 'No changes made') { return [pscustomobject]@{ Ok = $false; Detail = "b6p kept its old token (auth clear did not clear it): $text" } }
            return [pscustomobject]@{ Ok = $true; Detail = 'b6p login saved' }
        }
        # b6p 0.8.2 on an empty store takes the token at its first prompt, saves it, then hits
        # end of input at a second prompt and exits 1 (spec prove-out, Run 2). That exit is a
        # success only with this exact message and a rewritten store file. This special case
        # goes away when a b6p release ships the single-prompt "auth set" (b6p-cli PR 33).
        if ($r.ExitCode -eq 1 -and $text.Contains('No input available for prompt: "Enter new access token') -and $rewritten) {
            return [pscustomobject]@{ Ok = $true; Detail = 'b6p login saved (b6p 0.8.2 second-prompt exit 1, expected)' }
        }
        $store = if ($rewritten) { 'store file rewritten' } else { 'store file not rewritten' }
        return [pscustomobject]@{ Ok = $false; Detail = "b6p auth set exit $($r.ExitCode), ${store}: $text" }
    }

    function Test-GatewayToken([string]$Token) {
        # One MCP "initialize" call, in-process. The Authorization header is built here, never on
        # a command line, and never logged. Status: ok | refused | http | unreachable.
        $body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"bluestep-bootstrap","version":"' + $ScriptVersion + '"}}}'
        # WebClient (not Invoke-WebRequest) so the wait can show a heartbeat; a 2xx answer
        # completes the task, any other status faults it with a WebException that has the code.
        $wc = New-WebClient
        try {
            $wc.Encoding = New-Object Text.UTF8Encoding($false)
            $wc.Headers['Authorization'] = 'Bearer ' + $Token
            $wc.Headers['Accept'] = 'application/json, text/event-stream'
            $wc.Headers['Content-Type'] = 'application/json'
            Write-Activity 'Checking the token with the BlueStep gateway' 'a few seconds (up to 20)'
            $task = $wc.UploadStringTaskAsync([Uri]$GatewayUrl, 'POST', $body)
            if (-not (Wait-NetTask $task 20)) {
                try { $wc.CancelAsync() } catch { }
                return [pscustomobject]@{ Status = 'unreachable'; Code = 0; Message = 'no answer within 20 s' }
            }
            if (-not $task.IsFaulted -and -not $task.IsCanceled) { return [pscustomobject]@{ Status = 'ok'; Code = 200; Message = 'HTTP 2xx' } }
            $ex = Get-NetTaskError $task
            $code = 0
            $resp = $null
            try { $resp = $ex.Response } catch { $resp = $null }
            if ($resp) { try { $code = [int]$resp.StatusCode } catch { $code = 0 } }
            if ($code -eq 401 -or $code -eq 403) { return [pscustomobject]@{ Status = 'refused'; Code = $code; Message = "HTTP $code" } }
            if ($code) { return [pscustomobject]@{ Status = 'http'; Code = $code; Message = "HTTP $code" } }
            $msg = if ($ex) { $ex.Message } else { 'cancelled' }
            return [pscustomobject]@{ Status = 'unreachable'; Code = 0; Message = $msg }
        } finally {
            $wc.Headers.Clear()
            $wc.Dispose()
        }
    }

    function Read-PlatformToken {
        # Hidden input from this console. Returns Token ($null when none) and Why. The plain
        # value exists only in memory, is registered for redaction at once, and the BSTR is zeroed.
        $lines = @(
            # No "b6pt_." here: Hide-Secret would redact it as a token shape.
            'Paste your BlueStep platform token (it starts with b6pt_ and has no spaces).',
            'No token yet? In BlueStep: Tools -> Organization Admin -> Super -> Global Users ->',
            '  your user -> Access Tokens -> Create New Token (give it an expiry date).',
            '  No Super tab? You cannot create one yourself: ask BlueStep for a token.',
            'What you paste does NOT show on screen. That is normal: paste it once',
            '(right-click, or Ctrl+V) and press Enter. Enter alone skips this for now.'
        )
        for ($try = 1; $try -le 3; $try++) {
            $title = if ($try -gt 1) { "Platform token (try $try of 3)" } else { 'Platform token' }
            Show-TurnBlock 'token' $title $lines
            try {
                $sec = Read-TurnAnswer 'Platform token' 'Paste the token, then press Enter' -Secure
            } catch {
                return [pscustomobject]@{ Token = $null; Why = "this terminal cannot read input ($($_.Exception.Message)); run the script in a terminal, or use -SkipToken" }
            }
            $plain = $null
            $bstr = [IntPtr]::Zero
            try {
                $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
                $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
            } finally {
                if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
                if ($sec) { $sec.Dispose() }
            }
            Register-Secret $plain
            if ($plain) { $plain = $plain.Trim() }
            Register-Secret $plain
            if (-not $plain) {
                Write-TurnEcho 'platform token: skipped (run this script again to add it)'
                return [pscustomobject]@{ Token = $null; Why = 'no token entered' }
            }
            if ($plain -cmatch '^b6pt_\S+$') {
                Write-TurnEcho 'platform token: received (hidden); checking it next'
                return [pscustomobject]@{ Token = $plain; Why = '' }
            }
            $plain = $null
            Write-TurnEcho 'platform token: that is not a token'
            Say "    That does not look like a platform token: it starts with b6pt_ and has no spaces (try $try of 3)." 'warn'
        }
        return [pscustomobject]@{ Token = $null; Why = 'three entries did not look like a platform token' }
    }

    function Invoke-TokenStep {
        # The token the gateway MCP and b6p sign in with. A new token is checked against the
        # gateway first; only then is it stored as the user variable B6PT_TOKEN (in-process,
        # never setx) and in b6p's own store (b6p auth set, token on stdin). Never on a command
        # line, never on screen, never in the log.
        $item = 'platform token'
        Say '[platform token]' 'step'
        $userTok = Get-UserTokenValue
        $procTok = $env:B6PT_TOKEN
        Register-Secret $userTok
        Register-Secret $procTok
        $current = if ($userTok) { $userTok } else { $procTok }
        $where = if ($userTok) { 'user environment' } elseif ($procTok) { 'this session only' } else { '' }
        $store = Get-B6pStoreState
        $storeText = if ($store.Exists) { 'b6p login file present' } else { 'no b6p login file' }

        if ($DryRun) {
            if ($current) {
                $st = if ($store.Exists) { 'ok' } else { 'would install' }
                Add-Result $item $st "B6PT_TOKEN is set ($where), $storeText; gateway not checked (dry run)"
            } else {
                Add-Result $item 'would install' "B6PT_TOKEN is not set, $storeText; would ask for a token"
            }
            $current = $null; $userTok = $null; $procTok = $null
            return
        }

        $plain = $null
        try {
            # 1. A token is already set: keep it if the gateway accepts it.
            if ($current) {
                $g = Test-GatewayToken $current
                if ($g.Status -eq 'ok') {
                    Say '    the stored token works (the gateway accepted it)'
                    if (-not $userTok) { Set-TokenVariable $current; Say '    saved it in the user environment (it was set for this session only)' }
                    if ($store.Exists) { Add-Result $item 'ok' "B6PT_TOKEN set, gateway accepted it, $storeText"; return }
                    $b = Set-B6pLogin $current
                    if ($b.Ok) { Add-Result $item 'installed' "B6PT_TOKEN set, gateway accepted it; $($b.Detail)" }
                    else { Add-Result $item 'failed' "B6PT_TOKEN set, gateway accepted it, but $($b.Detail)" }
                    return
                }
                if ($g.Status -ne 'refused') {
                    # Cannot tell whether the token is good: keep it, and still give b6p a login.
                    $extra = ''
                    if (-not $store.Exists) { $b = Set-B6pLogin $current; $extra = "; $($b.Detail)" }
                    Add-Result $item 'needs you' "could not reach the gateway ($GatewayUrl, $($g.Message)); the stored token was kept$extra"
                    return
                }
                Say "    the stored token was refused ($($g.Message)): it is expired, revoked or wrong. A new one is needed." 'warn'
            }

            # 2. Ask for one (Read-PlatformToken says where to create it).
            $refused = [bool]$current
            for ($round = 1; $round -le 2; $round++) {
                $read = Read-PlatformToken
                $plain = $read.Token
                $why = $read.Why
                $read = $null
                if (-not $plain) {
                    $state = if ($refused) { 'the gateway refused the stored token' } else { 'no token stored' }
                    Add-Result $item 'needs you' "$state ($why); create a token and run this script again"
                    return
                }
                # 3. Does the gateway accept it? Checked before anything is stored, so a refused
                #    token never replaces the one already saved.
                $g = Test-GatewayToken $plain
                if ($g.Status -eq 'refused') {
                    if ($round -eq 1) {
                        Say "    The gateway refused that token ($($g.Message)). Check that you copied all of it, or create a new one." 'warn'
                        $plain = $null
                        $refused = $true
                        continue
                    }
                    Add-Result $item 'needs you' "the gateway refused the token ($($g.Message)); nothing was saved; create a new one and run this script again"
                    return
                }
                # 4. Accepted, or the gateway could not be reached (the token cannot be judged, so it is
                #    kept rather than lost): store it for every app started from now on and this session,
                # 5. and give b6p its own copy.
                Set-TokenVariable $plain
                $b = Set-B6pLogin $plain
                if ($g.Status -eq 'ok') {
                    if ($b.Ok) { Add-Result $item 'installed' "the gateway accepted it; saved in the user environment and in b6p" }
                    else { Add-Result $item 'failed' "the gateway accepted it and it was saved in the user environment, but $($b.Detail)" }
                    return
                }
                $bText = if ($b.Ok) { 'b6p login saved' } else { $b.Detail }
                Add-Result $item 'needs you' "could not reach the gateway ($GatewayUrl, $($g.Message)); the token was saved in the user environment unchecked; $bText"
                return
            }
        } finally {
            $plain = $null
            $current = $null
            $userTok = $null
            $procTok = $null
        }
    }

    # ---------------------------------------------------------------- plugins (step 6)

    function Get-JsonProp($Obj, [string]$Name) {
        if ($null -eq $Obj -or $Obj -is [string]) { return $null }
        if ($Obj -is [hashtable]) { return $Obj[$Name] }
        $p = $Obj.PSObject.Properties[$Name]
        if ($p) { return $p.Value }
        return $null
    }

    function ConvertFrom-JsonText([string]$Text) {
        # A CLI's --json output, skipping anything printed before the JSON starts.
        $i = $Text.IndexOfAny([char[]]'[{')
        if ($i -lt 0) { throw 'no JSON in the output' }
        return ($Text.Substring($i) | ConvertFrom-Json)
    }

    function Read-JsonFile([string]$Path) {
        # Read only. $null when the file is missing or is not JSON.
        if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
        try { return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json) } catch { Write-Log "could not read ${Path}: $($_.Exception.Message)" 'warn'; return $null }
    }

    function Get-OutputTail($R) {
        if ($R.TimedOut) { return $R.Error }
        $lines = @((($R.Output, $R.Error) -join "`n") -split "`r?`n" | Where-Object { $_.Trim() })
        $t = (($lines | Select-Object -Last 2) -join ' / ').Trim()
        if ($t.Length -gt 300) { $t = $t.Substring(0, 300) + '...' }
        return $t
    }

    function Invoke-PluginCommand([string]$Exe, [string]$Shown, [string[]]$ArgList, [int]$TimeoutSec = 600, [string]$What, [string]$Eta = 'up to a minute') {
        # Every command that changes a plugin or a marketplace goes through here (never in a dry
        # run). $What is the plain progress line; the exact command goes to the log.
        Write-Log "    running: $Shown $($ArgList -join ' ')"
        if (-not $What) { $What = "Running $Shown $($ArgList -join ' ')" }
        $r = Invoke-Captured $Exe $ArgList $TimeoutSec -Activity $What -Eta $Eta
        Write-Log ("$Shown exit $($r.ExitCode): " + (($r.Output, $r.Error) -join ' ').Trim())
        return $r
    }

    function Get-RepoSlug([string]$Text) {
        # "owner/repo" in lower case from a GitHub source: owner/repo, or an https://, ssh://git@
        # or git@github.com: URL, with or without .git or a trailing slash. $null otherwise, so
        # "bspecs-something" or another host never counts as the same repo.
        if (-not $Text) { return $null }
        $t = $Text.Trim()
        $m = [regex]::Match($t, '(?i)^(?:https?://(?:[^@/]+@)?(?:www\.)?github\.com/|ssh://git@github\.com/|git@github\.com:)([A-Za-z0-9_.\-]+)/([A-Za-z0-9_.\-]+?)(?:\.git)?/*$')
        if (-not $m.Success) { $m = [regex]::Match($t, '^([A-Za-z0-9_\-][A-Za-z0-9_.\-]*)/([A-Za-z0-9_.\-]+?)(?:\.git)?$') }
        if (-not $m.Success) { return $null }
        return ($m.Groups[1].Value + '/' + $m.Groups[2].Value).ToLowerInvariant()
    }

    function Get-SourceInfo($Src) {
        # A marketplace source as Claude Code stores it ({ source: github, repo } / { source: git,
        # url } / { source: directory, path }): Kind, Value, Slug (GitHub repo or $null), Text.
        if ($Src -is [string]) { return [pscustomobject]@{ Kind = ''; Value = $Src; Slug = (Get-RepoSlug $Src); Text = $Src } }
        $kind = [string](Get-JsonProp $Src 'source')
        $value = ''
        foreach ($k in 'repo', 'url', 'path') { $v = [string](Get-JsonProp $Src $k); if ($v) { $value = $v; break } }
        $slug = $null
        if ($value -and $kind -ne 'directory' -and $kind -ne 'file') { $slug = Get-RepoSlug $value }
        return [pscustomobject]@{ Kind = $kind; Value = $value; Slug = $slug; Text = ("$kind $value").Trim() }
    }

    function Compare-MarketplaceSource($Info, [string]$Wanted) {
        # same | old (this repo's old name, kept: it works through the redirect) | other
        $w = Get-RepoSlug $Wanted
        if ($Info.Slug -and $w -and $Info.Slug -eq $w) { return 'same' }
        if ($Info.Slug -and $w -eq (Get-RepoSlug $RepoSlug) -and $Info.Slug -eq (Get-RepoSlug $OldRepoSlug)) { return 'old' }
        return 'other'
    }

    function Get-PhiGuardWhat {
        return @('phi-guard stops the AI agent when it is about to write what looks like real',
            'client data into a B6P project.')
    }

    function Get-OneToolsWhat([string]$Name, [string]$Repo) {
        return @("$Name adds the BlueStep One team tools. It is only for BlueStep One work, and",
            "your GitHub login needs access to $Repo (this script checks that first).")
    }

    function Get-OptIn([string]$Key, [string]$Name, [string[]]$What) {
        # Asked once per run, and only when a tool still lacks the plugin. Yes, How.
        # $Name is the plugin as the user sees it; $What says in plain words what it does.
        if ($optIns.ContainsKey($Key)) { return $optIns[$Key] }
        $switches = @{ 'phi-guard' = [bool]$PhiGuard; 'one-tools' = [bool]$OneTools }
        $sw = if ($Key -eq 'phi-guard') { '-PhiGuard' } else { '-OneTools' }
        if ($switches[$Key]) { $a = [pscustomobject]@{ Yes = $true; How = $sw } }
        elseif ($NoOptIns) { $a = [pscustomobject]@{ Yes = $false; How = '-NoOptIns' } }
        elseif ($DryRun) { $a = [pscustomobject]@{ Yes = $false; How = "dry run, not asked; a real run asks y/N, or pass $sw" } }
        else {
            Show-TurnBlock $Key "Install ${Name}?" (@($What) + @('y = install it now, n = skip it (you can add it later by running this again)'))
            try {
                $ans = Read-TurnAnswer "Install ${Name}?" "Install $Name now? [y/N]"
                $yes = [bool]($ans -match '^\s*(?i:y|yes)\s*$')
                $a = [pscustomobject]@{ Yes = $yes; How = $(if ($yes) { 'you answered y' } else { 'you answered N' }) }
                Write-TurnEcho $(if ($yes) { "${Name}: will be installed" } else { "${Name}: skipped" })
            } catch {
                $a = [pscustomobject]@{ Yes = $false; How = "this terminal cannot read input; pass $sw to install it" }
                Write-TurnEcho "${Name}: skipped (this window cannot read an answer)"
            }
        }
        $optIns[$Key] = $a
        Write-Log "opt-in ${Key}: $($a.Yes) ($($a.How))"
        return $a
    }

    function Test-GitHubRepoAccess([string]$Repo) {
        # Read only: can this machine's GitHub login see the repo? Ok, Detail.
        $gh = Get-Command gh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $gh) { return [pscustomobject]@{ Ok = $false; Detail = 'gh is not installed, so access cannot be checked (see the gh item)' } }
        $r = Invoke-Captured $gh.Source @('api', "repos/$Repo", '--jq', '.full_name') 60 -Activity "Checking that your GitHub login can open $Repo" -Eta 'a few seconds'
        Write-Log "gh api repos/${Repo}: exit $($r.ExitCode) $((($r.Output, $r.Error) -join ' ').Trim())"
        if ($r.ExitCode -eq 0) { return [pscustomobject]@{ Ok = $true; Detail = 'access ok' } }
        $text = (($r.Output, $r.Error) -join ' ')
        $why = if ($text -match 'auth login|not logged in|authentication required') { 'not signed in to GitHub (see the github login item)' }
            elseif ($text -match '(?i)SAML|SSO') { "your GitHub login is not authorized for the organization's single sign-on" }
            elseif ($text -match '404|Not Found') { 'your GitHub login cannot see it' }
            else { "gh api exit $($r.ExitCode): $(Get-OutputTail $r)" }
        return [pscustomobject]@{ Ok = $false; Detail = $why }
    }

    # ---- Claude Code

    function Get-ClaudeConfigDir {
        if ($env:CLAUDE_CONFIG_DIR) { return $env:CLAUDE_CONFIG_DIR }
        return (Join-Path $env:USERPROFILE '.claude')
    }

    function Find-ClaudeCli {
        $c = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { return $c.Source }
        $p = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
        if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
        return $null
    }

    function Get-ManagedSettingsSources {
        # Claude Code's managed (organization) settings on Windows, read only: the files under
        # Program Files\ClaudeCode (and the older ProgramData path) and the policy registry value.
        $out = @()
        $files = @()
        if ($env:ProgramFiles) {
            $files += Join-Path $env:ProgramFiles 'ClaudeCode\managed-settings.json'
            $d = Join-Path $env:ProgramFiles 'ClaudeCode\managed-settings.d'
            if (Test-Path -LiteralPath $d) { $files += @(Get-ChildItem -LiteralPath $d -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
        }
        if ($env:ProgramData) { $files += Join-Path $env:ProgramData 'ClaudeCode\managed-settings.json' }
        foreach ($f in $files) { $j = Read-JsonFile $f; if ($j) { $out += [pscustomobject]@{ Where = $f; Json = $j } } }
        foreach ($key in 'HKLM:\SOFTWARE\Policies\ClaudeCode', 'HKCU:\SOFTWARE\Policies\ClaudeCode') {
            try {
                $v = (Get-ItemProperty -LiteralPath $key -Name 'Settings' -ErrorAction Stop).Settings
                if ($v) { $out += [pscustomobject]@{ Where = "$key\Settings"; Json = ($v | ConvertFrom-Json) } }
            } catch { }
        }
        return $out
    }

    function Get-ManagedMarketplace([string]$Name) {
        foreach ($s in @(Get-ManagedSettingsSources)) {
            $e = Get-JsonProp (Get-JsonProp $s.Json 'extraKnownMarketplaces') $Name
            if ($e) { return [pscustomobject]@{ Where = $s.Where; Source = (Get-JsonProp $e 'source') } }
        }
        return $null
    }

    function Get-ClaudeState([string]$Claude) {
        # Registered marketplaces (name -> source) and plugins installed at user or managed scope
        # (id -> entry). From the CLI's --json output, or, in a dry run before the CLI exists,
        # from the two files it keeps under ~\.claude\plugins. Throws when they cannot be read.
        $st = [pscustomobject]@{ Marketplaces = @{}; Installed = @{} }
        if ($Claude) {
            $r = Invoke-Captured $Claude @('plugin', 'marketplace', 'list', '--json') 120 -Activity 'Reading the Claude Code plugin marketplaces' -Eta 'a few seconds'
            if ($r.ExitCode -ne 0) { throw "claude plugin marketplace list exit $($r.ExitCode): $(Get-OutputTail $r)" }
            foreach ($m in @(ConvertFrom-JsonText $r.Output)) { if ($m.name) { $st.Marketplaces[[string]$m.name] = $m } }
            $r = Invoke-Captured $Claude @('plugin', 'list', '--json') 120 -Activity 'Reading the installed Claude Code plugins' -Eta 'a few seconds'
            if ($r.ExitCode -ne 0) { throw "claude plugin list exit $($r.ExitCode): $(Get-OutputTail $r)" }
            foreach ($p in @(ConvertFrom-JsonText $r.Output)) {
                if ($p.id -and ($p.scope -eq 'user' -or $p.scope -eq 'managed')) { $st.Installed[[string]$p.id] = $p }
            }
            return $st
        }
        $dir = Join-Path (Get-ClaudeConfigDir) 'plugins'
        $km = Read-JsonFile (Join-Path $dir 'known_marketplaces.json')
        if ($km) { foreach ($p in $km.PSObject.Properties) { $st.Marketplaces[$p.Name] = (Get-JsonProp $p.Value 'source') } }
        $ip = Get-JsonProp (Read-JsonFile (Join-Path $dir 'installed_plugins.json')) 'plugins'
        if ($ip) {
            foreach ($p in $ip.PSObject.Properties) {
                foreach ($e in @($p.Value)) { if ($e.scope -eq 'user' -or $e.scope -eq 'managed') { $st.Installed[$p.Name] = $e } }
            }
        }
        return $st
    }

    function Confirm-ClaudeMarketplace([string]$Claude, $State, [string]$Name, [string]$Source) {
        # Read first, add only when absent, never remove ("marketplace remove" uninstalls its
        # plugins and deletes their saved options and secrets). Returns $true when plugins can be
        # installed against it (or would be, in a dry run).
        $item = "claude-code: marketplace $Name"
        $managed = Get-ManagedMarketplace $Name
        $reg = $State.Marketplaces[$Name]
        if ($reg) {
            $info = Get-SourceInfo $reg
            $origin = if ($managed) { "from managed settings ($($managed.Where)), " } else { '' }
            switch (Compare-MarketplaceSource $info $Source) {
                'same'  { Add-Result $item 'ok' "registered, ${origin}$($info.Text)" }
                'old'   { Add-Result $item 'ok' "registered under the old name, ${origin}$($info.Text); it keeps working through GitHub's redirect, so it is left as is" }
                default { Add-Result $item 'ok' "registered, ${origin}from another source ($($info.Text)); left as is, plugins install from it" }
            }
            return $true
        }
        if ($managed) {
            Add-Result $item 'ok' "defined by managed settings ($($managed.Where)) and not registered here yet; left to your organization; the installs below try it"
            return $true
        }
        # Not registered. A user settings entry for this name decides the source: an add from any
        # other source is refused while it exists, and this script never edits that file.
        $addSrc = $Source
        $why = 'not registered'
        $userEntry = Get-JsonProp (Get-JsonProp (Read-JsonFile (Join-Path (Get-ClaudeConfigDir) 'settings.json')) 'extraKnownMarketplaces') $Name
        if ($userEntry) {
            $ui = Get-SourceInfo (Get-JsonProp $userEntry 'source')
            if ($ui.Value -and @('github', 'git', 'url', 'directory') -contains $ui.Kind) {
                $addSrc = $ui.Value
                $why = "not registered; your settings.json lists it from $($ui.Text), so it is added from there"
            }
        }
        if ($DryRun) { Add-Result $item 'would install' "${why}; would run: claude plugin marketplace add $addSrc --scope user"; return $true }
        $r = Invoke-PluginCommand $Claude 'claude' @('plugin', 'marketplace', 'add', $addSrc, '--scope', 'user') -What "Adding the $Name plugin marketplace to Claude Code" -Eta 'up to a minute'
        if ($r.ExitCode -ne 0) { Add-Result $item 'failed' "claude plugin marketplace add $addSrc exit $($r.ExitCode): $(Get-OutputTail $r)"; return $false }
        Add-Result $item 'installed' "added from $addSrc (user scope)"
        return $true
    }

    function Install-ClaudePlugin([string]$Claude, $State, [string]$Id, [bool]$Ready) {
        # User scope; nothing happens when it is already installed. Returns $true when it is (or
        # would be) installed.
        $item = 'claude-code: ' + ($Id -split '@')[0]
        $have = $State.Installed[$Id]
        if ($have) {
            $note = if ($have.enabled -eq $false) { ', disabled (left as is)' } else { '' }
            Add-Result $item 'ok' "installed ($($have.scope) scope$(if ($have.version) { ', ' + $have.version })$note)"
            return $true
        }
        if (-not $Ready) { Add-Result $item 'skipped' "its marketplace is not registered (see the marketplace item)"; return $false }
        if ($DryRun) { Add-Result $item 'would install' "would run: claude plugin install $Id --scope user"; return $true }
        # No -y: it would also accept a marketplace-declared install command nobody saw.
        $r = Invoke-PluginCommand $Claude 'claude' @('plugin', 'install', $Id, '--scope', 'user') -What "Installing $(($Id -split '@')[0]) for Claude Code" -Eta 'up to a minute'
        if ($r.ExitCode -ne 0) { Add-Result $item 'failed' "claude plugin install $Id exit $($r.ExitCode): $(Get-OutputTail $r)"; return $false }
        Add-Result $item 'installed' "$Id (user scope)"
        return $true
    }

    function Invoke-ClaudePlugins {
        Say '[plugins: Claude Code]' 'step'
        $claude = Find-ClaudeCli
        if (-not $claude -and -not $DryRun) {
            Add-Result 'claude-code: plugins' 'needs you' 'the claude CLI is not available (see the claude item); run this script again once it is'
            return
        }
        if (-not $claude) { Say '    the claude CLI is not installed yet: reading its plugin files instead' }
        try { $state = Get-ClaudeState $claude } catch { Add-Result 'claude-code: plugins' 'failed' "could not read the plugin state: $($_.Exception.Message)"; return }

        $ready = Confirm-ClaudeMarketplace $claude $state $MarketplaceName $RepoSlug
        foreach ($n in 'bluestep-tools', 'core-tools') { [void](Install-ClaudePlugin $claude $state "$n@$MarketplaceName" $ready) }

        $pg = "phi-guard@$MarketplaceName"
        if ($state.Installed[$pg]) { [void](Install-ClaudePlugin $claude $state $pg $ready) }
        else {
            $c = Get-OptIn 'phi-guard' 'phi-guard' (Get-PhiGuardWhat)
            if ($c.Yes) { [void](Install-ClaudePlugin $claude $state $pg $ready) } else { Add-Result 'claude-code: phi-guard' 'skipped' "opt-in, not chosen ($($c.How))" }
        }

        # one-tools: id, marketplace and access repo come only from tool-versions.json, so moving
        # it to another marketplace changes that file and not this script.
        $ot = Get-JsonProp $versions.plugins 'one-tools'
        if (-not $ot -or -not $ot.id -or -not $ot.marketplace -or -not $ot.marketplace.name -or -not $ot.marketplace.source) {
            Add-Result 'claude-code: one-tools' 'skipped' 'tool-versions.json has no complete plugins.one-tools entry'
            return
        }
        $otId = [string]$ot.id
        $otItem = 'claude-code: ' + ($otId -split '@')[0]
        if ($state.Installed[$otId]) { $runFlags.OneTools = [bool](Install-ClaudePlugin $claude $state $otId $true); return }
        $otName = ($otId -split '@')[0]
        # The same plugin from another marketplace (one-tools@bluestep, before it moved): never
        # install a second copy, since a session loads only one of them.
        $other = @($state.Installed.Keys | Where-Object { ($_ -split '@')[0] -eq $otName -and $_ -ne $otId })
        if ($other.Count) {
            Add-Result $otItem 'needs you' "$($other -join ', ') is installed from another marketplace; switch to $otId as its README says (do not keep both)"
            $runFlags.OneTools = $true
            return
        }
        $c = Get-OptIn 'one-tools' $otName (Get-OneToolsWhat $otName ([string]$ot.accessRepo))
        if (-not $c.Yes) { Add-Result $otItem 'skipped' "opt-in, not chosen ($($c.How))"; return }
        if ($ot.accessRepo) {
            $acc = Test-GitHubRepoAccess ([string]$ot.accessRepo)
            if (-not $acc.Ok) { Add-Result $otItem 'needs you' "ask for access to $($ot.accessRepo): $($acc.Detail); then run this script again"; return }
        }
        $mName = [string]$ot.marketplace.name
        $mSrc = [string]$ot.marketplace.source
        if ($mName -eq $MarketplaceName -and (Get-RepoSlug $mSrc) -eq (Get-RepoSlug $RepoSlug)) { $otReady = $ready }
        else { $otReady = Confirm-ClaudeMarketplace $claude $state $mName $mSrc }
        $runFlags.OneTools = [bool](Install-ClaudePlugin $claude $state $otId $otReady)
    }

    # ---- Codex

    function Find-CodexCli {
        # On PATH (the CLI), or inside the desktop app's MSIX package (app\resources\codex.exe).
        $c = Get-Command codex -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { return $c.Source }
        try {
            $pkg = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop | Select-Object -First 1
            if ($pkg -and $pkg.InstallLocation) {
                $p = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
                if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
            }
        } catch { Write-Log "Get-AppxPackage OpenAI.Codex: $($_.Exception.Message)" }
        return $null
    }

    function Read-CodexConfig {
        # Read only, the parts of config.toml step 6 needs: [marketplaces.<name>] (source_type,
        # source), [plugins."<id>"] (installed), [hooks.state."<id>:..."] with trusted_hash.
        $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
        $cfg = [pscustomobject]@{ Path = (Join-Path $codexHome 'config.toml'); Marketplaces = @{}; Plugins = @{}; Trusted = @{} }
        if (-not (Test-Path -LiteralPath $cfg.Path -PathType Leaf)) { return $cfg }
        $parts = @()
        foreach ($line in [IO.File]::ReadAllLines($cfg.Path)) {
            $l = $line.Trim()
            if ($l -match '^\[([^\[\]]+)\]\s*(#.*)?$') {
                $parts = @([regex]::Matches($Matches[1], '"((?:[^"\\]|\\.)*)"|''([^'']*)''|([^.\s"'']+)') | ForEach-Object {
                    if ($_.Groups[1].Success) { $_.Groups[1].Value } elseif ($_.Groups[2].Success) { $_.Groups[2].Value } else { $_.Groups[3].Value } })
                if ($parts.Count -eq 2 -and $parts[0] -eq 'marketplaces') { $cfg.Marketplaces[$parts[1]] = @{} }
                if ($parts.Count -eq 2 -and $parts[0] -eq 'plugins') { $cfg.Plugins[$parts[1]] = $true }
                continue
            }
            if ($l -notmatch '^([A-Za-z0-9_\-]+)\s*=\s*(.+)$') { continue }
            $key = $Matches[1]
            $raw = $Matches[2].Trim()
            $val = if ($raw -match '^"((?:[^"\\]|\\.)*)"') { $Matches[1] -replace '\\(.)', '$1' } elseif ($raw -match "^'([^']*)'") { $Matches[1] } else { $raw }
            if ($parts.Count -eq 2 -and $parts[0] -eq 'marketplaces') { $cfg.Marketplaces[$parts[1]][$key] = $val }
            if ($parts.Count -eq 3 -and $parts[0] -eq 'hooks' -and $parts[1] -eq 'state' -and $key -eq 'trusted_hash') {
                $cfg.Trusted[($parts[2] -split ':')[0]] = $true
            }
        }
        return $cfg
    }

    function Invoke-CodexPlugins {
        Say '[plugins: Codex]' 'step'
        $codex = Find-CodexCli
        $cfg = Read-CodexConfig
        $clicks = "in Codex: Plugins -> add the marketplace $RepoSlug -> install bluestep-tools, then Review -> trust its hooks"
        if (-not $codex) { Add-Result 'codex: plugins' 'needs you' "no codex command found; $clicks"; return }
        Say "    codex: $codex"
        # codex-cli 0.166.0 "codex plugin --help": add (install from a configured marketplace),
        # list, remove, marketplace add|list|upgrade|remove. "codex plugin add --help": the
        # argument is PLUGIN@MARKETPLACE (or PLUGIN --marketplace NAME). Older builds lack "add".
        $h = Invoke-Captured $codex @('plugin', '--help') 30 -Activity 'Checking what this Codex can do with plugins' -Eta 'a few seconds'
        $canAdd = ($h.ExitCode -eq 0) -and ((($h.Output, $h.Error) -join "`n") -match '(?m)^\s+add\s')
        $item = "codex: marketplace $MarketplaceName"
        $mk = $cfg.Marketplaces[$MarketplaceName]
        $ready = $true
        if ($mk) {
            $kind = if ($mk['source_type'] -eq 'local') { 'directory' } else { [string]$mk['source_type'] }
            $info = Get-SourceInfo ([pscustomobject]@{ source = $kind; url = [string]$mk['source'] })
            switch (Compare-MarketplaceSource $info $RepoSlug) {
                'same'  { Add-Result $item 'ok' "registered, $($info.Text)" }
                'old'   { Add-Result $item 'ok' "registered under the old name, $($info.Text); it keeps working through GitHub's redirect, so it is left as is" }
                default { Add-Result $item 'ok' "registered from another source ($($info.Text)); left as is, plugins install from it" }
            }
        } elseif (-not $canAdd) {
            Add-Result 'codex: plugins' 'needs you' "this Codex has no plugin commands; $clicks"
            return
        } elseif ($DryRun) {
            Add-Result $item 'would install' "not registered; would run: codex plugin marketplace add $RepoSlug"
        } else {
            # Codex refuses a second add of the same name from another source; the read above
            # keeps that from happening, and nothing here ever removes a marketplace.
            $r = Invoke-PluginCommand $codex 'codex' @('plugin', 'marketplace', 'add', $RepoSlug) -What "Adding the $MarketplaceName plugin marketplace to Codex" -Eta 'up to a minute'
            if ($r.ExitCode -ne 0) { Add-Result $item 'failed' "codex plugin marketplace add $RepoSlug exit $($r.ExitCode): $(Get-OutputTail $r)"; $ready = $false }
            else { Add-Result $item 'installed' "added from $RepoSlug" }
        }

        $want = @("bluestep-tools@$MarketplaceName")
        $pg = "phi-guard@$MarketplaceName"
        $pgSkip = $null
        if ($cfg.Plugins.ContainsKey($pg)) { $want += $pg }
        else {
            $c = Get-OptIn 'phi-guard' 'phi-guard' (Get-PhiGuardWhat)
            if ($c.Yes) { $want += $pg } else { $pgSkip = "opt-in, not chosen ($($c.How))" }
        }
        $have = @()
        foreach ($id in $want) {
            $pItem = 'codex: ' + ($id -split '@')[0]
            if ($cfg.Plugins.ContainsKey($id)) { Add-Result $pItem 'ok' 'installed'; $have += $id; continue }
            if (-not $ready) { Add-Result $pItem 'skipped' 'its marketplace is not registered (see the marketplace item)'; continue }
            if (-not $canAdd) { Add-Result $pItem 'needs you' "in Codex: Plugins -> $MarketplaceName -> install $(($id -split '@')[0])"; $have += $id; continue }
            if ($DryRun) { Add-Result $pItem 'would install' "would run: codex plugin add $id"; $have += $id; continue }
            $r = Invoke-PluginCommand $codex 'codex' @('plugin', 'add', $id) -What "Installing $(($id -split '@')[0]) for Codex" -Eta 'up to a minute'
            if ($r.ExitCode -ne 0) { Add-Result $pItem 'failed' "codex plugin add $id exit $($r.ExitCode): $(Get-OutputTail $r)"; continue }
            Add-Result $pItem 'installed' $id
            $have += $id
        }
        if ($pgSkip) { Add-Result 'codex: phi-guard' 'skipped' $pgSkip }
        if ($optIns.ContainsKey('one-tools') -and $optIns['one-tools'].Yes) {
            # Not in this repo's Codex marketplace (.agents/plugins/marketplace.json): Claude Code only.
            Add-Result 'codex: one-tools' 'skipped' 'Claude Code only; Codex does not get it'
        }
        $untrusted = @($have | Where-Object { -not $cfg.Trusted.ContainsKey($_) } | ForEach-Object { ($_ -split '@')[0] })
        if ($untrusted.Count) {
            Add-Result 'codex: hook trust' 'needs you' ("Codex runs a plugin's hooks only after you trust them, once: open Codex -> Plugins -> " + ($untrusted -join ' and ') + ' -> Review -> trust. Again after an update that changes a hook.')
        }
    }

    # ---- Cursor

    function Invoke-CursorPlugins {
        # Cursor has no command to import a marketplace or install a plugin, so this only looks
        # for the plugin folders Cursor keeps (~\.cursor\plugins\cache\<owner>-<repo>\<plugin>,
        # old or new repo name) and otherwise lists the clicks.
        Say '[plugins: Cursor]' 'step'
        $cache = Join-Path $env:USERPROFILE '.cursor\plugins\cache'
        $dirs = @($RepoSlug, $OldRepoSlug | ForEach-Object { $_.Replace('/', '-') })
        $want = @('bluestep-tools')
        $found = @{}
        foreach ($p in 'bluestep-tools', 'phi-guard') {
            foreach ($d in $dirs) { if (Test-Path -LiteralPath (Join-Path $cache "$d\$p")) { $found[$p] = $true } }
        }
        if (-not $found['phi-guard']) {
            $c = Get-OptIn 'phi-guard' 'phi-guard' (Get-PhiGuardWhat)
            if ($c.Yes) { $want += 'phi-guard' }
        }
        $missing = @($want | Where-Object { -not $found[$_] })
        $present = @($found.Keys | Sort-Object)
        if (-not $missing.Count) { Add-Result 'cursor: plugins' 'ok' ("installed through Cursor: " + ($present -join ', ')); return }
        $steps = "in Cursor: (1) connect GitHub to Cursor (Connect GitHub in the sidebar, or Cursor settings); without it the import does nothing and shows no error; " +
            "(2) plugins -> Add Marketplace -> Import from Repo -> https://github.com/$RepoSlug; " +
            "(3) install " + ($missing -join ' and ') + " from it, and turn it on in Manage if it is off. Open your project folder first."
        Add-Result 'cursor: plugins' 'needs you' $steps
    }

    function Invoke-PluginsStep {
        $claudeHere = [bool]($agents['Claude Code CLI'] -or $agents['Claude desktop app'])
        if (-not $claudeHere -and -not $agents['Codex'] -and -not $agents['Cursor']) {
            Say '[plugins]' 'step'
            Add-Result 'plugins' 'skipped' 'no agent tool found (Claude Code CLI or desktop app, Cursor, Codex); install one and run this script again'
            return
        }
        # Run 1 of the prove-out: the desktop app's Code tab loads what the CLI installs, so the
        # Claude Code part covers both and the desktop app needs no clicks.
        if ($claudeHere) { try { Invoke-ClaudePlugins } catch { Add-Result 'claude-code: plugins' 'failed' $_.Exception.Message } }
        if ($agents['Codex']) { try { Invoke-CodexPlugins } catch { Add-Result 'codex: plugins' 'failed' $_.Exception.Message } }
        if ($agents['Cursor']) { try { Invoke-CursorPlugins } catch { Add-Result 'cursor: plugins' 'failed' $_.Exception.Message } }
    }

    function Get-PlannedTurns {
        # The YOUR TURN blocks this run expects to show, in order, from cheap read-only checks
        # (gh status, whether a token is set, the plugin files). The steps lower the count with
        # Skip-Turn when one is not needed after all, or add one (a refused token).
        $plan = New-Object System.Collections.Generic.List[string]
        if ($DryRun) { return ,$plan }
        if (-not $SkipToken) {
            $gh = Get-Command gh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($gh -and -not (Get-GhStatus $gh.Source).LoggedIn) { $plan.Add('github') }
            if (-not (Get-UserTokenValue) -and -not $env:B6PT_TOKEN) { $plan.Add('token') }
        }
        if (-not $SkipPlugins -and -not $NoOptIns) {
            $claudeHere = [bool]($agents['Claude Code CLI'] -or $agents['Claude desktop app'])
            $cst = $null
            if ($claudeHere) { try { $cst = Get-ClaudeState $null } catch { $cst = $null } }
            $pg = "phi-guard@$MarketplaceName"
            if (-not $PhiGuard) {
                $lacks = $claudeHere -and -not ($cst -and $cst.Installed[$pg])
                if (-not $lacks -and $agents['Codex']) { $lacks = -not (Read-CodexConfig).Plugins.ContainsKey($pg) }
                if (-not $lacks -and $agents['Cursor']) {
                    $cache = Join-Path $env:USERPROFILE '.cursor\plugins\cache'
                    $lacks = -not (@($RepoSlug, $OldRepoSlug) | Where-Object { Test-Path -LiteralPath (Join-Path $cache ($_.Replace('/', '-') + '\phi-guard')) })
                }
                if ($lacks) { $plan.Add('phi-guard') }
            }
            $ot = Get-JsonProp $versions.plugins 'one-tools'
            if (-not $OneTools -and $claudeHere -and $ot -and $ot.id -and -not ($cst -and $cst.Installed[[string]$ot.id])) { $plan.Add('one-tools') }
        }
        $plan.Add('next')
        return ,$plan
    }

    # ---------------------------------------------------------------- report (step 7)

    function Write-Report {
        Say 'Summary' 'step'
        $w = 12
        foreach ($r in $results) { if ($r.Item.Length -gt $w) { $w = $r.Item.Length } }
        Say ('  {0} {1} {2}' -f 'item'.PadRight($w), 'status'.PadRight(13), 'detail')
        Say ('  {0} {1} {2}' -f ('-' * $w), ('-' * 13), ('-' * 6))
        foreach ($r in $results) {
            $level = switch ($r.Status) { 'ok' { 'ok' } 'installed' { 'ok' } 'failed' { 'error' } 'needs you' { 'warn' } 'needs IT' { 'warn' } default { 'info' } }
            Say ('  {0} {1} {2}' -f $r.Item.PadRight($w), $r.Status.PadRight(13), $r.Detail) $level
        }
        Say ''
        Say "script version: $ScriptVersion"
        Say "log: $logFile"
        $failed = @($results | Where-Object { $_.Status -eq 'failed' }).Count
        $yours = @($results | Where-Object { $_.Status -eq 'needs you' -or $_.Status -eq 'needs IT' }).Count
        if ($failed) { Say "$failed item(s) failed (exit code 1). Fix what the detail says and run this script again: it keeps what works and repairs the rest." 'error' }
        if ($yours) { Say "$yours item(s) need you or IT: the detail says what to do. They alone do not fail the run." 'warn' }
        $next = 'quit the app fully (tray icon / menu bar -> Quit; closing the window is not enough), reopen it, open your project folder and run /b6p-setup'
        if ($runFlags.OneTools) { $next += ', and /one-setup for BlueStep One work' }
        if ($DryRun) {
            # A dry run never beeps, asks or changes the window title: plain lines only.
            Say 'Dry run: nothing was changed. Run it again without -DryRun to apply.' 'step'
            Say "After that run: $next."
            return
        }
        Write-Log "Next: $next."
        if ($null -ne $turnState) { foreach ($k in @($turnState.Planned)) { if ($k -ne 'next') { Skip-Turn $k } } }
        $lines = @(
            'The tools are set up. To start using them:',
            '  1. Quit the app fully: tray icon / menu bar -> Quit; closing the window is not enough.',
            '     (Claude, Cursor or Codex: whichever you use.)',
            '  2. Open the app again.',
            '  3. Open your project folder in it.',
            '  4. Type /b6p-setup and press Enter.'
        )
        if ($runFlags.OneTools) { $lines += '  5. For BlueStep One work, also type /one-setup and press Enter.' }
        if ($failed -or $yours) { $lines += 'First, look at the items above marked failed or needs you: their detail says what to do.' }
        Show-TurnBlock 'next' 'Restart the app' $lines
        Send-Attention
        Write-Host ''
    }

    # ---------------------------------------------------------------- main

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    } catch { }
    try {
        # Corporate proxies: use the system proxy with the user's own credentials.
        [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials
    } catch { }

    $platform = Get-Platform
    if ($platform.Os -ne 'windows') {
        Write-Host 'This script is for Windows. On macOS or Linux use bootstrap.sh.' -ForegroundColor Red
        return 1
    }

    $logDir = Join-Path $env:USERPROFILE '.bluestep\bootstrap'
    try {
        [void](New-Item -ItemType Directory -Path $logDir -Force)
        $logFile = Join-Path $logDir ((Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
        [IO.File]::WriteAllText($logFile, '', (New-Object Text.UTF8Encoding($false)))
    } catch {
        Write-Host "Could not open a log file in ${logDir}: $($_.Exception.Message). Going on without a log." -ForegroundColor Yellow
        $logFile = $null
    }

    try {
        Say "BlueStep bootstrap $ScriptVersion$(if ($DryRun) { ' (dry run: nothing is downloaded or changed)' })" 'step'
        Say "log: $logFile"
        Write-Log "PowerShell $($PSVersionTable.PSVersion) $($PSVersionTable.PSEdition); Windows $([Environment]::OSVersion.Version)"
        $elevated = $false
        try { $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { }
        if ($elevated) { Say 'note: this terminal runs as administrator. It is not needed; tools still go to your own user folder.' 'warn' }

        # Step 1: detect.
        Say "platform: $($platform.Pair)"
        Sync-SessionPath
        Find-AgentTools
        foreach ($k in $agents.Keys) { Say ('  {0,-19} {1}' -f $k, $(if ($agents[$k]) { $agents[$k] } else { 'not found' })) }

        # Step 2: versions file.
        try {
            $versions = Get-ToolVersions
        } catch {
            Say "Stopped: $($_.Exception.Message)" 'error'
            return 1
        }
        $pairs = @{}
        foreach ($tp in $versions.tools.PSObject.Properties) {
            foreach ($ap in $tp.Value.assets.PSObject.Properties) { $pairs[$ap.Name] = $true }
        }
        if (-not $pairs.ContainsKey($platform.Pair)) {
            $supported = ($pairs.Keys | Where-Object { $_ -like 'windows-*' } | Sort-Object) -join ', '
            Say "Stopped: $($platform.Pair) is not supported (supported on Windows: $supported)." 'error'
            return 1
        }

        # Step 3: tools, in order. Node first: the guardrail hooks need a JSON parser.
        foreach ($tool in @('node', 'git', 'gh', 'b6p', 'claude')) {
            $spec = $versions.tools.PSObject.Properties[$tool]
            if (-not $spec) { Add-Result $tool 'failed' 'missing from tool-versions.json'; continue }
            if ($tool -eq 'claude') {
                # The CLI is needed only to install plugins for Claude (step 6).
                if ($SkipPlugins) { Add-Result 'claude' 'skipped' '-SkipPlugins'; continue }
                if (-not $agents['Claude Code CLI'] -and -not $agents['Claude desktop app']) {
                    Add-Result 'claude' 'skipped' 'no Claude Code CLI or desktop app found'
                    continue
                }
            }
            try {
                Invoke-ToolStep $tool $spec.Value $platform.Pair
            } catch {
                Add-Result $tool 'failed' $_.Exception.Message
            }
        }

        # Steps 4-6. First count the questions ahead, so each YOUR TURN block says "n of N".
        try { $turnState.Planned = Get-PlannedTurns } catch { Write-Log "could not plan the questions: $($_.Exception.Message)" 'warn' }
        if ($turnState.Planned.Count) { Write-Log ('questions planned: ' + ($turnState.Planned -join ', ')) }
        if ($SkipToken) {
            Say '[github login, platform token] skipped (-SkipToken)' 'step'
            Add-Result 'github login' 'skipped' '-SkipToken'
            Add-Result 'platform token' 'skipped' '-SkipToken'
        } else {
            Invoke-GitHubLoginStep
            Skip-Turn 'github'
            Invoke-TokenStep
            Skip-Turn 'token'
        }
        if ($SkipPlugins) { Say '[plugins] skipped (-SkipPlugins)' 'step'; Add-Result 'plugins' 'skipped' '-SkipPlugins' } else { Invoke-PluginsStep }
        Skip-Turn 'phi-guard', 'one-tools'

        # Step 7.
        Write-Report
        if (@($results | Where-Object { $_.Status -eq 'failed' }).Count) { return 1 }
        return 0
    } catch {
        Say "Stopped by an unexpected error: $($_.Exception.Message)" 'error'
        Write-Log $_.ScriptStackTrace 'error'
        return 1
    } finally {
        if ($DryRun) { $env:Path = $sessionPathBefore }
    }
}

# Exit with a code only when run as a file (-File, CI). Under iex an exit would close the
# caller's terminal or script, so there the function is just removed again.
$bsFromFile = [bool]${function:Invoke-BlueStepBootstrap}.File
$bsExitCode = Invoke-BlueStepBootstrap @PSBoundParameters | Select-Object -Last 1
if ($bsFromFile) { exit $bsExitCode }
Remove-Item -Path function:Invoke-BlueStepBootstrap -ErrorAction SilentlyContinue
Remove-Variable -Name bsExitCode, bsFromFile -ErrorAction SilentlyContinue
