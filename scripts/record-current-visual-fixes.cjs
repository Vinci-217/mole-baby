/** Capture shipping renderer frames, then encode a review GIF. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/visual-bounds-review');
async function main(){
 fs.mkdirSync(out,{recursive:true});const frames=path.join(out,'box-gif-frames');fs.mkdirSync(frames,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:570}});await page.clock.install();
  await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:5173/')+'?preview=size-review&form=super&action=spell');
  await expect(page.locator('[data-review-baseline] canvas[data-loaded=true]')).toHaveCount(1,{timeout:45000});
  await expect(page.locator('.magic-box-performance')).toHaveAttribute('data-ready','true');
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+2000));
  await page.evaluate(()=>window.animationSizeReview.select({form:'super',action:'spell'}));
  await expect(page.locator('.magic-box-performance')).toHaveAttribute('data-ready','true');
  for(let index=0;index<46;index++){
   await page.screenshot({path:path.join(frames,String(index).padStart(3,'0')+'.png')});await page.clock.runFor(100);
  }
 }finally{await browser.close()}
 const target=path.join(out,'body-sized-transformation.gif');
 const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','10','-i',path.join(frames,'%03d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',target],{encoding:'utf8'});
 if(encoded.error)throw encoded.error;if(encoded.status!==0)throw Error(encoded.stderr);
 fs.rmSync(frames,{recursive:true,force:true});console.log(JSON.stringify({file:target,bytes:fs.statSync(target).size,frames:46,fps:10}));
}
main().catch(error=>{console.error(error);process.exitCode=1});
