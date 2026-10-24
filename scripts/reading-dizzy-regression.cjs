const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {chromium,expect}=require('@playwright/test');
const {adopt,openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5198';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5198','--strictPort'],{cwd:root,stdio:'pipe'});let browser,logs='';server.stderr.on('data',d=>logs+=d);
(async()=>{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.goto(url);await adopt(p,'红色','红豆');const dir=path.join(root,'artifacts/v12-review');fs.mkdirSync(dir,{recursive:true});
 const forms=[['seed',0],['junior',60],['middle',180],['senior',420],['super',840],['water',840],['wood',840],['fire',840]];
 for(const [form,growth] of forms){
  await p.evaluate(({form,growth})=>{const x=JSON.parse(localStorage.getItem('ramu-house-save-v1'));x.growth=growth;delete x.evolution;if(growth===840)x.evolution=form;x.lastTick=Date.now();x.sleeping=false;x.stats={hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90};localStorage.setItem('ramu-house-save-v1',JSON.stringify(x));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false}));},{form,growth});
  await p.reload();const character=p.getByTestId('desktop-character'),ram=character.locator('.ram-sprite');await ram.locator('canvas:not(.ram-wear)[data-loaded=true]').waitFor();await openActions(p);
  await p.getByRole('button',{name:'开始计时',exact:true}).click();await p.clock.runFor(6450);
  const turning=ram.locator('.social-book-page');await expect(turning).toBeVisible();assert.ok(Number(await turning.evaluate(n=>getComputedStyle(n).opacity))>.6);
  assert.ok((await turning.evaluate(n=>getComputedStyle(n).transform)).startsWith('matrix3d'));await turning.locator('img').evaluate(n=>n.decode());
  assert.ok(parseFloat(await ram.evaluate(n=>n.style.getPropertyValue('--social-readTilt')))>4);
  await p.locator('.desktop-pet').screenshot({path:path.join(dir,`${form}-reading.png`)});await p.getByRole('button',{name:'取消计时',exact:true}).click();
  for(let n=0;n<5;n++)await character.click();await p.clock.runFor(450);
  const stars=ram.locator('.social-dizzy-stars>i');await expect(stars).toHaveCount(3);await stars.first().locator('img').evaluate(n=>n.decode());
  const before=await stars.evaluateAll(ns=>ns.map(n=>({left:n.style.left,top:parseFloat(n.style.top)})));assert.ok(Math.max(...before.map(v=>v.top))-Math.min(...before.map(v=>v.top))<7);
  await p.locator('.desktop-pet').screenshot({path:path.join(dir,`${form}-dizzy.png`)});await p.clock.runFor(350);const after=await stars.evaluateAll(ns=>ns.map(n=>n.style.left));assert.notDeepEqual(before.map(v=>v.left),after);
  await p.clock.runFor(3000);await expect(stars).toHaveCount(0);
 }
 const review=await browser.newPage({viewport:{width:1600,height:530}});await review.goto(url);await review.setContent(`<style>body{margin:0;background:#edf1f3;font:12px sans-serif}main{display:grid;grid-template-columns:repeat(8,200px)}figure{margin:0}img{width:200px;height:240px}figcaption{text-align:center;height:25px;color:#765431}</style><main>${['reading','dizzy'].flatMap(kind=>forms.map(([form])=>`<figure><img src="${url}/artifacts/v12-review/${form}-${kind}.png"><figcaption>${form} · ${kind}</figcaption></figure>`)).join('')}</main>`);
 await review.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));await review.screenshot({path:path.join(root,'artifacts/v12-reading-dizzy.png')});assert.deepEqual(errors,[]);
 console.log('PASS all eight original forms: lowered reading pose, separate hinged page turns, three independently orbiting head stars with depth and clean gesture completion');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill('SIGTERM');});
