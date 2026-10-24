const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {chromium,expect}=require('@playwright/test');
const {adopt,openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5195';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5195','--strictPort'],{cwd:root,stdio:'pipe'});let browser,logs='';server.stderr.on('data',d=>logs+=d);
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:1180,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto(url);await adopt(page,'红色','红豆');
 const cases=[['seed',0],['junior',60],['middle',180],['senior',420],['super',840],['water',840],['wood',840],['fire',840]];
 const ram=page.getByTestId('desktop-character').locator('.ram-sprite');const shots=path.join(root,'artifacts/v9-motion-review');fs.mkdirSync(shots,{recursive:true});
 for(const [form,growth] of cases){
  await page.evaluate(({form,growth})=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=growth;p.lastTick=Date.now();p.sleeping=false;p.stats={hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90};delete p.evolution;if(growth===840)p.evolution=form;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,reminders:true,reminderMinutes:40}));},{form,growth});
  await page.reload();await ram.locator('canvas:not(.ram-wear)[data-loaded=true]').waitFor({timeout:15000});
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  for(const [action,button,wait] of [['play','一起玩球',1000],['pet','摸摸拉姆',700],['focus','陪我专注',450]]){
   await page.getByRole('button',{name:button,exact:true}).click();await page.clock.runFor(wait);
   const originalBall=action==='play'&&form!=='seed';
   if(originalBall)await expect(ram.locator('canvas[data-sheet=football]')).toHaveAttribute('data-loaded','true');
   else {await expect(ram.locator(`[data-social-action=${action}]`)).toBeVisible();const state=await ram.evaluate(n=>({opacity:Number(n.style.getPropertyValue('--social-opacity')),stage:n.dataset.stage}));assert.ok(state.opacity>.8,`${form}/${action} visible opacity`);}
   const prop=ram.locator(originalBall?'.ram-football-frame':action==='play'?'.social-ball':action==='pet'?'.social-hand':'.social-book>img').first();const box=await prop.boundingBox();assert.ok(box.width>=20&&box.height>=10,'actual action has visible desktop dimensions');
   if(!originalBall)await prop.evaluate(n=>n.decode());await page.locator('.desktop-pet').screenshot({path:path.join(shots,`${form}-${action}.png`)});
   if(action==='focus'){await page.getByRole('button',{name:'结束专注',exact:true}).click();}else await page.clock.fastForward(4500);
  }
  if(form==='seed'){await page.getByTestId('companion-panel').getByRole('tab',{name:'背包',exact:true}).click();const slots=page.locator('.pocket-slot');assert.equal(await slots.count(),16);for(const slot of await slots.all()){const b=await slot.boundingBox();assert.ok(Math.abs(b.width-b.height)<1);}await page.screenshot({path:path.join(root,'artifacts/v9-square-backpack.png')});await page.getByRole('button',{name:'关闭小窗',exact:true}).click();}
 }
 assert.deepEqual(errors,[]);console.log('PASS eight original forms × three visible prop animations, real opacity/dimensions, all sixteen square slots and no renderer errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill('SIGTERM');});
