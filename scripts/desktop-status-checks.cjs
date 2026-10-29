const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{expect}=require('@playwright/test');
const{openActions,enterBackpack}=require('./smoke-helpers.cjs');
const{reloadWithStorage}=require('./smoke-storage.cjs');

async function verifyDesktopStatus(page,desktop,{label='browser',out=path.resolve(__dirname,'../artifacts/desktop-status-ui')}={}){
 fs.mkdirSync(out,{recursive:true});
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const fixture={hunger:71,thirst:53,cleanliness:30,happiness:74,health:38,energy:27};
 async function setup(stats=fixture,sleeping=false,studying=false){
  const entries=await page.evaluate(({stats,sleeping,studying})=>{const entries=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(entries['ramu-house-save-v1']),now=Date.now();Object.assign(p,{name:'小红',growth:180,growthLocked:true,evolution:undefined,sleeping,outing:undefined,activity:studying?{id:`${p.createdAt}:${now}`,kind:'course',course:'language',startedAt:now,endsAt:now+180000}:undefined,education:undefined,lastTick:now,stats});entries['ramu-house-save-v1']=JSON.stringify(p);entries['ramu-house-preferences-v2']=JSON.stringify({quiet:true,lively:false,presence:false,outings:false,sound:false,reminders:true,reminderMinutes:25});return entries},{stats,sleeping,studying});
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true);await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
  await reloadWithStorage(page,entries);await page.getByTestId('desktop-character').waitFor();await page.evaluate(()=>document.fonts.ready);
 }
 const caption=page.getByTestId('desktop-condition'),name=page.locator('.compact-pet-name');
 const panel=page.getByTestId('companion-panel');
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 try{
  await setup();await page.mouse.move(-20,-20);await page.waitForTimeout(350);
  await expect(name).toHaveText('小红');await expect(name).toHaveCSS('opacity','1');await expect(caption).toContainText('精神不足');await expect(caption).toBeVisible();
  let a=await name.boundingBox(),b=await caption.boundingBox();assert.ok(b.y>=a.y+a.height-.5,'condition must be below the real pet name');
  await expect(page.locator('.companion-layout [title]')).toHaveCount(0);
  await expect(page.getByTestId('desktop-character').locator('canvas[data-loaded=true]').first()).toBeVisible({timeout:30000});
  await page.locator('.compact-pet').screenshot({path:path.join(out,label+'-pet.png'),omitBackground:true});
  await caption.click();await expect(panel.getByRole('region',{name:'拉姆状态面板',exact:true})).toBeVisible();
  const bounds=await panel.evaluate(n=>{const box=n.getBoundingClientRect(),footer=n.querySelector('footer').getBoundingClientRect(),rows=[...n.querySelectorAll('.pocket-status label')].map(r=>r.getBoundingClientRect().toJSON());return{box:box.toJSON(),footer:footer.toJSON(),rows,overflow:n.querySelector('.care-pocket').scrollHeight-n.querySelector('.care-pocket').clientHeight,appearance:getComputedStyle(n.querySelector('progress')).appearance}});
  assert.ok(bounds.footer.bottom<=bounds.box.bottom-2,'footer must remain fully inside the pocket');assert.ok(bounds.rows.every(row=>row.bottom<=bounds.footer.top),'all six rows must fit above the footer');assert.ok(bounds.overflow<=1,'status contents must not overflow');assert.equal(bounds.appearance,'none','system-native dark progress tracks must be replaced');
  assert.deepEqual(await panel.getByRole('progressbar').evaluateAll(nodes=>nodes.map(n=>Math.round(n.value))),[71,53,30,74,38,27]);
  await panel.screenshot({path:path.join(out,label+'-panel.png'),omitBackground:true});
  await panel.getByRole('button',{name:'状态值变化规则',exact:true}).click();await expect(panel.getByRole('heading',{name:'状态值怎样变化？',exact:true})).toBeVisible();
  const f=await panel.locator('footer').boundingBox(),p=await panel.boundingBox();assert.ok(f.y+f.height<=p.y+p.height-2,'help must not displace the footer');
  await panel.getByRole('button',{name:'返回状态',exact:true}).click();await expect(panel.getByRole('progressbar')).toHaveCount(6);await enterBackpack(page);await expect(panel.locator('.pocket-slot')).toHaveCount(16);await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();
  const healthy={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};
  for(const[patch,text]of [[{hunger:20},'肚子饿了'],[{thirst:20},'口渴了'],[{cleanliness:20},'需要清洁'],[{health:30},'生病了']]){await setup({...healthy,...patch});await expect(caption).toHaveText(text)}
  await setup({...healthy,energy:55},true);await expect(name).toHaveText('小红');await expect(caption).toHaveText('睡梦中 · 叫醒');await page.locator('.compact-pet').screenshot({path:path.join(out,label+'-sleep.png'),omitBackground:true});await caption.click();await expect.poll(async()=>(await save()).sleeping).toBe(false);
  await setup(healthy,false,true);await expect(caption).toHaveText('语言课 · 学习中');await expect(name).toHaveCSS('opacity','1');
  await setup(healthy);await (await openActions(page)).getByRole('button',{name:'开始计时',exact:true}).click();const timer=page.locator('.tool-countdown');await expect(timer).toBeVisible();await expect(timer).toHaveText(/\d+:\d{2}/);a=await timer.boundingBox();b=await page.getByTestId('pet-actions').boundingBox();assert.ok(a.y>=b.y&&a.y+a.height<=b.y+b.height,'countdown must remain inside the toolbar');assert.ok(a.y>=((await caption.boundingBox()).y+14),'timer must not cover the condition');
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert.ok(a.x>=0&&a.x+a.width<=viewport.width&&a.y+a.height<=viewport.height,'native window must not clip the countdown');
  await page.locator('.compact-pet').screenshot({path:path.join(out,label+'-timer.png'),omitBackground:true});await page.getByTestId('pet-actions').getByRole('button',{name:'取消计时',exact:true}).click();
  fs.writeFileSync(path.join(out,label+'-layout.json'),JSON.stringify({label,...bounds},null,2)+'\n');
  console.log('PASS desktop status: persistent concrete needs below name, sleep/wake and lesson labels; all six custom progress bars and footer fit; help/backpack work; focus countdown fits the unchanged desktop window');
 }finally{
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await reloadWithStorage(page,snapshot);
 }
}
module.exports={verifyDesktopStatus};
