const{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
async function verifyWindowsChrome(page,desktop){
 if(process.platform!=='win32')return;
 const rendering=await desktop.evaluate(({app})=>({softwareRequested:app.commandLine.hasSwitch('disable-gpu'),softwareRasterizerDisabled:app.commandLine.hasSwitch('disable-software-rasterizer'),compositing:app.getGPUFeatureStatus().gpu_compositing}));
 assert.equal(rendering.softwareRequested,true,'Every Windows package must select compatible composition before startup');
 assert.equal(rendering.softwareRasterizerDisabled,false,'Transparent pet must retain its software rendering fallback');
 assert.match(rendering.compositing,/^(disabled|unavailable)/,'Actual packaged Windows GPU composition must be disabled');
 console.log('PASS: Windows transparent pet compatible rendering '+JSON.stringify(rendering));
 const handle=await desktop.evaluate(({BrowserWindow})=>{const bytes=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();return bytes.length===8?bytes.readBigUInt64LE().toString():String(bytes.readUInt32LE())});
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
 const hoverScript=`Add-Type @'
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;
public static class HoverCheck{
 delegate bool WindowCallback(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int L,T,R,B;}
 [DllImport("user32.dll")]static extern bool EnumWindows(WindowCallback callback,IntPtr parameter);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")]static extern int GetClassName(IntPtr h,StringBuilder name,int count);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect rect);
 public static string[] Inspect(uint pid,long main){var found=new List<string>();EnumWindows((h,p)=>{uint owner;Rect r;GetWindowThreadProcessId(h,out owner);if(owner==pid&&h.ToInt64()!=main&&IsWindowVisible(h)&&GetWindowRect(h,out r)&&r.R-r.L>1&&r.B-r.T>1){var name=new StringBuilder(256);GetClassName(h,name,256);found.Add(name+" "+(r.R-r.L)+"x"+(r.B-r.T));}return true;},IntPtr.Zero);return found.ToArray();}
}
'@
ConvertTo-Json -Compress -InputObject @([HoverCheck]::Inspect(${desktop.process().pid},${handle}))`;
 const noHoverWindow=label=>{const extra=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',hoverScript],{encoding:'utf8',timeout:20000,windowsHide:true}));assert.deepEqual(extra,[],`${label}: no separate native tooltip/white strip window may remain visible`)};
 await page.evaluate(()=>window.desktop.setEdgeHiding(false));probe('initial pet');
 assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()),'','Windows transparent pet must have no native title');
 for(let i=0;i<8;i++){
  await page.evaluate(()=>window.desktop.setCompanionPanel(true));if(i===0||i===7)probe('open pocket');
  await page.evaluate(()=>window.desktop.setCompanionPanel(false));
  await page.evaluate(()=>window.desktop.setPetMode(false));if(i===0||i===7)probe('cottage');
  await page.evaluate(()=>window.desktop.setPetMode(true));
 }
 probe('after eight room/pocket/pet cycles');
 // Renderer captures cannot see Chromium's separate tooltip HWND. Inspect
 // actual Windows-owned top-level windows after the hover delay and resize.
 const{openActions}=require('./smoke-helpers.cjs');
 await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();await require('./smoke-helpers.cjs').enterBackpack(page);await page.locator('.pocket-heading select').selectOption('food');
 await page.locator('.pocket-slot:not(:disabled)[data-item-id]').first().hover();
 await page.waitForTimeout(1300);noHoverWindow('hovering food');
 await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.mouse.move(0,0);await page.waitForTimeout(300);noHoverWindow('after closing food');
 await page.evaluate(()=>{document.title='拉姆 · mole-baby'});
 await page.waitForTimeout(100);
 assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()),'','A later document title must not restore the horizontal caption');
 console.log('PASS: Windows native caption/thick-frame bits and visible client insets stay absent across eight room, pocket and desktop cycles');
}
module.exports={verifyWindowsChrome};
