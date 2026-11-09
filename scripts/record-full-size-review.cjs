/** Real browser captures, normal source playback. No artwork synthesis or
 * source frame edits. Left is the unchanged pet at the same display setting. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json'),out=path.resolve(__dirname,'../artifacts/all-animation-sizes'),frames=path.join(out,'review-frames');
(async()=>{
 fs.mkdirSync(frames,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});let index=0;
 try{
  const page=await browser.newPage({viewport:{width:900,height:590}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const clip=(kind,stem,level)=>manifest.clips.find(c=>c.kind===kind&&c.level===level&&c.path.endsWith('/'+stem+'.swf'));
  const scenes=[
   {form:'super',outfit:'original-1200113',action:'walk-right',caption:'点点拉姆装 · 超级形态穿戴与移动'},
   {form:'senior',outfit:'warm-scarf',action:'pet',caption:'原版服装 · 项目适配摸头动作'},
   {form:'super',action:'element-water-1',caption:'水系变身 · 按身体轮廓固定比例'},
   {form:'middle',action:'official-'+clip('care','180026',3).id,caption:'道具互动 · 保留完整原版时间轴'},
   {form:'senior',action:'element-fire-3',caption:'火系变身 · 身体大小对照'},
  ];
  await page.goto('http://127.0.0.1:5173/?preview=size-review');
  for(const scene of scenes){
   await page.evaluate(s=>animationSizeReview.select(s),{...scene,action:scene.outfit?'idle':scene.action});
   if(scene.outfit)await expect(page.getByRole('combobox',{name:'尺寸对照装扮'})).toHaveValue(scene.outfit);
   const subject=page.locator('[data-review-subject]');
   if(await subject.locator('.official-ram-clip').count())await expect(subject.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   if(scene.action.startsWith('element-'))await expect(subject.locator('[data-ready]')).toHaveAttribute('data-ready','true',{timeout:45000});
   if(scene.outfit)await page.evaluate(s=>animationSizeReview.select(s),scene);
   await page.locator('h1').evaluate((node,caption)=>node.textContent=caption,scene.caption);
   for(let frame=0;frame<40;frame++){
    if(scene.action==='pet'&&(frame===16||frame===32))await page.evaluate(s=>animationSizeReview.select(s),scene);
    const at=Date.now();await page.screenshot({path:path.join(frames,String(index++).padStart(4,'0')+'.png')});
    const delay=125-(Date.now()-at);if(delay>0)await page.waitForTimeout(delay);
   }
   console.log('Recorded',scene.caption);
  }
  if(errors.length)throw Error(JSON.stringify(errors));
  execFileSync('ffmpeg',['-v','error','-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'装扮与动作尺寸复查.gif')]);
  // Only this recorder's reproducible captures; audits and source assets stay.
  for(const f of fs.readdirSync(frames))if(/^\d{4}\.png$/.test(f))fs.unlinkSync(path.join(frames,f));
  fs.rmdirSync(frames);console.log('PASS recorded five real application scenes at normal speed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
