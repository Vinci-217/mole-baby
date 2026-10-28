const assert=require('node:assert/strict'),{expect}=require('@playwright/test');
const{enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
async function verifyFixes(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));let failed=false;
 await page.addInitScript(()=>{const Base=window.Audio;window.__fixAudio=[];window.Audio=class extends Base{constructor(...args){super(...args);window.__fixAudio.push(this)}}});
 try{
  await page.evaluate(()=>{const k='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(k));Object.assign(p,{growth:60,growthLocked:false,evolution:undefined,sleeping:false,activity:undefined,outing:undefined,education:undefined,lastTick:Date.now()});p.stats={hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90};localStorage.setItem(k,JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false}));localStorage.removeItem('ramu-room-media-v1')});
  await page.reload();await page.getByTestId('desktop-character').waitFor();await enterHome(page);await roomTab(page,'学院');
  const language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});
  await expect(language.getByRole('button',{name:'上这一课',exact:true})).toBeEnabled();await language.getByRole('button',{name:'上这一课',exact:true}).click();
  await expect(page.locator('.school-scene-status')).toContainText('语言课');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(saved.activity.course,'language');
  await page.reload();await page.getByTestId('desktop-character').waitFor();await enterHome(page);await expect(page.locator('.school-scene-status')).toContainText('语言课');
  await page.locator('.school-scene-status').getByRole('button').click();await roomTab(page,'设置');
  await page.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();
  const forms=page.getByRole('group',{name:'选择神力形态',exact:true});await expect(forms.getByRole('button')).toHaveCount(5);
  await forms.getByRole('button',{name:'切换为经典超级拉姆',exact:true}).click();
  await expect(page.locator('.scene-character canvas[data-form=classic]')).toBeVisible();
  await expect.poll(()=>page.locator('.scene-character canvas[data-form=classic]').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.filter((_,i)=>i%4===3).some(v=>v>0))).toBe(true);
  const locked=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(locked.growthLocked,true);assert.equal(locked.evolution,'classic');
  await toDesktop(page);
  const actions=await require('./smoke-helpers.cjs').openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();await page.getByRole('button',{name:'一起玩球',exact:true}).click();
  const football=page.getByTestId('desktop-character').locator('canvas[data-form=classic][data-sheet=football]');await expect(football).toBeVisible();await expect(football).toHaveAttribute('data-loaded','true');await expect(football).toHaveCount(0,{timeout:12000});
  await page.reload();await page.getByTestId('desktop-character').waitFor();await enterHome(page);await roomTab(page,'设置');
  const background=page.getByRole('checkbox',{name:'允许后台播放音乐',exact:true});await expect(background).not.toBeChecked();
  if(desktop){
   assert.equal(await desktop.evaluate(()=>Number(process.versions.node.split('.')[0])<22||typeof process.getBuiltinModule('module').createRequire==='function'),true);
   await page.evaluate(()=>window.desktop.hideToTray());
   await expect.poll(()=>page.evaluate(()=>window.__fixAudio.filter(a=>a.src.includes('/audio/castle.mp3')).every(a=>a.paused))).toBe(true);
   await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  }
  await background.check();
  await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('ramu-room-media-v1'))).backgroundPlayback).toBe(true);
  await toDesktop(page);await expect.poll(async()=>page.evaluate(()=>window.__fixAudio.some(a=>a.src.includes('/audio/castle.mp3')))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__fixAudio.some(a=>a.src.includes('/audio/castle.mp3')&&!a.paused))).toBe(true);
  // The default and opt-in media policy is tested in both native visibility states.
  if(desktop){
   await page.evaluate(()=>window.desktop.hideToTray());await page.waitForTimeout(500);await expect.poll(()=>page.evaluate(()=>window.__fixAudio.some(a=>a.src.includes('/audio/castle.mp3')&&!a.paused))).toBe(true);
   const state=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible());assert.equal(state,false);
   await desktop.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.send('desktop:music-toggle',false)});
   await expect.poll(()=>page.evaluate(()=>window.__fixAudio.filter(a=>a.src.includes('/audio/castle.mp3')).every(a=>a.paused))).toBe(true);
   await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show()});
  }
  await expect(page.locator('.compact-bubble:not(.visible)')).toHaveCount(0);
  await require('./room-upgrade-checks.cjs').verifyRoomUpgrade(page);
  await require('./school-spells-checks.cjs').verifySchoolSpells(page);
  await require('./spell-care-checks.cjs').verifySpellCare(page,desktop);
  console.log('PASS fixes: language enrolment/reopen, five divine choices/classic pixels, persisted stage lock, opt-in background music, no faded bubble node');
 }catch(error){failed=true;console.error('Fixes original error:',error);console.error('Fixes diagnostic',await page.evaluate(()=>({visible:document.visibilityState,state:window.desktop?true:false,media:localStorage.getItem('ramu-room-media-v1'),audio:window.__fixAudio?.map(a=>({src:a.src,paused:a.paused,error:a.error?.code}))})));throw error;}finally{
  await page.evaluate(s=>{localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor().catch(error=>{if(!failed)throw error});
 }
}
module.exports={verifyFixes};
