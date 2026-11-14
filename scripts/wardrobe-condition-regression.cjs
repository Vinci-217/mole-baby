/** Real game regression for the user's log: an ill pet owns and changes
 * clothing, but its persistent need must never select an unclothed fallback. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('@playwright/test');
const {enterHome,roomTab,toDesktop,ramBodyPosition}=require('./smoke-helpers.cjs');
const out=path.resolve(__dirname,'../artifacts/wardrobe-condition'),base=process.env.PREVIEW_URL||'http://127.0.0.1:5173',saveKey='ramu-house-save-v1',before=process.argv.includes('--before');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 let browser,app,page;const errors=[];
 try{
  if(process.env.MOLE_QA_EXECUTABLE||process.env.MOLE_QA_LOCAL==='1'){
   app=await _electron.launch({...(process.env.MOLE_QA_EXECUTABLE?{executablePath:process.env.MOLE_QA_EXECUTABLE}:{}),args:[...(process.env.MOLE_QA_EXECUTABLE?[]:[path.resolve(__dirname,'..'),'--no-sandbox']),`--user-data-dir=${path.join(out,'packaged-qa-profile')}`],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});page=await app.firstWindow();
  }else{
   browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--disable-dev-shm-usage']});page=await browser.newPage({viewport:{width:1100,height:850}});await page.goto(base);
  }
  page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(key=>{
   if(localStorage.getItem(key))return;
   const now=Date.now();localStorage.setItem(key,JSON.stringify({version:1,name:'生病换衣检查拉姆',color:'blue',createdAt:now-86400000,lastTick:now,growth:840,highestGrowth:840,naturalGrowth:840,growthLocked:true,evolution:'classic',coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:20,energy:90},inventory:{biscuit:2},wardrobe:['wizard-cap','rabbit-hood'],wearing:'wizard-cap',sleeping:false,completedGames:0,lastRewardAt:0}));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,reminders:false,roomWander:false}));
  },saveKey);
  await page.reload();if(app)await page.evaluate(()=>window.desktop.setPetMode(true));
  const save=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey),initial=await save(),character=page.getByTestId('desktop-character'),source=character.locator('.ram-outfit-source');
  await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','sick');
  if(before){
   const record={condition:'sick',savedWearing:initial.wearing,sourceVisible:await source.isVisible(),players:await source.locator('iframe').count()};
   fs.writeFileSync(path.join(out,'before.json'),JSON.stringify(record,null,2));await page.screenshot({path:path.join(out,'before.png')});console.log(JSON.stringify(record));return;
  }
  await expect(source).toBeVisible();await expect(source.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  await enterHome(page);await roomTab(page,'衣橱');
  const [label,targetId]=initial.wearing==='rabbit-hood'?['紫色魔法帽','wizard-cap']:['粉兔帽','rabbit-hood'];
  const choose=page.getByRole('button',{name:'试戴'+label,exact:true}),prev=page.getByRole('button',{name:'衣橱上一页'}),next=page.getByRole('button',{name:'衣橱下一页'});
  while(!await choose.count()&&await prev.isEnabled())await prev.click();while(!await choose.count()&&await next.isEnabled())await next.click();await choose.click();await page.getByRole('button',{name:'给拉姆戴上',exact:true}).click();await toDesktop(page);
  await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','sick');
  await expect(source).toBeVisible();await expect(source.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const original=await source.locator('iframe').elementHandle();
  await character.click({position:await ramBodyPosition(character)});
  await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','pet');await expect(source).toBeVisible();
  await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','sick',{timeout:10000});
  await expect(source).toBeVisible();assert(await original.evaluate(node=>node.isConnected));
  await page.screenshot({path:path.join(out,app?'packaged-after.png':'after.png')});
  await page.reload();await expect(source.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});await expect(source).toBeVisible();
  const final=await save();for(const key of ['name','createdAt','growth','evolution','wardrobe'])assert.deepEqual(final[key],initial[key]);assert.equal(final.wearing,targetId);assert(final.stats.health<=35,'This must still be a genuinely sick pet');
  await enterHome(page);await roomTab(page,'设置');await expect(page.locator('.scene-character .official-ram-clip:visible')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const logFile=path.join(out,app?'packaged-log.json':'log.json'),exportButton=page.getByRole('button',{name:'导出动画日志',exact:true});
  if(app){
   // Electron uses its native save dialog, not Playwright's browser download
   // event. Supply the QA destination through the normal download callback.
   await app.evaluate(({session},file)=>{global.wardrobeDownloadState='waiting';session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(file);item.once('done',(_event,state)=>{global.wardrobeDownloadState=state})})},logFile);
   await exportButton.click();await expect.poll(()=>app.evaluate(()=>global.wardrobeDownloadState),{timeout:15000}).toBe('completed');
  }else{const downloadPromise=page.waitForEvent('download');await exportButton.click();const download=await downloadPromise;await download.saveAs(logFile)}
  const log=JSON.parse(fs.readFileSync(logFile));assert.equal(log.version,2);assert(log.events.some(event=>event.event==='ready'));assert(log.players.some(player=>player.loaded&&player.visible));assert(!JSON.stringify(log).includes(initial.name));
  assert.deepEqual(errors,[]);const result={platform:app?process.platform:'browser',sickPetStillSick:true,wearingBefore:initial.wearing,wearingAfter:final.wearing,clothesVisibleAtRest:true,pettingKeepsSource:true,reopeningRetainsClothesAndIdentity:true,diagnosticsHaveReadyAndPlayerSnapshot:true,errors};fs.writeFileSync(path.join(out,app?'packaged-checks.json':'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{if(app)await app.close();if(browser)await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
