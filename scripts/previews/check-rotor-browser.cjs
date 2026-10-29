/** Real pointer input against the standalone review, not the shipping app. */
const {chromium}=require('@playwright/test');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/previews/rotor-throw');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1020,height:680}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
  // Cloud Chromium disallows file: navigation. Render our own self-contained
  // HTML directly; do not change browser policy or require a remote server.
  await page.setContent(fs.readFileSync(path.join(out,'interactive.html'),'utf8'));
  await page.waitForFunction(()=>window.rotorReview?.getState().ready);
  const state=()=>page.evaluate(()=>window.rotorReview.getState());
  const box=await page.locator('canvas').boundingBox();
  const mousePoint=p=>({x:box.x+p.x/900*box.width,y:box.y+p.y/330*box.height});
  const start=await state(),p=mousePoint(start.position);await page.mouse.move(p.x,p.y);await page.mouse.down();
  for(let i=1;i<=8;i++){await page.mouse.move(p.x+i*18,p.y);await page.waitForTimeout(25)}
  const fast=await state();assert.equal(fast.held,true);assert.ok(fast.rate>start.rate*1.7,'Fast real-pointer movement must accelerate playback');
  for(let i=1;i<=8;i++){await page.mouse.move(p.x+144-i*24,p.y);await page.waitForTimeout(25)}
  const reversed=await state();assert.ok(reversed.phase>fast.phase,'Reversing mouse motion must advance the same source clock');assert.ok(reversed.rate>start.rate*1.7);
  await page.mouse.up();const released=await state();await page.waitForTimeout(150);const coast=await state();
  assert.ok(coast.position.x<released.position.x-3,'Release must move the actual sprite in the preview');assert.ok(coast.phase>released.phase);
  await page.waitForTimeout(1700);const settled=await state();assert.ok(settled.rate<reversed.rate);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);const reduced1=await state();await page.waitForTimeout(120);const reduced2=await state();
  assert.equal(reduced1.sourceFrame,3);assert.equal(reduced2.sourceFrame,3);assert.equal(reduced1.phase,reduced2.phase);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#reset').click();await page.waitForTimeout(80);
  await page.screenshot({path:path.join(out,'interactive-preview.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'Standalone review must not need network access');
  const receipt={reviewOnly:true,engine:'headless Chromium, standalone HTML via setContent (file navigation blocked by cloud browser policy)',realMouseInput:true,fastPointerIncreasesRate:true,
   reversalKeepsForwardPhase:true,releaseCoastsAndKeepsRotorPhase:true,reducedMotionFreezesAtSourceFrame3:true,networkRequests:0,pageErrors:errors,
   measurements:{start,fast,reversed,released,coast,settled}};
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('PASS real mouse drag: acceleration, reversal continuity, release inertia, slowing, reduced motion and offline page');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
