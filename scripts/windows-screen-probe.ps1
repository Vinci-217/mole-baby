param(
  [ValidateSet('Bar','Work','Capture')][string]$Mode,
  [string]$Output,
  [string]$Ready,
  [long]$Handle,
  [string]$OwnedIds = '',
  [int]$Left = 0, [int]$Top = 0, [int]$Width = 80, [int]$Height = 4
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class ScreenNative {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int L,T,R,B; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
  delegate bool Callback(IntPtr h,IntPtr p);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h,ref Point p);
  [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr Style(IntPtr h,int index);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder text,int count);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int key,out int value,int bytes);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("dwmapi.dll")] static extern int DwmIsCompositionEnabled(out bool enabled);
  public static uint Dpi(long id) { try { return GetDpiForWindow(new IntPtr(id)); } catch(EntryPointNotFoundException) { return 0; } }
  public static bool Compositing() { bool enabled; return DwmIsCompositionEnabled(out enabled)==0&&enabled; }
  public static void EnableDpi() { try { if(SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch(EntryPointNotFoundException) {} SetProcessDPIAware(); }
  public static long[] Inspect(long id) {
    var h=new IntPtr(id); Rect r; Point p=new Point();
    if(!GetWindowRect(h,out r)) throw new Exception("Cannot inspect native window");
    ClientToScreen(h,ref p); int nc,border; int ncResult=DwmGetWindowAttribute(h,1,out nc,4), borderResult=DwmGetWindowAttribute(h,34,out border,4);
    return new long[]{r.L,r.T,r.R-r.L,r.B-r.T,Style(h,-16).ToInt64(),Style(h,-20).ToInt64(),p.X-r.L,p.Y-r.T,ncResult,nc,borderResult,border};
  }
  public static string[] Windows(uint[] ids,long main) {
    var owners=new HashSet<uint>(ids); var rows=new List<string>();
    EnumWindows((h,p)=>{ uint pid; Rect r; GetWindowThreadProcessId(h,out pid);
      if(h.ToInt64()!=main&&owners.Contains(pid)&&IsWindowVisible(h)&&GetWindowRect(h,out r)&&r.R-r.L>1&&r.B-r.T>1) {
        var name=new StringBuilder(256); var title=new StringBuilder(512); GetClassName(h,name,256);GetWindowText(h,title,512);
        rows.Add(pid+" "+name+" "+r.L+","+r.T+","+(r.R-r.L)+","+(r.B-r.T)+" "+title);
      } return true; },IntPtr.Zero); return rows.ToArray();
  }
}
'@
[ScreenNative]::EnableDpi()
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ($Mode -eq 'Capture') {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $screen.Size)
    $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
  $ids = @($OwnedIds.Split(',') | Where-Object { $_ } | ForEach-Object { [uint32]$_ })
  $window = @(); if ($Handle -ne 0) { $window = @([ScreenNative]::Inspect($Handle)) }
  @{ screen=@($screen.X,$screen.Y,$screen.Width,$screen.Height); window=$window; dpi=[ScreenNative]::Dpi($Handle); compositing=[ScreenNative]::Compositing(); foreground=[ScreenNative]::GetForegroundWindow().ToInt64().ToString(); extraWindows=@([ScreenNative]::Windows($ids,$Handle)) } | ConvertTo-Json -Depth 4 -Compress
  exit
}
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System.Windows.Forms;
public class ProbeSurface : Form {
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams { get { var p=base.CreateParams; p.ExStyle|=0x08000080; return p; } }
}
'@
if ($Mode -eq 'Work') {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'Surface regression: other application'
} else {
  $form = New-Object ProbeSurface
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
}
$form.ShowInTaskbar = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.Bounds = New-Object System.Drawing.Rectangle($Left,$Top,$Width,$Height)
$form.BackColor = [System.Drawing.Color]::White
$form.TopMost = ($Mode -eq 'Bar')
$form.Add_Shown({ [System.IO.File]::WriteAllText($Ready, 'ready') })
[System.Windows.Forms.Application]::Run($form)
