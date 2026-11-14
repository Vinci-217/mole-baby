/** Record the actual original tool, with a retained/restored original outfit. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/original-tools-review');
async function main(){
 const frames=path.join(out,'football-recording-frames');fs.mkdirSync(frames,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1050,height:570}});await page.clock.install();
  await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:5173/')+'?preview=size-review&form=super&outfit=wizard-cap');
  await expect(page.locator('[data-review-subject] .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  let frame=0;const capture=async()=>{await page.screenshot({path:path.join(frames,String(frame++).padStart(3,'0')+'.png')});await page.clock.runFor(100)};
  for(let i=0;i<6;i++)await capture();
  await page.evaluate(()=>window.animationSizeReview.select({form:'super',outfit:'wizard-cap',action:'play'}));
  // Decoding is asynchronous; a paused recording clock must still service the
  // first paint's requestAnimationFrame before waiting for the ready marker.
  await expect.poll(async()=>{await page.clock.runFor(16);return page.locator('.ram-original-tool canvas[data-sheet=uploaded]').getAttribute('data-loaded')},{timeout:45000}).toBe('true');
  for(let i=0;i<66;i++)await capture();
  await page.evaluate(()=>window.animationSizeReview.select({form:'super',outfit:'wizard-cap',action:'idle'}));
  await expect(page.locator('[data-review-subject] .ram-outfit-source')).toBeVisible();
  for(let i=0;i<10;i++)await capture();
 }finally{await browser.close()}
 const target=path.join(out,'original-football-restores-outfit.gif');
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','10','-i',path.join(frames,'%03d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',target],{encoding:'utf8'});
 if(result.error)throw result.error;if(result.status!==0)throw Error(result.stderr);
 fs.rmSync(frames,{recursive:true,force:true});console.log(JSON.stringify({file:target,bytes:fs.statSync(target).size}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
