'use strict';
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const {mockNative}=require('./mock-native.cjs'),{adopt,openActions}=require('../smoke-helpers.cjs');
const origin=process.env.MOLE_REVIEW_URL||'http://localhost:5173';let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium'});
 const seed=await browser.newPage();await seed.goto(origin);await adopt(seed);
 const pet=await seed.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return {...p,growth:180,highestGrowth:180,growthLocked:true,stats:{hunger:95,thirst:95,happiness:95,cleanliness:95,health:100,energy:95}}});await seed.close();
 if(!process.argv.includes('--reproduce')){
  const seedMobile=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  await seedMobile.addInitScript(mockNative,{'ramu-house-save-v1':JSON.stringify({...pet,growth:0}),'ramu-house-preferences-v2':JSON.stringify({roomWander:true,lively:false,presence:false,sound:false})});
  await seedMobile.goto(origin);await expect(seedMobile.getByRole('button',{name:'小屋地面，点击让拉姆走过去',exact:true})).toBeDisabled();
  await seedMobile.evaluate(()=>{window.__androidTest.permissions.overlay=true});await seedMobile.getByRole('button',{name:'悬浮陪伴',exact:true}).tap();
  await expect(seedMobile.getByTestId('desktop-character')).toBeVisible();
  await expect.poll(()=>seedMobile.evaluate(()=>window.__androidTest.calls.filter(c=>c.method==='setPetCanMove').at(-1)?.args.enabled)).toBe(false);
  await seedMobile.close();
 }
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(mockNative,{'ramu-house-save-v1':JSON.stringify(pet),'ramu-house-preferences-v2':JSON.stringify({sound:false,lively:false,presence:false,outings:false,roomWander:false})});
 await page.goto(origin);await expect(page.locator('.room-dock')).toBeVisible();
 await page.evaluate(()=>{
  window.__androidTest.permissions.overlay=true;window.__androidTest.state.windowVisible=true;
  const invoke=window.MoleAndroid.invoke;
  window.MoleAndroid.invoke=(id,method,raw)=>{
   const args=JSON.parse(raw),state=window.__androidTest.state;
   if(method==='setPetMode'&&!args.enabled&&state.petMode){
    // Android detaches the overlay before its Activity becomes visible.
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    state.windowVisible=false;
    setTimeout(()=>{state.windowVisible=true;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.__androidTest.emit('state',{...state});window.__androidTest.emit('resume',{});},450);
   }
   return invoke(id,method,raw);
  };
 });
 await page.getByRole('button',{name:'悬浮陪伴',exact:true}).tap();await openActions(page);
 await page.getByRole('button',{name:'玩耍',exact:true}).tap();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 await page.getByRole('button',{name:'去餐厅打工',exact:true}).tap();await expect(page.getByTestId('desktop-restaurant-work')).toBeVisible();
 const started=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 await page.getByRole('button',{name:'进入餐厅',exact:true}).tap();await expect(page.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toBeVisible();
 await page.waitForTimeout(700);
 const entered=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 console.log(JSON.stringify({androidViewTransferRetainsShift:entered.activity?.id===started.activity?.id,energyCost:before.stats.energy-started.stats.energy,phase:await page.locator('.restaurant-work-stage canvas').getAttribute('data-phase')}));
 if(!process.argv.includes('--reproduce')){
  assert.equal(entered.activity?.id,started.activity.id,'entering restaurant must retain the same shift');
  assert(Math.abs(before.stats.energy-started.stats.energy-2)<.03,'one shift costs two energy');
  await expect(page.locator('.restaurant-work-stage canvas')).not.toHaveAttribute('data-phase','closed');
  await page.evaluate(()=>{window.__androidTest.state.windowVisible=false;window.__androidTest.emit('state',{...window.__androidTest.state})});
  await expect(page.locator('.restaurant-work-stage canvas')).toHaveAttribute('data-phase','closed');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')))).coins,started.coins);
  assert.deepEqual(errors,[]);console.log('PASS mobile restaurant: overlay handoff retains the shift, two energy charged once, real background cancels without pay.');
 }
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
