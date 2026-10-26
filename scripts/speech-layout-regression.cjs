const {chromium,expect}=require('@playwright/test'),{spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {adopt,enterHome}=require('./smoke-helpers.cjs'),root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5237';let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5237','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width:1180,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.evaluate(()=>localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({presence:false,lively:false,sound:false,reminders:false})));await p.reload();await adopt(p,'红色','小芽');await enterHome(p);await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
 for(const [stage,growth,evolution]of [[0,0,null],[1,60,null],[2,180,null],[3,420,null],[4,840,'super']]){
  console.log('Checking stage',stage);
  if(stage){await p.evaluate(({growth,evolution})=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(pet,{growth,sleeping:false,lastTick:Date.now()});delete pet.evolution;if(evolution)pet.evolution=evolution;localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet))},{growth,evolution});await p.reload();await enterHome(p)}
  await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('.scene-character canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:30000}).toBe(1).catch(async error=>{console.log(await p.locator('.scene-character').evaluateAll(ns=>ns.map(n=>n.outerHTML)));console.log(errors);throw error});
  await p.locator('.scene-character').click();await p.clock.runFor(300);const b=p.locator('.scene-bubble');await expect(b).toBeVisible();
  const bubble=await b.boundingBox(),pet=await p.locator('.scene-character').boundingBox();assert.ok(bubble.y+bubble.height<pet.y,`stage ${stage}: speech must not cover the pet: ${JSON.stringify({bubble,pet})}`);assert.ok(bubble.y>=0&&bubble.x>=0&&bubble.x+bubble.width<=1180);
  assert.equal(await p.locator('.classic-toast').count(),0,'No duplicate bottom popup');
  if(stage===0)await p.screenshot({path:path.join(root,'artifacts/animation-gallery/speech-fixed.png')});
  await p.clock.runFor(6800);await expect(b).toHaveCount(0);assert.equal(await p.locator('.scene-bubble[disabled]').count(),0,'No disabled half-visible speech remnant');
 }
 assert.deepEqual(errors,[]);console.log('PASS: five stages, non-overlapping speech, expiry removes DOM, no bottom duplicate popup, zero browser errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
