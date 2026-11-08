/** Verify real original frames and automatic costume restoration, including
 * every grown form. The independent wardrobe demo never touches a save. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/outfit-action-fallback');
async function choose(page,name){const target=page.getByRole('button',{name:'试戴'+name,exact:true}),prev=page.getByRole('button',{name:'衣橱上一页'}),next=page.getByRole('button',{name:'衣橱下一页'});while(!await target.count()&&await prev.isEnabled())await prev.click();while(!await target.count()&&await next.isEnabled())await next.click();await target.click();}
async function worn(page){await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});}
async function pixels(canvas){return canvas.evaluate(node=>{const rgba=node.getContext('2d').getImageData(0,0,node.width,node.height).data;let ink=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>32)ink++;return ink});}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 const checks=[],errors=[],missing=[];fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.goto('http://127.0.0.1:5173/?preview=wardrobe');await choose(page,'皇冠猫耳');
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire']){
   await page.getByRole('combobox',{name:'预览形态'}).selectOption(form);await worn(page);
   await expect(page.locator('.wardrobe-mirror>.ram-sprite')).toHaveAttribute('data-form','junior');
   await page.getByRole('button',{name:'预览玩球动作',exact:true}).click();
   const ball=page.locator('.wardrobe-mirror .ram-football-frame');await expect(ball).toHaveAttribute('data-form',form);await expect(ball).toHaveAttribute('data-loaded','true');
   assert.equal(await page.locator('.wardrobe-mirror .official-ram-clip').count(),0,'costume idle must never mask football');
   assert(await pixels(ball)>100,'the original football frame must contain real pixels');
   const first=Number(await ball.getAttribute('data-source-frame'));await expect.poll(async()=>Number(await ball.getAttribute('data-source-frame'))).toBeGreaterThan(first);
   await worn(page);await expect(page.locator('.wardrobe-mirror>.ram-sprite')).toHaveAttribute('data-form','junior');
   await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
   const pet=page.locator('.wardrobe-mirror .ram-daily-frame');await expect(pet).toHaveAttribute('data-form',form);await expect(pet).toHaveAttribute('data-loaded','true');assert(await pixels(pet)>100);
   await worn(page);
   checks.push({form,footballPainted:true,originalFramesAdvance:true,originalPetting:true,costumeRestored:true});console.log('PASS',form);
  }
  await page.getByRole('combobox',{name:'预览形态'}).selectOption('middle');await worn(page);
  await page.getByRole('button',{name:'预览开心动作',exact:true}).click();await expect(page.locator('.wardrobe-mirror .ram-emotion-frame')).toHaveAttribute('data-form','middle');await expect(page.locator('.wardrobe-mirror .ram-emotion-frame')).toHaveAttribute('data-loaded','true');await worn(page);
  await page.getByRole('button',{name:'预览睡觉动作',exact:true}).click();await expect(page.locator('.wardrobe-mirror .ram-daily-frame')).toHaveAttribute('data-form','middle');await expect(page.locator('.wardrobe-mirror .ram-daily-frame')).toHaveAttribute('data-loaded','true');
  await page.getByRole('button',{name:'预览右走动作',exact:true}).click();await worn(page);
  const iframe=await(await page.locator('.wardrobe-mirror iframe').elementHandle()).contentFrame();assert.equal(await iframe.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction),'right');
  // Exercise the real desktop menu and App completion clock on an isolated
  // copy of the previous record, preserving its identity/colour/memories.
  const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../artifacts/wardrobe-interactions/previous-record-after.json'),'utf8'));
  const previous=JSON.parse(snapshot['ramu-house-save-v1']),app=await browser.newPage({viewport:{width:1100,height:850}});
  app.on('pageerror',e=>errors.push(e.message));app.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await app.addInitScript(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const [key,value] of Object.entries(snapshot))localStorage.setItem(key,value);const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.lastTick=Date.now();p.wearing='wizard-cap';p.sleeping=false;p.stats={hunger:95,thirst:95,cleanliness:95,happiness:70,health:100,energy:95};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));},snapshot);
  await app.goto('http://127.0.0.1:5173/');await expect(app.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  await app.getByTestId('desktop-character').hover();await app.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await app.getByRole('button',{name:'一起玩球',exact:true}).click();await expect(app.locator('.desktop-character .ram-football-frame')).toHaveAttribute('data-form','super');await expect(app.locator('.desktop-character .ram-football-frame')).toHaveAttribute('data-loaded','true');
  await expect(app.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:20000});
  await app.getByRole('tab',{name:'道具',exact:true}).click();await app.getByRole('button',{name:'播放足球',exact:true}).click();
  const original=app.locator('.desktop-character .official-ram-clip');await expect(original).toHaveAttribute('data-source','resource/pet/swf/pet101/180004.swf');await expect(original).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect(app.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-source','resource/petcloth/swf2/1200020.swf',{timeout:25000});await expect(app.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const after=await app.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const key of ['createdAt','name','color','growth','evolution','coins','inventory','wardrobe'])assert.deepEqual(after[key],previous[key],key);assert.equal(after.wearing,'wizard-cap');
  const memoryKey='ramu-companion-memory-v1:'+previous.createdAt,oldMemory=JSON.parse(snapshot[memoryKey]),memory=await app.evaluate(key=>JSON.parse(localStorage.getItem(key)),memoryKey);for(const event of oldMemory.events)assert(memory.events.some(next=>next.id===event.id));
  console.log('PASS actual desktop activity/toy menus, App completion timing, outfit restoration and the previous record');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({checks,emotion:true,sleep:true,nativeClothedWalk:true,desktopActivityAndToyMenus:true,previousRecordRetained:true,errors,missing},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
