param(
 [Parameter(Mandatory=$true)][string]$Installer,
 [Parameter(Mandatory=$true)][string]$InstallDirectory,
 [string]$ProductName='拉姆',
 [switch]$RequireInstalledShortcut,
 [string]$Report=(Join-Path $PSScriptRoot '../artifacts/windows-entrypoints.json')
)
$ErrorActionPreference='Stop'
$env:MOLE_BABY_DISABLE_UPDATES='1'
if(-not ('ShortcutWindow' -as [type])) {
 Add-Type @'
using System;using System.Runtime.InteropServices;
public static class ShortcutWindow {
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
'@
}
$install=[IO.Path]::GetFullPath($InstallDirectory)
$exe=Join-Path $install "$ProductName.exe"
$shell=New-Object -ComObject WScript.Shell
$entries=@(
 (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) "$ProductName.lnk"),
 (Join-Path ([Environment]::GetFolderPath('Programs')) "$ProductName.lnk")
)
if($RequireInstalledShortcut){$entries+=Join-Path $install "$ProductName.lnk"}
$entries=@($entries|ForEach-Object {[IO.Path]::GetFullPath($_)})
$checks=[Collections.Generic.List[string]]::new()
$links=[Collections.Generic.List[object]]::new()
$failure=$null
function Stop-TestPet {
 Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.Equals($exe,[StringComparison]::OrdinalIgnoreCase)} | Stop-Process -Force -ErrorAction SilentlyContinue
 Start-Sleep -Milliseconds 300
}
function Test-Entry([string]$entry,[string]$phase) {
 if(!(Test-Path -LiteralPath $entry)){throw "Missing $phase entry: $entry"}
 $link=$shell.CreateShortcut($entry)
 $raw=Join-Path (Split-Path -Parent $Report) ('shortcut-files/'+$phase+'/'+[IO.Path]::GetFileName((Split-Path -Parent $entry)))
 New-Item -ItemType Directory -Path $raw -Force | Out-Null
 Copy-Item -LiteralPath $entry -Destination $raw
 Write-Output ('SHORTCUT_BYTES '+[Convert]::ToBase64String([IO.File]::ReadAllBytes($entry)))
 $record=[ordered]@{phase=$phase;shortcut=$entry;target=$link.TargetPath;workingDirectory=$link.WorkingDirectory;arguments=$link.Arguments;targetExists=(Test-Path -LiteralPath $link.TargetPath);bytes=(Get-Item -LiteralPath $entry).Length}
 $links.Add($record)
 Write-Output ('SHORTCUT '+($record|ConvertTo-Json -Compress))
 Stop-TestPet
 # ShellExecute the .lnk itself, from a directory unrelated to the app. The
 # old finish-page test bypassed every shortcut by executing the EXE directly.
 Start-Process -FilePath $entry -WorkingDirectory $env:WINDIR
 $deadline=[DateTime]::UtcNow.AddSeconds(45)
 $visible=$false
 while([DateTime]::UtcNow -lt $deadline){
  $pets=@(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.Equals($exe,[StringComparison]::OrdinalIgnoreCase)})
  if(@($pets|Where-Object {$_.MainWindowHandle -ne 0 -and [ShortcutWindow]::IsWindowVisible($_.MainWindowHandle)}).Count -gt 0){$visible=$true;break}
  Start-Sleep -Milliseconds 100
 }
 if(!$visible){throw "The $phase shortcut did not launch a visible installed application: $entry"}
 if(!$link.TargetPath -or !([IO.Path]::GetFullPath($link.TargetPath)).Equals($exe,[StringComparison]::OrdinalIgnoreCase) -or !$record.targetExists){throw "Broken $phase shortcut: $entry -> $($link.TargetPath); expected $exe"}
 if(!$link.WorkingDirectory -or !([IO.Path]::GetFullPath($link.WorkingDirectory)).Equals($install,[StringComparison]::OrdinalIgnoreCase)){throw "Wrong $phase shortcut working directory: $($link.WorkingDirectory)"}
 if($link.Arguments -ne ''){throw "Unexpected $phase shortcut arguments: $($link.Arguments)"}
 $checks.Add("$phase launched $entry")
 Stop-TestPet
}
try {
 if(!(Test-Path -LiteralPath $exe)){throw "Installed application executable is missing: $exe"}
 foreach($entry in $entries){Test-Entry $entry 'fresh install'}
 # Reproduce an old/moved target retained by electron-builder's KeepShortcuts
 # upgrade path. Reinstalling must repair links, while keeping app data intact.
 foreach($entry in $entries){
  $link=$shell.CreateShortcut($entry)
  $link.TargetPath=Join-Path $install 'missing-old-program.exe'
  $link.WorkingDirectory=Join-Path $install 'missing-old-directory'
  $link.Save()
 }
 $repair=Start-Process -FilePath $Installer -ArgumentList "/S /currentuser /D=$install" -PassThru
 if(!$repair.WaitForExit(150000)){throw 'Repair installation timed out'}
 if($repair.ExitCode -ne 0){throw "Repair installation failed: $($repair.ExitCode)"}
 foreach($entry in $entries){Test-Entry $entry 'repair install'}
 Write-Output 'PASS: desktop, Start menu and installed entries resolve and launch; reinstall repairs stale targets'
} catch {
 $failure=$_.Exception.Message
 throw
} finally {
 Stop-TestPet
 $parent=Split-Path -Parent $Report
 New-Item -ItemType Directory -Path $parent -Force | Out-Null
 [ordered]@{installDirectory=$install;executable=$exe;passed=($null -eq $failure);checks=$checks.ToArray();links=$links.ToArray();error=$failure}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $Report -Encoding utf8
}
