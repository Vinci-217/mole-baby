const{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
async function verifyWindowsChrome(page,desktop){
 if(process.platform!=='win32')return;
 const handle=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString());
 const script=`Add-Type @'
using System;using System.Runtime.InteropServices;
public static class FrameCheck{
 [StructLayout(LayoutKind.Sequential)] public struct Rect{public int L,T,R,B;}
 [StructLayout(LayoutKind.Sequential)] public struct Point{public int X,Y;}
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]public static extern IntPtr Style(IntPtr h,int i);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]public static extern bool ClientToScreen(IntPtr h,ref Point p);
 public static long[] Inspect(long id){var h=new IntPtr(id);Rect r;Point p=new Point();GetWindowRect(h,out r);ClientToScreen(h,ref p);return new[]{Style(h,-16).ToInt64(),p.X-r.L,p.Y-r.T};}
}
'@
[FrameCheck]::Inspect(${handle}) | ConvertTo-Json -Compress`;
 const probe=label=>{const[style,x,y]=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:20000,windowsHide:true}));assert.equal(style&0x00c00000,0,`${label}: native caption must remain absent`);assert.equal(style&0x00040000,0,`${label}: native thick frame must remain absent`);assert.ok(Math.abs(x)<=1&&Math.abs(y)<=1,`${label}: visible native non-client inset ${x},${y}`)};
 await page.evaluate(()=>window.desktop.setEdgeHiding(false));probe('initial pet');
 assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()),'','Windows transparent pet must have no native title');
 for(let i=0;i<8;i++){
  await page.evaluate(()=>window.desktop.setCompanionPanel(true));if(i===0||i===7)probe('open pocket');
  await page.evaluate(()=>window.desktop.setCompanionPanel(false));
  await page.evaluate(()=>window.desktop.setPetMode(false));if(i===0||i===7)probe('cottage');
  await page.evaluate(()=>window.desktop.setPetMode(true));
 }
 probe('after eight room/pocket/pet cycles');
 await page.evaluate(()=>{document.title='拉姆 · mole-baby'});
 await page.waitForTimeout(100);
 assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()),'','A later document title must not restore the horizontal caption');
 console.log('PASS: Windows native caption/thick-frame bits and visible client insets stay absent across eight room, pocket and desktop cycles');
}
module.exports={verifyWindowsChrome};
