const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{expect}=require('@playwright/test');
const {enterHome,toDesktop,roomTab,openActions}=require('./smoke-helpers.cjs');
const out=path.resolve(__dirname,'../artifacts/original-room');
async function verifyOriginalRoom(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),label=desktop?'native':'browser';
 let restoreExternal=false;
 const screenshot=name=>page.screenshot({path:path.join(out,`${label}-${name}.png`),omitBackground:name.startsWith('senior')});
 try{
  fs.mkdirSync(out,{recursive:true});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{
   const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(pet,{growth:420,growthLocked:true,evolution:undefined,wearing:undefined,sleeping:false,activity:undefined,outing:undefined,lastTick:Date.now()});pet.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false}));
   const key='ramu-companion-memory-v1:'+pet.createdAt,m=JSON.parse(localStorage.getItem(key));if(m){m.events.push({id:'original-room-timer',at:Date.now(),kind:'focus-timer',detail:'正向计时：实际专注8分钟，手动结束。'});localStorage.setItem(key,JSON.stringify(m))}
  });
  if(desktop)await page.evaluate(async()=>{await window.desktop.setRoomFullscreen(false);await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true);await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
  await page.reload();const character=page.getByTestId('desktop-character');await character.waitFor();
  const rotor=character.locator('canvas[data-form=senior][data-sheet=flight]');await expect(rotor).toHaveAttribute('data-loaded','true',{timeout:25000});await expect(rotor).toHaveAttribute('data-fan-blades','8');
  const speed=async()=>Number(await rotor.getAttribute('data-fan-speed'));
  await screenshot('senior-idle');await character.click();await expect.poll(speed).toBeGreaterThan(1);const petting=await speed();await screenshot('senior-petting');await expect(character.locator('.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:8000});await expect.poll(speed,{timeout:5000}).toBeLessThan(.4);
  let slow=null,fast=null;
  if(!desktop){
   const drag=async(delay,step)=>{
    const b=await character.boundingBox(),x=b.x+b.width*.5,y=b.y+b.height*.55;await page.mouse.move(x,y);await page.mouse.down();
    for(let i=1;i<=8;i++){await page.mouse.move(x+i*step,y);await page.waitForTimeout(delay)}
    const value=await speed();await screenshot(delay>50?'senior-slow-drag':'senior-fast-drag');await page.mouse.up();return value;
   };
   slow=await drag(100,7);await page.waitForTimeout(2200);fast=await drag(16,14);assert.ok(fast>slow*1.7,`faster horizontal drag must accelerate the rotor: slow=${slow}, fast=${fast}`);await page.waitForTimeout(2000);
  }
  const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();await expect(page.getByTestId('companion-panel').getByRole('button',{name:'睡一会儿',exact:true}).locator('img')).toHaveAttribute('src',/status-sleep\.(png|webp)$/);await page.getByTestId('companion-panel').getByRole('button',{name:'关闭小窗',exact:true}).click();
  await enterHome(page);const dock=page.getByRole('navigation',{name:'小屋功能',exact:true});await expect(dock.getByRole('button')).toHaveCount(9);const icons=await dock.locator('img').evaluateAll(items=>items.map(i=>i.getAttribute('src')));assert.equal(new Set(icons).size,9);await screenshot('room');
  const site=page.getByRole('button',{name:'进入摩尔庄园',exact:true}),decor=page.getByRole('button',{name:'布置小屋',exact:true});assert.ok((await site.boundingBox()).x<(await decor.boundingBox()).x);
  if(desktop){
   await desktop.evaluate(({shell})=>{globalThis.__originalOpenExternal=shell.openExternal;globalThis.__manorLinks=[];shell.openExternal=async url=>globalThis.__manorLinks.push(url)});restoreExternal=true;
   await site.click();await expect.poll(()=>desktop.evaluate(()=>globalThis.__manorLinks)).toEqual(['https://mole.61.com/']);
   await desktop.evaluate(({shell})=>{shell.openExternal=globalThis.__originalOpenExternal;delete globalThis.__originalOpenExternal;delete globalThis.__manorLinks});restoreExternal=false;
  }else{
   await page.context().route('https://mole.61.com/',route=>route.fulfill({contentType:'text/html',body:'<title>Official manor link test</title>'}));
   const popupPromise=page.context().waitForEvent('page');await site.click();const popup=await popupPromise;await popup.waitForURL('https://mole.61.com/');await popup.close();await page.context().unroute('https://mole.61.com/');
  }
  await expect(page.locator('.cottage-scene')).toBeVisible();
  await roomTab(page,'设置');await expect(page.getByRole('region',{name:'当前成长阶段',exact:true})).toHaveCount(0);
  await roomTab(page,'成长');const growth=page.getByRole('region',{name:'当前成长阶段',exact:true});await expect(growth.getByRole('group',{name:'选择当前阶段',exact:true}).getByRole('button')).toHaveCount(5);await expect(growth.getByRole('button',{name:'自动成长',exact:true})).toBeVisible();await expect(growth.getByRole('button',{name:'固定形态',exact:true})).toContainText('手动固定形态');await expect.poll(()=>growth.locator('.stage-choices canvas:not(.ram-wear)').evaluateAll(items=>items.length===5&&items.every(n=>n.dataset.loaded==='true'&&n.getContext('2d').getImageData(0,0,n.width,n.height).data.some((v,i)=>i%4===3&&v>0))),{timeout:25000}).toBe(true);await screenshot('growth');
  await roomTab(page,'回忆');const diary=page.getByRole('region',{name:'照料回忆',exact:true}),timers=page.getByRole('region',{name:'计时记录',exact:true});assert.ok((await diary.boundingBox()).y<(await timers.boundingBox()).y);await expect(timers).toContainText('实际专注8分钟');
  for(const region of [diary,timers]){await region.locator('summary').click();await expect(region.locator('details')).not.toHaveAttribute('open','');}
  await page.waitForTimeout(1100);for(const region of [diary,timers])await expect(region.locator('details')).not.toHaveAttribute('open','');await screenshot('memories-collapsed');
  await diary.locator('summary').focus();await page.keyboard.press('Enter');await expect(diary.locator('details')).toHaveAttribute('open','');await expect(timers.locator('details')).not.toHaveAttribute('open','');await timers.locator('summary').click();await screenshot('memories');
  if(!desktop){await page.setViewportSize({width:1000,height:720});await screenshot('memories-small');await toDesktop(page);await enterHome(page);await screenshot('room-small');const bounds=await page.locator('.scene-top-actions').evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth}});assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1);await page.setViewportSize({width:1180,height:820})}
  fs.writeFileSync(path.join(out,`${label}-checks.json`),JSON.stringify({version:require('../package.json').version,native:Boolean(desktop),pettingSpeed:petting,slowDragSpeed:slow,fastDragSpeed:fast,distinctIcons:icons.length,growthLocation:'成长',diaryBeforeTimers:true,independentDisclosure:true,officialLink:'https://mole.61.com/'},null,2)+'\n');
  console.log('PASS original room: nine distinct icons, trusted official link, growth-only forms, independent ordered memory folding, original sleep icon, eight-blade rotor with pet boost'+(!desktop?' and proportional drag speed':''));
 }finally{
  if(restoreExternal)await desktop.evaluate(({shell})=>{shell.openExternal=globalThis.__originalOpenExternal;delete globalThis.__originalOpenExternal;delete globalThis.__manorLinks});
  await page.evaluate(values=>{localStorage.clear();for(const[k,v]of Object.entries(values))localStorage.setItem(k,v)},snapshot);
  if(desktop)await page.evaluate(async()=>{await window.desktop.setRoomFullscreen(false);await window.desktop.setCompanionPanel(false);await window.desktop.setPetMode(true)});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
 }
}
module.exports={verifyOriginalRoom};
