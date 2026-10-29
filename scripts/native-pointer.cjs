const{execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
let macBinary,windowsBinary;
/** Native cursor coordinates are essential: CDP mouse events alone do not move
 * the OS cursor used by desktop dragging. This helper is never packaged. */
async function warpPointer(desktop,point){
 const p=process.platform==='win32'?await desktop.evaluate(({screen},p)=>screen.dipToScreenPoint(p),point):point;
 if(process.platform==='win32'){
  if(!windowsBinary){
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-pointer-')),source=path.join(dir,'warp.cs'),target=path.join(dir,'warp.exe');
   const framework=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
   fs.writeFileSync(source,'using System.Runtime.InteropServices; public class MouseWarp { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); public static int Main(string[] a) { int x,y; if(a.Length!=2 || !int.TryParse(a[0],out x) || !int.TryParse(a[1],out y)) return 2; return SetCursorPos(x,y)?0:1; } }');
   execFileSync(framework,['/nologo','/target:winexe','/out:'+target,source],{stdio:'pipe',timeout:60000,windowsHide:true});windowsBinary=target;
  }
  // Compile once; repeatedly starting PowerShell + C# compilation for every
  // cursor sample was slow and intermittently timed out on hosted Windows.
  execFileSync(windowsBinary,[String(Math.round(p.x)),String(Math.round(p.y))],{stdio:'pipe',timeout:10000,windowsHide:true});
 }else if(process.platform==='darwin'){
  if(!macBinary){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-pointer-'));macBinary=path.join(dir,'warp');const source=path.join(dir,'warp.c');fs.writeFileSync(source,'#include <ApplicationServices/ApplicationServices.h>\n#include <stdlib.h>\nint main(int n,char**v){if(n!=3)return 1;CGWarpMouseCursorPosition(CGPointMake(atof(v[1]),atof(v[2])));return 0;}');execFileSync('clang',[source,'-framework','ApplicationServices','-o',macBinary],{stdio:'pipe',timeout:30000});}
  execFileSync(macBinary,[String(p.x),String(p.y)],{stdio:'pipe'});
 }else{
  const script='import ctypes,sys\nx=ctypes.CDLL("libX11.so.6");x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(None);assert d,"X display unavailable";x.XDefaultRootWindow.argtypes=[ctypes.c_void_p];x.XDefaultRootWindow.restype=ctypes.c_ulong;r=x.XDefaultRootWindow(d);x.XWarpPointer.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_uint,ctypes.c_uint,ctypes.c_int,ctypes.c_int];x.XWarpPointer(d,0,r,0,0,0,0,int(sys.argv[1]),int(sys.argv[2]));x.XFlush.argtypes=[ctypes.c_void_p];x.XFlush(d)';
  const display=await desktop.evaluate(()=>process.env.DISPLAY);execFileSync('python3',['-c',script,String(Math.round(p.x)),String(Math.round(p.y))],{stdio:'pipe',env:{...process.env,DISPLAY:display}});
 }
}
async function dragNative(page,desktop,from,to,steps=5){
 // Use the actual OS cursor and the same native drag IPC as the renderer.
 // Mixing OS moves (buttons=0) with CDP button capture cancels pointers on
 // some window managers; browser pointer capture is checked separately.
 await warpPointer(desktop,from);await page.evaluate(async()=>{await window.desktop.preparePetDrag();await window.desktop.startPetDrag()});
 for(let i=1;i<=steps;i++){
  await warpPointer(desktop,{x:Math.round(from.x+(to.x-from.x)*i/steps),y:Math.round(from.y+(to.y-from.y)*i/steps)});
  await page.evaluate(()=>window.desktop.dragPetToCursor());await page.waitForTimeout(50);
 }
 await page.evaluate(()=>window.desktop.endPetDrag());await page.waitForTimeout(100);
}

module.exports={warpPointer,dragNative};
