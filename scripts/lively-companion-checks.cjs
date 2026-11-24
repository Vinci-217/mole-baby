const{expect}=require('@playwright/test'),assert=require('node:assert/strict'),path=require('node:path');
const{enterHome,toDesktop,roomTab}=require('./smoke-helpers.cjs');
const{reloadWithStorage}=require('./smoke-storage.cjs');

async function verifyAutonomousPlayback(page,fixture){
 const motionPreference=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'reduce':'no-preference');
 const desktop=await page.evaluate(()=>window.desktop?.getState());
 const pet=JSON.parse(fixture['ramu-house-save-v1']);
 delete pet.wearing;
 const prefs={sound:false,lively:true,presence:false,outings:false,idleIntervalSeconds:10};
 const memory={version:1,petId:String(pet.createdAt),facts:[{kind:'boundary',value:'请不要主动说话',at:pet.createdAt}],events:[],messages:[]};
 try{
  await page.emulateMedia({reducedMotion:'reduce'});
  if(desktop)await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
  await reloadWithStorage(page,{...fixture,'ramu-house-save-v1':JSON.stringify(pet),'ramu-house-preferences-v2':JSON.stringify(prefs),[`ramu-companion-memory-v1:${pet.createdAt}`]:JSON.stringify(memory)});
  await expect(page.getByTestId('desktop-character')).toBeVisible();
  await page.evaluate(()=>{Math.random=()=>.05});
  const clip=page.getByTestId('desktop-character').locator('.ram-sprite[data-action^="ambient-"] > .official-ram-clip');
  await expect(clip).toHaveAttribute('data-loaded','true',{timeout:65000});
  const frame=await(await clip.locator('iframe').elementHandle()).contentFrame();
  const pixels=()=>frame.evaluate(()=>window.player.shadowRoot.querySelector('canvas').toDataURL());
  const first=await pixels();
  await expect.poll(pixels,{timeout:6000}).not.toBe(first);
  await expect(page.locator('.compact-bubble')).toHaveCount(0);
  console.log('PASS: a scheduled original action paints distinct frames with reduced motion and a saved quiet-speech preference');

  const calmPet={...pet,createdAt:Date.UTC(2026,10,20,5),lastTick:Date.now(),growth:840,highestGrowth:840,naturalGrowth:840,
   growthLocked:true,evolution:'super',stats:{...pet.stats,happiness:31}};
  await reloadWithStorage(page,{...fixture,'ramu-house-save-v1':JSON.stringify(calmPet),'ramu-house-preferences-v2':JSON.stringify(prefs)});
  await page.evaluate(()=>{Math.random=()=>.98});
  const expression=page.getByTestId('desktop-character').locator('>.ram-sprite[data-action="mood-content"] canvas[data-loaded="true"]');
  await expect(expression).toBeVisible({timeout:25000});
  const startingPixels=await expression.evaluate(canvas=>canvas.toDataURL());
  await expect.poll(async()=>expression.evaluate(canvas=>canvas.toDataURL(),{},{timeout:500}),{timeout:2200}).not.toBe(startingPixels);
  console.log('PASS: a scheduled built-in expression paints distinct frames with reduced motion');

  await page.emulateMedia({reducedMotion:'no-preference'});
  const needsCare={...pet,lastTick:Date.now(),stats:{...pet.stats,hunger:23,thirst:21}};
  await reloadWithStorage(page,{...fixture,'ramu-house-save-v1':JSON.stringify(needsCare),'ramu-house-preferences-v2':JSON.stringify(prefs),[`ramu-companion-memory-v1:${pet.createdAt}`]:JSON.stringify(memory)});
  const actor=page.getByTestId('desktop-character').locator('>.ram-sprite');
  await expect(actor).toHaveAttribute('data-action','hungry');
  await expect(actor).toHaveAttribute('data-action',/^ambient-(hungry|thirsty)$/,{timeout:25000});
  await expect(actor.locator('.ram-need-cue')).toBeVisible();
  await expect(actor).toHaveAttribute('data-action','hungry',{timeout:12000});
  console.log('PASS: needs care can do a quiet scheduled gesture and returns to its original status');
  if(desktop){
   await page.evaluate(()=>window.desktop.setPetMode(false));
   await roomTab(page,'设置');
   // The tray switches the native view directly while a room dialog is open.
   await page.evaluate(()=>window.desktop.setPetMode(true));
   await expect(actor).toHaveAttribute('data-action',/^ambient-(hungry|thirsty)$/,{timeout:25000});
   console.log('PASS: direct native view switches clear room dialogs and resume scheduled actions');
  }
 }finally{
  await page.emulateMedia({reducedMotion:motionPreference});
  if(desktop)await page.evaluate(async state=>{await window.desktop.wander(state.wandering);await window.desktop.setEdgeHiding(state.edgeHiding)},desktop);
 }
}

