'use strict';
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict');
const {adopt,enterHome}=require('./smoke-helpers.cjs'),{reloadStoredFixture}=require('./smoke-storage.cjs');
const origin=process.env.MOLE_REVIEW_URL||'http://localhost:5173';let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium'});
 for(const viewport of [{width:1180,height:820},{width:393,height:852},{width:852,height:393}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto(origin);await adopt(page);
  await page.evaluate(()=>{
   const k='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(k));Object.assign(p,{growth:180,highestGrowth:180,growthLocked:true,lastTick:Date.now(),room:{owned:['message-board'],placed:[{id:'message-board',x:82,y:72}]}});
   localStorage.setItem(k,JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({roomWander:true,lively:false,presence:false,sound:false,outings:false}));
  });
  await reloadStoredFixture(page);await page.evaluate(()=>{Math.random=()=>0});await enterHome(page);
  const board=page.getByRole('button',{name:'小屋留言板',exact:true}),b=await board.boundingBox();
  const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.className,{x:b.x+b.width/2,y:b.y+b.height*.6});
  await page.mouse.click(b.x+b.width/2,b.y+b.height*.6);
  const dialog=page.getByRole('dialog',{name:'小屋留言板',exact:true});
  if(process.argv.includes('--reproduce')){console.log(JSON.stringify({viewport,boardOpened:await dialog.isVisible(),hit}));await page.close();continue}
  await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  const overlap=await board.evaluate(button=>{
   const pet=document.querySelector('.scene-character'),host=document.querySelector('.room-furnishing-layer'),r=pet.getBoundingClientRect(),layer=host.getBoundingClientRect();
   const point=[[.04,.04],[.96,.04],[.04,.96],[.96,.96]].map(([x,y])=>({x:r.x+r.width*x,y:r.y+r.height*y})).find(p=>{
    if(!document.elementFromPoint(p.x,p.y)?.closest('.scene-character'))return false;
    return [...pet.querySelectorAll('canvas.ram-classic-frame,canvas.seed-body-frame')].every(c=>{const b=c.getBoundingClientRect(),x=Math.floor((p.x-b.x)/b.width*c.width),y=Math.floor((p.y-b.y)/b.height*c.height);return x<0||y<0||x>=c.width||y>=c.height||c.getContext('2d').getImageData(x,y,1,1).data[3]<32});
   });
   if(!point)throw Error('No transparent pet corner available for overlap test');
   const piece=button.parentElement,style=piece.style.cssText,height=button.getBoundingClientRect().height;
   piece.style.left=`${point.x-layer.x}px`;piece.style.top=`${point.y-layer.y+height*.4}px`;
   return {point,style};
  });
  await page.mouse.click(overlap.point.x,overlap.point.y);await expect(dialog).toBeVisible();await page.keyboard.press('Escape');
  await board.evaluate((button,style)=>{button.parentElement.style.cssText=style},overlap.style);
  const scene=await page.locator('.room-walker').boundingBox(),floor=page.getByRole('button',{name:'小屋地面，点击让拉姆走过去',exact:true}),position=page.locator('.room-pet-position');
  const point=()=>position.evaluate(n=>({x:n.dataset.x,y:n.dataset.y}));
  const start=await point();await page.mouse.click(scene.x+scene.width*.35,scene.y+scene.height*.25);await page.clock.runFor(300);
  assert.deepEqual(await point(),start,'upper wall clicks cannot move the pet');
  const f=await floor.boundingBox();assert(f.y-scene.y>=scene.height*.5-1,'walkable floor starts below the upper half');
  await floor.click({position:{x:25,y:Math.min(25,f.height-2)}});await page.clock.runFor(7000);
  assert(Number((await point()).y)>=scene.height*.5,'manual travel stays on the lower floor');assert.notDeepEqual(await point(),start,'uncovered floor remains clickable');
  await page.clock.runFor(13000);assert(Number((await point()).y)>=scene.height*.5,'random travel stays on the lower floor');
  await page.evaluate(()=>{const k='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(k));p.growth=0;delete p.evolution;p.lastTick=Date.now();localStorage.setItem(k,JSON.stringify(p))});
  await reloadStoredFixture(page);await enterHome(page);await expect(floor).toBeDisabled();
  const seed=await point();await page.mouse.click(scene.x+scene.width*.3,scene.y+scene.height*.65);await page.clock.runFor(30000);
  assert.deepEqual(await point(),seed,'a seed cannot walk manually or randomly');
  await board.click();await expect(dialog).toBeVisible();assert.deepEqual(errors,[]);
  console.log('PASS furniture beats floor clicks, lower-floor manual/random travel, and stationary seed:',viewport);await page.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
