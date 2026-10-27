const{execFileSync}=require('node:child_process');
function windowsStartupDiagnostics(pid){
 if(process.platform!=='win32')return null;
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid diagnostic PID');
 const script=`Add-Type @'
using System;using System.Collections.Generic;using System.Text;using System.Runtime.InteropServices;
public static class StartupWindows{
 delegate bool Callback(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(Callback callback,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumChildWindows(IntPtr h,Callback callback,IntPtr p);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW",CharSet=CharSet.Unicode)]static extern IntPtr Text(IntPtr h,uint m,IntPtr w,StringBuilder text,uint flags,uint timeout,out UIntPtr result);
 public static string[] Inspect(uint pid){var texts=new List<string>();Callback read=(h,p)=>{var s=new StringBuilder(8192);UIntPtr result;Text(h,0xD,new IntPtr(8192),s,2,500,out result);if(s.Length>0)texts.Add(s.ToString());return texts.Count<64;};EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid&&IsWindowVisible(h)){read(h,p);EnumChildWindows(h,read,p);}return true;},IntPtr.Zero);return texts.ToArray();}
}
'@
ConvertTo-Json -Compress -InputObject @([StartupWindows]::Inspect(${pid}))`;
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:10000,windowsHide:true}));
}
module.exports={windowsStartupDiagnostics};
