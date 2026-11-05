'use strict';
const {_electron}=require('playwright'),{expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/desktop-board-review'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-board-review-'));
function nativeMouse(x,y,button){
 const script=`import ctypes\nx=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')\nx.XOpenDisplay.restype=ctypes.c_void_p\nd=x.XOpenDisplay(None)\nt.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]\nt.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]\nx.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]\nt.XTestFakeMotionEvent(d,-1,${Math.round(x)},${Math.round(y)},0)\n${button===undefined?'':`t.XTestFakeButtonEvent(d,1,${button?1:0},0)\n`}x.XSync(d,0)\n`;
 execFileSync('python3',['-c',script]);
}
let app;
async function launch(){
 app=await _electron.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu',`--user-data-dir=${profile}`,root],cwd:root,env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:30000});const p=await app.firstWindow();p.setDefaultTimeout(15000);
 await p.context().addInitScript(()=>{
  if(location.hash!=='#message-board')return;
  window.boardOpeningFrames=[];
  function sample(){const stage=document.querySelector('.message-board-stage');if(stage){const r=stage.getBoundingClientRect();window.boardOpeningFrames.push([r.x,r.y,r.width,r.height])}if(window.boardOpeningFrames.length<60)requestAnimationFrame(sample)}
  requestAnimationFrame(sample);
 });return p;
}
async function captureNative(name){const encoded=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));fs.writeFileSync(path.join(out,name),Buffer.from(encoded,'base64'))}
const snapshot=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
(async()=>{
 fs.mkdirSync(out,{recursive:true});let p=await launch(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.evaluate(()=>{const now=Date.now();localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小叶',color:'blue',createdAt:now-86400000,lastTick:now,growth:420,highestGrowth:420,growthLocked:true,coins:1000,stats:{hunger:95,thirst:95,happiness:95,cleanliness:95,health:100,energy:95},inventory:{'mix-9955cc':1},sleeping:false,completedGames:0,lastRewardAt:0,notes:[]}));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false,gameSound:false,reminders:true,reminderMinutes:1}));localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:false,backgroundPlayback:false}))});await p.reload();await p.getByTestId('desktop-character').waitFor();await p.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setBounds({...w.getBounds(),x:300,y:220})});
 // A real native screen cursor drives the resize; CDP mouse events alone do
 // not move screen.getCursorScreenPoint().
 await (await openActions(p)).getByRole('button',{name:'玩耍',exact:true}).click();await p.locator('.desktop-play').getByRole('button',{name:'放大缩小',exact:true}).click();await expect(p.getByRole('group',{name:'拖动边角调整拉姆大小',exact:true})).toBeVisible();assert.equal(app.windows().length,1);
 const b=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),handle=await p.getByRole('button',{name:'调整大小 se',exact:true}).boundingBox(),x=b.x+handle.x+handle.width/2,y=b.y+handle.y+handle.height/2;
 nativeMouse(x,y,true);await expect.poll(()=>p.evaluate(async()=>(await window.desktop.getState()).petResizing)).toBe(true);nativeMouse(x+44,y+48);await expect.poll(()=>p.evaluate(async()=>(await window.desktop.getState()).petScale)).toBe(1.4);nativeMouse(x+44,y+48,false);
 const viewport=await p.evaluate(()=>({width:innerWidth,height:innerHeight}));assert.ok(Math.abs(viewport.width-160)<=1&&Math.abs(viewport.height-240)<=1,'All four corners fit inside the logical viewport');await captureNative('native-direct-resize.png');await p.getByRole('button',{name:'完成',exact:true}).click();await expect.poll(()=>p.evaluate(async()=>(await window.desktop.getState()).petResizing)).toBe(false);
 const geometry=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {bounds:w.getBounds(),zoom:w.webContents.getZoomFactor()}});assert.equal(geometry.bounds.width,224);assert.equal(geometry.bounds.height,336);assert.equal(geometry.zoom,1.4);await p.evaluate(()=>window.desktop.setPetScale(1));
 await (await openActions(p)).getByRole('button',{name:'开始计时',exact:true}).click();await expect(p.locator('.pet-focus-time')).toBeVisible();await expect(p.locator('.reading-book')).toHaveAttribute('data-loaded','true');
 const timerRect=await p.locator('.pet-focus-time').boundingBox(),petRect=await p.getByTestId('desktop-character').boundingBox();assert.ok(timerRect.y+timerRect.height<=petRect.y,'Native timer is above the pet');await captureNative('native-book-timer.png');await (await openActions(p)).getByRole('button',{name:'取消计时',exact:true}).click();
 const menu=await openActions(p);await menu.getByRole('button',{name:'玩耍',exact:true}).click();const next=app.waitForEvent('window');await p.locator('.desktop-play').getByRole('button',{name:'留言板',exact:true}).click();const board=await next;board.setDefaultTimeout(15000);board.on('pageerror',e=>errors.push(e.message));await expect(board.getByRole('dialog',{name:'小屋留言板',exact:true})).toBeVisible();assert.match(board.url(),/#message-board$/);assert.equal(await board.locator('.desktop-character,.cottage-scene').count(),0);assert.equal(await p.evaluate(async()=>(await window.desktop.getState()).petMode),true);
 await board.waitForFunction(()=>window.boardOpeningFrames?.length===60);
 const openingStates=await board.evaluate(()=>[...new Set(window.boardOpeningFrames.map(JSON.stringify))]);
 assert.equal(openingStates.length,1,`Native board changes size on first display: ${openingStates.join('; ')}`);
 await board.getByRole('button',{name:'我要留言',exact:true}).click();await board.locator('#board-note').fill('桌面窗口里的第一条留言');await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await snapshot(p)).notes.length).toBe(1);await expect(board.locator('.message-card')).toHaveCount(1);
 // Leave the board open while changing the pet. A later notes edit must merge
 // into the current save and must never restore the old blue colour.
 await p.bringToFront();await p.getByRole('button',{name:'打开拉姆背包',exact:true}).click();await p.getByRole('tab',{name:'药水',exact:true}).click();const immediate=await p.locator('[data-item-id=mix-9955cc]').evaluate(el=>{el.click();return JSON.parse(localStorage.getItem('ramu-house-save-v1'))});assert.equal(immediate.color,'#9955cc');const id=immediate.createdAt;
 await board.bringToFront();await board.getByRole('button',{name:'编辑留言：桌面窗口里的第一条留言',exact:true}).click();await board.locator('#board-note').fill('换色后继续编辑，保留紫色');await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await snapshot(p)).notes[0].text).toBe('换色后继续编辑，保留紫色');assert.equal((await snapshot(p)).color,'#9955cc');
 // Classic Windows scrollbars used to make the board resize every frame at
 // this content height. Test the same renderer in a real native window too.
 for(const height of [711,710,720,740]){
  await app.evaluate(({BrowserWindow},height)=>{BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('#message-board')).setContentSize(980,height)},height);
  await board.waitForTimeout(150);
  const states=await board.evaluate(async()=>{
   const values=[];for(let frame=0;frame<60;frame++){await new Promise(requestAnimationFrame);const r=document.querySelector('.message-board-original').getBoundingClientRect();values.push(JSON.stringify([r.x,r.y,r.width,r.height]))}
   return [...new Set(values)];
  });
  assert.equal(states.length,1,`Native board keeps moving at height ${height}: ${states.join('; ')}`);
 }
 await board.screenshot({path:path.join(out,'native-board-one.png')});await board.close();
 await p.evaluate(()=>window.desktop.flushSave());await app.close();app=null;
 p=await launch();await p.getByTestId('desktop-character').waitFor();assert.equal((await snapshot(p)).color,'#9955cc');assert.equal((await snapshot(p)).createdAt,id);assert.equal((await snapshot(p)).notes[0].text,'换色后继续编辑，保留紫色');assert.equal((await snapshot(p)).inventory['mix-9955cc'],0);await expect(p.locator('.desktop-character .ram-sprite')).toHaveAttribute('data-color','#9955cc');await captureNative('native-purple-after-relaunch.png');
 assert.deepEqual(errors,[]);console.log('PASS real Electron: native corner drag at 1.4x with no size dialog; standalone board notes CRUD; board stable across four native window sizes; concurrent notes edit keeps the latest potion colour; complete app relaunch preserves identity, colour, notes and inventory.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(app)await app.close();fs.rmSync(profile,{recursive:true,force:true})});
