const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5207';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5207','--strictPort'],{cwd:root,stdio:'pipe'});
let browser,logs='';server.stderr.on('data',s=>logs+=s);
const forms=[['seed',0],['junior',1],['middle',2],['senior',3],['super',4],['water',4],['wood',4],['fire',4]];
const dir=path.join(root,'artifacts/v20-motion');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:340}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');const review=mountComfortReview(forms);window.renderMotion=review.render;window.endCount=review.endCount;},forms);
 const sprites=p.locator('#motion-review .ram-sprite');
 const load=async()=>{await expect.poll(async()=>{await p.clock.runFor(30);return p.locator('#motion-review canvas[data-loaded=true]').count()}).toBe(8);await p.locator('#motion-review img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())))};
 const shot=async name=>p.screenshot({path:path.join(dir,`${name}.png`)});
 if(!process.argv.includes('--record-only')) {
 for(const color of ['red','yellow','blue','pink']){
  await p.evaluate(c=>window.renderMotion('still',c),color);await load();await p.clock.runFor(150);
  const contours=await sprites.locator('canvas').evaluateAll(ns=>ns.map(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return Array.from({length:c.width*c.height},(_,i)=>a[i*4+3]>150)}));
  await p.evaluate(c=>window.renderMotion('sleep',c),color);await load();await p.clock.runFor(300);
  assert.deepEqual(await sprites.locator('canvas').evaluateAll(ns=>ns.map(n=>[n.dataset.sheet||'seed',n.dataset.frame])),[['seed','61'],['grounded','2'],['grounded','2'],...Array(5).fill(['comfort','0'])]);
  const sleeping=await sprites.locator('canvas').evaluateAll(ns=>ns.map(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return Array.from({length:c.width*c.height},(_,i)=>a[i*4+3]>150)}));
  sleeping.forEach((pixels,i)=>{const union=pixels.filter((v,j)=>v||contours[i][j]).length,diff=pixels.filter((v,j)=>v!==contours[i][j]).length;assert.ok(diff/union<.18,`${forms[i][0]} sleep must retain original contour (${diff/union})`)});
  const seed=await sprites.first().locator('.seed-body-original').evaluate(n=>getComputedStyle(n).transform);assert.equal(seed,'matrix(1, 0, 0, 1, 0, 0)','sleep has no head lean');
  const eyeWhites=await sprites.locator('canvas').evaluateAll(ns=>ns.slice(3).map(c=>{const a=c.getContext('2d').getImageData(48,135,96,55).data;let bright=0;for(let i=0;i<a.length;i+=4)if(a[i]>240&&a[i+1]>240&&a[i+2]>240&&a[i+3]>240)bright++;return bright}));assert.ok(eyeWhites.every(n=>n<25),'closed expressions cannot leave white eye rims');
  await shot(`${color}-sleep`);
  await p.evaluate(c=>window.renderMotion('wake',c),color);await load();await p.clock.runFor(650);await shot(`${color}-wake`);await p.clock.runFor(1900);assert.equal(await p.evaluate(()=>window.endCount()),8);
  await p.evaluate(c=>window.renderMotion('pet',c),color);await load();await p.clock.runFor(700);
  assert.deepEqual(await sprites.locator('canvas').evaluateAll(ns=>ns.map(n=>n.dataset.sheet||'seed')),['seed','grounded','grounded',...Array(5).fill('comfort')]);
  const reactions=await sprites.evaluateAll(ns=>ns.map(n=>({angle:parseFloat(n.style.getPropertyValue('--social-angle')),scale:parseFloat(n.style.getPropertyValue('--social-scaleY'))})));
  reactions.forEach((v,i)=>{assert.ok(v.angle>1.5,`${forms[i][0]} follows hand`);assert.ok(v.scale<1,'touch visibly compresses body')});await shot(`${color}-pet`);await p.clock.runFor(1900);assert.equal(await p.evaluate(()=>window.endCount()),8);
  await p.evaluate(c=>window.renderMotion('play',c),color);await load();await p.clock.runFor(1000);
  await expect.poll(async()=>{await p.clock.runFor(16);return sprites.first().evaluate(n=>Number(n.style.getPropertyValue('--social-contact')))}).toBeGreaterThan(.85);
  for(const spark of await p.locator('.social-ball-contact').all())assert.ok(Number(await spark.evaluate(n=>getComputedStyle(n).opacity))>.85);
  await shot(`${color}-ball-contact`);await p.clock.runFor(2700);await shot(`${color}-ball-cheer`);await p.clock.runFor(650);assert.equal(await p.evaluate(()=>window.endCount()),8);
  await p.evaluate(c=>window.renderMotion('focus',c),color);await load();await p.clock.runFor(6500);await shot(`${color}-reading`);
 }
 await p.emulateMedia({reducedMotion:'reduce'});
 for(const action of ['sleep','pet','play','wake']){await p.evaluate(a=>window.renderMotion(a),action);await load();await p.clock.runFor(800);const before=await sprites.locator('canvas').evaluateAll(ns=>ns.map(n=>n.toDataURL()));await p.clock.runFor(150);assert.deepEqual(await sprites.locator('canvas').evaluateAll(ns=>ns.map(n=>n.toDataURL())),before);for(const pose of await p.locator('.ram-pose-layer').all())assert.equal(await pose.evaluate(n=>getComputedStyle(n).transform),'none');}
 assert.deepEqual(errors,[]);
 console.log('PASS 32 form/colour combinations: original closed-eye contour, upright seed sleep, hand-contact response, two ball beats, wake completion, reading and reduced motion');
 }
 // A real-time browser recording, separate from the accelerated assertions.
 const videoPage=await browser.newPage({viewport:{width:1280,height:340},recordVideo:{dir,size:{width:1280,height:340}}});
 await videoPage.goto(url);await videoPage.evaluate(async forms=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.playReview=mountComfortReview(forms).render;},forms);
 for(const [action,duration] of [['idle',700],['pet',2700],['play',4500],['sleep',5000],['wake',2100],['focus',8200]]){await videoPage.evaluate(a=>window.playReview(a),action);await new Promise(r=>setTimeout(r,duration))}
 const video=videoPage.video();await videoPage.close();await video.saveAs(path.join(root,'artifacts/v20-interactions.webm'));console.log('PASS actual-time interaction recording saved');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
