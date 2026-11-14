/** Sign-in audio and autonomous speech, through the real room controls. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/interaction-feedback-review');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
fs.mkdirSync(out,{recursive:true});
async function main(){
 const context=await chromium.launchPersistentContext(path.join(out,'browser-complete-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1100,height:850},args:['--disable-dev-shm-usage']});
 try{
  const fixture=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
  await context.addInitScript(({snapshot,pet})=>{
   if(!localStorage.getItem('ramu-house-save-v1')){
    for(const[key,value]of Object.entries(snapshot))localStorage.setItem(key,value);
    localStorage.setItem('ramu-house-save-v1',JSON.stringify({...pet,lastTick:Date.now()}));
   }
   window.qaAudioPlays=[];const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){window.qaAudioPlays.push(this.src);return play.call(this)};
  },fixture);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(base);await expect(page.locator('.cottage-scene')).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  await roomTab(page,'设置');
  const gameSound=page.getByRole('switch',{name:'游戏音效',exact:true});
  if(await gameSound.getAttribute('aria-checked')!=='true')await gameSound.click();
  await page.getByRole('checkbox',{name:'自然小动作',exact:true}).check();
  await page.getByRole('checkbox',{name:'允许短暂出游',exact:true}).uncheck();
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  const count=await page.evaluate(()=>window.qaAudioPlays.length);
  const check=page.getByRole('button',{name:'每日签到领取1000摩尔豆',exact:true});
  const claimed=await check.isVisible();
  if(claimed){
   await check.click();await expect(page.getByRole('button',{name:'今日已签到',exact:true})).toBeDisabled();
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
   assert.equal(after.coins,before.coins+1000);
   const sounds=await page.evaluate(count=>window.qaAudioPlays.slice(count),count);
   assert(!sounds.some(url=>url.includes('/game-audio/')),'Claiming beans must not start a game reward sound');
  }
  await page.clock.fastForward(20000);
  await expect(page.locator('.scene-bubble.visible')).toHaveCount(0);
  await page.evaluate(()=>{Math.random=()=>.1});
  await page.clock.fastForward(260000);
  const bubble=page.locator('.scene-bubble');
  await expect(bubble).toBeVisible({timeout:15000});
  const speech=await bubble.innerText();assert(/我想|我要/.test(speech),speech);
  assert(!/ambient-|tuya\d|\.swf|[a-f0-9]{16}/.test(speech));
  await page.screenshot({path:path.join(out,'autonomous-speech.png')});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const field of ['createdAt','name','color','growth','evolution','wearing','wardrobe','inventory','notes'])assert.deepEqual(after[field],before[field],field);
  assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),claimedThisRun:claimed,dailyClaimNoRewardSound:claimed?true:null,gameSoundEnabled:true,autonomousSpeech:speech,identityAndBelongingsRetained:true,errors};
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await context.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
