/** Actual game navigation and saved ownership, in a dedicated reusable QA
 * browser profile. Never opens or resets the user's browser/Electron data. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {enterHome,toDesktop,openActions,ramBodyPosition,roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-quality');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173',saveKey='ramu-house-save-v1';
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(out,'gameplay-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1100,height:850},args:['--disable-dev-shm-usage','--disk-cache-size=10485760']});
 try{
  const page=context.pages()[0],errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.addInitScript(key=>{
   if(localStorage.getItem(key))return;
   localStorage.setItem(key,JSON.stringify({version:1,name:'服装回归拉姆',color:'#9c5fd4',createdAt:1793491200000,lastTick:Date.now(),growth:840,highestGrowth:840,naturalGrowth:840,growthLocked:true,evolution:'super',coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90},inventory:{biscuit:2},wardrobe:['wizard-cap','warm-scarf','magic-book'],wearing:'wizard-cap',sleeping:false,completedGames:0,lastRewardAt:0}));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,reminders:false,roomWander:false}));
  },saveKey);
  await page.goto(base);const save=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
  // This is a real continuing QA save. After a night it may be tired, and
  // football would legitimately trigger sleep. Restore it through the shop
  // and backpack, never by reseeding the profile or editing its saved stats.
  const initial=await save();
  if(initial.sleeping||Object.values(initial.stats).some(value=>value<60)){
   await enterHome(page);await roomTab(page,'商店');
   const shop=page.locator('.shop-book');await shop.getByRole('button',{name:'翻开药水商品书',exact:true}).click();
   const cross=shop.locator('[data-item-id="180006"]');while(!await cross.count())await shop.getByRole('button',{name:'商店下一页',exact:true}).click();await cross.click();
   if(!(initial.inventory['180006']>0)){await expect(shop.locator('.book-buy')).toBeEnabled();await shop.locator('.book-buy').click()}
   await roomTab(page,'背包');await page.getByRole('tab',{name:'药水',exact:true}).click();await page.locator('.care-pocket [data-item-id="180006"]').click();
   await expect.poll(async()=>(await save()).stats.energy).toBeGreaterThan(99);
   await expect.poll(()=>page.locator('.scene-character>.ram-sprite').getAttribute('data-action'),{timeout:65000}).toBe('idle');
   console.log('PASS continuing QA save restored through actual shop and care UI');
  }
  const before=await save();
  for(const [name,id] of [['魔法书','magic-book'],['皇冠猫耳','warm-scarf']]){
   await enterHome(page);await roomTab(page,'衣橱');
   const pick=page.getByRole('button',{name:'试戴'+name,exact:true}),prev=page.getByRole('button',{name:'衣橱上一页'}),next=page.getByRole('button',{name:'衣橱下一页'});
   while(!await pick.count()&&await prev.isEnabled())await prev.click();while(!await pick.count()&&await next.isEnabled())await next.click();await pick.click();
   const wear=page.getByRole('button',{name:'给拉姆戴上',exact:true});if(await wear.count())await wear.click();
   await toDesktop(page);
   await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   assert.equal((await save()).wearing,id);assert.equal((await save()).evolution,'super');assert.equal((await save()).growth,840);
   const frame=await(await page.locator('.desktop-character iframe').elementHandle()).contentFrame();
   await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus')?.form)).toBe(id==='warm-scarf'?'level2':'level101_7');
   const character=page.getByTestId('desktop-character');await character.click({position:await ramBodyPosition(character)});
   await expect(character.locator('[data-petting-adaptation]')).toHaveAttribute('data-petting-adaptation','project');
   await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:10000});
   const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
   const play=page.getByTestId('companion-panel');await play.getByRole('tab',{name:'活动',exact:true}).click();await play.getByRole('button',{name:'一起玩球',exact:true}).click();
   await expect(character.locator('.ram-football-frame')).toBeVisible();await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-stage','4');
   assert.equal((await save()).wearing,id,'the full action must not unequip the saved costume');
   await expect(character.locator('.ram-outfit-source')).toBeVisible({timeout:16000});
   await expect(character.locator('.official-ram-clip:visible')).toHaveAttribute('data-loaded','true');
   await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
   console.log('PASS actual room wardrobe/wear navigation, desktop petting, original football and restored costume: '+id);
  }
  const dressed=await save();await page.reload();await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const after=await save();for(const key of ['name','color','createdAt','growth','naturalGrowth','evolution','coins','inventory','wardrobe'])assert.deepEqual(after[key],before[key],key);assert.equal(after.wearing,dressed.wearing);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'gameplay-checks.json'),JSON.stringify({realGameNavigation:true,originalFootballAndOutfitRestoration:true,juniorCostumeWithoutGrowthMutation:true,reusedProfile:true,identityAndInventoryRetained:true,errors,missing},null,2));
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
