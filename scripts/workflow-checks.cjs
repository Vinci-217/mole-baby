const {expect}=require('@playwright/test'),assert=require('node:assert/strict'),path=require('node:path');
const {enterHome,roomTab,toDesktop,openActions}=require('./smoke-helpers.cjs');
const clips=require('../public/assets/original/element-skills/clips.json');
/** Exercise actual controls and persisted state. Packaged runs cover one full
 * source animation per type; the browser review covers all eighteen clips. */
async function verifyWorkflow(page,{full=false}={}){
 let clockInstalled=false;
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 try{
  await page.evaluate(()=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1')),now=Date.now();
   Object.assign(p,{growth:840,evolution:'super',sleeping:false,lastTick:now,coins:10000,wardrobe:['wizard-cap'],wearing:'wizard-cap',education:{lessons:{magic:1,'element-fire':6,'element-water':6,'element-wood':6},graduated:{magic:now-1000,'element-fire':now-500,'element-water':now-500,'element-wood':now-500}},stats:{hunger:95,thirst:95,happiness:95,cleanliness:95,energy:95,health:100}});
   delete p.activity;delete p.outing;localStorage.removeItem('ramu-companion-memory-v1:'+p.createdAt);localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false,outings:false,reminders:true,reminderMinutes:1,timerDirection:'countup'}));
  });
  await page.reload();const character=page.getByTestId('desktop-character');await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true',{timeout:20000});
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();
  const panel=page.getByTestId('companion-panel');await expect(panel.locator('.pocket-status progress')).toHaveCount(6);
  await panel.getByRole('button',{name:'状态值变化规则',exact:true}).click();await expect(panel.getByRole('table')).toContainText('每小时');await expect(panel.getByRole('table')).toContainText('+22');
  await panel.getByRole('button',{name:'状态值变化规则',exact:true}).click();await panel.getByLabel('物品分类',{exact:true}).selectOption('food');await expect(panel.locator('.pocket-slot')).toHaveCount(16);await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  const buttons=panel.locator('.desktop-play>button');await expect(buttons).toHaveCount(9);
  const boxes=await buttons.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));assert.equal(new Set(boxes.map(b=>Math.round(b.y))).size,3);assert.equal(new Set(boxes.map(b=>Math.round(b.x))).size,3);
  for(const b of boxes)assert.ok(b.height>=45&&b.width>=50,'all nine controls remain clickable');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/v30-nine-actions.png'),omitBackground:true});
  await panel.getByRole('button',{name:'变魔术',exact:true}).click();const magic=character.locator('.magic-box-performance');
  await expect(magic).toHaveAttribute('data-magic-frame','17',{timeout:5000});await expect(magic.locator('.magic-box-original')).toHaveCSS('opacity','0');await page.screenshot({path:path.resolve(__dirname,'../artifacts/v30-magic-box.png'),omitBackground:true});await expect(magic).toHaveCount(0,{timeout:10000});await expect(character.locator('.ram-wear')).toHaveAttribute('data-outfit','wizard-cap');assert.equal((await save()).wearing,'wizard-cap');
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await panel.getByRole('button',{name:'睡一会儿',exact:true}).click();await expect(panel.getByRole('button',{name:'轻轻叫醒',exact:true})).toBeEnabled();assert.equal((await save()).sleeping,true);await panel.getByRole('button',{name:'轻轻叫醒',exact:true}).click();assert.equal(await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+p.createdAt)).events.filter(e=>e.kind==='auto-sleep').length}),0,'manual sleep must not create an automatic nap event');await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await enterHome(page);await page.getByRole('button',{name:'布置小屋',exact:true}).click();const drawer=page.getByRole('complementary',{name:'小屋布置工具',exact:true});await expect(page.locator('.classic-room-overlay')).toHaveCount(0);await expect(drawer).toBeVisible();
  const original=drawer.locator('.furnishing-catalogue article').filter({has:page.locator('img[src*="/original/furniture/"]')}).first();await expect(original).toBeVisible();await original.getByRole('button',{name:'购买',exact:true}).click();await original.getByRole('button',{name:'放进小屋',exact:true}).click();
  const placed=page.locator('.room-furnishing-layer.is-editing [data-furniture^="original-"]').first();await expect(placed).toBeVisible();const id=await placed.getAttribute('data-furniture');
  const bounds=await page.locator('.cottage-scene').boundingBox(),b=await placed.boundingBox();const handle={x:b.x+b.width*.5,y:b.y+b.height*.5};await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(handle.x-bounds.width*.1,handle.y+10,{steps:5});await page.mouse.up();await expect.poll(async()=>(await save()).room.placed.find(p=>p.id===id)?.x).toBeLessThan(49);
  const gallery=drawer.getByRole('group',{name:'选择小屋背景',exact:true});await expect(gallery.getByRole('button')).toHaveCount(14);await gallery.getByRole('button',{name:'魔法小屋',exact:true}).click();await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background','original-160427');await page.screenshot({path:path.resolve(__dirname,'../artifacts/v30-original-room.png')});await page.locator('.cottage-top').getByRole('button',{name:'完成布置',exact:true}).click();await expect(drawer).toHaveCount(0);await page.getByRole('button',{name:'布置小屋',exact:true}).click();await expect(drawer).toBeVisible();await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);
  await roomTab(page,'学院');await expect(page.locator('.paper-tabs').getByRole('button',{name:'布置',exact:true})).toHaveCount(0);await expect(page.locator('.element-skill-list button:not(:disabled)')).toHaveCount(18);
  await page.evaluate(()=>{window.__skillTrace={};const observer=new MutationObserver(records=>{for(const record of records){const target=record.target;if(target instanceof HTMLCanvasElement&&target.dataset.elementSkill){const frames=window.__skillTrace[target.dataset.elementSkill]??=[];const frame=Number(target.dataset.sourceFrame);if(frame&&frames.at(-1)!==frame)frames.push(frame)}}});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-source-frame']})});
  const ids=full?Object.keys(clips):['fire-1','water-1','wood-1'];
  for(const id of ids){
   await roomTab(page,'学院');const row=page.locator('.element-skill-list li').filter({hasText:clips[id].name});await row.getByRole('button',{name:'变身',exact:true}).click();
   const canvas=page.locator(`.scene-character canvas[data-element-skill="${id}"]`);await expect.poll(()=>canvas.count(),{intervals:[25],timeout:5000}).toBe(1);
   await expect.poll(()=>canvas.evaluateAll(nodes=>Number(nodes[0]?.dataset.sourceFrame??0)),{intervals:[50],timeout:3500}).toBeGreaterThan(1);
   if(full)await page.screenshot({path:path.resolve(__dirname,`../artifacts/element-review/runtime-${id}.png`)});
   await expect(canvas).toHaveCount(0,{timeout:clips[id].durationMs+10000});const trace=await page.evaluate(id=>window.__skillTrace[id]??[],id);assert.equal(trace[0],1,`${id}: first original frame`);assert.equal(trace.at(-1),clips[id].frames,`${id}: last original frame`);await expect(page.locator('.scene-character .ram-wear')).toHaveAttribute('data-outfit','wizard-cap');
  }
  // Install before reloading so all course/timer deadlines use this clock.
  await page.clock.install();clockInstalled=true;
  // One completed lesson unlocks its whole school once across a real reload.
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.education.lessons['element-fire']=0;delete p.education.graduated['element-fire'];p.lastTick=Date.now();localStorage.setItem('ramu-house-save-v1',JSON.stringify(p))});await page.reload();await enterHome(page);await roomTab(page,'学院');await page.locator('.school-course-grid article').filter({hasText:'火系变身课'}).getByRole('button',{name:'上这一课',exact:true}).click();
  await page.clock.fastForward(180100);await expect.poll(async()=>(await save()).education.lessons['element-fire']).toBe(1);await page.reload();await expect.poll(async()=>(await save()).education.lessons['element-fire']).toBe(1);
  await enterHome(page);await roomTab(page,'学院');await expect(page.locator('.school-course-grid article').filter({hasText:'火系变身课'}).locator('.element-skill-list button:not(:disabled)')).toHaveCount(6);
  await roomTab(page,'设置');await page.getByLabel('计时方向',{exact:true}).selectOption('countup');await page.getByLabel('提醒间隔',{exact:true}).fill('1');
  // Keep native UI latency out of the three-second timer fixture.
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+10000));await toDesktop(page);await openActions(page);await page.getByRole('button',{name:'开始计时',exact:true}).click();await expect(page.getByRole('timer',{name:'专注正向计时',exact:true})).toHaveText('00:00');await page.clock.fastForward(3000);await expect(page.getByRole('timer')).toHaveText('00:03');await page.getByRole('button',{name:'取消计时',exact:true}).click();
  await enterHome(page);await roomTab(page,'回忆');await expect(page.getByRole('region',{name:'计时记录',exact:true})).toContainText('正向计时结束：00:03');
  await roomTab(page,'设置');await page.getByLabel('计时方向',{exact:true}).selectOption('countdown');await toDesktop(page);await openActions(page);await page.getByRole('button',{name:'开始计时',exact:true}).click();await expect(page.getByRole('timer')).toHaveText('01:00');await page.clock.fastForward(60100);await expect(page.getByRole('timer')).toHaveCount(0);
  await enterHome(page);await roomTab(page,'回忆');const history=page.getByRole('region',{name:'计时记录',exact:true});await expect(history).toContainText('倒数计时完成：01:00');await expect(history.locator('article')).toHaveCount(2);await page.clock.fastForward(60000);await expect(history.locator('article')).toHaveCount(2);await page.screenshot({path:path.resolve(__dirname,'../artifacts/v30-timer-history.png')});
  console.log(`PASS: nine actions, help/status, shared magic and outfit restoration, original furniture drag/save and room backgrounds, ${ids.length} complete original skills, one lesson per deadline, count-up cancellation and countdown completion records`);
 }catch(error){console.error('Workflow original error:',error);await page.screenshot({path:path.resolve(__dirname,'../artifacts/v30-workflow/failed-before-restore.png')}).catch(()=>{});console.error('Workflow state:',await page.evaluate(()=>({save:localStorage.getItem('ramu-house-save-v1'),body:document.body.innerText.slice(-1600),trace:window.__skillTrace,performance:performance.now(),magic:[...document.querySelectorAll('.magic-box-performance')].map(n=>({frame:n.dataset.magicFrame,subject:n.dataset.magicSubject,label:n.getAttribute('aria-label')}))})));throw error;}finally{if(clockInstalled)await page.clock.resume();await page.evaluate(snapshot=>{localStorage.clear();for(const[k,v]of Object.entries(snapshot))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor()}
}
module.exports={verifyWorkflow};