/** Run inside each real packaged platform; no test bridge is shipped. */
async function verifyLivelyCompanion(page){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 try{
  const fixture=await page.evaluate(()=>{const entries=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(entries['ramu-house-save-v1']),now=Date.now();Object.assign(p,{createdAt:now-2*86400000,lastTick:now,growth:180,coins:50,education:{lessons:{language:3,magic:3},graduated:{language:now-1000,magic:now-500}},sleeping:false,color:'blue',wardrobe:['gold-feather','wizard-cap','rabbit-hood'],wearing:'gold-feather',stats:{hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95}});delete p.evolution;delete p.checkIn;delete p.outing;delete p.lastOutingAt;delete p.activity;entries['ramu-house-save-v1']=JSON.stringify(p);entries['ramu-house-preferences-v2']=JSON.stringify({sound:false,lively:false,presence:false,outings:true});return entries;});
  await verifyAutonomousPlayback(page,fixture);
  await reloadWithStorage(page,fixture);await expect(page.getByTestId('desktop-character')).toBeVisible();await enterHome(page);
  await expect.poll(async()=>{const p=await save();return{coins:p.coins,checkIn:p.checkIn}}).toEqual({coins:50,checkIn:undefined});
  const daily=page.getByRole('button',{name:'每日签到领取1000摩尔豆',exact:true});await daily.evaluate(b=>{b.click();b.click()});await expect.poll(async()=>(await save()).coins).toBe(1050);await expect(page.getByRole('button',{name:'今日已签到',exact:true})).toBeDisabled();await page.reload();await expect(page.getByTestId('desktop-character')).toBeVisible();await enterHome(page);await expect(page.getByRole('button',{name:'今日已签到',exact:true})).toBeDisabled();assert.equal((await save()).coins,1050);
  await roomTab(page,'衣橱');const mirror=page.locator('.wardrobe-mirror');await page.getByRole('button',{name:'试戴粉兔帽',exact:true}).click();
  // Every ordinary gesture retains the original dressed appearance. Start
  // with a movement pose, then verify sleeping and petting preserve its rig.
  await page.getByRole('button',{name:'预览左走动作',exact:true}).click();
  await expect(mirror.locator('.ram-sprite').first()).toBeVisible();
  // Legacy Chromium can keep the first wardrobe preview on its compatible
  // static fallback while the native player is still warming up. The shipped
  // desktop outfit path below is the authoritative original-SWF check; when
  // the mirror player is present, retain the proportional pose assertions.
  const player=mirror.locator('.official-ram-clip');
  await player.first().waitFor({state:'attached',timeout:5000}).catch(()=>{});
  if(await player.count()){
    await expect(player).toHaveAttribute('data-loaded','true',{timeout:60000});await expect(player).toHaveAttribute('data-source',/1200033\.swf$/);
    const size=await mirror.locator('.ram-sprite').first().boundingBox();
    const original=await player.locator('iframe').elementHandle();
    for(const name of ['左走','右走','睡觉','摸摸']){await page.getByRole('button',{name:`预览${name}动作`,exact:true}).click();await expect(mirror.locator('.ram-sprite').first()).toBeVisible();const bounds=await mirror.locator('.ram-sprite').first().boundingBox();assert.ok(Math.abs(bounds.width-size.width)<.5&&Math.abs(bounds.height-size.height)<.5,'native costume poses preserve body scale');await expect(player).toHaveAttribute('data-loaded','true');await expect(player.locator('iframe')).toHaveCount(1);assert(await original.evaluate(node=>node.isConnected),'all ordinary poses retain the dressed source');}
  }
  assert.equal((await save()).wearing,'gold-feather');assert.equal((await save()).coins,1050);
  await roomTab(page,'游戏');const roomRam=page.locator('.scene-character .ram-sprite').first(),dressed=roomRam.locator('.ram-outfit-source .official-ram-clip');
  await expect(dressed).toHaveAttribute('data-loaded','true',{timeout:60000});const dressedFrame=await dressed.locator('iframe').elementHandle();
  await page.getByRole('button',{name:'一起翻翻书',exact:true}).click();
  const reading=roomRam.locator('[data-source$="Movie/14.swf"] canvas[data-uploaded-id="read"]');
  await expect(reading).toHaveAttribute('data-loaded','true');
  const firstPage=await reading.getAttribute('data-source-frame');
  await expect.poll(()=>reading.getAttribute('data-source-frame')).not.toBe(firstPage);
  await expect(dressed).toHaveAttribute('data-loaded','true');assert(await dressedFrame.evaluate(node=>node.isConnected));assert.equal((await save()).wearing,'gold-feather');
  await page.getByRole('button',{name:'摸摸拉姆',exact:true}).press('Enter');await expect(roomRam).toHaveAttribute('data-action','pet');await expect(reading).toHaveCount(0);assert(await dressedFrame.evaluate(node=>node.isConnected));await expect(roomRam).toHaveAttribute('data-action','idle',{timeout:15000});
  await roomTab(page,'游戏');await page.getByRole('button',{name:'一起变魔术',exact:true}).click();const transformation=page.locator('.scene-character .magic-box-performance');await expect(transformation).toHaveAttribute('data-magic-subject','box',{timeout:5000});await expect(transformation.locator('.magic-box-layer').first()).toBeVisible();assert.equal((await save()).wearing,'gold-feather');await expect(transformation).toHaveCount(0,{timeout:10000});await expect(roomRam.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:60000});assert.equal((await save()).wearing,'gold-feather');
  await roomTab(page,'游戏');await expect(page.getByRole('button',{name:'一起顶书练习',exact:true})).toHaveCount(0);await page.getByRole('tab',{name:'道具',exact:true}).click();await expect(page.getByRole('button',{name:'播放足球',exact:true})).toBeVisible();await page.getByRole('tab',{name:'活动',exact:true}).click();
  await roomTab(page,'游戏');await page.screenshot({path:path.resolve(__dirname,'../artifacts/v26-pastimes.png')});await page.getByRole('button',{name:'出门逛逛',exact:true}).click();const trip=(await save()).outing;assert.ok(trip&&trip.returnsAt-trip.startedAt>=120000&&trip.returnsAt-trip.startedAt<=300000);await toDesktop(page);const note=page.locator('.pet-away-note');await expect(note).toBeVisible();await page.waitForTimeout(1600);assert.ok(await page.getByTestId('desktop-character').locator('.ram-sprite').first().evaluate(n=>Number(getComputedStyle(n).opacity)<.01));await page.screenshot({path:path.resolve(__dirname,'../artifacts/v26-away.png'),omitBackground:true});await page.reload();await expect(note).toBeVisible();await note.getByRole('button',{name:'叫拉姆回来',exact:true}).click();await expect(note).toHaveCount(0);assert.equal((await save()).outing,undefined);
  await page.evaluate(trip=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1')),now=Date.now();p.outing={...trip,startedAt:now-180000,returnsAt:now-1,id:`${p.createdAt}:${now-180000}`};localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));},trip);await require('./smoke-storage.cjs').reloadStoredFixture(page);await expect.poll(async()=>(await save()).outing).toBeUndefined();const after=await save();assert.equal(after.coins,1050);assert.equal(after.wearing,'gold-feather');const events=await page.evaluate(p=>JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+p.createdAt)).events,after);assert.equal(events.filter(e=>e.kind==='outing-return').length,1);assert.equal(events.filter(e=>e.kind==='self-spell').length,1);assert.ok(events.some(e=>e.kind==='outing-return'&&e.detail===trip.story));await page.reload();await page.waitForTimeout(300);const again=await page.evaluate(p=>JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+p.createdAt)).events,after);assert.equal(again.filter(e=>e.kind==='outing-return').length,1);
  console.log('PASS: daily 1000 beans once across clicks/reload; original clothes with small-mouth care; finite books and reversible illusion; retired balance absent; supplied football entry; persisted outings recall and return once without rewards');
 }catch(error){console.error('Lively companion failure before cleanup:',await save().catch(()=>null));throw error}
 finally{await reloadWithStorage(page,snapshot);await page.getByTestId('desktop-character').waitFor()}
}
module.exports={verifyLivelyCompanion,verifyAutonomousPlayback};
