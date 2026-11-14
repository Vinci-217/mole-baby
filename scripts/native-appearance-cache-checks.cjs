const assert=require('node:assert/strict'),{expect}=require('@playwright/test');
const {reloadWithStorage}=require('./smoke-storage.cjs');
/** Same checks on packaged modern/legacy Windows and both native Macs. */
async function verifyNativeAppearanceCache(page){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  const fixture=await page.evaluate(()=>{const values=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(values['ramu-house-save-v1']);Object.assign(p,{growth:840,highestGrowth:840,growthLocked:true,evolution:'super',wearing:'wizard-cap',sleeping:false,activity:undefined,outing:undefined,lastTick:Date.now(),stats:{hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95}});p.wardrobe=[...new Set([...(p.wardrobe??[]),'wizard-cap'])];values['ramu-house-save-v1']=JSON.stringify(p);values['ramu-house-preferences-v2']=JSON.stringify({lively:false,presence:false,roomWander:false,outings:false,sound:false,gameSound:false});return values});
  await reloadWithStorage(page,fixture);await page.evaluate(()=>window.desktop.setPetMode(true));
  const ready=page.locator('.desktop-character .official-ram-clip');await expect(ready).toHaveAttribute('data-loaded','true',{timeout:60000});
  await expect(ready.locator('iframe')).toHaveCSS('opacity','1');
  const frame=await ready.locator('iframe').elementHandle(),runtime=await frame.contentFrame();
  const origin=await runtime.evaluate(()=>{window.__nativeAppearanceAVM=window.player;return performance.timeOrigin});
  const canMove=await page.evaluate(()=>typeof Element.prototype.moveBefore==='function');
  for(let round=0;round<2;round++)for(const desktop of [false,true]){
   await page.evaluate(value=>window.desktop.setPetMode(value),desktop);
   const active=page.locator((desktop?'.desktop-character':'.scene-character')+' .official-ram-clip');
   await expect(active).toHaveAttribute('data-loaded','true',{timeout:60000});await expect(active.locator('iframe')).toHaveCSS('opacity','1');
   if(canMove){
    assert(await active.locator('iframe').evaluate((node,previous)=>node===previous,frame),'A ready iframe survives desktop/room switches');
    assert.equal(await runtime.evaluate(()=>performance.timeOrigin),origin);
    assert(await runtime.evaluate(()=>window.__nativeAppearanceAVM===window.player),'The original AVM survives the move');
   }
  }
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1'))),expected=JSON.parse(fixture['ramu-house-save-v1']);
  for(const key of ['createdAt','name','color','growth','evolution','wearing','wardrobe','inventory'])assert.deepEqual(after[key],expected[key],key+' survives view switching');
  console.log('PASS packaged appearance cache: original costume visibly restored across four desktop/room switches; '+(canMove?'same iframe document and AVM retained':'legacy engine reload fallback verified')+'; save identity and growth unchanged');
 }finally{await reloadWithStorage(page,snapshot);await page.evaluate(()=>window.desktop.setPetMode(true))}
}
module.exports={verifyNativeAppearanceCache};
