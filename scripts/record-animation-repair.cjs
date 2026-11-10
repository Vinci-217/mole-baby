/** A review GIF of the shipping renderer; no save, art resampling or new poses. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/animation-repair'),frames=path.join(out,'gif-frames');
(async()=>{
 fs.mkdirSync(frames,{recursive:true});let frame=0;
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});
 try{
  const p=await browser.newPage({viewport:{width:780,height:600}});await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
  await p.goto('http://127.0.0.1:5173/?preview=size-review&form=super');
  for(const [action,label]of [['element-water-1','水系变身'],['element-fire-1','火系变身'],['element-wood-1','木系变身'],['skill-magic','变盒子']]){
   await p.evaluate(action=>animationSizeReview.select({form:'super',action}),action);
   await expect.poll(async()=>{await p.clock.runFor(30);return p.locator('[data-review-subject] .magic-box-performance').getAttribute('data-ready')},{timeout:30000}).toBe('true');
   await p.locator('h1').evaluate((n,label)=>n.textContent=label+' · 修复预览',label);
   const duration=action==='skill-magic'?4600:action.includes('fire')?9000:8000;
   for(let ms=0;ms<duration;ms+=100){if(ms)await p.clock.runFor(100);await p.screenshot({path:path.join(frames,String(frame++).padStart(4,'0')+'.png')})}
   assert.equal(await p.locator('[data-review-subject]').getAttribute('data-finished'),'true');console.log('Recorded',action);
  }
  execFileSync('ffmpeg',['-v','error','-y','-framerate','10','-i',path.join(frames,'%04d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'三系魔法与变盒子修复预览.gif')]);
  fs.rmSync(frames,{recursive:true,force:true});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
