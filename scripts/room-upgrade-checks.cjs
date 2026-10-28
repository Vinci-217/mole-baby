const assert=require('node:assert/strict'),path=require('node:path'),{expect}=require('@playwright/test');
const{enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
/** Real controls, actual Audio transport and persisted single-course credit. */
async function verifyRoomUpgrade(page){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));let clock=false,failed=false;
 await page.addInitScript(()=>{const Base=window.Audio;window.__roomAudio=[];window.Audio=class extends Base{constructor(...args){super(...args);window.__roomAudio.push(this)}}});
 try{
  await page.evaluate(()=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1')),now=Date.now();
   Object.assign(p,{growth:180,growthLocked:true,evolution:undefined,sleeping:false,activity:undefined,outing:undefined,wearing:undefined,lastTick:now,education:{lessons:{language:1},graduated:{}}});
   p.stats={hunger:95,thirst:95,happiness:95,cleanliness:95,health:100,energy:95};
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false}));
   localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:true,backgroundPlayback:false,musicId:'castle',volume:.1}));
  });
  await page.reload();await page.getByTestId('desktop-character').waitFor();await enterHome(page);
  const walker=page.locator('.room-walker'),floor=page.getByRole('button',{name:'小屋地面，点击让拉姆走过去',exact:true}),position=page.locator('.room-pet-position');
  await expect(floor).toBeEnabled();const box=await floor.boundingBox(),destination={x:box.x+30,y:box.y+20},scene=await page.locator('.cottage-scene').boundingBox();
  const initial=Number(await position.getAttribute('data-x'));await page.mouse.click(destination.x,destination.y);await expect(walker).toHaveAttribute('data-moving','true');
  await expect.poll(async()=>Number(await position.getAttribute('data-x'))).toBeLessThan(initial);
  const during=Number(await position.getAttribute('data-x'));assert.ok(during<initial&&during>destination.x-scene.x,'Travel must be visible before arrival');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/v303-room-moving.png')});
  await expect(walker).toHaveAttribute('data-moving','false',{timeout:10000});
  assert.ok(Math.abs(Number(await position.getAttribute('data-x'))-(destination.x-scene.x))<2);
  const feet=await page.locator('.scene-character canvas:not(.ram-wear)').evaluate(c=>{
   const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let bottom=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>80)bottom=y+1;
   const rect=c.getBoundingClientRect();return rect.top+bottom/c.height*rect.height;
  });assert.ok(Math.abs(feet-destination.y)<5,`Visible feet ${feet} must meet ground target ${destination.y}`);
  const settled=await position.getAttribute('data-x');await page.mouse.click(scene.x+scene.width*.8,scene.y+scene.height*.3);await page.waitForTimeout(120);assert.equal(await position.getAttribute('data-x'),settled,'Wall clicks must not move the pet');
  await floor.focus();await page.keyboard.press('ArrowRight');await expect(walker).toHaveAttribute('data-moving','true');await expect(walker).toHaveAttribute('data-moving','false',{timeout:4000});
  await page.mouse.click(box.x+box.width-20,box.y+20);await expect(walker).toHaveAttribute('data-moving','true');
  const pet=await page.locator('.scene-character').boundingBox();await page.mouse.click(pet.x+pet.width/2,pet.y+pet.height/2);await expect(walker).toHaveAttribute('data-moving','false');await expect(floor).toBeDisabled();await expect(floor).toBeEnabled({timeout:5000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.click(box.x+box.width-20,box.y+20);await expect.poll(()=>position.getAttribute('data-x')).not.toBe(settled);await expect(walker).toHaveAttribute('data-moving','false');await page.emulateMedia({reducedMotion:'no-preference'});
  const audio=()=>page.evaluate(()=>window.__roomAudio.find(a=>a.src.includes('/audio/castle.mp3')&&a.getAttribute('src'))?.currentTime);
  await expect.poll(()=>page.evaluate(()=>window.__roomAudio.some(a=>a.src.includes('/audio/castle.mp3')&&!a.paused))).toBe(true);
  await page.evaluate(()=>{window.__roomAudio.find(a=>a.src.includes('/audio/castle.mp3')&&!a.paused).currentTime=12});await toDesktop(page);await enterHome(page);await expect.poll(audio).toBeLessThan(3);
  // Toggling playback also restarts; ordinary clicks must not reset it.
  await roomTab(page,'设置');const music=page.getByRole('checkbox',{name:'播放背景音乐',exact:true});await music.uncheck();await page.evaluate(()=>{window.__roomAudio.find(a=>a.src.includes('/audio/castle.mp3')&&a.getAttribute('src')).currentTime=18});await music.check();await expect.poll(audio).toBeLessThan(3);
  await page.evaluate(()=>{window.__roomAudio.find(a=>a.src.includes('/audio/castle.mp3')&&!a.paused).currentTime=8});await page.getByRole('heading',{name:'背景音乐',exact:true}).click();assert.ok(await audio()>=8,'A regular pointer unlock must not rewind playing music');
  const background=page.getByRole('checkbox',{name:'允许后台播放音乐',exact:true});await background.check();await toDesktop(page);
  await page.evaluate(()=>{window.__roomAudio.find(a=>a.src.includes('/audio/castle.mp3')&&!a.paused).currentTime=14});await enterHome(page);await expect.poll(audio).toBeLessThan(3);
  // A previous one-session save is already graduated, without another class.
  await roomTab(page,'学院');let language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});await expect(language.getByRole('button',{name:'展示本领',exact:true})).toBeEnabled();await expect(language.getByRole('button',{name:'上这一课',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));delete p.education;p.lastTick=Date.now();localStorage.setItem('ramu-house-save-v1',JSON.stringify(p))});
  // Earlier workflow checks may already have advanced this page's clock.
  // Reinstalling at wall time would make its saved lastTick look future-dated.
  await page.clock.install({time:new Date(await page.evaluate(()=>Date.now()))});clock=true;await page.reload();await enterHome(page);await roomTab(page,'学院');await language.getByRole('button',{name:'上这一课',exact:true}).click();await page.clock.fastForward(120150);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).education?.lessons.language)).toBe(1);
  await page.reload();await enterHome(page);await roomTab(page,'学院');await expect(language.getByRole('button',{name:'展示本领',exact:true})).toBeEnabled();await expect(language.getByRole('button',{name:'上这一课',exact:true})).toHaveCount(0);
  console.log('PASS room upgrade: smooth floor travel, wall exclusion, keyboard, touch interruption, reduced motion; real music restarts without click resets; one language lesson and old-save graduation persist');
 }catch(error){failed=true;console.error('Room upgrade error:',error);throw error;}finally{
  if(clock)await page.clock.resume();await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(s=>{localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor().catch(error=>{if(!failed)throw error});
 }
}
module.exports={verifyRoomUpgrade};
