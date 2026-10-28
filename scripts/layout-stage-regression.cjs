const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {chromium,expect}=require('@playwright/test');
const {adopt,openActions,enterHome,roomTab,toDesktop,verifyStageSettings}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5199';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5199','--strictPort'],{cwd:root,stdio:'pipe'});let browser,logs='';server.stderr.on('data',d=>logs+=d);
(async()=>{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await adopt(p,'蓝色','小蓝');await p.clock.fastForward(16000);
 await verifyStageSettings(p);await openActions(p);const pet=p.locator('.compact-pet');
 const bounds=await pet.boundingBox(),character=await p.getByTestId('desktop-character').boundingBox();assert.equal(bounds.width,160);assert.equal(character.width,100);assert.equal(character.x-bounds.x,30);
 const buttons=p.getByTestId('pet-actions').getByRole('button');assert.equal(await buttons.count(),7);
 for(const button of await buttons.all()){const box=await button.boundingBox();assert.ok(box.x>=bounds.x&&box.x+box.width<=bounds.x+bounds.width+.5);}
 fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});await pet.screenshot({path:path.join(root,'artifacts/v13-compact.png')});
 await enterHome(p);await roomTab(p,'成长');const stages=p.getByRole('region',{name:'当前成长阶段',exact:true});await stages.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await require('./smoke-helpers.cjs').applyGrowthSettings(p,{mode:'fixed'});
 await stages.scrollIntoViewIfNeeded();await expect(stages.getByRole('group',{name:'选择当前阶段',exact:true}).getByRole('button')).toHaveCount(5);await expect(stages.getByRole('group',{name:'选择神力形态',exact:true}).getByRole('button')).toHaveCount(5);
 for(const image of await stages.locator('canvas:not(.ram-wear)[data-loaded=true]').all())assert.ok(await image.evaluate(n=>n.width>0));
 await expect(p.locator('.classic-toast')).toHaveCount(0,{timeout:6000});
 await stages.screenshot({path:path.join(root,'artifacts/v13-stage-settings.png')});
 await stages.getByRole('button',{name:'切换为霹雳火系拉姆',exact:true}).click();await require('./smoke-helpers.cjs').applyGrowthSettings(p,{mode:'fixed'});await toDesktop(p);await p.reload();await expect(p.locator('.desktop-character .ram-sprite')).toHaveAttribute('data-evolution','fire');await expect(p.locator('.desktop-character .ram-sprite')).toHaveAttribute('data-color','blue');
 assert.deepEqual(errors,[]);console.log('PASS five settings stages/five evolutions, reload/downgrade, identity/items/memory retained, 160 px frame and seven unclipped hover buttons');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM');});
