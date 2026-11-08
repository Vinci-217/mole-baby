/** Real native costume playback with the explicitly project-authored petting
 * adaptation. Capture labels identify examples; no source frames are replaced. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/clothed-petting'),frames=path.join(out,'review-frames'),m=require('../public/assets/original/official/manifest.json');
const legacy=[...fs.readFileSync(path.join(root,'src/wardrobe.ts'),'utf8').matchAll(/^  \{id:'([^']+)',name:'([^']+)',sourceId:'([^']+)'/gm)].map(v=>({id:v[1],name:v[2],sourceId:v[3]})),outfits=[...legacy,...m.outfits];
(async()=>{
 fs.mkdirSync(frames,{recursive:true});let index=0,currentPage=0;
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});await page.goto('http://127.0.0.1:5173/?preview=wardrobe');while(await page.getByRole('button',{name:'衣橱上一页'}).isEnabled())await page.getByRole('button',{name:'衣橱上一页'}).click();
  for(const [id,form] of [['1200052','super'],['1200026','super'],['1200025','super'],['1200113','super'],['1200020','middle'],['1200040','senior']]){
   const o=outfits.find(o=>o.sourceId===id),i=outfits.indexOf(o),target=Math.floor((i+1)/9);
   while(currentPage<target){await page.getByRole('button',{name:'衣橱下一页'}).click();currentPage++;}while(currentPage>target){await page.getByRole('button',{name:'衣橱上一页'}).click();currentPage--;}
   await page.getByRole('combobox',{name:'预览形态'}).selectOption(form);await page.locator('.wardrobe-grid>button').nth((i+1)%9).click();
   await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   await page.evaluate(name=>{document.querySelector('.wardrobe-preview>h3').textContent=name;document.querySelector('.wardrobe-preview>span').textContent='项目适配摸头 · 保留穿戴外观'},o.name);
   const mirror=await page.locator('.wardrobe-mirror').boundingBox(),clip={x:0,y:Math.max(0,mirror.y-100),width:445,height:420};
   const capture=async()=>{const began=Date.now();await page.screenshot({path:path.join(frames,String(index++).padStart(4,'0')+'.png'),clip});const remaining=125-(Date.now()-began);if(remaining>0)await page.waitForTimeout(remaining)};
   for(let n=0;n<4;n++)await capture();
   const token=await page.locator('.wardrobe-mirror iframe').getAttribute('src');await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
   const deadline=Date.now()+10000;while(await page.locator('.wardrobe-mirror>.ram-sprite').getAttribute('data-action')==='pet'){if(Date.now()>deadline)throw Error('Petting did not complete');await capture();}
   if(await page.locator('.wardrobe-mirror iframe').getAttribute('src')!==token)throw Error('Petting replaced the native costume');
   for(let n=0;n<4;n++)await capture();
  }
  execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'穿衣摸头适配示例.gif')],{stdio:'ignore'});
  console.log('Recorded 6 native costume examples, including junior appearances worn by a super Ram and complete transformation outfits.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
