const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {adopt,enterHome}=require('./smoke-helpers.cjs');
const {reloadStoredFixture}=require('./smoke-storage.cjs');
const dir=path.resolve(__dirname,'../artifacts/wardrobe-expansion');fs.mkdirSync(dir,{recursive:true});
const additions=[['flower-crown','鲜花花冠',55],['knight-shield','骑士盾牌',65],['angel-wings','天使羽翼',75]];
const forms=['junior','middle','senior','super','water','wood','fire'];
const SAVE='ramu-house-save-v1';let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:1180,height:860}}),errors=[],failed=[],shots=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()])});
 await page.addInitScript(key=>localStorage.setItem(key,'wardrobe-preview-untouched'),SAVE);
 await page.clock.install();await page.goto('http://localhost:5173/?preview=wardrobe');
 const wear=page.locator('.wardrobe-mirror .ram-wear');
 const ready=async id=>{await expect(page.locator('.wardrobe-mirror canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true');await expect(wear).toHaveAttribute('data-outfit',id);await expect(wear).toHaveAttribute('data-loaded','true');await expect(wear).toHaveAttribute('data-registration','original-source');await expect(wear).toBeVisible();};
 await ready('flower-crown');
 await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('seed');
 for(const target of [0,1]){
  const back=page.getByRole('button',{name:'衣橱上一页',exact:true});if(target===0&&await back.isEnabled())await back.click();
  if(target===1)await page.getByRole('button',{name:'衣橱下一页',exact:true}).click();
  const buttons=page.locator('.wardrobe-grid button').filter({hasNot:page.locator('[src$="icon-happy.webp"]')});
  for(const b of await buttons.all()){await b.click();await expect(page.locator('.wardrobe-mirror .ram-wear')).toHaveCount(0);await expect(page.getByRole('button',{name:'长大后才能穿戴',exact:true})).toBeDisabled()}
 }
 await page.screenshot({path:path.join(dir,'seed-outfits-blocked.png')});
 assert.equal(await page.locator('.wardrobe-grid').getByText('穿戴中',{exact:true}).count(),0);
 await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('middle');
 await page.getByRole('button',{name:'试戴鲜花花冠',exact:true}).click();
 await ready('flower-crown');await expect(page.getByRole('button',{name:'试戴鲜花花冠',exact:true})).toBeVisible();
 for(const [index,[id,label]] of additions.entries()){
  await page.getByRole('button',{name:`试戴${label}`,exact:true}).click();
  for(const [col,form] of forms.entries()){
   console.log('Checking',id,form);
   await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption(form);
   await expect(page.locator('.wardrobe-mirror canvas:not(.ram-wear)')).toHaveAttribute('data-form',form);
   await page.getByRole('button',{name:'预览左走动作',exact:true}).click();await ready(id);await page.clock.runFor(200);
   assert.equal(await page.locator('.wardrobe-mirror [data-fallback=true]').count(),0);
   await page.getByRole('button',{name:'预览右走动作',exact:true}).click();await ready(id);await page.clock.runFor(200);
   shots.push({input:await page.locator('.wardrobe-mirror').screenshot(),left:col*180,top:index*220});
  }
  await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('middle');
  for(const action of ['开心','不高兴','吃东西','玩球','睡觉','摸摸']){
   await page.getByRole('button',{name:`预览${action}动作`,exact:true}).click();await ready(id);await page.clock.runFor(300);
   assert.equal(await page.locator('.wardrobe-mirror [data-fallback=true]').count(),0);
   if(action==='玩球')assert.notEqual(await wear.getAttribute('data-head-registration'),'original-symbols',`${id} uses its original football costume poses`);
  }
  await page.getByRole('button',{name:'预览右走动作',exact:true}).click();await ready(id);
  await page.screenshot({path:path.join(dir,`${id}-wardrobe.png`)});
  await page.locator('.wardrobe-mirror').screenshot({path:path.join(dir,`${id}-mirror.png`)});
 }
 await sharp({create:{width:1260,height:660,channels:4,background:'#f6eedb'}}).composite(shots).png().toFile(path.join(dir,'outfits-eight-forms.png'));
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE),'wardrobe-preview-untouched');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'wardrobe-mobile.png')});
 assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));await page.close();
 const main=await browser.newPage({viewport:{width:1180,height:860}});
 main.on('pageerror',e=>errors.push(e.message));main.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()])});
 await main.goto('http://localhost:5173/');await adopt(main,'蓝色','旧存档试衣');
 await main.waitForFunction(key=>Boolean(localStorage.getItem(key)),SAVE);
 await main.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));Object.assign(p,{growth:180,highestGrowth:180,growthLocked:true,coins:1000,color:'#935ac9',wardrobe:['party-cap','gold-feather','wizard-cap'],wearing:'wizard-cap'});localStorage.setItem(key,JSON.stringify(p));},SAVE);
 await reloadStoredFixture(main);const before=await main.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
 await enterHome(main);await main.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();await main.getByRole('button',{name:'衣橱下一页',exact:true}).click();
 let coins=before.coins;
 for(const [id,label,price] of additions){
  await main.getByRole('button',{name:`试戴${label}`,exact:true}).click();assert.equal((await main.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).coins,coins);
  await main.getByRole('button',{name:`买下 · ${price} 摩尔豆`,exact:true}).evaluate(b=>{b.click();b.click()});coins-=price;
  assert.equal((await main.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).coins,coins);
  await main.getByRole('button',{name:'给拉姆戴上',exact:true}).click();
  await expect(main.locator('.wardrobe-mirror .ram-wear')).toHaveAttribute('data-outfit',id);
 }
 await main.reload();const after=await main.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
 for(const field of ['createdAt','color','growthLocked','inventory'])assert.deepEqual(after[field],before[field],field);
 assert.equal(after.wearing,'angel-wings');assert.equal(after.coins,805);
 assert.deepEqual(after.wardrobe,['party-cap','gold-feather','wizard-cap',...additions.map(a=>a[0])]);
 await main.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));p.growth=0;localStorage.setItem(key,JSON.stringify(p));},SAVE);
 await reloadStoredFixture(main);
 await expect(main.locator('.companion-layout .ram-wear')).toHaveCount(0);
 await enterHome(main);await expect(main.locator('.scene-character .ram-wear')).toHaveCount(0);
 const seedSave=await main.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
 assert.equal(seedSave.wearing,'angel-wings');assert.deepEqual(seedSave.wardrobe,after.wardrobe);assert.equal(seedSave.coins,after.coins);
 await main.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));p.growth=60;localStorage.setItem(key,JSON.stringify(p));},SAVE);
 await reloadStoredFixture(main);
 await expect(main.locator('.companion-layout .ram-wear')).toHaveAttribute('data-outfit','angel-wings');
 await expect(main.locator('.companion-layout .ram-wear')).toHaveAttribute('data-loaded','true');

 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={passed:true,threeOriginalModules:true,grownFormsPerOutfit:7,seedCannotTryOrWearAnyOutfit:true,seedHidesImportedClothingOnDesktopAndInRoom:true,ownedClothesAndPreferenceResumeAfterGrowing:true,allEightPreviewActions:true,usesAuthoredFootballPoses:true,previewLeavesSaveUntouched:true,doublePurchaseOnlyChargesOnce:true,oldOwnershipColourInventoryAndNewClothesSurviveReload:true,mobileNoHorizontalOverflow:true,errors,failed};fs.writeFileSync(path.join(dir,'browser-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
