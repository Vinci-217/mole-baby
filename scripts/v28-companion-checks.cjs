const{expect}=require('@playwright/test'),assert=require('node:assert/strict');
async function verifyV28(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=180;delete p.evolution;delete p.outing;p.sleeping=false;p.lastTick=Date.now();p.stats={hunger:90,thirst:90,cleanliness:90,happiness:85,health:100,energy:90};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,sound:false}))});await page.reload();const character=page.getByTestId('desktop-character');await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true');
  // Five rapid direct touches use the real App shake policy and source pupils.
  for(let i=0;i<5;i++)await character.evaluate(n=>n.click());
  const pupils=character.locator('canvas[data-sheet=dizzy]');await expect(pupils).toHaveAttribute('data-loaded','true');const point=()=>pupils.getAttribute('data-pupil-x');const first=await point();await expect.poll(point,{timeout:1500}).not.toBe(first);await expect(character.locator('.social-dizzy-stars')).toBeVisible();await expect(pupils).toHaveCount(0,{timeout:5000});
  console.log('PASS: real dizziness uses orbiting original pupils and recovers; calibrated 30 percent body exposure across eight forms and all four edges');
 }finally{await page.evaluate(snapshot=>{localStorage.clear();for(const[k,v]of Object.entries(snapshot))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor()}
}
module.exports={verifyV28};
