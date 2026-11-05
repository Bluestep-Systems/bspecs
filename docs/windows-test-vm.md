# A clean Windows test machine (Hyper-V)

A disposable Windows 11 VM on a developer's own Windows machine, for anything that has to be
tested "as a new user would see it": an install script, a setup skill, a plugin install, a
non-admin account. It opens in a window next to the agent session, it goes back to a clean state
in seconds (a checkpoint), and it shares a folder with the host so results come back as a file
the agent on the host reads, with nothing typed by hand.

Used first for the machine-bootstrap prove-out (`.claude/specs/machine-bootstrap/`, tasks 1 and 7).

## Where this fits: the test matrix

The VM covers one case: **Windows x64, with a GUI, as a user without admin rights**. Nothing
Anthropic ships gives a clean Windows or macOS machine (checked 2026-11-04): `claude plugin eval`
isolates the Claude config, not the OS, and runs as you on your machine; cloud sessions, computer
use and Managed Agents sandboxes are Ubuntu only. So each kind of test has its own place:

| What to test | Where | When |
|---|---|---|
| A plugin's skills and hooks | `claude plugin eval` in CI (temporary home and config; only the plugin loads) | Every PR |
| A script on Windows, macOS and Linux, without a GUI, with admin | GitHub Actions `windows-latest`, `macos-latest`, `ubuntu-latest` | Every PR |
| A clean Linux machine | A Claude Code cloud session (Ubuntu, root) or a local container | When the Linux path changes |
| Windows without admin, with the desktop apps | **This VM**, restored to its clean checkpoint | Each release of what is tested |
| macOS without admin, with the desktop apps | A real Mac with a *Standard* user account. Apple's license allows macOS VMs only on Apple hardware, so this VM cannot stand in | Each release |
| A machine under the organization's device management (Intune, AppLocker, proxy) | A pilot user's real laptop | Before announcing |

Not verified yet: whether `claude plugin eval` runs on the Windows and macOS runners (its docs
name no OS), and whether a cloud session starts clean each time (its setup script is cached).

## What the host needs

- Windows 11 **Pro, Enterprise or Business**. Hyper-V is not available on Home.
- A 64-bit CPU with SLAT and virtualization on in the firmware. Check: Task Manager → Performance
  → CPU → "Virtualization: Enabled".
- Admin rights on the host, once, to turn Hyper-V on and to add yourself to the
  *Hyper-V Administrators* group. After that, day-to-day use needs no elevation.
- About 8 GB of RAM and 80 GB of disk free for one VM.

On a machine joined to the organization's device management (Entra ID / Intune), a policy can
still block the Hyper-V feature. Nothing in the local policy keys shows it in advance; the enable
command in step 1 is the check.

## One-time setup

### 1. Turn Hyper-V on (host, PowerShell as administrator)

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
Add-LocalGroupMember -Group "Hyper-V Administrators" -Member $env:USERNAME
```

Restart the host. Windows' own virtualization-based security and WSL 2 already use the hypervisor;
they keep working with Hyper-V on.

### 2. Get Windows

Download the **Windows 11 Enterprise Evaluation** ISO (64-bit) from the Microsoft Evaluation
Center (`https://www.microsoft.com/en-us/evalcenter/download-windows-11-enterprise`). It asks for a
short registration first and runs for 90 days, which is enough for test use; after that, rebuild
the VM from the ISO. Microsoft no longer offers the prebuilt developer VMs.

### 3. Create the VM (host, PowerShell; no elevation once you are in Hyper-V Administrators)

