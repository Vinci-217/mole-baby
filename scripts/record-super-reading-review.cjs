/** Record the shipping renderer, with no player save or generated artwork. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/super-reading-leaf'),frames=path.join(out,'recording-frames');
(async()=>{
 fs.mkdirSync(frames,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const page=await browser.newPage({viewport:{width:780,height:565}}),errors=[],missing=[],rows=[];let frame=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.addInitScript(()=>localStorage.setItem('super-review-sentinel','keep previous data'));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('http://127.0.0.1:5173/?preview=size-review&form=super');
  for(const [action,label,duration]of [['focus','神力超拉 · 书的位置下移',8000],['idle','神力超拉 · 中间叶片完整保留',2000],['walk-left','神力超拉 · 向左移动',2000],['walk-right','神力超拉 · 向右移动',2000]]){
   await page.evaluate(action=>animationSizeReview.select({form:'super',action}),action);
   const canvas=page.locator('[data-review-subject] canvas').first();
   await expect.poll(async()=>{await page.clock.runFor(30);return canvas.getAttribute('data-loaded')},{timeout:30000}).toBe('true');
   await page.locator('h1').evaluate((n,label)=>n.textContent=label,label);
   const sources=new Set();
   for(let i=0;i<duration/1000*12;i++){
    if(i)await page.clock.runFor(1000/12);
    sources.add(await canvas.getAttribute('data-source-frame'));
    if(action!=='focus'){
     const golden=await canvas.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>230&&d[i+1]>230&&d[i+2]<30&&d[i+3]>200)n++;return n});
     assert(golden>2000,'central leaf remains visible during '+action);
    }
    await page.screenshot({path:path.join(frames,String(frame++).padStart(4,'0')+'.png')});
   }
   rows.push({action,duration,distinctSourceFrames:sources.size});
   if(action==='focus')await page.screenshot({path:path.join(out,'神力超拉看书.png')});
   console.log('Recorded',action);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('super-review-sentinel')),'keep previous data');
  execFileSync('ffmpeg',['-v','error','-y','-framerate','12','-i',path.join(frames,'%04d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'神力超拉看书与叶片修复.gif')]);
  fs.writeFileSync(path.join(out,'playback-checks.json'),JSON.stringify({rows,errors,missing,originalDataPreserved:true},null,2));
  fs.rmSync(frames,{recursive:true,force:true});
  console.log('PASS reading and three full flight directions in the actual renderer');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
