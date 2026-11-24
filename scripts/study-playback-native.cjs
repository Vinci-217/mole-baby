/** Run with xvfb-run against a built renderer and a fresh Electron profile. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {_electron,expect}=require('@playwright/test');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const {enterHome,openActions}=require('./smoke-helpers.cjs');

const root=path.resolve(__dirname,'..');
const renderer=process.env.MOLE_REVIEW_APP??root;
const capture=process.env.MOLE_STUDY_CAPTURE;
const saveKey='ramu-house-save-v1';

async function main(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-study-qa-'));
 let app;
 try{
  app=await _electron.launch({executablePath:require('electron'),cwd:renderer,
   args:[renderer,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disk-cache-size=1048576','--user-data-dir='+profile],
   env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:30000});
  const page=await app.firstWindow(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await expect(page.locator('.adoption-screen')).toBeVisible({timeout:15000});
  await page.addInitScript(()=>{
   if(window.top!==window)return;
   const qa=window.studyQA={hold:true,held:[],observed:new Map(),gaps:0,armed:false,corners:[],started:0,first:0};
   const later=window.setTimeout.bind(window);
   window.setTimeout=(callback,ms,...args)=>{
    const id=later(callback,ms,...args);
    if(typeof callback==='function'&&ms>59000&&ms<=60000)qa.expire=()=>{clearTimeout(id);callback(...args);};
    return id;
   };
   const src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   Object.defineProperty(HTMLImageElement.prototype,'src',{...src,set(value){
    if(String(value).includes('/study-frames/')&&String(value).includes('-read/')&&qa.hold){qa.held.push([this,value]);return;}
    src.set.call(this,qa.failSleep&&String(value).includes('/daily-frames/super-sleep/')?'data:,':value);
   }});
   qa.release=()=>{qa.hold=false;for(const [image,value] of qa.held.splice(0))src.set.call(image,value);};
   document.addEventListener('click',event=>{
    if(event.target instanceof Element&&event.target.closest('button[aria-label="开始计时"]')){qa.started=performance.now();qa.first=0;}
   },true);
   new MutationObserver(records=>{
    for(const {target} of records){
     const shot=target.closest?.('[data-study-shot]'),frame=Number(target.dataset?.sourceFrame);
     if(!shot||!frame||!(target instanceof HTMLCanvasElement))continue;
     const key=shot.dataset.studyShot,kind=target.dataset.uploadedId;
     if(!qa.observed.has(key))qa.observed.set(key,{kind,frames:new Set(),expected:Number(target.dataset.sourceFrames)});
     qa.observed.get(key).frames.add(frame);
     if(kind==='read'||kind==='write')qa.corners.push(target.getContext('2d').getImageData(0,0,1,1).data[3]);
    }
   }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-source-frame']});
   const sample=()=>{
    const study=document.querySelector('[data-testid="desktop-character"] .ram-study');
    if(study){
     const visible=study.querySelectorAll('[data-study-visible="true"]');
     if(qa.armed&&visible.length!==1)qa.gaps++;
     if(visible.length===1&&!qa.first&&qa.started)qa.first=performance.now()-qa.started;
    }
    requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
  const actor=page.getByTestId('desktop-character');
  const shown=actor.locator('[data-study-visible="true"]');
  const current=action=>shown.locator(`canvas[data-uploaded-id="${action}"][data-loaded="true"]`);
  const pending=actor.locator('[data-study-visible="false"]');
  const play=page.getByTestId('companion-panel');
  const button=async name=>(await openActions(page)).getByRole('button',{name,exact:true});
  const start=()=>button('开始计时').then(control=>control.click());
  const cancel=()=>button('取消计时').then(control=>control.click());
  const release=()=>page.evaluate(()=>window.studyQA.release());
  const load=async ({wearing,evolution='super',minutes=1,happiness=72}={})=>{
   const now=Date.now();
   const pet={version:1,name:'超仔',color:'blue',createdAt:now-86400000,lastTick:now,growth:840,naturalGrowth:840,
    highestGrowth:840,growthLocked:true,evolution,coins:1234,stats:{hunger:90,thirst:90,happiness,cleanliness:90,health:100,energy:95},
    inventory:{},sleeping:false,completedGames:0,lastRewardAt:0,wardrobe:['leaf-hood','warm-scarf'],wearing,room:{owned:['plant'],placed:[]}};
   const prefs={lively:false,presence:false,outings:false,sound:false,gameSound:false,roomWander:false,reminderMinutes:minutes};
   await reloadWithStorage(page,{[saveKey]:JSON.stringify(pet),'ramu-house-preferences-v2':JSON.stringify(prefs)});
   await expect(actor).toBeVisible({timeout:18000});
   await page.evaluate(async()=>{await window.desktop.setEdgeHiding(false);await window.desktop.wander(false);Math.random=()=>.99;});
  };
  const expire=async()=>{
   await page.waitForFunction(()=>Boolean(window.studyQA.expire));
   await page.evaluate(()=>window.studyQA.expire());
  };
  const snap=async name=>{
   if(!capture)return;
   fs.mkdirSync(capture,{recursive:true});
   await page.screenshot({path:path.join(capture,name+'.png'),omitBackground:true,timeout:6000});
  };
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
  const frameCounts=kind=>page.evaluate(kind=>[...window.studyQA.observed.values()].filter(row=>row.kind===kind).map(row=>[row.frames.size,row.expected]),kind);
  const doSleep=async()=>{await (await button('玩耍')).click();await play.getByRole('button',{name:'睡一会儿',exact:true}).click();};

  await load();
  await start();
  await expect(pending).toHaveCount(1);
  await expire();
  await expect(actor.locator('.ram-study')).toHaveCount(0);
  await release();
  await expect(actor.locator('.ram-study')).toHaveCount(0);
  console.log('PASS expiring a timer before its first original frame leaves no delayed study');

  await load();
  await start();
  await expect(pending).toHaveCount(1);
  await cancel();
  await expect(actor.locator('>.ram-sprite')).toHaveAttribute('data-action','waving',{timeout:1000});
  await expect(actor.locator('.ram-study')).toHaveCount(0);
  await expect(actor.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:10000});
  await release();
  await page.waitForTimeout(800);
  await start();
  await expect(current('read')).toHaveCount(1,{timeout:4000});
  await expect(current('read')).toHaveAttribute('data-source-form','classic');
  await expect(shown).toHaveAttribute('data-source',/pet101Movie\/14\.swf$/);
  await expire();
  await expect(current('read')).toHaveCount(1);
  await expect(actor.locator('.ram-study')).toHaveCount(0,{timeout:9000});
  assert.deepEqual(await frameCounts('read'),[[95,95]]);
  console.log('PASS immediate cancellation and natural expiry through the original reading tail');

  await load({wearing:'leaf-hood',minutes:2});
  const costume=actor.locator('.ram-outfit-source .official-ram-clip');
  await expect(costume).toHaveAttribute('data-loaded','true',{timeout:25000});
  await release();
  await page.waitForTimeout(800);
  await start();
  await expect(current('read')).toHaveCount(1,{timeout:4000});
  await expect(actor.locator('.ram-outfit-source')).toHaveCSS('opacity','0');
  await expect(shown.locator('iframe')).toHaveCount(0);
  assert(await current('read').evaluate(canvas=>{
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>200&&pixels[i+2]>pixels[i]+65&&pixels[i+1]>pixels[i]+35)return true;
   return false;
  }),'The first original pose is already tinted');
  await expect.poll(()=>page.evaluate(()=>window.studyQA.first)).toBeGreaterThan(0);
  const latency=await page.evaluate(()=>window.studyQA.first);
  assert(latency<250,`Warm read took ${latency}ms`);
  await page.evaluate(()=>{window.studyQA.armed=true});
  await snap('reading');
  await expect(current('write')).toHaveCount(1,{timeout:50000});
  await expect(shown).toHaveAttribute('data-source',/pet101Movie\/13\.swf$/);
  await snap('writing');
  await expect.poll(async()=>(await frameCounts('write')).some(([seen,total])=>seen===116&&total===116),{timeout:12500}).toBe(true);
  await expect(current('read')).toHaveCount(1,{timeout:50000});
  assert.deepEqual(await frameCounts('tuya1'),[]);
  await cancel();
  await expect(actor.locator('>.ram-sprite')).toHaveAttribute('data-action','waving',{timeout:1000});
  const paint=await page.evaluate(()=>({gaps:window.studyQA.gaps,corners:window.studyQA.corners}));
  assert.equal(paint.gaps,0);assert(paint.corners.length>200&&paint.corners.every(value=>value===0));
  assert.equal((await saved()).wearing,'leaf-hood');
  console.log(`PASS warm opening in ${Math.round(latency)}ms, original reading and writing, transparent frames and no handoff gaps`);

  await load({evolution:'classic',wearing:'leaf-hood'});
  await doSleep();
  const nap=actor.locator('[data-sleep-source="original-nap"] .official-ram-clip');
  await expect(nap).toHaveAttribute('data-source',/pet101Movie\/0\.swf$/);
  await expect(nap).toHaveAttribute('data-loaded','true',{timeout:20000});
  await snap('original-nap');
  await expect(actor.locator('[data-sleep-source="adapted-loop"] canvas[data-loaded=true]')).toHaveCount(1,{timeout:12000});
  await play.getByRole('button',{name:'轻轻叫醒',exact:true}).click();
  await expect(actor.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:12000});
  await expect(actor.locator('.ram-outfit-source')).toHaveCSS('visibility','visible');
  console.log('PASS manual classic sleep plays the original nap and restores the outfit on waking');

  await load({wearing:'warm-scarf',happiness:35});
  await (await button('玩耍')).click();
  await play.getByRole('button',{name:'回应心情',exact:true}).click();
  const mood=actor.locator('canvas[data-sheet="mood-grumpy"][data-form="super"]');
  await expect(mood).toHaveAttribute('data-loaded','true',{timeout:10000});
  assert(Number(await mood.getAttribute('width'))>192);
  await snap('super-mood');
  await expect(actor.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:10000});
  await page.evaluate(()=>{window.studyQA.failSleep=true});
  await doSleep();
  await expect(actor.locator('canvas[data-uploaded-id="sleep"][data-form="super"]')).toHaveAttribute('data-failed','true');
  await expect(actor.locator('.ram-original-body canvas[data-sheet="slumber"][data-loaded=true]')).toHaveCount(1,{timeout:10000});
  assert.equal((await saved()).wearing,'warm-scarf');
  console.log('PASS Super Ram uses its own full mood frame and closed-eye sleep fallback while dressed');

  await load({wearing:'leaf-hood',happiness:95});
  await (await button('玩耍')).click();
  await play.getByRole('button',{name:'回应心情',exact:true}).click();
  const tallMood=actor.locator('canvas[data-sheet="mood-joy"][data-form="super"]');
  await expect(tallMood).toHaveAttribute('data-loaded','true',{timeout:10000});
  assert(Number(await tallMood.getAttribute('height'))>208);
  await expect.poll(()=>tallMood.evaluate(canvas=>canvas.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-1);
  await snap('super-full-frame');
  console.log('PASS the native window includes the tall Super Ram emotion canvas');

  await load();
  await enterHome(page);
  const toggle=page.locator('.room-decoration-action');
  const sameButton=await toggle.elementHandle();
  const drawer=page.getByRole('complementary',{name:'小屋布置工具'});
  const rail=page.locator('.room-side-tools');
  const scene=page.locator('.cottage-scene');
  const before=await rail.boundingBox(),room=await scene.boundingBox();
  assert(Math.abs(before.y+before.height/2-room.y-room.height/2)<3,'The icon rail is centered');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('searchbox',{name:'查找家具'}).fill('小小绿植');
  await drawer.getByRole('button',{name:'放进小屋',exact:true}).click();
  await snap('room-decoration');
  assert(await toggle.evaluate((node,first)=>node===first,sameButton),'One button performs both actions');
  await toggle.click();
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  assert((await saved()).room.placed.some(item=>item.id==='plant'));
  await page.reload();
  await enterHome(page);
  await expect(page.locator('.room-placed-item[data-furniture="plant"]')).toHaveCount(1);
  assert.deepEqual(errors,[]);
  console.log('PASS centered furniture toggle, immediate save and persistence after reopening');
 }finally{
  await app?.close();
  fs.rmSync(profile,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
