/** Real browser captures at normal playback speed, with an unchanged pet
 * beside each source. Never reconstruct or synthesize animation artwork. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json'),out=path.resolve(__dirname,'../artifacts/animation-semantics'),frames=path.join(out,'size-frames');
(async()=>{
 fs.mkdirSync(frames,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 let index=0;
 try{
  const page=await browser.newPage({viewport:{width:900,height:760},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [kind,stem] of [['care','180011'],['magic','bibobibo']]){
   const clip=manifest.clips.find(c=>c.kind===kind&&c.level===3&&c.path.endsWith('/'+stem+'.swf'));
   await page.goto('http://127.0.0.1:5173/?preview=official&compare=1&form=middle&group='+kind+'&clip='+clip.id);
   await expect(page.locator('[data-clip] .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   const box=await page.locator('.official-preview-grid').boundingBox(),capture={x:box.x-8,y:box.y-8,width:box.width+16,height:box.height+16};
   for(let frame=0;frame<64;frame++){
    const start=Date.now();await page.screenshot({path:path.join(frames,String(index++).padStart(4,'0')+'.png'),clip:capture});
    if(frame===24)await page.screenshot({path:path.join(out,kind+'-size.png'),clip:capture});
    const remaining=125-(Date.now()-start);if(remaining>0)await page.waitForTimeout(remaining);
   }
  }
  if(errors.length)throw Error(JSON.stringify(errors));
  execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'道具与魔法尺寸对照.gif')],{stdio:'ignore'});
  fs.copyFileSync(path.resolve(__dirname,'../artifacts/wardrobe-interactions/穿衣摸头与拖动.gif'),path.join(out,'原版穿衣形态与互动.gif'));
  console.log('Recorded original source playback beside the unchanged pet, at real speed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
