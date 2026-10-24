const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {chromium,expect}=require('@playwright/test');
const {adopt,openActions,enterHome,roomTab,toDesktop,selectPocket,buy}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5200';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5200','--strictPort'],{cwd:root,stdio:'pipe'});let browser,logs='';server.stderr.on('data',d=>logs+=d);
const colors={red:'红色',yellow:'黄色',blue:'蓝色',pink:'粉色'},forms=[['seed',0],['junior',60],['middle',180],['senior',420],['super',840],['water',840],['wood',840],['fire',840]];
async function tint(p){return p.getByTestId('desktop-character').locator('canvas:not(.ram-wear)').evaluate(async c=>{
 const form=c.dataset.form,seed=form==='seed',cw=seed?96:192,ch=seed?99:208,frame=Number(c.dataset.frame),row=seed?Math.floor(frame/8):Number(c.dataset.row),column=seed?frame%8:frame;
 const sheet=c.dataset.sheet||'classic',src=seed?'./assets/original/seed/body-mask.png':sheet==='grounded'?`./assets/original/grounded/${form}-mask.png`:sheet==='item'?`./assets/original/item-motion/${form}-mask.png`:sheet==='care'?`./assets/original/care/${form}-mask.png`:`./assets/classic/${form}-mask.png`;
 window.__v14Masks??={};let im=window.__v14Masks[src];if(!im){im=new Image();im.src=src;await im.decode();window.__v14Masks[src]=im;}
 const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;canvas.getContext('2d').drawImage(im,column*cw,row*ch,cw,ch,0,0,cw,ch);
 const mask=canvas.getContext('2d').getImageData(0,0,cw,ch).data,pixels=c.getContext('2d').getImageData(0,0,cw,ch).data;let count=0,r=0,g=0,b=0;
 for(let i=0;i<mask.length;i+=4)if(mask[i]+mask[i+1]+mask[i+2]>120&&pixels[i+3]>190){count++;r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];}
 return {count,r:r/count,g:g/count,b:b/count};
});}
function matches(v,color){assert.ok(v.count>300,JSON.stringify(v));return color==='red'?v.r>v.g+70&&v.r>v.b+100:color==='blue'?v.b>v.r+70&&v.g>v.r+50:color==='yellow'?v.r>150&&v.g>150&&v.b<90:v.r>v.g+70&&v.b>v.g+70;}
async function usePotion(p,color){await openActions(p);await p.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();await p.locator('.pocket-categories').getByRole('button',{name:'药水',exact:true}).click();await(await selectPocket(p,`recolor-${color}`,`${colors[color]}换色药水`)).click();await expect(p.locator('[data-item-gesture=recolor]')).toBeVisible();await p.getByRole('button',{name:'关闭小窗',exact:true}).click();}
(async()=>{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await adopt(p,'红色','红豆');
 await enterHome(p);await buy(p,'recolor-blue','蓝色换色药水','药水');await expect(p.locator('.book-products .book-product[data-item-id]')).toHaveCount(5);for(const image of await p.locator('.book-products img').all())await image.evaluate(n=>n.decode());
 await toDesktop(p);await p.clock.pauseAt(new Date(Date.now()+1000));await usePotion(p,'blue');await p.clock.runFor(400);assert.ok(matches(await tint(p),'red'),'before the sip the source body remains red');await p.clock.runFor(1500);assert.ok(matches(await tint(p),'blue'),'body tint changes after sipping');await p.clock.runFor(1000);
 let state=await p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(state.coins,20);assert.equal(state.color,'blue');assert.equal(state.inventory['recolor-blue'],0);await p.reload();await p.clock.runFor(100);await expect(p.locator('.desktop-character .ram-sprite')).toHaveAttribute('data-color','blue');
 console.log('PASS real bean purchase, bottle consumption, delayed original-body tint transition and restart persistence');
 const dir=path.join(root,'artifacts/v14-review');fs.mkdirSync(dir,{recursive:true});
 for(const [form,growth] of forms)for(const color of Object.keys(colors)){
  await p.evaluate(({form,growth,color})=>{const x=JSON.parse(localStorage.getItem('ramu-house-save-v1'));x.color=color==='red'?'blue':'red';x.growth=growth;delete x.evolution;if(growth===840)x.evolution=form;x.sleeping=false;x.stats={hunger:100,thirst:100,happiness:100,cleanliness:100,health:100,energy:100};x.lastTick=Date.now();for(const c of ['red','yellow','blue','pink'])x.inventory[`recolor-${c}`]=2;localStorage.setItem('ramu-house-save-v1',JSON.stringify(x));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false}));},{form,growth,color});
  await p.reload();await usePotion(p,color);await p.clock.runFor(1950);assert.ok(matches(await tint(p),color),`${form}/${color} must use the real body-only palette`);await p.clock.runFor(1000);
  const character=p.getByTestId('desktop-character'),ram=character.locator('.ram-sprite');await expect(ram).toHaveAttribute('data-color',color);assert.equal(await ram.locator('[data-fallback]').count(),0);
  if(growth>=420){await expect(ram).toHaveClass(/is-flying/);await ram.locator('.ram-flight-layer').evaluate(n=>{window.__v14Flight=n.getAnimations()[0];});}
  await character.click();await p.clock.runFor(650);await expect(ram.locator('.social-hand')).toBeVisible();
  if(growth>=420){await expect(ram.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-row','0');assert.equal(await ram.locator('.ram-flight-layer').evaluate(n=>n.getAnimations()[0]===window.__v14Flight),true);const movement=await ram.locator('.ram-flight-layer').evaluate(n=>{const a=n.getAnimations()[0];a.currentTime=0;const x=getComputedStyle(n).transform;a.currentTime=1600;const y=getComputedStyle(n).transform;return [x,y]});assert.notEqual(...movement);}
  await p.locator('.desktop-pet').screenshot({path:path.join(dir,`${form}-${color}.png`)});await p.clock.runFor(2600);
 }
 const review=await browser.newPage({viewport:{width:1280,height:1040}});await review.goto(url);await review.setContent(`<style>body{margin:0;background:#edf1f3;font:12px sans-serif}main{display:grid;grid-template-columns:repeat(8,160px)}figure{margin:0}img{width:160px;height:240px}figcaption{text-align:center;height:20px;color:#765431}</style><main>${Object.keys(colors).flatMap(color=>forms.map(([form])=>`<figure><img src="${url}/artifacts/v14-review/${form}-${color}.png"><figcaption>${form} · ${color}</figcaption></figure>`)).join('')}</main>`);await review.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));await review.screenshot({path:path.join(root,'artifacts/v14-flight-colors.png')});
 assert.deepEqual(errors,[]);console.log('PASS 32 original form/colour potion animations, body-mask pixel checks, continuous flight during affection and no renderer errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM');});