```powershell
$name = "win11-test"
$iso  = "$env:USERPROFILE\Downloads\<the ISO file>.iso"
$vhd  = "$env:PUBLIC\Documents\Hyper-V\Virtual hard disks\$name.vhdx"

New-VM -Name $name -Generation 2 -MemoryStartupBytes 8GB -NewVHDPath $vhd -NewVHDSizeBytes 80GB -SwitchName "Default Switch"
Set-VMMemory    -VMName $name -DynamicMemoryEnabled $false
Set-VMProcessor -VMName $name -Count 4 -ExposeVirtualizationExtensions $true
Set-VMKeyProtector -VMName $name -NewLocalKeyProtector
Enable-VMTPM    -VMName $name
Add-VMDvdDrive  -VMName $name -Path $iso
Set-VMFirmware  -VMName $name -FirstBootDevice (Get-VMDvdDrive -VMName $name)
Set-VMHost -EnableEnhancedSessionMode $true
Start-VM -Name $name
vmconnect.exe localhost $name
```

- Generation 2 with a virtual TPM: Windows 11 setup refuses to install without one.
- Fixed memory and `ExposeVirtualizationExtensions`: nested virtualization, in case something
  inside the VM (WSL 2, an app's own sandbox) needs a hypervisor. It costs nothing when unused.
- "Default Switch" gives the VM internet through the host with no setup.

### 4. Install Windows with the right accounts

1. In setup, choose *Sign-in options → Domain join instead* to make a **local** account
   (for example `vmadmin`). The first account is always an administrator; keep it for setup only.
2. Signed in as `vmadmin`, create the account the tests run as, a **standard user**, and let it use
   Enhanced Session (which signs in over Remote Desktop):

   ```powershell
   net user tester * /add
   net localgroup "Remote Desktop Users" tester /add
   ```

3. Settings → System → Remote Desktop → **On**. Enhanced Session needs it.
4. Sign out, close the window, reconnect with `vmconnect.exe localhost win11-test`. The Enhanced
   Session dialog appears: *Show Options → Local Resources → More…* → tick the host drive that holds
   the shared folder (below). Sign in as `tester`.

### 5. Shared folder for instructions and results

Make a folder on the host, for example `C:\vm-share\<task>\`. With the drive ticked in step 4, the
VM sees it under *This PC* as "C on <host name>", reachable from PowerShell as
`\\tsclient\C\vm-share\<task>\`.

- The host agent writes the instructions and the test script there.
- The script in the VM writes its results (a `results.md`) back to the same folder.
- On the host, tell the agent "done"; it reads the results file. Nothing is copied by hand.

Never put a real credential in that folder. Use a throwaway token with a short expiry for any test
that needs one, and revoke it afterwards.

### 6. Take the clean checkpoint

Install what every test run starts from (for example the Claude desktop app, signed in as
`tester`), then on the host:

```powershell
Set-VM -Name win11-test -CheckpointType Standard
Checkpoint-VM -Name win11-test -SnapshotName "clean"
```

## Each test run

1. Back to clean (host):
   ```powershell
   Restore-VMSnapshot -VMName win11-test -Name "clean" -Confirm:$false
   Start-VM -Name win11-test; vmconnect.exe localhost win11-test
   ```
2. In the VM, as `tester`: open PowerShell and run the line from the task's instructions file, for
   example
   `powershell -ExecutionPolicy Bypass -File \\tsclient\C\vm-share\<task>\run.ps1`.
3. Answer the script's prompts; it writes `results.md` to the shared folder.
4. On the host, tell the agent the run is done.

Restoring the checkpoint undoes everything the run installed, so the next run starts clean again.

## Clean-up

```powershell
Stop-VM -Name win11-test -TurnOff
Remove-VM -Name win11-test -Force
Remove-Item "$env:PUBLIC\Documents\Hyper-V\Virtual hard disks\win11-test*.vhdx"
```

## What this does not test

See the matrix at the top for where each of these goes.

- A machine under the organization's device management: the VM is not enrolled, so policies that
  apply to staff laptops (blocked apps, AppLocker, proxy) are not there.
- macOS.
- Arm64 Windows: the evaluation ISO is x64 only.
- A host without Hyper-V: Windows Home, no admin rights, or a policy that blocks the feature.
