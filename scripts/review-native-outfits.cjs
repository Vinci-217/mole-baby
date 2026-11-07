const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {enterHome,roomTab,toDesktop,openActions,applyGrowthSettings}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/native-outfits-review');fs.mkdirSync(out,{recursive:true});
const profile=path.join(out,'browser-profile'),saveKey='ramu-house-save-v1';
const checks={errors:[],missing:[],forms:[],playerReuse:[],snapshots:[]};let browser;
const save=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
async function snapshot(page,name){const value=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));checks.snapshots.push(name);return JSON.parse(value[saveKey]);}
const sameIdentity=(a,b)=>{for(const key of ['createdAt','name','color','naturalGrowth','highestGrowth','inventory','wardrobe','coins'])assert.deepEqual(a[key],b[key],key);};
async function clipReady(page,locator){await expect(locator.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:25000});const iframe=locator.locator('iframe');const frame=await (await iframe.elementHandle()).contentFrame();await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').settled)).toBe(true);return {iframe,frame};}
async function choose(page,name){const section=page.getByRole('region',{name:'拉姆小衣橱',exact:true}),button=section.getByRole('button',{name:'试戴'+name,exact:true});while(!await button.count()&&await section.getByRole('button',{name:'衣橱上一页',exact:true}).isEnabled())await section.getByRole('button',{name:'衣橱上一页',exact:true}).click();while(!await button.count()&&await section.getByRole('button',{name:'衣橱下一页',exact:true}).isEnabled())await section.getByRole('button',{name:'衣橱下一页',exact:true}).click();await button.click();}
(async()=>{
 browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/usr/local/bin/chromium',viewport:{width:1100,height:850},args:['--disable-dev-shm-usage','--disk-cache-size=10485760','--renderer-process-limit=2']});
 const page=browser.pages()[0]??await browser.newPage();page.on('pageerror',e=>checks.errors.push(e.message));page.on('response',r=>{if(r.status()===404)checks.missing.push(r.url());});
 // Only initialize an isolated QA record when this persistent profile is new.
 // Later runs reload exactly the same record; never clear/reset browser storage.
 await page.addInitScript(()=>{if(localStorage.getItem('ramu-house-save-v1'))return;const now=Date.now(),id=1794020000000;
 localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小紫',color:'#9c5fd4',createdAt:id,lastTick:now,growth:840,naturalGrowth:213,highestGrowth:213,growthLocked:true,evolution:'super',coins:880,stats:{hunger:90,thirst:90,cleanliness:90,happiness:90,health:100,energy:90},inventory:{berry:3,'180011':1},wardrobe:['party-cap','wizard-cap','magic-book','angel-wings','original-1200001','original-1200055'],sleeping:false,completedGames:0,lastRewardAt:0}));
 localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,roomWander:false,reminders:false}));
 localStorage.setItem('ramu-companion-memory-v1:'+id,JSON.stringify({version:1,petId:String(id),personality:'慢慢陪伴',facts:[],events:[{id:'old-memory',kind:'play',detail:'保留这段旧回忆',at:id}],messages:[]}));});
 await page.goto('http://127.0.0.1:5173/');await expect(page.getByTestId('desktop-character')).toBeVisible();
 const existing=await save(page);
 if(existing.growth!==840||existing.evolution!=='super'){
  await enterHome(page);await roomTab(page,'成长');const growth=page.getByRole('region',{name:'当前成长阶段',exact:true});await growth.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await growth.getByRole('button',{name:'切换为神力超级拉姆',exact:true}).click();await applyGrowthSettings(page);await toDesktop(page);
 }
 const before=await snapshot(page,'before');
 await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();const menu=page.getByRole('region',{name:'原版互动与自然动作'});
 await menu.getByRole('tab',{name:'道具',exact:true}).click();assert.equal(await menu.locator('.official-clip-grid button').count(),11);await expect(menu.getByRole('button',{name:'播放足球',exact:true})).toBeInViewport({ratio:1});assert.equal(await menu.locator('p').count(),0);await page.screenshot({path:path.join(out,'free-tools.png')});
 await menu.getByRole('button',{name:'播放足球',exact:true}).click();await expect(page.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:25000});sameIdentity(before,await save(page));await page.keyboard.press('Escape');
 await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await menu.getByRole('tab',{name:'魔法',exact:true}).click();assert(await menu.getByRole('button',{name:'播放魔法星星',exact:true}).isEnabled());checks.magicButtons=await menu.locator('.official-clip-grid button').count();await page.screenshot({path:path.join(out,'magic-menu.png')});await menu.getByRole('button',{name:'播放魔法星星',exact:true}).click();await expect(page.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:25000});await page.keyboard.press('Escape');
 await enterHome(page);await roomTab(page,'衣橱');
 const mirror=page.locator('.wardrobe-mirror');let originalFrame;
 for(const name of ['庆生小帽','紫色魔法帽','魔法书','天使羽翼']){
  await choose(page,name);const {iframe,frame}=await clipReady(page,mirror);if(originalFrame)assert.equal(frame,originalFrame,'outfit change remounted iframe');originalFrame=frame;
  const status=await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));checks.playerReuse.push({name,form:status.form,registration:status.registration});assert(status.registration);assert.equal(await mirror.locator('.ram-wear').count(),0);
  await page.screenshot({path:path.join(out,name+'.png')});
  const scale=status.registration.scale;
  await page.getByRole('button',{name:'预览左走动作',exact:true}).click();await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('left');await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').settled)).toBe(true);assert.equal((await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'))).registration.scale,scale);
  await page.getByRole('button',{name:'预览右走动作',exact:true}).click();await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('right');
 }
 await choose(page,'庆生小帽');await clipReady(page,mirror);await page.locator('.wardrobe-choice button').click();await toDesktop(page);await clipReady(page,page.getByTestId('desktop-character'));
 await page.reload();sameIdentity(before,await snapshot(page,'after-reload'));
 await enterHome(page);await roomTab(page,'成长');const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
 for(const [name,form] of [['中级拉姆','middle'],['高级拉姆','senior'],['种子期','seed']]){
  const button=settings.getByRole('button',{name:'切换到'+name,exact:true});if(!await button.count()&&name==='种子期')await settings.getByRole('button',{name:/切换到.*种子/}).click();else await button.click();await applyGrowthSettings(page);
  const current=await save(page);if(form==='seed'){assert.equal(current.wearing,undefined);assert.deepEqual(current.wardrobe,before.wardrobe);}else{await clipReady(page,page.locator('.scene-character'));await expect(page.locator('.scene-character>.ram-sprite')).toHaveAttribute('data-form',form);}
  checks.forms.push({form,wearing:current.wearing});
 }
 const after=await snapshot(page,'after');sameIdentity(before,after);const memory=await page.evaluate(id=>JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+id)),before.createdAt);assert(memory.events.some(e=>e.detail==='保留这段旧回忆'));
 await page.reload();sameIdentity(after,await save(page));assert.equal((await save(page)).wearing,undefined);
 await enterHome(page);await roomTab(page,'成长');await settings.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await settings.getByRole('button',{name:'切换为神力超级拉姆',exact:true}).click();await applyGrowthSettings(page);await toDesktop(page);await snapshot(page,'retained-record');
 assert.deepEqual(checks.errors,[]);assert.deepEqual(checks.missing,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>browser?.close());
