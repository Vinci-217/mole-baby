const {expect}=require('@playwright/test'),assert=require('node:assert/strict'),path=require('node:path');
const {enterHome,roomTab,toDesktop,openActions}=require('./smoke-helpers.cjs');
const clips=require('../public/assets/original/element-skills/clips.json');
async function verifySchoolSpells(page){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));let clock=false,failed=false;
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 try{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{growth:840,evolution:'super',growthLocked:true,sleeping:false,activity:undefined,outing:undefined,education:undefined,wardrobe:[],wearing:undefined,lastTick:Date.now(),coins:10000});p.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false}));localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:false}));});
  await page.reload();await enterHome(page);await roomTab(page,'衣橱');
  await page.getByRole('button',{name:'试戴魔法法杖',exact:true}).click();await expect(page.getByRole('button',{name:'魔法课结业获得',exact:true})).toBeDisabled();
  await page.clock.install({time:new Date(await page.evaluate(()=>Date.now()))});clock=true;await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  await roomTab(page,'学院');const course=name=>page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name,exact:true})});
  await course('魔法入门课').getByRole('button',{name:'上这一课',exact:true}).click();
  const room=page.locator('.school-scene-status');await expect(room.getByRole('timer',{name:'魔法入门课倒计时',exact:true})).toHaveText('3:00');await expect(room.getByRole('progressbar')).toHaveAttribute('max','180000');
  await page.clock.fastForward(60000);await expect(room.getByRole('timer')).toHaveText('2:00');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/v305-learning-room.png')});
  await toDesktop(page);await expect(page.locator('.school-desktop-status').getByRole('timer')).toHaveText('2:00');
  await page.getByTestId('desktop-character').hover();await page.clock.runFor(50);
  const statusBox=await page.locator('.school-desktop-status').boundingBox(),toolsBox=await page.getByTestId('pet-actions').boundingBox();
  assert.ok(statusBox.y+statusBox.height<toolsBox.y||statusBox.y>toolsBox.y+toolsBox.height,'Learning progress must not overlap the hover toolbar');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/v305-learning-desktop.png'),omitBackground:true});
  await page.reload();await expect(page.locator('.school-desktop-status').getByRole('timer')).toHaveText('2:00');
  await page.clock.fastForward(119000);assert.ok(!(await save()).wardrobe?.includes('star-wand'));await expect(page.locator('.school-desktop-status').getByRole('timer')).toHaveText('0:01');
  await page.clock.fastForward(1100);await expect.poll(async()=>(await save()).wardrobe).toEqual(['star-wand']);await expect(page.locator('.school-desktop-status')).toContainText('学习完成');assert.equal((await save()).coins,10000);
  await page.reload();assert.deepEqual((await save()).wardrobe,['star-wand']);await enterHome(page);await roomTab(page,'衣橱');await page.getByRole('button',{name:'试戴魔法法杖',exact:true}).click();await page.getByRole('button',{name:'给拉姆戴上',exact:true}).click();assert.equal((await save()).wearing,'star-wand');
  for(const name of ['火系变身课','水系变身课','木系变身课']){
   await roomTab(page,'学院');await course(name).getByRole('button',{name:'上这一课',exact:true}).click();await expect(room.getByRole('timer')).toHaveText('3:00');await page.clock.fastForward(180150);
  }
  await toDesktop(page);let actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  let panel=page.getByTestId('companion-panel');await expect(panel.locator('.desktop-element-group')).toHaveCount(3);await expect(panel.locator('.desktop-element-grid button')).toHaveCount(18);
  assert.ok(await panel.evaluate(p=>p.scrollHeight>p.clientHeight),'Spells must be reachable in the compact scrolling pocket');
  await panel.evaluate(p=>p.scrollTop=p.scrollHeight);await page.clock.runFor(50);await page.screenshot({path:path.resolve(__dirname,'../artifacts/v305-spells-pocket.png'),omitBackground:true});
  for(const [id,name]of[['fire-6','星火涅槃'],['water-6','水上狂舞'],['wood-6','上天入地']]){
   if(!await panel.count()){actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click()}
   await panel.getByRole('button',{name,exact:true}).click();const magic=page.getByTestId('desktop-character').locator('.magic-box-performance');await expect(magic).toHaveAttribute('data-ready','true');
   await page.clock.runFor(950);const smoke=magic.locator('.magic-box-smoke');await expect(smoke).toHaveCount(1);
   const white=await smoke.evaluate(im=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.filter=getComputedStyle(im).filter;ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200){if(d[i]!==255||d[i+1]!==255||d[i+2]!==255)return false;n++}return n>100});assert.equal(white,true,'Transformation smoke must be pure white');
   await page.clock.runFor(1700);await expect(magic.locator(`canvas[data-element-skill="${id}"]`)).toBeVisible();await expect(panel).toHaveCount(0);
   await page.clock.fastForward(clips[id].durationMs+5000);await expect(magic).toHaveCount(0);assert.deepEqual((await save()).wardrobe,['star-wand']);
  }
  console.log('PASS school spells: visible 3-minute course progress in room and desktop/reload, finish-only wand reward and no purchase, all 18 scrolling desktop entries, three apex casts with pure-white smoke and restored outfit');
 }catch(error){failed=true;console.error('School/spells error:',error);throw error;}finally{
  if(clock)await page.clock.resume();await page.evaluate(s=>{localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor().catch(e=>{if(!failed)throw e});
 }
}
module.exports={verifySchoolSpells};
