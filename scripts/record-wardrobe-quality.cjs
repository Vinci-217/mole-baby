/** Record the real shipping renderer, at wall-clock speed, using isolated
 * preview routes. Images are browser captures, never rebuilt character art. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-quality');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173',fps=10;
const executablePath=process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--disable-dev-shm-usage','--disk-cache-size=10485760']});
 try{
  for(const mode of process.argv.includes('--continuity')?['continuity']:['samples','interactions']){
   const dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});let index=0;
   const page=await browser.newPage({viewport:{width:900,height:850}});
   const capture=async(clip)=>{const began=Date.now();await page.screenshot({path:path.join(dir,String(index++).padStart(4,'0')+'.png'),clip});await page.waitForTimeout(Math.max(0,1000/fps-(Date.now()-began)))};
   if(mode==='continuity'){
    await page.goto(base+'/?preview=wardrobe&form=super&outfit=1200020');
    await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
    const box=await page.locator('.wardrobe-preview').boundingBox(),clip={x:Math.max(0,box.x-12),y:Math.max(0,box.y-12),width:Math.ceil(box.width+24),height:Math.ceil(box.height+24)};
    for(let i=0;i<10;i++)await capture(clip);
    await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
    for(let i=0;i<36;i++)await capture(clip);
    await page.getByRole('button',{name:'预览玩球动作',exact:true}).click();
    for(let i=0;i<125;i++)await capture(clip);
    await expect(page.locator('.wardrobe-mirror .ram-outfit-source')).toBeVisible();
   }else if(mode==='samples'){
    await page.goto(base+'/?preview=wardrobe-motion&category=samples&form=super');
    await expect(page.locator('.official-ram-clip[data-loaded=true]')).toHaveCount(6,{timeout:45000});
    await page.getByRole('button',{name:'重新播放',exact:true}).click();
    for(let i=0;i<90;i++)await capture({x:0,y:0,width:900,height:830});
   }else{
    for(const [form,id] of [['middle','1200052'],['super','1200026']]){
     await page.goto(base+`/?preview=wardrobe&form=${form}&outfit=${id}`);
     await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
     const box=await page.locator('.wardrobe-mirror').boundingBox();
     const clip={x:box.x-65,y:box.y-30,width:300,height:330};
     await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
     for(let i=0;i<32;i++)await capture(clip);
     const x=box.x+box.width*.5,y=box.y+box.height*.65;
     await page.mouse.move(x,y);await page.mouse.down();
     for(let i=0;i<15;i++){await page.mouse.move(x+i*4,y);await capture(clip)}
     for(let i=0;i<23;i++){await page.mouse.move(x+56-i*4,y);await capture(clip)}
     await page.mouse.up();for(let i=0;i<10;i++)await capture(clip);
    }
   }
   const gif=path.join(out,mode==='continuity'?'换衣动作连续性实录.gif':mode==='samples'?'服装分类移动实录.gif':'穿衣摸头拖动实录.gif');
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(dir,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',gif]);
   fs.rmSync(dir,{recursive:true});await page.close();console.log(JSON.stringify({gif,frames:index,fps,bytes:fs.statSync(gif).size}));
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
