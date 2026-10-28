const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {expect}=require('@playwright/test');
const {openActions,enterHome,roomTab,toDesktop,enterBackpack,applyGrowthSettings}=require('./smoke-helpers.cjs');
const out=path.resolve(__dirname,'../artifacts/growth-settings');
async function verifyGrowthSettings(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const originalTime=await page.evaluate(()=>Date.now()),wallStart=Date.now();
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 let clock=false;const label=desktop?'native':'browser';
 const screenshot=name=>page.screenshot({path:path.join(out,`${label}-${name}.png`),omitBackground:name==='backpack'});
 const stagePanel=()=>page.getByRole('region',{name:'当前成长阶段',exact:true});
 try{
  fs.mkdirSync(out,{recursive:true});
  await page.clock.install({time:new Date(originalTime)});clock=true;await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+10000));
  await page.evaluate(()=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1')),now=Date.now();
   Object.assign(p,{growth:230,growthLocked:false,evolution:undefined,sleeping:false,activity:undefined,outing:undefined,lastTick:now,coins:3000});
   p.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};p.inventory.biscuit=3;
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false}));
   localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:false}));
   const key='ramu-companion-memory-v1:'+p.createdAt,m=JSON.parse(localStorage.getItem(key));
   if(m?.events?.[0]){m.events.push({...m.events[0],id:m.events[0].id+'-stage',kind:'stage-choice',detail:'曾经手动选择过阶段。'});localStorage.setItem(key,JSON.stringify(m))}
  });
  if(desktop)await page.evaluate(async()=>{await window.desktop.setRoomFullscreen(false);await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
  const actions=await openActions(page);await actions.getByRole('button',{name:'状态',exact:true}).click();
  const status=page.getByRole('region',{name:'拉姆状态面板',exact:true});await expect(status.getByRole('progressbar')).toHaveCount(6);await expect(status.getByLabel('物品分类',{exact:true})).toHaveCount(0);
  const backpack=await enterBackpack(page);await expect(backpack.locator('.pocket-status')).toHaveCount(0);await expect(backpack.getByRole('button',{name:'状态值变化规则',exact:true})).toHaveCount(0);
  assert.deepEqual(await backpack.getByLabel('物品分类',{exact:true}).locator('option').evaluateAll(items=>items.map(i=>i.value)),['food','drink','clean','medicine']);
  for(const category of ['drink','clean','medicine','food']){await backpack.getByLabel('物品分类',{exact:true}).selectOption(category);await expect(backpack.locator('.pocket-slot')).toHaveCount(16)}
  await page.getByTestId('companion-panel').getByRole('button',{name:'关闭小窗',exact:true}).click();
  await enterHome(page);let normal;
  if(desktop)normal=await desktop.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getBounds();return[b.width,b.height]});
  await page.getByRole('button',{name:'全屏查看小屋',exact:true}).click();await expect(page.getByRole('button',{name:'退出小屋全屏',exact:true})).toHaveAttribute('aria-pressed','true');
  const screen=await page.locator('.cottage-scene').evaluate(el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,vw:innerWidth,vh:innerHeight}});
  assert.ok(Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&Math.abs(screen.w-screen.vw)<1&&Math.abs(screen.h-screen.vh)<1,'fullscreen room fills the actual viewport');
  if(desktop){
   assert.equal((await page.evaluate(()=>window.desktop.getState())).roomFullscreen,true);
   if(await desktop.evaluate(()=>process.platform==='win32')){
    const displayBounds=await desktop.evaluate(({BrowserWindow,screen})=>screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).bounds);
    await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds())).toEqual(displayBounds);
   }
  }
  else assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'全屏查看小屋',exact:true})).toHaveAttribute('aria-pressed','false');
  if(desktop)await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getBounds();return[b.width,b.height]})).toEqual(normal);
  await page.getByRole('button',{name:'全屏查看小屋',exact:true}).click();await expect(page.getByRole('button',{name:'退出小屋全屏',exact:true})).toBeVisible();await toDesktop(page);
  if(desktop){assert.equal((await page.evaluate(()=>window.desktop.getState())).roomFullscreen,false);assert.deepEqual(await desktop.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getBounds();return[b.width,b.height]}),[160,240])}
  else assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),false);
  if(desktop&&await desktop.evaluate(()=>process.platform==='win32'))await require('./windows-window-chrome.cjs').verifyWindowsChrome(page,desktop);
  await enterHome(page);await roomTab(page,'设置');
  const titles=await page.locator('.settings-panel>section').evaluateAll(items=>items.map(s=>s.querySelector('h3')?.textContent));
  assert.deepEqual(titles,['拉姆信息','当前成长阶段','陪伴与桌面','声音与音乐','专注计时','存档与送别',...(desktop?['软件与帮助']:[])]);
  await expect(stagePanel().getByRole('region',{name:'成长进度',exact:true})).toContainText('5天 13小时');
  const baseline=(await save()).growth;
  await stagePanel().getByRole('button',{name:'固定形态',exact:true}).click();assert.equal((await save()).growthLocked,false);
  await stagePanel().getByRole('button',{name:'应用成长设置',exact:true}).click();const confirm=page.getByRole('alertdialog',{name:'确认切换成长设置？',exact:true});
  await expect(confirm).toContainText('当前阶段的成长进度会保留');assert.equal((await save()).growthLocked,false);
  await page.keyboard.press('Escape');await expect(confirm).toHaveCount(0);await expect(stagePanel()).toBeVisible();assert.equal((await save()).growthLocked,false);
  await stagePanel().getByRole('button',{name:'应用成长设置',exact:true}).click();await confirm.getByRole('button',{name:'取消',exact:true}).click();assert.equal((await save()).growthLocked,false);
  await applyGrowthSettings(page);assert.equal((await save()).growthLocked,true);assert.equal((await save()).growth,baseline);
  await page.clock.fastForward(3600000);assert.equal((await save()).growth,baseline);
  await page.reload();await enterHome(page);await roomTab(page,'设置');assert.equal((await save()).growthLocked,true);
  await applyGrowthSettings(page,{mode:'auto'});assert.equal((await save()).growth,baseline);assert.equal((await save()).growthLocked,false);
  await page.clock.fastForward(3600000);const grown=(await save()).growth;assert.ok(grown>baseline);
  for(let n=0;n<2;n++){await page.reload();await enterHome(page);await roomTab(page,'设置');assert.equal((await save()).growthLocked,false);assert.ok((await save()).growth>=grown)}

  const identity=await save();await stagePanel().getByRole('button',{name:'切换到初级拉姆',exact:true}).click();await stagePanel().getByRole('button',{name:'应用成长设置',exact:true}).click();
  await expect(confirm).toContainText('从所选阶段的起点重新计算');await confirm.getByRole('button',{name:'取消',exact:true}).click();assert.equal((await save()).growth,grown);
  await applyGrowthSettings(page);assert.equal((await save()).growth,60);assert.equal((await save()).growthLocked,false);
  for(const key of ['createdAt','name','color','inventory','coins'])assert.deepEqual((await save())[key],identity[key]);
  await page.clock.fastForward(3600000);assert.ok(Math.abs((await save()).growth-(60+120/72))<.001);
  await roomTab(page,'学院');const language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});
  if(await language.getByRole('button',{name:'上这一课',exact:true}).count()){
   await language.getByRole('button',{name:'上这一课',exact:true}).click();const activity=(await save()).activity;
   await roomTab(page,'设置');await applyGrowthSettings(page,{mode:'fixed'});assert.equal((await save()).activity.id,activity.id);await page.clock.fastForward(180100);assert.ok((await save()).education.graduated.language);
  }
  await roomTab(page,'设置');
  // Visual review runs with a live animation clock: frozen rAF can leave an
  // unloaded canvas looking blank even when the surrounding controls work.
  await page.clock.resume();await page.clock.setSystemTime(new Date(originalTime+Date.now()-wallStart));clock=false;
  await page.evaluate(()=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{growth:230,growthLocked:false,sleeping:false,activity:undefined,outing:undefined,lastTick:Date.now()});
   p.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
  });
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
  const painted=async selector=>{
   const canvases=page.locator(selector);await expect(canvases.first()).toBeVisible();
   await expect.poll(()=>canvases.evaluateAll(items=>items.every(c=>c.dataset.loaded==='true'&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))),{timeout:30000}).toBe(true);
  };
  await painted('[data-testid="desktop-character"] canvas.ram-classic-frame');
  await (await openActions(page)).getByRole('button',{name:'状态',exact:true}).click();await enterBackpack(page);await screenshot('backpack');
  await page.getByTestId('companion-panel').getByRole('button',{name:'关闭小窗',exact:true}).click();await enterHome(page);
  await painted('.scene-character canvas.ram-classic-frame');await page.getByRole('button',{name:'全屏查看小屋',exact:true}).click();await expect(page.getByRole('button',{name:'退出小屋全屏',exact:true})).toBeVisible();await screenshot('fullscreen');await page.keyboard.press('Escape');
  await roomTab(page,'设置');await stagePanel().scrollIntoViewIfNeeded();await painted('.stage-settings canvas.ram-classic-frame');await screenshot('growth');
  await stagePanel().getByRole('button',{name:'固定形态',exact:true}).click();await stagePanel().getByRole('button',{name:'应用成长设置',exact:true}).click();await screenshot('confirmation');await page.keyboard.press('Escape');
  for(const name of ['声音与音乐','专注计时']){await page.getByRole('region',{name,exact:true}).scrollIntoViewIfNeeded();await screenshot(name==='声音与音乐'?'sound':'timer')}
  assert.equal(await page.locator('.settings-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  if(!desktop){
   await page.setViewportSize({width:1000,height:720});await stagePanel().scrollIntoViewIfNeeded();assert.equal(await page.locator('.settings-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await screenshot('small-growth');await page.setViewportSize({width:1180,height:820});
  }
  fs.writeFileSync(path.join(out,`${label}-checks.json`),JSON.stringify({version:require('../package.json').version,native:Boolean(desktop),backpackCategories:4,fullscreen:true,restoredBounds:normal??null,confirmationCancel:true,autoBefore:baseline,autoAfter:grown,repeatedReloads:2,newStageFrom:60,settingsOrder:titles},null,2)+'\n');
  console.log('PASS independent status/backpack without status category, room fullscreen+Escape+desktop restoration, confirmed auto/fixed growth and repeated reloads, retained progress/identity/course, remaining healthy time and ordered responsive settings');
 }finally{
  if(clock){await page.clock.resume();await page.clock.setSystemTime(new Date(originalTime+Date.now()-wallStart))}
  await page.evaluate(values=>{localStorage.clear();for(const[k,v]of Object.entries(values))localStorage.setItem(k,v)},snapshot);
  if(desktop)await page.evaluate(async()=>{await window.desktop.setRoomFullscreen(false);await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
 }
}
module.exports={verifyGrowthSettings};
