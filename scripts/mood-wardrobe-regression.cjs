const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const {adopt,enterHome,verifyMoodWardrobe}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5212',dir=path.join(root,'artifacts/v22-review');fs.mkdirSync(dir,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5212','--strictPort'],{cwd:root,stdio:'pipe'});let browser,logs='';server.stderr.on('data',s=>logs+=s);
const forms=[['seed',0],['junior',1],['middle',2],['senior',3],['super',4],['water',4],['wood',4],['fire',4]];
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:360}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.review=mountComfortReview(forms)},forms);
 const load=async()=>{await expect.poll(async()=>{await p.clock.runFor(30);return p.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:30000}).toBe(8);await p.locator('#motion-review img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())))};
 const render=async(action,color='red',costume)=>{await p.evaluate(({action,color,costume})=>{window.review.render(action,color);window.review.refresh({costume})},{action,color,costume});await load()};
 if(!process.argv.includes('--app-only')){
 for(const color of ['red','yellow','blue','pink']){
  for(const action of ['mood-joy','mood-grumpy','mood-content','mood-dozy','sleep']){
   await render(action,color);await p.clock.runFor(action==='sleep'?2750:800);
   const canvas=p.locator('#motion-review canvas:not(.ram-wear)');await expect(p.locator('#motion-review [data-fallback=true]')).toHaveCount(0);
   if(action==='sleep'){await expect(p.locator('.ram-sleep-particles>img')).toHaveCount(24);const styles=await p.locator('.ram-sleep-particles>img').first().evaluate(n=>({width:parseFloat(getComputedStyle(n).width),duration:getComputedStyle(n).animationDuration}));assert.ok(styles.width<=10);assert.equal(styles.duration,'6.4s')}
   if(action==='mood-joy'||action==='mood-grumpy'){assert.equal(await p.locator('.ram-emotion-frame').count(),7);const before=await canvas.evaluateAll(ns=>ns.map(n=>n.dataset.frame));await p.clock.runFor(160);assert.notDeepEqual(await canvas.evaluateAll(ns=>ns.map(n=>n.dataset.frame)),before)}
   await p.screenshot({path:path.join(dir,`${color}-${action}.png`)});
   if(action!=='sleep'){await p.clock.fastForward(5000);await p.clock.runFor(50);assert.equal(await p.evaluate(()=>window.review.endCount()),8)}
  }
  await render('still',color);const base=await p.locator('#motion-review canvas:not(.ram-wear)').evaluateAll(ns=>ns.map(n=>n.toDataURL()));
  for(const costume of ['party-cap','gold-feather','wizard-cap']){
   await p.evaluate(c=>window.review.refresh({costume:c}),costume);await p.clock.runFor(80);await expect.poll(async()=>{await p.clock.runFor(30);return p.locator('#motion-review .ram-wear[data-loaded=true]').count()},{timeout:30000}).toBe(8);
   await expect(p.locator('#motion-review .ram-wear')).toHaveCount(8);
   for(const image of await p.locator('#motion-review .ram-wear').all()){await expect(image).toBeVisible();const b=await image.boundingBox();assert.ok(b.width>4&&b.height>4)}
   if(costume!=='wizard-cap')assert.deepEqual(await p.locator('#motion-review canvas:not(.ram-wear)').evaluateAll(ns=>ns.map(n=>n.toDataURL())),base,'simple accessories never change the body or its adoption colour');
   await p.screenshot({path:path.join(dir,`${color}-${costume}.png`)});
  }
  await render('play',color,'wizard-cap');await p.clock.runFor(1000);const first=await p.locator('.ram-football-frame+.ram-wear').evaluateAll(ns=>ns.map(n=>n.toDataURL()));await p.clock.runFor(2400);const next=await p.locator('.ram-football-frame+.ram-wear').evaluateAll(ns=>ns.map(n=>n.toDataURL()));assert.ok(next.filter((n,i)=>n!==first[i]).length>=4,'hats follow squash and jump in original football poses');await p.screenshot({path:path.join(dir,`${color}-football-wear.png`)});
 }
 await p.emulateMedia({reducedMotion:'reduce'});
 for(const action of ['mood-joy','mood-grumpy','mood-content','mood-dozy','sleep']){await render(action,'blue','party-cap');await p.clock.runFor(50);const before=await p.locator('#motion-review canvas:not(.ram-wear)').evaluateAll(ns=>ns.map(n=>n.toDataURL()));await p.clock.runFor(1000);assert.deepEqual(await p.locator('#motion-review canvas:not(.ram-wear)').evaluateAll(ns=>ns.map(n=>n.toDataURL())),before)}
 console.log('PASS 32 forms/colours: refined sleeping, four finite mood gestures, 96 accessory fits, unchanged original bodies, original-football tracking and reduced motion');
 }
 const app=await browser.newPage({viewport:{width:1180,height:820}});app.on('pageerror',e=>errors.push(e.message));await app.goto(url);await adopt(app,'蓝色','小叶');await verifyMoodWardrobe(app);
 await enterHome(app);await app.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();await app.locator('.wardrobe').getByRole('button',{name:'试戴紫色魔法帽',exact:true}).click();await expect(app.locator('.wardrobe-mirror .ram-wear')).toBeVisible();const checkBuy=async()=>{const button=app.locator('.wardrobe-choice button'),paper=app.locator('.panel-paper');const b=await button.boundingBox(),a=await paper.boundingBox();assert.ok(b.y+b.height<=a.y+a.height,'purchase remains fully inside the visible panel')};await checkBuy();await app.screenshot({path:path.join(root,'artifacts/v22-wardrobe.png')});
 await app.setViewportSize({width:1000,height:720});await checkBuy();await app.screenshot({path:path.join(dir,'wardrobe-1000.png')});await app.close();assert.deepEqual(errors,[]);
 const videoPage=await browser.newPage({viewport:{width:1280,height:360},recordVideo:{dir,size:{width:1280,height:360}}});await videoPage.goto(url);await videoPage.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.review=mountComfortReview(forms);window.review.render('sleep')},forms);await expect(videoPage.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(8,{timeout:30000});
 for(const [action,duration,costume] of [['sleep',6800],['mood-joy',4200],['mood-grumpy',3200],['mood-content',3900],['mood-dozy',4600],['idle',2300,'wizard-cap'],['play',11200,'wizard-cap']]){await videoPage.evaluate(({action,costume})=>{window.review.render(action);window.review.refresh({costume})},{action,costume});await expect(videoPage.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(8,{timeout:30000});await new Promise(r=>setTimeout(r,duration))}
 const video=videoPage.video();await videoPage.close();await video.saveAs(path.join(root,'artifacts/v22-moods-wardrobe.webm'));console.log('PASS actual-time mood, sleep and original wardrobe recording saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
