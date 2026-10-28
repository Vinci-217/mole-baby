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
  await page.reload();await page.getByTestId('desktop-character').waitFor();
 };
 try{
  fs.mkdirSync(out,{recursive:true});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.install({time:new Date(await page.evaluate(()=>Date.now()))});clock=true;
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+10000));
  if(desktop)await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
  await fixture(95);
  for(const id of ['fire-6','water-6','wood-6']){
   const clip=clips[id],character=page.getByTestId('desktop-character');
   const actions=await openActions(page);
   // Capture before resizing, from the authoritative native window plus pet
   // offset. Chromium's screenX/screenY can lag a Windows move notification.
   let baseline;
   if(desktop){
    const state=await page.evaluate(()=>window.desktop.getState());assert.equal(state.companionPanel,false);
    const bounds=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    baseline={x:bounds.x+(state.petOffset?.x??0)+30,y:bounds.y+(state.petOffset?.y??0)+71};
    await expect.poll(async()=>{const p=await character.evaluate(el=>{const r=el.getBoundingClientRect();return{x:screenX+r.x,y:screenY+r.y}});return Math.max(Math.abs(p.x-baseline.x),Math.abs(p.y-baseline.y))}).toBeLessThan(1);
   }
   await actions.getByRole('button',{name:'玩耍',exact:true}).click();
   await page.getByTestId('companion-panel').getByRole('button',{name:clip.name,exact:true}).click();
   const magic=character.locator('.magic-box-performance');await expect(magic).toHaveAttribute('data-ready','true');
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
    assert.ok(Math.abs(result.ratio-(160/288)*result.parentWidth/100)<.001,'original fixed scale must survive large effect bounds');
    if(frame===1)assert.ok(Math.max(result.inkWidth,result.inkHeight)>70,'preparation pose remains readable at actual desktop size');
    samples.push({frame,...result});
    if(frame===peak)await page.screenshot({path:path.join(out,`${id}-${desktop?'native':'browser'}.png`),omitBackground:true});
   }
   if(desktop){
    const native=await page.evaluate(()=>window.desktop.getState());assert.equal(native.effectExpanded,true);
    const bounds=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.ok(bounds.width>160||bounds.height>240);
    const anchor=await character.evaluate(el=>{const r=el.getBoundingClientRect();return{x:screenX+r.x,y:screenY+r.y}});
    assert.ok(Math.abs(anchor.x-baseline.x)<1&&Math.abs(anchor.y-baseline.y)<1,`native resize must preserve character position: ${JSON.stringify({id,baseline,anchor,bounds,offset:native.petOffset})}`);
    receipt.spells.push({id,peak,samples,baseline,anchor});
   }
   await page.clock.runFor(4000);await expect(magic).toHaveCount(0);
   if(desktop)await expect.poll(async()=>{
    const b=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());return[b.width,b.height];
   }).toEqual([160,240]);
   if(!desktop)receipt.spells.push({id,peak,samples});
  }
  // Interrupt through real controls: no target may keep painting after its
  // expanded host is restored or a different interaction surface is opened.
  receipt.interruptions=[];
  for(const route of ['panel','room','desktop']){
   if(route==='desktop'){
    await enterHome(page);await roomTab(page,'学院');
    await page.locator('.element-skill-list li').filter({hasText:clips['fire-1'].name}).getByRole('button',{name:'变身',exact:true}).click();
   }else{
    const tools=await openActions(page);await tools.getByRole('button',{name:'玩耍',exact:true}).click();
    await page.getByTestId('companion-panel').getByRole('button',{name:clips['fire-1'].name,exact:true}).click();
   }
   await expect(page.locator('.magic-box-performance')).toHaveAttribute('data-ready','true');await page.clock.runFor(2100);
   if(route==='panel'){
    const tools=await openActions(page);await tools.getByRole('button',{name:'状态',exact:true}).click();
    await expect(page.locator('.magic-box-performance')).toHaveCount(0);
    await page.getByTestId('companion-panel').getByRole('button',{name:'关闭小窗',exact:true}).click();
   }else if(route==='room'){
    await enterHome(page);await expect(page.locator('.magic-box-performance')).toHaveCount(0);await toDesktop(page);
   }else{await toDesktop(page);await expect(page.locator('.magic-box-performance')).toHaveCount(0)}
   if(desktop)await expect.poll(async()=>{const b=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());return[b.width,b.height]}).toEqual([160,240]);
   receipt.interruptions.push(route);
  }
  await fixture(25);await enterHome(page);await roomTab(page,'学院');
  const language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});
  await expect(language).toContainText('30 点');await expect(language).toContainText('当前');
  await expect(language.getByRole('button',{name:'上这一课',exact:true})).toBeDisabled();
  await roomTab(page,'游戏');await expect(page.getByRole('region',{name:'餐厅打工'})).toContainText('31 点');
  await expect(page.getByRole('region',{name:'拉姆的小日常'})).toContainText('30 点');
  await toDesktop(page);let actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByTestId('companion-panel').getByRole('button',{name:'睡一会儿',exact:true}).click();
  const before=(await save()).stats.energy;await page.clock.fastForward(60000);
  assert.ok(Math.abs((await save()).stats.energy-before-10)<.01,'sleep recovers ten points per minute');
  if(desktop)await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).trayTooltip)).toMatch(/睡觉中[\s\S]*精力 35/);
  await page.reload();await page.clock.fastForward(300100);assert.equal((await save()).sleeping,false);assert.ok((await save()).stats.energy>=84.9);
  if(desktop){
   await page.evaluate(()=>window.desktop.hideToTray());await page.clock.fastForward(15000);
   await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).trayTooltip)).toMatch(/陪伴中[\s\S]*精力/);
   await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  }
  for(const roll of [.05,.5,.95]){
   await fixture(95);await enterHome(page);await roomTab(page,'游戏');
   await page.evaluate(roll=>{Math.random=()=>roll},roll);
   await page.getByRole('button',{name:'开始接果子',exact:true}).click();const before=await save();
   await page.getByTestId('fruit-game-start').click();await page.clock.runFor(22000);await expect(page.getByTestId('fruit-game-result')).toBeVisible();
   const after=await save(),awarded=Object.keys(after.inventory).filter(id=>after.inventory[id]>(before.inventory[id]??0));
   assert.equal(awarded.length,1);assert.equal(after.inventory[awarded[0]]-(before.inventory[awarded[0]]??0),1);
   const item=page.locator('.fruit-rewards>div').nth(1),name=await item.locator('span').textContent();
   await expect(item.locator('strong')).toHaveText('+1');await expect(item.locator('img')).toBeVisible();
   await expect(page.locator('.fruit-reward-saved')).toContainText(name);
   receipt.rewards.push({roll,id:awarded[0],name});
   if(roll===.95)await page.screenshot({path:path.join(out,`random-reward-${desktop?'native':'browser'}.png`)});
  }
  assert.equal(new Set(receipt.rewards.map(r=>r.id)).size,3);
  fs.writeFileSync(path.join(out,`${desktop?'native':'browser'}-checks.json`),JSON.stringify(receipt,null,2)+'\n');
  console.log('PASS fixed-size apex spells/native expansion+anchor+restore, safe panel/mode interruption, explicit need limits, quick sleep+reopen, live hidden tray stats, random receipts matching actual inventory');
 }finally{
  if(originalDesktop)await page.evaluate(async s=>{await window.desktop.setEdgeHiding(s.edgeHiding);await window.desktop.wander(s.wandering)},originalDesktop);
  if(clock)await page.clock.resume();
  await page.evaluate(values=>{localStorage.clear();for(const[k,v]of Object.entries(values))localStorage.setItem(k,v)},snapshot);
  if(desktop)await page.evaluate(async()=>{await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
 }
}
module.exports={verifySpellCare};
