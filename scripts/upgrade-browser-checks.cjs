'use strict';
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/v32'),origin=process.env.MOLE_UPGRADE_URL||'http://127.0.0.1:5244';
const server=process.env.MOLE_UPGRADE_URL?null:spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5244','--strictPort'],{cwd:root,stdio:'ignore'});
function fixture({corrupt=false,seed=false}={}){
 const now=Date.now(),save={version:1,name:'一直陪着你',color:'blue',createdAt:now-86400000,lastTick:now,growth:seed?0:516.25,coins:1000,stats:{hunger:82,thirst:82,happiness:78,cleanliness:88,health:100,energy:85},inventory:{biscuit:2,'energy-drink':1,'180006':1},sleeping:false,completedGames:0,lastRewardAt:0};
 if(localStorage.getItem('ramu-house-save-v1')===null)localStorage.setItem('ramu-house-save-v1',corrupt?'broken original save':JSON.stringify(save));
 if(localStorage.getItem('ramu-house-preferences-v2')===null)localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,reminders:false,sound:false,roomWander:false}));
 const state={petMode:false,alwaysOnTop:true,wandering:false,companionPanel:false,panelSide:'right',edgeHiding:false,edgeSide:null,edgePose:'visible',windowVisible:true},listeners=new Set(),modes=new Set();
 window.__upgradeNative={state,music:null,toggleMusic:null,tracks:[]};
 const NativeAudio=window.Audio;window.Audio=function(...args){const element=new NativeAudio(...args);window.__upgradeNative.tracks.push(element);return element;};window.Audio.prototype=NativeAudio.prototype;
 window.desktop=new Proxy({isElectron:false,platform:'darwin',messageBoard:undefined,getState:async()=>({...state}),updates:{onPrepare:()=>()=>{},onStateChanged:()=>()=>{},getState:async()=>null,setBusy(){}},
 onStateChanged:callback=>{listeners.add(callback);queueMicrotask(()=>callback({...state}));return()=>listeners.delete(callback)},onPetModeChanged:callback=>{modes.add(callback);return()=>modes.delete(callback)},onMusicToggle:callback=>{window.__upgradeNative.toggleMusic=callback;return()=>{}},setMusicState:async value=>{window.__upgradeNative.music=value},
 setPetMode:async enabled=>{state.petMode=enabled;for(const callback of listeners)callback({...state});for(const callback of modes)callback(enabled);return enabled},
 },{get(object,key){if(key in object)return object[key];if(String(key).startsWith('on'))return()=>()=>{};return()=>Promise.resolve(true)}});
}
let browser;
const save=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
const music=p=>p.evaluate(()=>{const a=window.__upgradeNative.tracks.filter(a=>a.src.includes('/original/audio/')).at(-1);return {src:a?.src,paused:a?.paused,ready:a?.readyState,...window.__upgradeNative.music}});
async function home(p){await expect(p.getByTestId('desktop-character')).toBeVisible();await p.evaluate(()=>window.desktop.setPetMode(false));await expect(p.locator('.room-dock')).toBeVisible();}
async function panel(p,name){if(await p.locator('.game-panel').isVisible())await p.getByRole('button',{name:'关闭面板',exact:true}).click();await p.locator('.room-dock').getByRole('button',{name,exact:true}).click();await expect(p.locator('.game-panel')).toBeVisible();}
async function openBoard(p){
 if(await p.locator('.game-panel').isVisible())await p.getByRole('button',{name:'关闭面板',exact:true}).click();
 assert.equal(await p.locator('.room-dock').getByRole('button',{name:/留言板/}).count(),0);
 if(!await p.locator('.room-placed-item[data-furniture=message-board]').count()){
  await p.getByRole('button',{name:'布置小屋',exact:true}).click();const drawer=p.getByRole('complementary',{name:'小屋布置工具'}),card=drawer.locator('.warehouse-drag-card'),layer=p.locator('.time-scene>.room-furnishing-layer.is-editing');
  await card.scrollIntoViewIfNeeded();const box=await layer.boundingBox();await card.dragTo(layer,{targetPosition:{x:box.width*.3,y:box.height*.35}});await expect(p.locator('.room-placed-item[data-furniture=message-board]')).toHaveCount(1);await drawer.getByRole('button',{name:'完成布置',exact:true}).click();
 }
 // Verify keyboard access even when the pet overlaps the furnishing in a short room.
 const trigger=p.getByRole('button',{name:'小屋留言板',exact:true});await trigger.focus();await trigger.press('Enter');const board=p.getByRole('dialog',{name:'小屋留言板',exact:true});await expect(board).toBeVisible();return board;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});for(let n=0;n<80;n++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:1180,height:820},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(fixture);await p.goto(origin);await home(p);
 const original=await save(p);assert.equal(original.name,'一直陪着你');assert.ok(original.highestGrowth>=516.25&&original.highestGrowth<517);
 const board=await openBoard(p);await board.getByRole('button',{name:'我要留言',exact:true}).click();await p.locator('#board-note').fill('明天陪拉姆去学院\n记得喝水');await p.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await save(p)).notes.length).toBe(1);await expect(board.locator('.message-card')).toHaveCount(1);
 await board.getByRole('button',{name:'□ 待完成',exact:true}).click();await board.getByRole('button',{name:/编辑留言：明天陪拉姆/}).click();await p.locator('#board-note').fill('已经完成学院计划');await p.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await save(p)).notes[0].text).toBe('已经完成学院计划');
 await board.getByRole('button',{name:'删除留言：已经完成学院计划',exact:true}).click();await p.getByRole('button',{name:'保留',exact:true}).click();assert.equal((await save(p)).notes.length,1);await p.screenshot({path:path.join(out,'message-board.png')});await p.keyboard.press('Escape');
 await panel(p,'陪伴设置');await expect.poll(async()=>(await music(p)).playing).toBe(true);await p.getByRole('checkbox',{name:'小屋随机走动',exact:true}).check();await p.getByRole('checkbox',{name:'小屋随机走动',exact:true}).uncheck();
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'导出存档',exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(out,'review-save.json'));const backup=JSON.parse(fs.readFileSync(path.join(out,'review-save.json')));assert.equal(backup.notes[0].text,'已经完成学院计划');assert.equal(backup.name,original.name);assert.ok(backup.companionMemory);
 await p.getByRole('button',{name:'关闭面板',exact:true}).click();await p.getByRole('button',{name:'回到桌面',exact:true}).click();await expect.poll(async()=>(await music(p)).paused).toBe(true);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-room-media-v1')).musicEnabled),true);
 await p.evaluate(()=>window.__upgradeNative.toggleMusic(true));await expect.poll(async()=>(await music(p)).playing).toBe(true);await p.evaluate(()=>window.__upgradeNative.toggleMusic(false));await expect.poll(async()=>(await music(p)).paused).toBe(true);
 await p.evaluate(()=>window.desktop.setPetMode(false));await expect.poll(async()=>(await music(p)).playing).toBe(true);
 await p.getByRole('button',{name:'布置小屋',exact:true}).click();await p.getByRole('checkbox',{name:'随机播放背景音乐',exact:true}).check();let previous=(await music(p)).src;
 for(let n=0;n<8;n++){await p.evaluate(()=>window.__upgradeNative.tracks.filter(a=>a.src.includes('/original/audio/')).at(-1).dispatchEvent(new Event('ended')));await expect.poll(async()=>(await music(p)).src).not.toBe(previous);previous=(await music(p)).src;}
 const gallery=p.getByRole('group',{name:'选择小屋背景',exact:true});await gallery.getByRole('button',{name:'神秘花海',exact:true}).click();await p.getByRole('group',{name:'选择背景音乐',exact:true}).getByRole('button',{name:'神秘花海',exact:true}).click();await expect.poll(async()=>(await music(p)).ready).toBeGreaterThanOrEqual(2);await p.locator('.cottage-top').getByRole('button',{name:'完成布置',exact:true}).click();await expect(p.locator('.cottage-scene')).toHaveAttribute('data-background','mystery-flower-sea');await p.screenshot({path:path.join(out,'mystery-flower-sea.png')});
 await p.reload();await home(p);assert.equal((await save(p)).notes[0].done,true);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-preferences-v2')).roomWander),false);
 await panel(p,'成长手册');await p.getByRole('button',{name:'固定形态',exact:true}).click();await p.getByRole('button',{name:'切换到初级拉姆',exact:true}).click();await p.getByRole('button',{name:'应用成长设置',exact:true}).click();await p.getByRole('button',{name:'确认切换',exact:true}).click();assert.ok((await save(p)).highestGrowth>=original.highestGrowth);await expect(p.getByRole('button',{name:'切换到神力拉姆',exact:true})).toBeEnabled();
 for(const viewport of [{width:360,height:320},{width:480,height:360},{width:1000,height:720}]){await p.setViewportSize(viewport);if(await p.locator('.game-panel').isVisible())await p.getByRole('button',{name:'关闭面板',exact:true}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const dock=await p.locator('.room-dock').boundingBox();assert.ok(dock.x>=0&&dock.x+dock.width<=viewport.width+.5&&dock.y+dock.height<=viewport.height);const board=await openBoard(p),box=await board.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+.5&&box.y+box.height<=viewport.height+.5);await expect(board.locator('.paper-tabs')).toHaveCount(0);await expect(board.locator('.message-card')).toHaveCount(1);await p.screenshot({path:path.join(out,`room-${viewport.width}x${viewport.height}.png`)});await p.keyboard.press('Escape');}

 // Deterministic lost-boot regression: hold the deferred runtime until the
 // parent's initial request has been sent, then discard the child's boot ping.
 // Only iframe.onload can establish the second, reliable handshake.
 let heldRuntime;
 await p.route('**/assets/original/official/runtime.js',route=>{heldRuntime=route});
 await p.evaluate(()=>{window.__lostReadyCount=0;window.__lostBoot=e=>{if(e.data?.type==='ram-original-boot'||e.data?.type==='ram-original-ready'&&window.__lostReadyCount++<3)e.stopImmediatePropagation()};addEventListener('message',window.__lostBoot,true)});
 await panel(p,'拉姆小衣橱');await p.getByRole('button',{name:'试戴粉兔帽',exact:true}).click();
 await expect.poll(()=>Boolean(heldRuntime),{timeout:15000}).toBe(true);await p.waitForTimeout(500);await heldRuntime.continue();
 await expect(p.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:60000});
 await p.evaluate(()=>{removeEventListener('message',window.__lostBoot,true);delete window.__lostBoot});await p.unroute('**/assets/original/official/runtime.js');
 assert.ok(await p.evaluate(()=>window.__lostReadyCount)>=4,'Host recovers after three lost ready messages');console.log('PASS deterministic original-player handshake with delayed runtime, dropped boot and three dropped ready messages');
 assert.deepEqual(errors,[]);await p.close();
 const seed=await browser.newPage();await seed.addInitScript(fixture,{seed:true});await seed.goto(origin);await home(seed);await panel(seed,'成长手册');for(const name of ['初级拉姆','中级拉姆','高级拉姆','神力拉姆'])await expect(seed.getByRole('button',{name:'切换到'+name,exact:true})).toBeEnabled();await seed.close();
 const recovery=await browser.newPage();await recovery.addInitScript(fixture,{corrupt:true});await recovery.goto(origin);await expect(recovery.getByRole('heading',{name:'先把原来的拉姆存档保管好',exact:true})).toBeVisible();assert.equal(await recovery.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'broken original save');await expect(recovery.getByRole('button',{name:'带拉姆回家！',exact:true})).toHaveCount(0);await recovery.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({passed:true,checks:['memo create/edit/complete/delete confirmation/reload/backup','room and background music independence','8 random transitions without immediate repeat','original flower scene and real MP3 decode','free form selection and preserved highest growth','360x320,480x360,1000x720 layout','new seed free selection controls','corrupt save protection'],pageErrors:errors},null,2)+'\n');console.log('PASS v0.32: memos, save identity/backup, music/background/shuffle, original flower media, earned forms, small rooms and corrupt-save protection');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
