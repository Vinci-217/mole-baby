const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium,expect}=require('@playwright/test');
const {enterHome,roomTab,applyGrowthSettings,toDesktop}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/complete-animation-review');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});try{
 const p=await browser.newPage({viewport:{width:1200,height:920}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'artifacts/wardrobe-interactions/previous-record-after.json'))),before=JSON.parse(snapshot['ramu-house-save-v1']);
 await p.addInitScript(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const[k,v]of Object.entries(snapshot))localStorage.setItem(k,v);const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(pet,{lastTick:Date.now(),sleeping:false,growth:840,evolution:'classic',growthLocked:true});delete pet.wearing;delete pet.activity;delete pet.outing;pet.stats={hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90};localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,roomWander:false}));},snapshot);
 await p.goto('http://127.0.0.1:5173/');await enterHome(p);await roomTab(p,'成长');
 const settings=p.getByRole('region',{name:'当前成长阶段',exact:true});await expect(settings.getByRole('group',{name:'选择神力形态'}).getByRole('button')).toHaveCount(5);
 await settings.getByRole('button',{name:'切换为神力超级拉姆',exact:true}).click();await applyGrowthSettings(p,{mode:'fixed'});
 await expect.poll(()=>p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).evolution)).toBe('super');
 await settings.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await expect(settings.getByRole('button',{name:'切换为神力超级拉姆',exact:true})).toHaveAttribute('aria-pressed','true');
 await p.screenshot({path:path.join(out,'神力超级拉姆已恢复.png')});await toDesktop(p);await p.reload();
 const actor=p.locator('.desktop-character .ram-sprite');await expect(actor).toHaveAttribute('data-evolution','super');const canvas=actor.locator('canvas').first();await expect(canvas).toHaveAttribute('data-loaded','true');
 const [a,b]=await Promise.all([canvas.evaluate(c=>c.toDataURL()),p.waitForTimeout(200).then(()=>canvas.evaluate(c=>c.toDataURL()))]);assert.notEqual(a,b,'golden-crown original animation advances');
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));for(const key of ['createdAt','name','color','inventory','wardrobe','coins'])assert.deepEqual(after[key],before[key],key);
 const memoryKey='ramu-companion-memory-v1:'+before.createdAt,old=JSON.parse(snapshot[memoryKey]);const memory=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),memoryKey);for(const event of old.events)assert(memory.events.some(next=>next.id===event.id));
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'super-restoration-checks.json'),JSON.stringify({selectorCount:5,superSelectable:true,stageRetapPreservesSuper:true,reloadPreservesChoice:true,sourceFramesAdvance:true,previousIdentityAndMemoriesPreserved:true,errors},null,2));console.log('PASS restored selector, real apply/reload, golden source frames, previous identity and memories');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
