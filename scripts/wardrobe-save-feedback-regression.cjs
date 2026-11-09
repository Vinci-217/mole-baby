const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-interactions'),base=process.env.PREVIEW_URL||'http://127.0.0.1:5173';
const executablePath=process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',saveKey='ramu-house-save-v1';
(async()=>{
 // Reuse the existing review record. Never initialize, import over, or clear it.
 const profile=path.join(root,'artifacts/native-outfits-review/browser-profile');assert(fs.existsSync(profile));
 const context=await chromium.launchPersistentContext(profile,{headless:true,executablePath,viewport:{width:1100,height:850},ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 let snapshot;
 try{const page=context.pages()[0]||await context.newPage();await page.addInitScript(()=>{window.beforeWardrobeCheck=Object.fromEntries(Object.entries(localStorage))});await page.goto(base);
  await expect(page.getByTestId('desktop-character')).toBeVisible();snapshot=await page.evaluate(()=>window.beforeWardrobeCheck);assert(snapshot[saveKey],'the previous save must exist');
  const before=JSON.parse(snapshot[saveKey]);fs.writeFileSync(path.join(out,'previous-record-before.json'),JSON.stringify(snapshot,null,2));await page.reload();
  const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),pet=JSON.parse(after[saveKey]);
  for(const key of ['createdAt','name','color','inventory','wardrobe','wearing','coins','naturalGrowth'])assert.deepEqual(pet[key],before[key],key);
  const memoryKey='ramu-companion-memory-v1:'+before.createdAt;
  if(snapshot[memoryKey]){const old=JSON.parse(snapshot[memoryKey]),next=JSON.parse(after[memoryKey]);for(const event of old.events)assert(next.events.some(e=>e.id===event.id),'previous memories survive');}
  fs.writeFileSync(path.join(out,'previous-record-after.json'),JSON.stringify(after,null,2));console.log('PASS previous persistent QA identity, colour, wardrobe, inventory, coins and memories survive reload');
 }finally{await context.close()}
 const browser=await chromium.launch({headless:true,executablePath,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  // An isolated copy of that same record exercises rewards without spending
  // or changing the persistent review pet's inventory and money.
  const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.addInitScript(({snapshot,saveKey})=>{if(localStorage.getItem(saveKey))return;for(const [key,value] of Object.entries(snapshot))localStorage.setItem(key,value);const pet=JSON.parse(localStorage.getItem(saveKey));pet.lastTick=Date.now();pet.stats={hunger:80,thirst:80,cleanliness:80,health:100,happiness:70,energy:90};pet.sleeping=false;delete pet.outing;delete pet.activity;localStorage.setItem(saveKey,JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,roomWander:false}));},{snapshot,saveKey});
  await page.goto(base);await enterHome(page);await roomTab(page,'游戏');await page.getByRole('button',{name:'开始翻牌',exact:true}).click();await page.getByTestId('memory-start').click();
  const kinds=await page.getByTestId('memory-card').evaluateAll(ns=>ns.map(n=>n.dataset.kind));await expect(page.locator('.memory-dialog')).toHaveAttribute('data-phase','playing');
  for(let kind=0;kind<6;kind++)for(let index=0;index<kinds.length;index++)if(Number(kinds[index])===kind)await page.getByTestId('memory-card').nth(index).click();
  await expect(page.getByTestId('memory-result')).toBeVisible({timeout:20000});await page.getByRole('button',{name:'收好奖励',exact:true}).click();
  const gain=page.getByTestId('care-gain');await expect(gain).toBeVisible();await expect(gain.locator('[data-care-stat=coins]')).toBeVisible();await expect(gain.locator('[data-care-stat=happiness]')).toBeVisible();
  for(const img of await gain.locator('img').all())assert(await img.evaluate(n=>n.complete&&n.naturalWidth>0));
  await page.screenshot({path:path.join(out,'game-feedback.png')});console.log('PASS real matching game, actual coin/happiness receipts, both decoded feedback icons');
  await toDesktop(page);await expect(page.getByTestId('desktop-character')).toBeVisible();
  const reduced=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'reduce'});await reduced.goto(base+'/?preview=wardrobe');await reduced.getByRole('button',{name:'衣橱上一页',exact:true}).click();await reduced.getByRole('button',{name:'试戴紫色魔法帽',exact:true}).click();
  await expect(reduced.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  // A suspended Ruffle engine need not service ad-hoc ExternalInterface calls.
  // Check its actual pose reports delivered before suspension instead.
  await reduced.evaluate(()=>{window.reducedPose={};addEventListener('message',event=>{if(event.data?.type==='ram-original-state'&&event.source===document.querySelector('.wardrobe-mirror iframe')?.contentWindow)window.reducedPose=event.data.value})});
  await reduced.getByRole('button',{name:'预览右走动作',exact:true}).click();
  await expect.poll(()=>reduced.evaluate(()=>window.reducedPose.direction)).toBe('right');
  await expect.poll(()=>reduced.evaluate(()=>window.reducedPose.settled)).toBe(true);await expect(reduced.locator('.official-hit-mask')).toHaveAttribute('data-loaded','true');
  const sourceBefore=await reduced.locator('.wardrobe-mirror iframe').getAttribute('src');await reduced.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
  await expect(reduced.locator('[data-petting-adaptation]')).toHaveAttribute('data-petting-adaptation','project');
  await expect.poll(()=>reduced.locator('.wardrobe-mirror>.ram-sprite').evaluate(n=>parseFloat(n.style.getPropertyValue('--social-opacity'))||0)).toBe(1);
  await expect(reduced.locator('.wardrobe-mirror>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:8000});assert.equal(await reduced.locator('.wardrobe-mirror iframe').getAttribute('src'),sourceBefore);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS reduced-motion outfit selection and direction change remain painted; no page errors or missing assets');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
