const{expect}=require('@playwright/test'),assert=require('node:assert/strict'),path=require('node:path');
const{openActions}=require('./smoke-helpers.cjs');
const{warpPointer}=require('./native-pointer.cjs');
async function verifyElasticCare(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{growth:180,coins:2000,sleeping:false,wardrobe:['wizard-cap'],wearing:'wizard-cap',lastTick:Date.now(),stats:{hunger:15,thirst:15,cleanliness:15,happiness:90,health:60,energy:95}});delete p.evolution;delete p.outing;p.inventory.biscuit=5;p.inventory.juice=5;p.inventory['180003']=5;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,lively:false,presence:false}));});await page.reload();
  const character=page.getByTestId('desktop-character'),ram=character.locator('.ram-sprite'),save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  // A cold Electron profile decodes and tints the full middle-form atlas here.
  // Wait for painted pixels using the same budget as desktop waitForClassic.
  await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true',{timeout:20000});
  if(desktop){await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);await window.desktop.movePet(-300,-100)});}
  await openActions(page);await page.getByRole('button',{name:'状态',exact:true}).click();const panel=page.getByTestId('companion-panel'),pocket=panel.locator('.care-pocket');
  await pocket.getByLabel('物品分类',{exact:true}).selectOption('food');const before=await save();await pocket.locator('[data-item-id=biscuit]').click();await expect(ram.locator('[data-care-routine=eat]')).toBeVisible();await expect.poll(async()=>(await save()).inventory.biscuit).toBe(4);await expect(page.getByTestId('care-gain')).toHaveCount(0);await expect(ram.locator('.care-food-bite')).toHaveCount(4);
  await page.waitForTimeout(950);const food=await ram.locator('.care-food-bite').evaluateAll(nodes=>nodes.map(n=>({y:parseFloat(n.style.top),opacity:Number(n.style.opacity)})));assert.ok(food.some(p=>p.opacity>0&&p.y<65));
  // A second one-click portion replaces the clip and merges only actual,
  // already committed gains. The final feedback may not disappear or double.
  await pocket.locator('[data-item-id=biscuit]').click();const after=await save();await expect(page.getByTestId('care-gain')).toHaveCount(0);await expect(page.getByTestId('care-gain')).toContainText(`+${Math.round(after.stats.hunger)-Math.round(before.stats.hunger)}`,{timeout:6500});
  await pocket.getByLabel('物品分类',{exact:true}).selectOption('drink');await pocket.locator('[data-item-id=juice]').click();await expect(ram.locator('.care-drink-bottle')).toBeVisible();await expect(ram.locator('[data-care-routine=drink]')).toHaveAttribute('data-item-id','juice');await expect(page.getByTestId('care-gain')).toHaveCount(0);await expect(page.getByTestId('care-gain')).toContainText('水分',{timeout:5500});
  await pocket.getByLabel('物品分类',{exact:true}).selectOption('clean');await pocket.locator('[data-item-id="180003"]').click();await expect(ram.locator('.care-clean-foam')).toBeVisible();await expect(page.getByTestId('care-gain')).toContainText('清洁',{timeout:5000});
  await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();await openActions(page);await page.getByRole('button',{name:'玩耍',exact:true}).click();await panel.getByRole('button',{name:'和蝴蝶玩',exact:true}).click();await expect(ram.locator('.social-butterfly-net')).toBeVisible();await expect(ram.locator('.social-butterfly')).toBeVisible();const angle=()=>ram.evaluate(n=>n.style.getPropertyValue('--net-angle'));const first=await angle();await expect.poll(angle,{timeout:3000}).not.toBe(first);await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();
  if(desktop){
   const b=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());await warpPointer(desktop,{x:b.x+70,y:b.y+120});await page.evaluate(async()=>{await window.desktop.preparePetDrag();await window.desktop.startPetDrag()});const p=await page.evaluate(async()=>(await window.desktop.getState()).dragPoint);assert.ok(p&&Number.isFinite(p.at));await warpPointer(desktop,{x:b.x+120,y:b.y+120});const q=await page.evaluate(async()=>(await window.desktop.getState()).dragPoint);assert.ok(q.x>p.x+40);await page.evaluate(()=>window.desktop.endPetDrag());assert.equal(await page.evaluate(async()=>(await window.desktop.getState()).dragPoint),undefined);
  }else{
   // Exercise the real UI pointer path in all five growth stages. Native OS
   // geometry and cursor sampling are checked separately above / by compact care.
   for(const growth of [0,60,180,420,840]){
    await page.evaluate(growth=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=growth;p.sleeping=false;p.lastTick=Date.now();if(growth===840)p.evolution='super';else delete p.evolution;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p))},growth);await page.reload();await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true',{timeout:20000});
    const box=await character.boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.55;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-12,y,{steps:2});for(let i=1;i<=5;i++){await page.mouse.move(x-12-i*10,y+i*2);await page.waitForTimeout(32)}
    await expect(ram).toHaveClass(/is-dragging/);const transform=await ram.locator('.ram-elastic-layer').evaluate(n=>getComputedStyle(n).transform);assert.notEqual(transform,'matrix(1, 0, 0, 1, 0, 0)');if(growth===0)assert.equal(await ram.locator('.seed-pot-original').evaluate(n=>getComputedStyle(n).rotate),'none');
    const held=await ram.evaluate(n=>parseFloat(n.style.getPropertyValue('--pull-x')));await page.mouse.up();await expect(ram).not.toHaveClass(/is-dragging/);
    const recoil=await ram.evaluate(n=>new Promise(resolve=>{const values=[],start=performance.now();function frame(now){values.push(parseFloat(n.style.getPropertyValue('--pull-x')));if(now-start<1300)requestAnimationFrame(frame);else resolve(values)}requestAnimationFrame(frame)}));
    assert.ok(recoil.some(x=>x*held<0&&Math.abs(x)>Math.abs(held)*.1),'each stage visibly rebounds past rest after a real UI release');const residue=await ram.evaluate(n=>Math.abs(parseFloat(n.style.getPropertyValue('--pull-x'))));assert.ok(residue<.1,`spring must settle: ${residue}`);
   }
  }
  console.log('PASS: elastic stage-specific pulling and settle; real cursor samples during native drag; plate rain, shared bottle/clean gestures and delayed capped gains without loss on rapid clicks; playful butterfly net');
  if(!desktop)console.log('PASS: real UI dragging and visible release overshoot across five stages; seed pot stays upright');
 }catch(error){console.error('Elastic care check failed before cleanup:',error);throw error}finally{if(!page.isClosed()){await page.evaluate(snapshot=>{localStorage.clear();for(const[k,v]of Object.entries(snapshot))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor()}}
}
module.exports={verifyElasticCare};
