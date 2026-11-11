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
using System;using System.Text;using System.Runtime.InteropServices;using System.Runtime.InteropServices.ComTypes;
public static class ShortcutWindow {
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
[ComImport, Guid("00021401-0000-0000-C000-000000000046")] internal class ShellLinkObject {}
[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] internal interface IShellLinkW {
 void GetPath([Out,MarshalAs(UnmanagedType.LPWStr)] StringBuilder path,int count,IntPtr findData,uint flags);
 void GetIDList(out IntPtr id);void SetIDList(IntPtr id);
 void GetDescription([Out,MarshalAs(UnmanagedType.LPWStr)] StringBuilder text,int count);
 void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
 void GetWorkingDirectory([Out,MarshalAs(UnmanagedType.LPWStr)] StringBuilder path,int count);
 void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string path);
 void GetArguments([Out,MarshalAs(UnmanagedType.LPWStr)] StringBuilder args,int count);
 void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string args);
 void GetHotkey(out short hotkey);void SetHotkey(short hotkey);void GetShowCmd(out int command);void SetShowCmd(int command);
 void GetIconLocation([Out,MarshalAs(UnmanagedType.LPWStr)] StringBuilder path,int count,out int index);
 void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path,int index);
 void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path,uint reserved);void Resolve(IntPtr window,uint flags);
 void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
}
public sealed class ShortcutDetails {public string TargetPath;public string WorkingDirectory;public string Arguments;}
public static class NativeShortcut {
 public static ShortcutDetails Read(string path) {
  var link=(IShellLinkW)new ShellLinkObject();
  try {
   ((IPersistFile)link).Load(path,0);var target=new StringBuilder(32768);var directory=new StringBuilder(32768);var args=new StringBuilder(32768);
   link.GetPath(target,target.Capacity,IntPtr.Zero,4);link.GetWorkingDirectory(directory,directory.Capacity);link.GetArguments(args,args.Capacity);
   return new ShortcutDetails {TargetPath=target.ToString(),WorkingDirectory=directory.ToString(),Arguments=args.ToString()};
  } finally {Marshal.FinalReleaseComObject(link);}
 }
 public static void BreakTarget(string path,string target,string directory) {
  var link=(IShellLinkW)new ShellLinkObject();
  try {((IPersistFile)link).Load(path,0);link.SetPath(target);link.SetWorkingDirectory(directory);((IPersistFile)link).Save(path,true);}
  finally {Marshal.FinalReleaseComObject(link);}
 }
}
'@
}
$install=[IO.Path]::GetFullPath($InstallDirectory)
$exe=Join-Path $install "$ProductName.exe"
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
 $link=[NativeShortcut]::Read($entry)
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
 # Deliberately damage the links, verify the damage independently, then require
 # a real reinstall to repair them. This is separate from a fresh-install check.
 foreach($entry in $entries){
  $missing=Join-Path $install 'missing-old-program.exe'
  [NativeShortcut]::BreakTarget($entry,$missing,(Join-Path $install 'missing-old-directory'))
  $broken=[NativeShortcut]::Read($entry)
  if(!$broken.TargetPath -or !([IO.Path]::GetFullPath($broken.TargetPath)).Equals($missing,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $broken.TargetPath)){throw "Broken-link positive control failed: $entry"}
  $checks.Add("confirmed missing target for $entry")
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
