/** OS pointer regression: run with xvfb-run, in the existing isolated QA profile. */
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{_electron,expect}=require('@playwright/test');
const {ramBodyPosition}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-repair');
const pointer=`import ctypes,sys,time
x=ctypes.CDLL('libX11.so.6'); t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p; d=x.XOpenDisplay(None)
x.XFlush.argtypes=[ctypes.c_void_p]
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
px,py=map(int,sys.argv[1:])
def move(a,b):
 t.XTestFakeMotionEvent(d,-1,a,b,0);x.XFlush(d);time.sleep(.07)
move(px,py);t.XTestFakeButtonEvent(d,1,1,0);x.XFlush(d)
for i in range(1,11):move(px+i*4,py-i)
print('held',flush=True);sys.stdin.readline()
t.XTestFakeButtonEvent(d,1,0,0);x.XFlush(d)
`;
(async()=>{
 let app,mouse;
 try{
  app=await _electron.launch({args:[root,'--no-sandbox','--user-data-dir='+path.join(out,'electron-profile')],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1'}});
  const p=await app.firstWindow();await p.waitForLoadState('domcontentloaded');
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await expect(p.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const before=await p.evaluate(()=>localStorage.getItem('ramu-house-save-v1'));
  await p.evaluate(()=>window.desktop.setInteracting(true));
  const bounds=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setIgnoreMouseEvents(false);w.focus();return w.getBounds()});
  const char=p.getByTestId('desktop-character'),body=await ramBodyPosition(char),box=await char.boundingBox(),src=await char.locator('iframe').getAttribute('src');
  mouse=spawn('python3',['-c',pointer,String(Math.round(bounds.x+box.x+body.x)),String(Math.round(bounds.y+box.y+body.y))],{env:process.env});
  await new Promise((resolve,reject)=>{mouse.stdout.once('data',resolve);mouse.once('error',reject);mouse.once('exit',code=>{if(code)reject(Error('X11 pointer failed: '+code))})});
  await expect(p.locator('.is-pet-dragging [data-drag-adaptation=project]')).toBeVisible();assert.equal(await char.locator('iframe').getAttribute('src'),src);
  await p.screenshot({path:path.join(out,'electron-real-pointer-drag.png')});
  mouse.stdin.end('\n');await new Promise(resolve=>mouse.once('exit',resolve));mouse=null;
  await expect(p.locator('.is-pet-dragging')).toHaveCount(0);assert.equal(await char.locator('iframe').getAttribute('src'),src);
  const after=await p.evaluate(()=>localStorage.getItem('ramu-house-save-v1'));
  for(const key of ['growth','evolution','wearing','color','createdAt'])assert.deepEqual(JSON.parse(after)[key],JSON.parse(before)[key]);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'native-pointer-checks.json'),JSON.stringify({realX11Pointer:true,samePlayerDuringAndAfterDrag:true,shapeAndSaveRetained:true,errors},null,2));console.log('PASS real OS drag in Electron, original costume retained, player unchanged, save intact');
 }finally{mouse?.stdin.end('\n');await app?.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
