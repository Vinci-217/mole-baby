/** Offline Electron with real X11 pickup, including a meal interrupted by drag. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,execFile}=require('node:child_process');
const {_electron,expect}=require('@playwright/test');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const {openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/care-outfit-review');
const pointer=(...args)=>execFileSync('python3',[path.join(__dirname,'wardrobe-native-pointer.py'),...args.map(String)],{stdio:'pipe'});
const movePointer=(...args)=>new Promise((resolve,reject)=>execFile('python3',[path.join(__dirname,'wardrobe-native-pointer.py'),...args.map(String)],error=>error?reject(error):resolve()));
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu','--user-data-dir='+path.join(out,'electron-qa-profile')],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});
 try{
  const page=await app.firstWindow(),errors=[],remote=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
  await app.context().route(/^https?:\/\//,route=>{remote.push(route.request().url());return route.abort('internetdisconnected')});
  const localSources=await page.evaluate(async()=>{const response=await fetch('ram-original://assets/manifest.json');if(!response.ok)throw Error('Local preload unavailable');return (await response.json()).clips.length});
  assert(localSources>500,'The desktop can prepare its own bundled sources');
  await require('./renderer-policy-checks.cjs').verifyRendererPolicy(page);
  const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const pet=JSON.parse(saved['ramu-house-save-v1']);assert(pet&&pet.createdAt,'Reuse the previous dedicated QA save');
  const identity={createdAt:pet.createdAt,name:pet.name,color:pet.color,coins:pet.coins};
  async function fixture(wearing){
   const values=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),p=JSON.parse(values['ramu-house-save-v1']);
   Object.assign(p,{growth:840,highestGrowth:840,naturalGrowth:840,growthLocked:true,evolution:'super',wearing,sleeping:false,activity:undefined,outing:undefined,lastTick:Date.now()});
   p.wardrobe=[...new Set([...(p.wardrobe??[]),'leaf-hood','warm-scarf','original-1200038'])];
   p.inventory.biscuit=Math.max(10,p.inventory.biscuit??0);p.stats={hunger:60,thirst:90,cleanliness:90,happiness:90,health:100,energy:95};
   await reloadWithStorage(page,{...values,'ramu-house-save-v1':JSON.stringify(p),'ramu-house-preferences-v2':JSON.stringify({lively:false,presence:false,outings:false,sound:false,gameSound:false,roomWander:false})});
   await page.evaluate(async()=>{await window.desktop.setPetMode(true);await window.desktop.setPetCanMove(false);await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
   await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),state=await page.evaluate(()=>window.desktop.getState());
   await page.evaluate(({bounds,state})=>window.desktop.movePet(500-bounds.x-state.petOffset.x*state.petScale,300-bounds.y-state.petOffset.y*state.petScale),{bounds,state});
  }
  async function pickup(label,interrupted=false){
   const character=page.getByTestId('desktop-character');
   const box=await character.boundingBox(),windowBounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
   const drag=movePointer(windowBounds.x+box.x+box.width*.52,windowBounds.y+box.y+box.height*.72,1);
   await expect(page.locator('.companion-layout')).toHaveClass(/is-pet-dragging/,{timeout:5000});
   await expect.poll(()=>page.evaluate(async()=>Boolean((await window.desktop.getState()).dragPoint)),{timeout:5000}).toBe(true);
   const current=character.locator('>.ram-sprite');await expect(current).toHaveAttribute('data-action','drag');
   await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds().x),{timeout:5000}).not.toBe(windowBounds.x);
   await expect(character.locator('.ram-outfit-source')).toBeVisible();
   await page.screenshot({path:path.join(out,label+'-drag.png')});
   await drag;pointer('release');await expect.poll(()=>page.evaluate(async()=>Boolean((await window.desktop.getState()).dragPoint))).toBe(false);
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
   for(const key of ['createdAt','name','color','coins','wearing','growth','evolution','wardrobe'])assert.deepEqual(after[key],before[key],key);
   if(interrupted){assert.equal(after.inventory.biscuit,before.inventory.biscuit);assert(after.stats.hunger>=before.stats.hunger-.1,'A committed care result survives interruption');}
   checks.push({label,realNativePointer:true,windowMoved:true,retainedClothing:after.wearing,careResultRetained:interrupted});
   await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:10000});
  }
  for(const outfit of ['leaf-hood','warm-scarf','original-1200038']){
   await fixture(outfit);await pickup(outfit+'-resting');
   const actor=page.locator('.desktop-character'),iframe=await actor.locator('iframe').elementHandle();
   await page.getByRole('button',{name:'打开拉姆背包',exact:true}).evaluate(node=>node.click());
   await page.locator('[data-item-id=biscuit]').click();
   const original=actor.locator('.ram-original-care canvas[data-sheet=uploaded]');await expect(original).toHaveAttribute('data-loaded','true',{timeout:45000});
   await expect(original).toHaveAttribute('data-source-form','classic');await expect(actor.locator('.ram-outfit-source')).toBeHidden();
   await page.screenshot({path:path.join(out,outfit+'-native-meal.png')});
   await pickup(outfit+'-interrupt-meal',true);assert(await iframe.evaluate(node=>node.isConnected),'Pickup reuses the original clothes');
   console.log('PASS offline original meal + native pickup:',outfit);
  }
  const viewSwitches=[],cached=page.locator('.desktop-character .official-ram-clip'),frame=await cached.locator('iframe').elementHandle(),runtime=await frame.contentFrame();
  const runtimeOrigin=await runtime.evaluate(()=>{window.__nativeCachedAVM=window.player;return performance.timeOrigin});
  for(let round=0;round<3;round++)for(const petMode of [false,true]){
   const began=Date.now();await page.evaluate(mode=>window.desktop.setPetMode(mode),petMode);
   const active=page.locator((petMode?'.desktop-character':'.scene-character')+' .official-ram-clip');
   await expect(active).toHaveAttribute('data-loaded','true',{timeout:10000});
   assert(await active.locator('iframe').evaluate((node,previous)=>node===previous,frame),'Switching desktop/room reuses the same iframe');
   assert.equal(await runtime.evaluate(()=>performance.timeOrigin),runtimeOrigin,'No iframe document reload');
   assert(await runtime.evaluate(()=>window.__nativeCachedAVM===window.player),'No original AVM reload');
   viewSwitches.push({round:round+1,view:petMode?'desktop':'room',readyMs:Date.now()-began,sameFrame:true,sameAVM:true});
  }
  // Reading remains deliberately stationary even though other finite actions
  // can be interrupted. The same real pointer must not start a native drag.
  const actions=await openActions(page);await actions.getByRole('button',{name:'开始计时',exact:true}).click();
  await expect(page.locator('.pet-focus-time')).toBeVisible();
  const b=await page.getByTestId('desktop-character').boundingBox(),w=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  await movePointer(w.x+b.x+b.width*.5,w.y+b.y+b.height*.7,1);pointer('release');
  assert.equal(await page.evaluate(async()=>Boolean((await window.desktop.getState()).dragPoint)),false);
  assert(!(await page.locator('.companion-layout').getAttribute('class')).includes('is-pet-dragging'));
  await (await openActions(page)).getByRole('button',{name:'取消计时',exact:true}).click();
  await page.evaluate(()=>window.desktop.flushSave());await page.reload();
  await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const key of Object.keys(identity))assert.deepEqual(after[key],identity[key],key+' survives reopening');
  assert.equal(after.wearing,'original-1200038');assert.equal(after.growth,840);assert.equal(after.evolution,'super');
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  fs.writeFileSync(path.join(out,'native-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),platform:'Linux Electron with real X11 pointer events',checks,viewSwitches,readingStationary:true,saveIdentityRetainedAfterReload:true,allAssetsOffline:true,localOriginalPreloadAllowed:true,externalScriptsBlocked:true,errors,remote},null,2)+'\n');
 }finally{try{pointer('release')}catch{}await app.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
