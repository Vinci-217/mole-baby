'use strict';
const {chromium,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {adopt,enterHome,roomTab,applyGrowthSettings}=require('./smoke-helpers.cjs'),{reloadStoredFixture}=require('./smoke-storage.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/original-reading-review'),url=process.env.MOLE_REVIEW_URL||'http://localhost:5173';
fs.mkdirSync(out,{recursive:true});let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium'});
 const page=await browser.newPage({viewport:{width:680,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.addInitScript(()=>localStorage.setItem('reading-preview-sentinel','untouched'));
 await page.goto(url+'/?preview=reading');const grid=page.locator('.reading-preview-grid');
 await expect.poll(async()=>{await page.clock.runFor(32);return grid.locator('.reading-book[data-loaded=true]').count()},{timeout:30000}).toBe(9);
 await expect.poll(async()=>{await page.clock.runFor(32);return grid.locator('.reading-pet-source canvas[data-loaded=true]').count()},{timeout:30000}).toBe(9);
 await page.clock.runFor(1000);await grid.screenshot({path:path.join(out,'reading-all-forms.png')});
 const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
 const gridBounds=await grid.boundingBox(),superBounds=await grid.locator('figure').nth(5).boundingBox();
 await page.getByRole('button',{name:'翻书全程 · 18秒',exact:true}).click();
 const phases=new Set();for(let i=0;i<216;i++){
  await page.clock.runFor(1000/12);(await grid.locator('.reading-book').evaluateAll(ns=>ns.map(n=>n.dataset.pagePhase))).forEach(p=>phases.add(p));
  await grid.screenshot({path:path.join(frames,`${String(i).padStart(4,'0')}.png`)});
 }
 for(const phase of ['opening','reading','turning','closing'])assert(phases.has(phase),phase);
 await page.clock.runFor(150);await expect(grid.locator('.reading-book')).toHaveCount(0);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',path.join(frames,'%04d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-threads','2','-loop','0',path.join(out,'reading-all-forms.gif')],{timeout:60000});
 const crop=`crop=${Math.floor(superBounds.width)}:${Math.floor(superBounds.height)}:${Math.ceil(superBounds.x-gridBounds.x)}:${Math.ceil(superBounds.y-gridBounds.y)},scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`;
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',path.join(frames,'%04d.png'),'-filter_complex_threads','1','-filter_complex',crop,'-threads','2','-loop','0',path.join(out,'reading-super.gif')],{timeout:60000});fs.rmSync(frames,{recursive:true,force:true});
 assert.equal(await page.evaluate(()=>localStorage.getItem('reading-preview-sentinel')),'untouched');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'专注看书 · 循环',exact:true}).click();await page.clock.runFor(8000);
 await expect.poll(()=>grid.locator('.reading-book[data-page-phase=reading]').count()).toBe(9);
 await page.setViewportSize({width:393,height:852});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(out,'reading-phone.png'),fullPage:true});
 console.log('PASS nine forms: original book loads, opening/reading/page turn/closing, finite end, reduced motion and phone layout; preview leaves live save alone.');

 const app=await browser.newPage({viewport:{width:1180,height:820}});app.on('pageerror',e=>errors.push(e.message));
 await app.addInitScript(()=>{window.__liveStorage=window.localStorage});await app.goto(url+'/');await adopt(app,'蓝色','原存档');
 await app.evaluate(()=>{const k='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(k));p.growth=0;p.highestGrowth=0;p.growthLocked=true;localStorage.setItem(k,JSON.stringify(p));localStorage.setItem('debug-sentinel','keep me');localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false,outings:false}));});
 await reloadStoredFixture(app);await enterHome(app);await roomTab(app,'成长');await expect(app.getByRole('button',{name:'切换到初级拉姆',exact:true})).toBeDisabled();
 await app.getByRole('switch',{name:'本地调试',exact:true}).check();
 await expect(app.getByRole('switch',{name:'本地调试',exact:true})).toBeChecked();await enterHome(app);await roomTab(app,'成长');
 const liveBefore=await app.evaluate(()=>Object.fromEntries(Object.entries(window.__liveStorage)));
 for(const name of ['初级拉姆','中级拉姆','高级拉姆','神力拉姆','种子期']){
  await app.getByRole('button',{name:`切换到${name}`,exact:true}).click();await applyGrowthSettings(app,{mode:'fixed'});
  await expect(app.getByRole('button',{name:`切换到${name}`,exact:true})).toHaveAttribute('aria-pressed','true');
 }
 await app.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await applyGrowthSettings(app,{mode:'fixed'});
 for(const name of ['经典超级拉姆','神奇水系拉姆','弹力木系拉姆','霹雳火系拉姆','神力超级拉姆']){
  await app.getByRole('group',{name:'选择神力形态',exact:true}).getByRole('button',{name:`切换为${name}`,exact:true}).click();await applyGrowthSettings(app,{mode:'fixed'});
 }
 assert.deepEqual(await app.evaluate(()=>Object.fromEntries(Object.entries(window.__liveStorage))),liveBefore,'debug changes cannot reach live data');
 await app.screenshot({path:path.join(out,'debug-all-forms.png')});await app.reload();await expect(app.getByRole('switch',{name:'本地调试',exact:true})).toBeChecked();
 await app.getByRole('switch',{name:'本地调试',exact:true}).uncheck();await expect(app.getByRole('switch',{name:'本地调试',exact:true})).not.toBeChecked();
 const restored=await app.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(restored.name,'原存档');assert.equal(restored.growth,0);assert.equal(restored.highestGrowth,0);assert.equal(await app.evaluate(()=>localStorage.getItem('debug-sentinel')),'keep me');
 await enterHome(app);await roomTab(app,'成长');await expect(app.getByRole('button',{name:'切换到初级拉姆',exact:true})).toBeDisabled();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({forms:9,readingPhases:[...phases],reducedMotion:true,mobile:true,debugSandbox:true,allDebugForms:true,debugReload:true,liveSaveRestored:true,errors},null,2)+'\n');
 console.log('PASS local debug: all stages/evolutions unlocked only in sandbox, reload persists test data, live storage stays byte-identical, disabling restores earned-form locks.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
