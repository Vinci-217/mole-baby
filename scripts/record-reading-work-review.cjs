'use strict';
// Record real production components and start work through the football menu.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const {adopt,openActions}=require('./smoke-helpers.cjs'),{reloadStoredFixture}=require('./smoke-storage.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/reading-work-review');
const origin=process.env.MOLE_REVIEW_URL||'http://localhost:5173';
fs.mkdirSync(out,{recursive:true});
let browser;
const checksOnly=process.argv.includes('--checks-only');
async function record(page,locator,name,duration,fps){
 const dir=path.join(out,name+'-frames');fs.mkdirSync(dir,{recursive:true});
 const count=Math.round(duration/1000*fps),phases=new Set();
 for(let i=0;i<count;i++){
  if(i)await page.clock.runFor(1000/fps);
  if(!checksOnly)await locator.screenshot({path:path.join(dir,String(i).padStart(4,'0')+'.png')});
  const values=await locator.locator('canvas').evaluateAll(nodes=>nodes.map(c=>c.dataset.pagePhase||c.dataset.phase).filter(Boolean));
  values.forEach(v=>phases.add(v));
 }
 if(!checksOnly)execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(dir,'%04d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-threads','2','-loop','0',path.join(out,name+'.gif')],{timeout:60000});
 fs.rmSync(dir,{recursive:true,force:true});
 return {frames:count,fps,duration,phases:[...phases]};
}
async function loaded(page,locator,count=1){
 await expect.poll(async()=>{await page.clock.runFor(32);return locator.locator('canvas[data-loaded=true]').count()},{timeout:30000}).toBe(count);
}
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true});
 const errors=[],failed=[];
 const observe=p=>{p.on('pageerror',e=>{errors.push(e.message);console.error('Review page error:',e.message)});p.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()])});};
 const gallery=await browser.newPage({viewport:{width:680,height:780}});observe(gallery);
 await gallery.addInitScript(()=>localStorage.setItem('ramu-house-save-v1','review-does-not-touch-save'));
 await gallery.clock.install();await gallery.clock.pauseAt(new Date(Date.now()+1000));
 await gallery.goto(origin+'/?preview=reading');
 const grid=gallery.locator('.reading-preview-grid');
 await expect.poll(async()=>{await gallery.clock.runFor(32);return grid.locator('.reading-book[data-loaded=true]').count()},{timeout:30000}).toBe(9);
 await expect.poll(async()=>{await gallery.clock.runFor(32);return grid.locator('.reading-pet-source canvas[data-loaded=true]').count()},{timeout:30000}).toBe(9);
 const positions=await grid.locator('.reading-book').evaluateAll(nodes=>nodes.map(n=>({top:parseFloat(n.style.top),left:parseFloat(n.style.left),width:parseFloat(n.style.width)})));
 await grid.screenshot({path:path.join(out,'reading.png')});
 const reading=await record(gallery,grid,'reading',8000,16);
 assert(reading.phases.includes('turning'));assert(reading.phases.includes('reading'));
 await gallery.getByRole('button',{name:'桌面大小',exact:true}).click();
 await gallery.clock.runFor(32);await grid.screenshot({path:path.join(out,'reading-desktop.png')});
 assert.equal(await gallery.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'review-does-not-touch-save');
 await gallery.close();

 const page=await browser.newPage({viewport:{width:1000,height:700}});observe(page);
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto(origin+'/');await adopt(page,'蓝色','小蓝');
 await page.evaluate(()=>{
  const key='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(key));
  Object.assign(p,{growth:180,highestGrowth:180,growthLocked:true,wardrobe:['magic-book'],wearing:'magic-book',lastTick:Date.now()});p.stats.energy=100;
  localStorage.setItem(key,JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false,outings:false}));
 });
 await reloadStoredFixture(page);await openActions(page);await page.getByRole('button',{name:'开始计时',exact:true}).click();
 await expect.poll(async()=>{await page.clock.runFor(32);return page.locator('.reading-book[data-loaded=true]').count()},{timeout:30000}).toBe(1);
 await expect(page.locator('.reading-pet-source .ram-wear')).toHaveCount(0);
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')))).wearing,'magic-book');
 await openActions(page);await page.getByRole('button',{name:'取消计时',exact:true}).click();
 await expect.poll(async()=>{await page.clock.runFor(32);return page.getByTestId('desktop-character').locator('.ram-wear[data-outfit=magic-book]').isVisible()},{timeout:20000}).toBe(true);
 await openActions(page);await page.getByRole('button',{name:'玩耍',exact:true}).click();
 await page.getByRole('button',{name:'去餐厅打工',exact:true}).click();
 const work=page.getByTestId('desktop-restaurant-work');await loaded(page,work);
 await expect(page.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toHaveCount(0);
 const working=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 assert.equal(working.activity.kind,'restaurant');
 await work.screenshot({path:path.join(out,'desktop-work.png')});
 const desktop=await record(page,work,'desktop-work',9000,16);
 for(const phase of ['ready','collect','deliver','serve','return'])assert(desktop.phases.includes(phase),phase);
 for(const width of [320,393,1000]){
  await page.setViewportSize({width,height:700});await page.clock.runFor(32);
  const box=await work.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,`Desktop work must fit ${width}px: ${JSON.stringify(box)}`);
 }
 await page.getByRole('button',{name:'进入餐厅',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toBeVisible();
 await expect.poll(async()=>{await page.clock.runFor(32);return page.locator('.restaurant-work-stage canvas').getAttribute('data-phase')},{timeout:30000}).not.toBe('closed');
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')))).activity.id,working.activity.id);
 await page.getByRole('button',{name:'离开餐厅',exact:true}).click();await page.getByRole('button',{name:'回到桌面',exact:true}).click();await loaded(page,work);
 await page.getByRole('button',{name:'停止打工',exact:true}).click();await expect(work).toHaveCount(0);
 await expect(page.getByTestId('desktop-character').locator('.ram-sprite')).toBeVisible();
 const stopped=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 assert.equal(stopped.activity,undefined);assert.equal(stopped.createdAt,working.createdAt);assert.equal(stopped.color,working.color);assert.equal(stopped.coins,working.coins);assert.deepEqual(stopped.wardrobe,working.wardrobe);assert.equal(stopped.wearing,working.wearing);
 // Exercise App's native IPC boundary too: the animation needs a wider host,
 // then must release it on stop. This is a bridge simulation, not an OS test.
 const native=await browser.newPage({viewport:{width:400,height:500}});observe(native);
 await native.addInitScript(pet=>{
  pet.lastTick=Date.now();localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));
  localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false,outings:false}));
  const state={petMode:false,alwaysOnTop:true,wandering:false,companionPanel:false,panelSide:'right',edgeHiding:false,edgeSide:null,edgePose:'visible',windowVisible:true,petOffset:{x:0,y:0}};
  const listeners=new Set(),emit=()=>listeners.forEach(fn=>fn({...state}));window.__workBounds=[];
  const stub={isElectron:true,platform:'win32',messageBoard:undefined,getState:async()=>({...state}),onStateChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
   setPetMode:async enabled=>{state.petMode=enabled;emit();return enabled},
   setCompanionPanel:async open=>{state.companionPanel=open;emit();return {...state}},
   setPetEffectBounds:async bounds=>{window.__workBounds.push(bounds);state.petOffset={x:bounds?96:0,y:0};state.effectExpanded=Boolean(bounds);emit();return {...state}},
   updates:new Proxy({getState:async()=>({status:'disabled',enabled:false,currentVersion:'preview',version:null,percent:0,automaticInstall:false,checkedAt:null,message:''})},{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>true})};
  window.desktop=new Proxy(stub,{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>true});
 },stopped);
 await native.goto(origin+'/');await openActions(native).catch(async error=>{console.error('Native bridge diagnostic:',await native.evaluate(()=>({body:document.body.innerText,effects:window.__workBounds})));throw error});await native.getByRole('button',{name:'玩耍',exact:true}).click();
 await native.getByRole('button',{name:'去餐厅打工',exact:true}).click();
 const nativeWork=native.getByTestId('desktop-restaurant-work');await expect(nativeWork.locator('canvas')).toHaveAttribute('data-loaded','true');
 await expect.poll(()=>native.evaluate(()=>window.__workBounds.at(-1))).toEqual({x:-96,y:5,width:352,height:200});
 const nativeBox=await nativeWork.boundingBox();assert(nativeBox.x>=0&&nativeBox.x+nativeBox.width<=400,'expanded native host includes stove and table');
 await native.getByRole('button',{name:'停止打工',exact:true}).click();await expect(nativeWork).toHaveCount(0);
 await expect.poll(()=>native.evaluate(()=>window.__workBounds.at(-1))).toBe(null);
 await native.close();
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({reading,positions,desktop,startsFromRealFootballMenu:true,desktopAndRestaurantShareShift:true,stoppingRestoresPetWithoutPay:true,nativeBridgeRequestsExpandedHostAndRestores:true,previewDoesNotTouchPlayerSave:true,readingStowsBookOutfitAndRestoresWithoutSaveChange:true,narrowScreens:[320,393,1000],errors,failed},null,2)+'\n');
 console.log('PASS: nine reading forms and a full desktop delivery GIF from actual app work; 320px fit, enter/stop and player identity retained.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
