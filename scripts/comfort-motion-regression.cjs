const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const {adopt,openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5207';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5207','--strictPort'],{cwd:root,stdio:'pipe'});
let browser,logs='';server.stderr.on('data',s=>logs+=s);
const forms=[['seed',0],['junior',1],['middle',2],['senior',3],['super',4],['water',4],['wood',4],['fire',4]],dir=path.join(root,'artifacts/v21-motion');fs.mkdirSync(dir,{recursive:true});
const runtime=require('../public/assets/original/football/runtime.json');
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:360}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.review=mountComfortReview(forms);},forms);
 const sprites=p.locator('#motion-review .ram-sprite'),canvases=sprites.locator('canvas:not(.ram-wear)');
 const load=async()=>{await expect.poll(async()=>{await p.clock.runFor(30);return p.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:30000}).toBe(8);await p.locator('#motion-review img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())))};
 const shot=async name=>p.screenshot({path:path.join(dir,name+'.png')});
 if(!process.argv.includes('--record-only')){
 for(const color of ['red','yellow','blue','pink']){
  await p.evaluate(c=>window.review.render('sleep',c),color);await load();await p.clock.fastForward(8800);await p.clock.runFor(40);
  await expect(p.locator('.ram-sleep-particles>img')).toHaveCount(24);assert.deepEqual(await canvases.evaluateAll(ns=>ns.map(c=>c.dataset.sheet)),Array(8).fill('slumber'));
  const closed=await canvases.evaluateAll(ns=>ns.map(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {alpha:Array.from(a).filter((_,i)=>i%4===3),pixels:Array.from(a)}}));
  await shot(`${color}-sleep-closed`);await p.clock.fastForward(2750);await p.clock.runFor(20);
  const opened=await canvases.evaluateAll(ns=>ns.map(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {alpha:Array.from(a).filter((_,i)=>i%4===3),pixels:Array.from(a)}}));
  for(let i=0;i<8;i++){assert.deepEqual(opened[i].alpha,closed[i].alpha,`${forms[i][0]} mouth stays INSIDE the unchanged body`);assert.notDeepEqual(opened[i].pixels,closed[i].pixels,`${forms[i][0]} mouth visibly opens`)}
  assert.equal(await sprites.first().locator('.seed-body-original').evaluate(n=>getComputedStyle(n).transform),'matrix(1, 0, 0, 1, 0, 0)');
  const z=await p.locator('.ram-sleep-particles>img').first().evaluate(n=>{const a=n.getAnimations()[0];a.pause();a.currentTime=3200;const from=getComputedStyle(n).transform;a.currentTime=8750;return {from,to:getComputedStyle(n).transform,opacity:Number(getComputedStyle(n).opacity)}});assert.notEqual(z.from,z.to);assert.ok(z.opacity<.1);await shot(`${color}-sleep-open`);
  await p.evaluate(c=>window.review.render('pet',c),color);await load();await p.clock.fastForward(750);await p.clock.runFor(30);
  assert.deepEqual(await canvases.evaluateAll(ns=>ns.map(c=>c.dataset.sheet)),['seed','grounded','grounded',...Array(5).fill('classic')]);
  for(const canvas of await canvases.all()){const white=await canvas.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]>240&&a[i+1]>240&&a[i+2]>240&&a[i+3]>220)n++;return n});assert.ok(white>20,'affection keeps normal large white eyes')}
  await shot(`${color}-pet`);await p.clock.fastForward(2000);await p.clock.runFor(30);assert.equal(await p.evaluate(()=>window.review.endCount()),8);
  await p.evaluate(c=>window.review.render('play',c),color);await load();await expect(p.locator('.ram-football-frame')).toHaveCount(7);await expect(p.locator('.social-ball')).toHaveCount(1);
  await p.clock.fastForward(700);await p.clock.runFor(30);const before=await p.locator('.ram-football-frame').evaluateAll(ns=>ns.map(n=>Number(n.dataset.sourceFrame)));
  await p.evaluate(()=>window.review.refresh({dragging:true}));await p.clock.runFor(100);await p.evaluate(()=>window.review.refresh({dragging:false}));await load();await p.clock.runFor(70);
  const resumed=await p.locator('.ram-football-frame').evaluateAll(ns=>ns.map(n=>Number(n.dataset.sourceFrame)));resumed.forEach((f,i)=>assert.ok(f>before[i],'a drag/re-render does not restart the source timeline'));
  for(const target of [1600,2300,3400,5000,5900,7400,11000]){
   const current=Number(await p.locator('.ram-football-frame').first().getAttribute('data-source-frame'))/24*1000;await p.clock.fastForward(Math.max(0,target-current));await p.clock.runFor(25);
   if([2300,3400,5900].includes(target))await shot(`${color}-football-${target}`);
  }
  assert.equal(await p.evaluate(()=>window.review.endCount()),8);
  for(const sprite of await sprites.all()){const box=await sprite.boundingBox();assert.equal(Math.round(box.width),100)}
 }
 await p.emulateMedia({reducedMotion:'reduce'});
 for(const action of ['sleep','pet','play']){await p.evaluate(a=>window.review.render(a),action);await load();await p.clock.runFor(50);const a=await canvases.evaluateAll(ns=>ns.map(c=>c.toDataURL()));await p.clock.fastForward(1000);await p.clock.runFor(30);assert.deepEqual(await canvases.evaluateAll(ns=>ns.map(c=>c.toDataURL())),a)}
 assert.deepEqual(errors,[]);console.log('PASS 32 forms/colours: mouth-only sleep breathing, rising original Z, normal-eye affection, original body/ball timeline, drag continuity and reduced motion');
 // Actual application callbacks must finish from the source clock, before its
 // separate loading-error watchdog, with the 100px desktop character preserved.
 const app=await browser.newPage({viewport:{width:1180,height:820}});app.on('pageerror',e=>errors.push(e.message));await app.clock.install();await app.goto(url);await adopt(app,'红色','小芽');await app.clock.pauseAt(new Date(Date.now()+1000));
 for(const [form,growth] of [['seed',0],['junior',60],['middle',180],['super',840]]){
  await app.evaluate(({form,growth})=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(pet,{growth,sleeping:false,lastTick:Date.now(),stats:{hunger:90,thirst:90,cleanliness:90,happiness:90,health:100,energy:100}});delete pet.evolution;if(growth===840)pet.evolution=form;localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}));},{form,growth});await app.reload();const ram=app.getByTestId('desktop-character').locator('.ram-sprite');
  await expect.poll(async()=>{await app.clock.runFor(40);return ram.locator('canvas:not(.ram-wear)[data-loaded=true]').count()}).toBe(1);await openActions(app);await app.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await app.getByRole('button',{name:'一起玩球',exact:true}).click();
  await expect.poll(async()=>{await app.clock.runFor(30);return ram.locator('canvas:not(.ram-wear)[data-loaded=true]').count()}).toBe(1);
  const duration=form==='seed'?4200:runtime.forms[form].frameCount/24*1000;
  await app.clock.fastForward(duration-80);await app.clock.runFor(250);await expect(ram).toHaveAttribute('data-action','idle');assert.equal(Math.round((await app.getByTestId('desktop-character').boundingBox()).width),100);
 }
 await app.close();assert.deepEqual(errors,[]);console.log('PASS actual seed/junior/middle/super UI finishes complete performances via source callbacks before the watchdog');
 }
 if(process.argv.includes('--checks-only'))return;
 const videoPage=await browser.newPage({viewport:{width:1280,height:360},recordVideo:{dir,size:{width:1280,height:360}}});await videoPage.goto(url);await videoPage.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.review=mountComfortReview(forms);window.review.render('idle');},forms);await expect(videoPage.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(8,{timeout:30000});
 for(const [action,duration] of [['pet',2800],['sleep',6800],['wake',2100],['play',11200]]){await videoPage.evaluate(a=>window.review.render(a),action);await expect(videoPage.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(8,{timeout:30000});await new Promise(r=>setTimeout(r,duration))}
 const video=videoPage.video();await videoPage.close();await video.saveAs(path.join(root,'artifacts/v21-original-actions.webm'));console.log('PASS actual-time original football, mouth breathing and large-eye affection recording saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
