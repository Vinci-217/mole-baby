/** Record complete original football playback, including restoration of the
 * selected outfit. Captures the actual renderer, with no invented frames. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/outfit-action-fallback'),frames=path.join(out,'football-frames');
(async()=>{
 fs.mkdirSync(frames,{recursive:true});let index=0;
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:2});await page.goto('http://127.0.0.1:5173/?preview=wardrobe');
  await page.getByRole('button',{name:'试戴皇冠猫耳',exact:true}).click();
  for(const form of ['middle','super']){
   await page.getByRole('combobox',{name:'预览形态'}).selectOption(form);
   await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   const box=await page.locator('.wardrobe-mirror').boundingBox(),clip={x:Math.max(0,box.x-70),y:Math.max(0,box.y-110),width:360,height:380},deadline=Date.now()+45000;
   const capture=async()=>{const began=Date.now();await page.screenshot({path:path.join(frames,String(index++).padStart(4,'0')+'.png'),clip});const remaining=125-(Date.now()-began);if(remaining>0)await page.waitForTimeout(remaining)};
   for(let n=0;n<6;n++)await capture();
   await page.getByRole('button',{name:'预览玩球动作',exact:true}).click();await expect(page.locator('.ram-football-frame')).toHaveAttribute('data-loaded','true');
   while(await page.locator('.ram-football-frame').count()){if(Date.now()>deadline)throw Error('Football action did not finish');await capture();}
   // Include the normal loading fallback too, then finish on the real outfit.
   while(await page.locator('.wardrobe-mirror .official-ram-clip[data-loaded=true]').count()===0){if(Date.now()>deadline)throw Error('Costume did not restore');await capture();}
   for(let n=0;n<8;n++)await capture();
  }
  execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'穿衣踢足球与恢复.gif')],{stdio:'ignore'});
  console.log('Recorded complete middle and super original football sequences with the selected outfit restored.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
