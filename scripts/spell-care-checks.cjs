const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {expect}=require('@playwright/test');
const {openActions,enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const clips=require('../public/assets/original/element-skills/clips.json');
const out=path.resolve(__dirname,`../artifacts/v${require('../package.json').version.split('.').slice(1).join('')}`);
async function verifySpellCare(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 const receipt={spells:[],rewards:[],native:Boolean(desktop)};let clock=false;
 const originalDesktop=desktop?await page.evaluate(()=>window.desktop.getState()):null;
 const fixture=async energy=>{
  await page.evaluate(energy=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1')),now=Date.now();
   Object.assign(p,{growth:840,evolution:'super',growthLocked:true,sleeping:false,activity:undefined,outing:undefined,awakeUntil:undefined,sleepUntil:undefined,
    lastTick:now,completedGames:0,lastRewardAt:0,education:{lessons:{magic:1,'element-fire':1,'element-water':1,'element-wood':1},graduated:{magic:now,'element-fire':now,'element-water':now,'element-wood':now}}});
   p.stats={hunger:95,thirst:95,happiness:95,cleanliness:95,health:100,energy};
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false}));
   localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:false}));
  },energy);
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await require('./smoke-storage.cjs').reloadStoredFixture(page);await page.getByTestId('desktop-character').waitFor();
 };
 try{
  fs.mkdirSync(out,{recursive:true});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.install({time:new Date(await page.evaluate(()=>Date.now()))});clock=true;
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+10000));
  if(desktop)await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
  await fixture(95);
  for(const id of ['fire-6','water-6','wood-6']){
   const clip=clips[id],character=page.locator('.scene-character');
   await enterHome(page);await roomTab(page,'学院');await page.locator('.element-skill-list li').filter({hasText:clip.name}).getByRole('button',{name:'变身',exact:true}).click();
   const magic=character.locator('.magic-box-performance');await expect.poll(async()=>{await page.clock.runFor(16);return magic.getAttribute('data-ready')},{timeout:15000}).toBe('true');
   const started=Number(await magic.getAttribute('data-magic-start'));
   const peak=clip.frameMap.map((index,frame)=>({frame:frame+1,area:clip.rectangles[index][3]*clip.rectangles[index][4]})).sort((a,b)=>b.area-a.area)[0].frame;
   const samples=[];
   for(const frame of [...new Set([1,peak,clip.frames])].sort((a,b)=>a-b)){
    const target=started+1520+(frame-1)/clip.fps*1000+20;
    await page.clock.runFor(Math.max(1,Math.ceil(target-await page.evaluate(()=>performance.now()))));
    const canvas=magic.locator('canvas[data-element-skill]');await expect(canvas).toHaveAttribute('data-source-frame',String(frame));
    const result=await canvas.evaluate(c=>{
     const r=c.getBoundingClientRect(),p=c.parentElement.getBoundingClientRect(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let x0=c.width,y0=c.height,x1=0,y1=0;
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1)}
     return{ratio:r.width/c.width,parentWidth:p.width,inkWidth:(x1-x0)*r.width/c.width,inkHeight:(y1-y0)*r.height/c.height};
    });
    // Old Chromium rounds percentage canvas sizes to a fractional CSS pixel;
    // keep the original fixed scale contract while allowing that bounded DIP
    // rounding on legacy x86/x64 runners.
    const formBody=require('../electron/edge-visibility.json').forms.super.body;
    const expectedRatio=((formBody[2]-formBody[0])/clip.registration.referenceBodyWidth)*result.parentWidth/100;
    assert.ok(Math.abs(result.ratio-expectedRatio)<.01,`original calibrated scale must survive large effect bounds: ${JSON.stringify({result,expectedRatio})}`);
    if(frame===1)assert.ok(Math.max(result.inkWidth,result.inkHeight)>70,'preparation pose remains readable at actual desktop size');
    samples.push({frame,...result});
    if(frame===peak)await page.screenshot({path:path.join(out,`${id}-${desktop?'native':'browser'}.png`),omitBackground:true});
   }
   receipt.spells.push({id,peak,samples});await page.clock.runFor(4000);await expect(magic).toHaveCount(0);await toDesktop(page);
  }

  // Interrupt through real controls: no target may keep painting after its
  // expanded host is restored or a different interaction surface is opened.
  receipt.interruptions=[];
  for(const route of ['room','desktop']){
   await enterHome(page);await roomTab(page,'学院');await page.locator('.element-skill-list li').filter({hasText:clips['fire-1'].name}).getByRole('button',{name:'变身',exact:true}).click();
   await expect.poll(async()=>{await page.clock.runFor(16);return page.locator('.magic-box-performance').getAttribute('data-ready')},{timeout:15000}).toBe('true');await page.clock.runFor(2100);
   if(route==='room')await roomTab(page,'设置');else await toDesktop(page);await expect(page.locator('.magic-box-performance')).toHaveCount(0);if(route==='room')await toDesktop(page);receipt.interruptions.push(route);
  }
  await fixture(22);await enterHome(page);await roomTab(page,'学院');
  const language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});
  await expect(language).toContainText('30 点');await expect(language).toContainText('当前');
  await expect(language.getByRole('button',{name:'上这一课',exact:true})).toBeDisabled();
  await roomTab(page,'游戏');await expect(page.getByRole('region',{name:'餐厅打工',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'拉姆的小日常'})).toContainText('30 点');
  await toDesktop(page);let actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByTestId('companion-panel').getByRole('button',{name:'去餐厅打工',exact:true}).click();
  await expect(page.locator('.compact-toast')).toContainText('23 点');assert.equal((await save()).activity,undefined,'insufficient energy cannot start restaurant work');
  await page.getByTestId('companion-panel').getByRole('button',{name:'睡一会儿',exact:true}).click();
  const before=(await save()).stats.energy;await page.clock.fastForward(60000);
  assert.ok(Math.abs((await save()).stats.energy-before-10)<.01,'sleep recovers ten points per minute');
  if(desktop)await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).trayTooltip)).toMatch(/睡觉中[\s\S]*精力 32/);
  // This fixture now starts at 22 energy. After the first minute it has 32;
  // allow another 5.5 minutes to reach the unchanged automatic wake threshold.
  await page.reload();await page.clock.fastForward(330100);assert.equal((await save()).sleeping,false);assert.ok((await save()).stats.energy>=84.9);
  if(desktop){
   await page.evaluate(()=>window.desktop.hideToTray());await page.clock.fastForward(15000);
   await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).trayTooltip)).toMatch(/陪伴中[\s\S]*精力/);
   await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  }
  for(const roll of [.05,.5,.95]){
   await fixture(95);await enterHome(page);await roomTab(page,'游戏');
   await page.evaluate(roll=>{Math.random=()=>roll},roll);
   await page.getByRole('button',{name:'开始翻牌',exact:true}).click();const before=await save();await page.getByTestId('memory-start').click();const kinds=await page.getByTestId('memory-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.kind));await page.clock.runFor(3100);for(const kind of new Set(kinds)){for(let index=0;index<kinds.length;index++)if(kinds[index]===kind)await page.getByTestId('memory-card').nth(index).click();}await page.clock.runFor(7100);await expect(page.getByTestId('memory-result')).toBeVisible();
   const after=await save(),items=Object.keys(after.inventory).filter(id=>after.inventory[id]>(before.inventory[id]??0)),outfits=(after.wardrobe??[]).filter(id=>!before.wardrobe?.includes(id)),furniture=(after.room?.owned??[]).filter(id=>!before.room?.owned?.includes(id));
   assert.equal(items.length+outfits.length+furniture.length,1);assert.ok(after.coins>before.coins,'effective game time earns beans');
   const item=page.locator('.memory-rewards>div').nth(1),name=await item.locator('span').textContent();await expect(item.locator('strong')).toHaveText(items.length?'+1':'已解锁');await expect(item.locator('img')).toBeVisible();await expect(page.locator('.memory-saved')).toContainText(name);
   receipt.rewards.push({roll,id:[...items,...outfits,...furniture][0],name});
   if(roll===.95)await page.screenshot({path:path.join(out,`random-reward-${desktop?'native':'browser'}.png`)});
  }
  assert.equal(new Set(receipt.rewards.map(r=>r.id)).size,3);
  fs.writeFileSync(path.join(out,`${desktop?'native':'browser'}-checks.json`),JSON.stringify(receipt,null,2)+'\n');
  console.log('PASS fixed-size academy apex spells, safe panel/mode interruption, explicit need limits, quick sleep+reopen, live hidden tray stats, random receipts matching actual inventory');
 }finally{
  if(originalDesktop)await page.evaluate(async s=>{await window.desktop.setEdgeHiding(s.edgeHiding);await window.desktop.wander(s.wandering)},originalDesktop);
  if(clock)await page.clock.resume();
  await page.evaluate(values=>{localStorage.clear();for(const[k,v]of Object.entries(values))localStorage.setItem(k,v)},snapshot);
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await require('./smoke-storage.cjs').reloadStoredFixture(page);await page.getByTestId('desktop-character').waitFor();
 }
}
module.exports={verifySpellCare};
