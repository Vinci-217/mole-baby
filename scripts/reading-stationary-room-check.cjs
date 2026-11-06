'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,expect}=require('@playwright/test');
const {adopt,enterHome,roomTab}=require('./smoke-helpers.cjs'),{reloadStoredFixture}=require('./smoke-storage.cjs');
const origin=process.env.MOLE_REVIEW_URL||'http://localhost:5173',out=path.resolve(__dirname,'../artifacts/reading-work-review');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium'});
 const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto(origin+'/');await adopt(page,'蓝色','小蓝');
 await page.evaluate(()=>{
  const key='ramu-house-save-v1',pet=JSON.parse(localStorage.getItem(key));Object.assign(pet,{growth:180,highestGrowth:180,growthLocked:true,lastTick:Date.now()});
  localStorage.setItem(key,JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false,outings:false,roomWander:true,reminderMinutes:1,reminders:true}));
 });
 await reloadStoredFixture(page);await page.evaluate(()=>{Math.random=()=>.25});await enterHome(page);
 const floor=page.getByRole('button',{name:'小屋地面，点击让拉姆走过去',exact:true}),position=page.locator('.room-pet-position');
 const point=()=>position.evaluate(node=>({x:node.dataset.x,y:node.dataset.y}));
 await roomTab(page,'游戏');await page.getByRole('button',{name:'一起翻翻书',exact:true}).click();
 if(await page.getByRole('button',{name:'关闭面板',exact:true}).isVisible())await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 await expect(page.locator('.scene-character .ram-reading')).toBeVisible();await expect(floor).toBeDisabled();
 const readingPoint=await point();await page.clock.runFor(16000);
 assert.deepEqual(await point(),readingPoint,'random roaming must not move a reading pet');
 await expect(page.locator('.scene-character .ram-reading')).toBeVisible();await expect(floor).toBeDisabled();
 await page.screenshot({path:path.join(out,'room-reading-stationary.png')});
 await page.clock.runFor(2500);await expect(floor).toBeEnabled();
 await page.clock.runFor(14500);assert.notDeepEqual(await point(),readingPoint,'enabled roaming resumes after the reading ends');
 const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-preferences-v2')));assert.equal(settings.roomWander,true);

 await roomTab(page,'设置');await page.getByRole('button',{name:'开始计时',exact:true}).click();
 if(await page.getByRole('button',{name:'关闭面板',exact:true}).isVisible())await page.getByRole('button',{name:'关闭面板',exact:true}).click();await expect(floor).toBeDisabled();
 const focusPoint=await point();await page.clock.runFor(59000);assert.deepEqual(await point(),focusPoint);
 await expect(floor).toBeDisabled();await page.clock.runFor(1500);await expect(floor).toBeEnabled();

 // Turning movement off must survive reading, rather than being forced on.
 await page.evaluate(()=>{const key='ramu-house-preferences-v2',prefs=JSON.parse(localStorage.getItem(key));prefs.roomWander=false;localStorage.setItem(key,JSON.stringify(prefs))});
 await reloadStoredFixture(page);await enterHome(page);await roomTab(page,'游戏');
 await page.getByRole('button',{name:'一起翻翻书',exact:true}).click();if(await page.getByRole('button',{name:'关闭面板',exact:true}).isVisible())await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 const quietPoint=await point();await page.clock.runFor(35000);assert.deepEqual(await point(),quietPoint);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-preferences-v2')).roomWander),false);
 await expect(floor).toBeEnabled();assert.deepEqual(errors,[]);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'stationary-room-checks.json'),JSON.stringify({readAloneStopsRoomWander:true,focusTimerStopsRoomWander:true,movementRestoresAfterReadingAndTimerEnd:true,disabledMovementPreferencePreserved:true,errors},null,2)+'\n');
 console.log('PASS reading stays in place with random walk enabled; reading and timer finish restore movement; disabled wandering remains disabled.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
