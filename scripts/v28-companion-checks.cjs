const{expect}=require('@playwright/test'),assert=require('node:assert/strict');
async function verifyV28(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=180;delete p.wearing;p.wardrobe=[...new Set([...(p.wardrobe??[]),'wizard-cap'])];delete p.activity;delete p.evolution;delete p.outing;p.sleeping=false;p.lastTick=Date.now();p.stats={hunger:90,thirst:90,cleanliness:90,happiness:85,health:100,energy:90};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,sound:false}))});await require('./smoke-storage.cjs').reloadStoredFixture(page);const character=page.getByTestId('desktop-character');await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true',{timeout:20000});
  // Five direct touches exercise App's rapid-touch policy; middle form now
  // uses the full original daily timeline rather than the older pupil overlay.
  for(let i=0;i<5;i++)await character.click({position:await require('./smoke-helpers.cjs').ramBodyPosition(character)});
  const dizzy=character.locator('.ram-sprite').first();await expect(dizzy).toHaveAttribute('data-action','dizzy');
  const source=character.locator('canvas[data-sheet=daily]');await expect(source).toHaveAttribute('data-loaded','true',{timeout:20000});const frame=()=>source.getAttribute('data-source-frame'),first=await frame();await expect.poll(frame,{timeout:1500}).not.toBe(first);await expect(dizzy).toHaveAttribute('data-action','idle',{timeout:10000});
  console.log('PASS: rapid real body clicks play the complete original dizziness timeline, advance frames and recover');
 }finally{await page.evaluate(snapshot=>{localStorage.clear();for(const[k,v]of Object.entries(snapshot))localStorage.setItem(k,v)},snapshot);await require('./smoke-storage.cjs').reloadStoredFixture(page);await page.getByTestId('desktop-character').waitFor()}
}
module.exports={verifyV28};
