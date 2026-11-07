const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {openActions,enterHome,roomTab,toDesktop,applyGrowthSettings,buy}=require('./smoke-helpers.cjs');
const out=path.resolve(__dirname,'../artifacts/gameplay-originals-review');fs.mkdirSync(out,{recursive:true});
const checks={errors:[],mobile:[],checks:[]};let browser;
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
function observe(page){page.on('pageerror',error=>checks.errors.push(error.message));}
async function seed(page,{growth=60,lively=false}={}){
 await page.addInitScript(({growth,lively})=>{
  if(localStorage.getItem('ramu-house-save-v1'))return;
  const now=Date.now(),id=now-100000;
  localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小紫',color:'#9c5fd4',createdAt:id,lastTick:now,growth,naturalGrowth:growth,highestGrowth:growth,growthLocked:false,coins:6000,wardrobe:['party-cap'],stats:{hunger:95,thirst:95,happiness:95,cleanliness:95,health:100,energy:95},inventory:{berry:3},sleeping:false,completedGames:0,lastRewardAt:0}));
  localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively,presence:false,outings:false,roomWander:false,reminders:false}));
  localStorage.setItem('ramu-companion-memory-v1:'+id,JSON.stringify({version:1,petId:String(id),personality:'慢慢陪伴',facts:[],events:[{id:'old-memory',kind:'play',detail:'保留这段旧回忆',at:id}],messages:[]}));
 },{growth,lively});
}
async function football(page){await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await expect(page.getByRole('region',{name:'原版互动与自然动作'})).toBeVisible();}
async function closePanel(page){const btn=page.getByRole('button',{name:'关闭小窗',exact:true});if(await btn.isVisible())await btn.click();}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disable-dev-shm-usage','--renderer-process-limit=2']});
 if(!process.env.REVIEW_AMBIENT_ONLY){
 const page=await browser.newPage({viewport:{width:1100,height:850}});observe(page);await seed(page,{growth:0});await page.goto('http://127.0.0.1:5173/');
 await enterHome(page);await roomTab(page,'成长');
 const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
 await settings.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await settings.getByRole('button',{name:/^切换为.*火系拉姆$/}).click();await applyGrowthSettings(page);
 await expect.poll(async()=>(await save(page)).evolution).toBe('fire');let chosen=await save(page);assert(chosen.naturalGrowth<1);assert.equal(chosen.highestGrowth,chosen.naturalGrowth);assert.equal(chosen.color,'#9c5fd4');
 await page.screenshot({path:path.join(out,'free-form-settings.png')});await page.reload();chosen=await save(page);assert.equal(chosen.evolution,'fire');assert(chosen.naturalGrowth<1);assert.equal(chosen.highestGrowth,chosen.naturalGrowth);
 await enterHome(page);await roomTab(page,'成长');await applyGrowthSettings(page,{mode:'auto'});await expect.poll(async()=>(await save(page)).growth).toBeLessThan(1);assert.equal((await save(page)).evolution,undefined);
 await settings.getByRole('button',{name:'切换到初级拉姆',exact:true}).click();await applyGrowthSettings(page);
 console.log('CHECKPOINT',Date.now());checks.checks.push('Seed can select future elemental form; reload preserves colour and earned growth; automatic mode returns to earned stage.');
 await buy(page,'180011','逗逗拉姆·一','玩具');const afterBuy=await save(page);assert.equal(afterBuy.inventory['180011'],1);assert.equal(afterBuy.coins,5960);
 await page.locator('.shop-book').getByRole('button',{name:'购买逗逗拉姆·一',exact:true}).isDisabled().then(value=>assert(value));
 await roomTab(page,'背包');const bag=page.getByRole('region',{name:'拉姆用品背包'});await bag.getByRole('tab',{name:'玩具',exact:true}).click();await bag.locator('[data-item-id="180011"]').click();
 await expect(page.locator('.official-ram-clip[data-loaded=true]')).toHaveCount(1,{timeout:30000});assert.equal((await save(page)).inventory['180011'],1);
 await page.screenshot({path:path.join(out,'purchased-toy.png')});await expect(page.locator('.ram-official')).toHaveCount(0,{timeout:35000});
 await toDesktop(page);await football(page);const menu=page.getByRole('region',{name:'原版互动与自然动作'});await menu.getByRole('button',{name:'魔法本领',exact:true}).click();
 assert(await menu.getByRole('button',{name:/先知球|魔法星星/}).count()>0);const names=await menu.locator('.official-clip-grid button span').allTextContents();assert.equal(names.length,new Set(names).size);assert(names.length<=7);
 await menu.getByRole('button',{name:'自然动作',exact:true}).click();await expect(menu).toContainText('不需要守着逐个播放');await closePanel(page);
 console.log('CHECKPOINT',Date.now());checks.checks.push('Toy shop purchase costs once; reusable item plays original current-stage SWF and remains owned; magic menu removes duplicates.');
 await page.close();const workPage=await browser.newPage({viewport:{width:1100,height:850}});observe(workPage);await workPage.clock.install();await seed(workPage);await workPage.goto('http://127.0.0.1:5173/');await football(workPage);await workPage.getByRole('button',{name:'去餐厅打工',exact:true}).click();let working=await save(workPage);assert.equal(working.activity.continuous,true);const energy=working.stats.energy,coins=working.coins;
 await expect(workPage.getByTestId('desktop-restaurant-work').locator('canvas')).toHaveAttribute('data-loaded','true');
 await workPage.clock.runFor(145000);working=await save(workPage);assert.equal(working.activity.kind,'restaurant');assert(working.activity.paidCoins>=180,JSON.stringify({working,now:await workPage.evaluate(()=>Date.now())}));assert.equal(working.activity.paidCoins,Math.floor((working.lastTick-working.activity.startedAt)*180/120000));assert(working.coins>coins);assert(working.stats.energy>energy-1);
 await expect(workPage.getByRole('timer',{name:'餐厅打工已用时间'})).toHaveText(/^2:2[5-9]$/);await workPage.screenshot({path:path.join(out,'count-up-work.png')});
 await workPage.getByTestId('desktop-restaurant-work').getByRole('button',{name:'进入餐厅',exact:true}).click();const restaurant=workPage.getByRole('dialog',{name:'拉姆餐厅',exact:true});await expect(restaurant).toBeVisible();assert.equal((await save(workPage)).activity.kind,'restaurant');
 await restaurant.getByRole('button',{name:'切换餐厅背景',exact:true}).click();await restaurant.getByRole('button',{name:'结束打工',exact:true}).click();await expect(restaurant.getByText('餐厅已经打烊了',{exact:true})).toBeVisible();assert.equal((await save(workPage)).activity,undefined);
 await restaurant.getByRole('button',{name:'开始打工',exact:true}).click();await workPage.clock.runFor(30000);const partial=await save(workPage);await restaurant.getByRole('button',{name:'结束打工',exact:true}).click();const stopped=await save(workPage);assert(stopped.coins>=partial.coins);assert.equal(stopped.activity,undefined);
 await restaurant.getByRole('button',{name:'开始打工',exact:true}).click();await workPage.clock.runFor(10000);const beforeOffline=await save(workPage);await workPage.context().setOffline(true);await expect.poll(async()=>(await save(workPage)).activity).toBe(undefined);await workPage.clock.runFor(90000);assert.equal((await save(workPage)).coins,beforeOffline.coins);await workPage.context().setOffline(false);
 await restaurant.getByRole('button',{name:'开始打工',exact:true}).click();const beforeReload=await save(workPage);await workPage.reload();await expect.poll(async()=>(await save(workPage)).activity).toBe(undefined);assert.equal((await save(workPage)).coins,beforeReload.coins);
 console.log('CHECKPOINT',Date.now());checks.checks.push('Work counts up beyond 2min, credits elapsed wages, stops/restarts anytime; opening restaurant retains work; offline/reload stops without offline wages.');
 const final=await save(workPage);assert.equal(final.name,'小紫');assert.equal(final.color,'#9c5fd4');assert.equal(final.inventory.berry,3);assert(final.wardrobe.includes('party-cap'));
 const memory=await workPage.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+p.createdAt))});assert(memory.events.some(row=>row.detail==='保留这段旧回忆'));await workPage.close();
 for(const width of [393,320]){
  const mobile=await browser.newPage({viewport:{width,height:760},isMobile:true,hasTouch:true});observe(mobile);await seed(mobile);await mobile.goto('http://127.0.0.1:5173/');await enterHome(mobile);await buy(mobile,'180011','逗逗拉姆·一','玩具');
  await mobile.screenshot({path:path.join(out,`mobile-shop-${width}.png`)});await roomTab(mobile,'背包');await mobile.getByRole('tab',{name:'玩具',exact:true}).click();
  const sizes=await mobile.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));assert(sizes.body<=width);checks.mobile.push(sizes);await mobile.screenshot({path:path.join(out,`mobile-bag-${width}.png`)});
  await toDesktop(mobile);await football(mobile);await mobile.getByRole('button',{name:'去餐厅打工',exact:true}).click();await mobile.getByTestId('desktop-restaurant-work').getByRole('button',{name:'进入餐厅',exact:true}).click();assert.equal((await save(mobile)).activity.kind,'restaurant');await mobile.getByRole('button',{name:'结束打工',exact:true}).click();assert.equal((await save(mobile)).activity,undefined);await mobile.close();
 }
 console.log('CHECKPOINT',Date.now());checks.checks.push('Phone widths 320/393 fit five inventory categories and scrolling shop books; entering restaurant keeps work.');
 fs.writeFileSync(path.join(out,'checks-partial.json'),JSON.stringify(checks,null,2));
 }else Object.assign(checks,JSON.parse(fs.readFileSync(path.join(out,'checks-partial.json'),'utf8')));
 const ambient=await browser.newPage({viewport:{width:1100,height:850}});observe(ambient);await seed(ambient,{lively:true});await ambient.addInitScript(()=>Math.random=()=>.01);await ambient.clock.install();await ambient.goto('http://127.0.0.1:5173/');
 async function spontaneous(inRoom){
  const samples=[];for(let i=0;i<70;i++){await ambient.clock.runFor(5000);const value=await ambient.locator(inRoom?'.scene-character .ram-sprite':'.desktop-character .ram-sprite').first().getAttribute('data-action');samples.push(value);if(value?.startsWith('ambient-')){for(let load=0;load<20&&!await ambient.locator('.official-ram-clip[data-loaded=true]').count();load++)await ambient.clock.runFor(500);await expect(ambient.locator('.official-ram-clip[data-loaded=true]')).toHaveCount(1,{timeout:30000});return value;}}
  throw Error('No spontaneous source action: '+JSON.stringify(samples));
 }
 const desktopAction=await spontaneous(false);await ambient.screenshot({path:path.join(out,'desktop-spontaneous.png')});await ambient.clock.runFor(35000);await enterHome(ambient);const homeAction=await spontaneous(true);await ambient.screenshot({path:path.join(out,'home-spontaneous.png')});assert.notEqual(homeAction,desktopAction);checks.ambient={desktopAction,homeAction};
 await ambient.close();assert.deepEqual(checks.errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks,null,2));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
