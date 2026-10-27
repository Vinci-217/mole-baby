param([Parameter(Mandatory=$true)][string]$Installer,[string]$ProductName='拉姆',[string]$InstallDirName='mole-baby')
$ErrorActionPreference = 'Stop'
$env:MOLE_BABY_DISABLE_UPDATES='1'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class InstallerUI {
 public delegate bool EnumProc(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p,IntPtr arg);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent,EnumProc p,IntPtr arg);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",EntryPoint="SendMessageW",CharSet=CharSet.Unicode)] public static extern IntPtr SetText(IntPtr h,uint m,IntPtr w,string text);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW",CharSet=CharSet.Unicode)] public static extern IntPtr ReadControlText(IntPtr h,uint m,IntPtr w,StringBuilder text,uint flags,uint timeout,out UIntPtr result);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 public static string Text(IntPtr h){var s=new StringBuilder(1024);GetWindowText(h,s,1024);return s.ToString();}
 public static string ControlText(IntPtr h){var s=new StringBuilder(1024);UIntPtr result;ReadControlText(h,0xD,new IntPtr(1024),s,2,1000,out result);return s.ToString();}
 public static IntPtr DirectoryEdit(IntPtr parent){IntPtr found=IntPtr.Zero;EnumChildWindows(parent,(h,p)=>{var cls=new StringBuilder(64);GetClassName(h,cls,64);if(IsWindowVisible(h)&&cls.ToString()=="Edit"&&System.IO.Path.IsPathRooted(ControlText(h))){found=h;return false;}return true;},IntPtr.Zero);return found;}
 public static IntPtr Find(int pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid&&IsWindowVisible(h)&&GetDlgItem(h,1)!=IntPtr.Zero){found=h;return false;}return true;},IntPtr.Zero);return found;}
}
'@
$folder = Join-Path $env:RUNNER_TEMP ('mole-finish-'+[guid]::NewGuid().ToString('N'))
# electron-builder uses the ASCII package name as APP_FILENAME when the
# product name is Chinese. Its directory pre-hook appends that name if absent.
$install = Join-Path $folder $InstallDirName
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$installerProcess = $null
try {
 $installerProcess = Start-Process -FilePath $Installer -ArgumentList @('/currentuser',"/D=$install") -PassThru
 $deadline = [DateTime]::UtcNow.AddMinutes(4)
 $finish = [IntPtr]::Zero
 $dialog = [IntPtr]::Zero
 $lastClick = [DateTime]::MinValue
 $pathConfirmed = $false
 while([DateTime]::UtcNow -lt $deadline) {
  $dialog = [InstallerUI]::Find($installerProcess.Id)
  if($dialog -ne [IntPtr]::Zero){
   $button = [InstallerUI]::GetDlgItem($dialog,1)
   $label = [InstallerUI]::Text($button)
   if([InstallerUI]::IsWindowVisible($button) -and [InstallerUI]::IsWindowEnabled($button)){
    if($label -match 'Finish|完成'){$finish=$button;break}
    if($label -match 'Next|Install|下一步|安装' -and ([DateTime]::UtcNow-$lastClick).TotalSeconds -gt 1){
     if($label -match 'Install|安装' -and !$pathConfirmed){
      $edit=[InstallerUI]::DirectoryEdit($dialog)
      if($edit -eq [IntPtr]::Zero){throw 'Installer directory page has no visible path field'}
      [InstallerUI]::SetText($edit,0xC,[IntPtr]::Zero,$install) | Out-Null
      if([InstallerUI]::ControlText($edit) -ne $install){throw 'Installer did not accept the isolated target path'}
      $pathConfirmed=$true
      Write-Output "Installer target confirmed in directory page: $install"
      Start-Sleep -Milliseconds 100
     }
     Write-Output "Installer page: $label"
     [InstallerUI]::SetForegroundWindow($dialog) | Out-Null
     [InstallerUI]::PostMessage($button,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
     $lastClick=[DateTime]::UtcNow
    }
   }
  }
  Start-Sleep -Milliseconds 100
 }
 if($finish -eq [IntPtr]::Zero){throw 'Installer never reached its real Finish page'}
 if(!$pathConfirmed){throw 'Installer skipped the explicit directory-page path check'}
 if(!(Test-Path (Join-Path $install "$ProductName.exe"))){throw 'Installer did not install in the isolated test folder'}
 # Leave the standard, default-checked Run checkbox enabled. A real button
 # message runs the same custom MUI callback as a mouse click on Finish.
 $watch=[Diagnostics.Stopwatch]::StartNew()
 [InstallerUI]::SetForegroundWindow($dialog) | Out-Null
 [InstallerUI]::PostMessage($finish,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
 while([InstallerUI]::IsWindowVisible($dialog) -and $watch.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}
 $hiddenMs=$watch.ElapsedMilliseconds
 if([InstallerUI]::IsWindowVisible($dialog)){throw "Finish left the installer visible for ${hiddenMs}ms"}
 $launched=$false
 while($watch.ElapsedMilliseconds -lt 45000){
  $pets=@(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq (Join-Path $install "$ProductName.exe")})
  if(@($pets | Where-Object {$_.MainWindowHandle -ne 0 -and [InstallerUI]::IsWindowVisible($_.MainWindowHandle)}).Count -gt 0){$launched=$true;break}
  Start-Sleep -Milliseconds 100
 }
 if(!$launched){throw 'Finish did not launch a visible, installed pet application'}
 Write-Output "PASS: Windows installer real Finish click hides wizard in ${hiddenMs}ms and launches installed application in $($watch.ElapsedMilliseconds)ms"
} finally {
 # Only processes from our unique installation directory are eligible.
 Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith($install,[StringComparison]::OrdinalIgnoreCase)} | Stop-Process -Force -ErrorAction SilentlyContinue
 if($installerProcess -and !$installerProcess.HasExited){$installerProcess | Stop-Process -Force -ErrorAction SilentlyContinue}
 $uninstaller=Join-Path $install "Uninstall $ProductName.exe"
 if(Test-Path $uninstaller){Start-Process -FilePath $uninstaller -ArgumentList @('/S',"_?=$install") -Wait}
 Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
}
