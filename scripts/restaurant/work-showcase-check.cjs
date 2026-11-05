const {chromium, expect} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {adopt, enterHome, openActions} = require('../smoke-helpers.cjs');
const {reloadStoredFixture} = require('../smoke-storage.cjs');
const out = path.resolve(__dirname, '../../artifacts/restaurant-work-showcase');
const SAVE = 'ramu-house-save-v1';
fs.mkdirSync(out, {recursive: true});
let browser;
(async () => {
  browser = await chromium.launch({executablePath: '/usr/local/bin/chromium', headless: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 860}});
  const page = await context.newPage(), errors = [], failed = [];
  const observe = p => { p.on('pageerror', e => errors.push(e.message)); p.on('response', r => { if(r.status() >= 400) failed.push([r.status(), r.url()]); }); };
  observe(page);
  await page.addInitScript(key => { if(!localStorage.getItem(key)) localStorage.setItem(key, 'primary-save-untouched'); }, SAVE);
  await page.clock.install();
  await page.goto('http://localhost:5173/?preview=restaurant');
  const dialog = page.getByRole('dialog', {name: '拉姆餐厅', exact: true});
  const scene = page.locator('.restaurant-work-stage canvas');
  await expect(scene).toHaveAttribute('data-background', '1330004');
  await expect(page.locator('.restaurant-work-loading')).toHaveCount(0);
  assert.equal(await dialog.getByRole('button').count(), 2); // close + background, nothing else
  assert.equal(await page.locator('.native-hit,.native-menu,.restaurant-management,.restaurant-tabs').count(), 0);
  const phases = [];
  for (const [duration, phase] of [[2200,'enter'],[2700,'wait'],[2100,'fetch'],[2300,'collect'],[2000,'deliver'],[2700,'serve'],[1700,'eat'],[6000,'leave'],[3600,'ready']]) {
    await page.clock.runFor(duration);
    await expect(scene).toHaveAttribute('data-phase', phase);
    phases.push(phase);
    if(phase === 'deliver') await page.screenshot({path: path.join(out, 'desktop-serving.png')});
    if(phase === 'eat') await page.screenshot({path: path.join(out, 'desktop.png')});
  }
  await page.clock.runFor(1800);
  await expect(scene).toHaveAttribute('data-cycle', '1');
  await expect(scene).toHaveAttribute('data-phase', 'enter');

  await context.setOffline(true); await page.clock.runFor(300);
  await expect(scene).toHaveAttribute('data-paused', 'true');
  await expect(page.getByText('网络已断开，打工暂停', {exact:true})).toBeVisible();
  const pausedPhase = await scene.getAttribute('data-phase');
  await page.clock.runFor(20000); assert.equal(await scene.getAttribute('data-phase'), pausedPhase);
  await context.setOffline(false); await page.clock.runFor(100);
  await expect(scene).toHaveAttribute('data-paused', 'false');
  await page.evaluate(() => Object.defineProperty(document, 'hidden', {configurable:true,value:true}));
  await page.clock.runFor(100); await expect(scene).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(10000); assert.equal(await scene.getAttribute('data-phase'), pausedPhase);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', {configurable:true,value:false}));
  await page.clock.runFor(100);

  const seen = new Set(['1330004']);
  for(let i=0;i<15;i++) {
    const before = await scene.getAttribute('data-background');
    await page.getByRole('button', {name:'切换餐厅背景',exact:true}).click();
    await expect(scene).not.toHaveAttribute('data-background', before);
    await expect(page.locator('.restaurant-work-loading')).toHaveCount(0);
    seen.add(await scene.getAttribute('data-background'));
    await page.clock.runFor(200);
  }
  assert.equal(seen.size, 15);
  await page.getByRole('button', {name:'切换餐厅背景',exact:true}).click();
  await expect(scene).toHaveAttribute('data-background', '1330006');
  await page.reload(); await expect(scene).toHaveAttribute('data-background', '1330006');
  await expect(page.locator('.restaurant-work-loading')).toHaveCount(0);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE), 'primary-save-untouched');

  const mobile = await context.newPage(); observe(mobile);
  await mobile.setViewportSize({width:390,height:844});
  await mobile.clock.install();
  await mobile.goto('http://localhost:5173/?preview=restaurant');
  await expect(mobile.locator('.restaurant-work-stage canvas')).toHaveAttribute('data-loaded-color', 'blue');
  await expect(mobile.locator('.restaurant-work-loading')).toHaveCount(0);
  await mobile.clock.runFor(15500);
  await mobile.screenshot({path: path.join(out, 'mobile.png')});
  for (const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]) {
    await mobile.setViewportSize(viewport);
    await mobile.clock.runFor(100);
    const box = await mobile.locator('.restaurant-work-dialog').boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify({viewport,box}));
    const widths = await mobile.evaluate(() => ({body:document.body.scrollWidth,viewport:innerWidth}));
    assert(widths.body <= widths.viewport);
  }
  await mobile.close();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name:'拉姆餐厅',exact:true})).toHaveCount(0);

  // Main app: keep a real pet, custom potion colour, locked form, inventory,
  // memories and the older restaurant data through entry/exit/reload.
  const primaryContext = await browser.newContext({viewport:{width:1180,height:820}});
  const primary = await primaryContext.newPage(); observe(primary);
  await primary.goto('http://localhost:5173/'); await adopt(primary,'蓝色','紫紫');
  await primary.waitForFunction(key => Boolean(localStorage.getItem(key)), SAVE);
  const before = await primary.evaluate(key => {
    const pet = JSON.parse(localStorage.getItem(key));
    Object.assign(pet,{color:'#9b59d0',growth:180,highestGrowth:180,growthLocked:true,coins:4321});
    pet.restaurant={version:1,xp:0,favor:50,revenue:0,spent:75,served:0,lost:0,interior:1330004,owned:[1330004],staff:1,stock:{1340001:3},mastery:{},stoves:[null,null,null]};
    localStorage.setItem(key,JSON.stringify(pet));
    const memoryKey = `ramu-companion-memory-v1:${pet.createdAt}`;
    const memory = JSON.parse(localStorage.getItem(memoryKey) ?? '{}');
    localStorage.setItem(memoryKey,JSON.stringify({...memory,version:1,petId:String(pet.createdAt),events:[...(memory.events??[]),{id:'restaurant-regression',kind:'test-memory',detail:'餐厅简化前的陪伴记忆',at:pet.createdAt}]}));
    return {createdAt:pet.createdAt,color:pet.color,coins:pet.coins,inventory:pet.inventory,wardrobe:pet.wardrobe,restaurant:pet.restaurant};
  }, SAVE);
  await reloadStoredFixture(primary); await enterHome(primary);
  await primary.getByRole('button',{name:'进入拉姆餐厅',exact:true}).click();
  await expect(primary.locator('.restaurant-work-stage canvas')).toHaveAttribute('data-loaded-color','#9b59d0');
  await expect(primary.locator('.restaurant-work-loading')).toHaveCount(0);
  await primary.screenshot({path:path.join(out,'custom-colour.png')});
  await primary.getByRole('button',{name:'切换餐厅背景',exact:true}).click();
  await primary.getByRole('button',{name:'离开餐厅',exact:true}).click();
  await primary.reload(); await enterHome(primary);
  const saved = await primary.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE);
  for(const field of ['createdAt','color','coins','inventory','wardrobe']) assert.deepEqual(saved[field], before[field], field);
  assert.equal(saved.growthLocked,true); assert.equal(saved.highestGrowth,180);
  assert.equal(saved.restaurant.stock[1340001],3); assert.equal(saved.restaurant.spent,75);
  const memory = await primary.evaluate(at => JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${at}`)),saved.createdAt);
  assert(memory.events.some(event => event.detail === '餐厅简化前的陪伴记忆'));
  await primary.getByRole('button',{name:'进入拉姆餐厅',exact:true}).click();
  await expect(primary.locator('.restaurant-work-stage canvas')).toHaveAttribute('data-background','1330006');
  await primary.keyboard.press('Escape');
  await expect(primary.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toHaveCount(0);
  // Desktop play starts a shift in place; the miniature opens the larger scene.
  await primary.getByRole('button',{name:'回到桌面',exact:true}).click();
  await primary.clock.install();
  const actions = await openActions(primary);
  await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  await primary.getByRole('button',{name:'餐厅打工',exact:true}).click();
  await expect(primary.getByTestId('desktop-restaurant-work')).toBeVisible();
  await expect(primary.locator('.desktop-work-view canvas')).toHaveAttribute('data-loaded-color','#9b59d0');
  await expect(primary.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toHaveCount(0);
  const working = await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)), SAVE);
  assert.equal(working.activity.kind,'restaurant');assert.equal(working.activity.endsAt-working.activity.startedAt,120000);
  await primary.clock.runFor(2200);await expect(primary.locator('.desktop-work-view canvas')).toHaveAttribute('data-phase','deliver');
  await primary.screenshot({path:path.join(out,'desktop-working.png')});
  await primary.getByRole('button',{name:'查看餐厅打工',exact:true}).click();
  await expect(primary.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toBeVisible();
  assert.equal(await primary.getByRole('dialog',{name:'拉姆餐厅',exact:true}).getByRole('button').count(),2);
  assert.equal((await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).activity.id,working.activity.id);
  await primary.getByRole('button',{name:'离开餐厅',exact:true}).click();
  await primary.getByRole('button',{name:'回到桌面',exact:true}).click();
  await expect(primary.getByTestId('desktop-restaurant-work')).toBeVisible();
  await primary.clock.runFor(120100);
  await expect(primary.getByTestId('desktop-restaurant-work')).toHaveCount(0);
  const paid=await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(paid.coins,before.coins+180);assert.equal(paid.activity,undefined);
  await primary.clock.runFor(15000);assert.equal((await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).coins,paid.coins);
  const startAgain=async()=>{const a=await openActions(primary);await a.getByRole('button',{name:'玩耍',exact:true}).click();await primary.getByRole('button',{name:'餐厅打工',exact:true}).click();await expect(primary.getByTestId('desktop-restaurant-work')).toBeVisible();};
  await startAgain();await primaryContext.setOffline(true);await expect(primary.getByTestId('desktop-restaurant-work')).toHaveCount(0);await primaryContext.setOffline(false);
  assert.equal((await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).coins,paid.coins);
  await startAgain();await primary.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(primary.getByTestId('desktop-restaurant-work')).toHaveCount(0);await primary.clock.runFor(130000);
  assert.equal((await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE)).coins,paid.coins);
  await primary.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
  await startAgain();await primary.getByRole('button',{name:'结束餐厅打工',exact:true}).click();await expect(primary.getByTestId('desktop-restaurant-work')).toHaveCount(0);
  await startAgain();await primary.reload();
  const reopened=await primary.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);assert.equal(reopened.activity,undefined);assert.equal(reopened.coins,paid.coins);assert.equal(reopened.color,before.color);
  await primaryContext.close();
  assert.deepEqual(errors,[]); assert.deepEqual(failed,[]);
  const report={passed:true,phases,backgrounds:seen.size,onlyBackgroundAndExitControls:true,backgroundPersists:true,offlineAndHiddenPause:true,mobilePortraitLandscapeAnd320px:true,previewLeavesPrimarySaveUntouched:true,mainPetColourFormWalletInventoryAndOldRestaurantRetained:true,desktopShiftStartsInPlace:true,miniatureOpensRestaurantAndSurvivesModeSwitch:true,onlineShiftPaysOnce:true,offlineHiddenManualAndReloadCancelWithoutPay:true,errors,failed};
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await context.close();
})().catch(error => { console.error(error); process.exitCode=1; }).finally(async()=>{ await browser?.close(); });
