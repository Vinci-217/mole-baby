/** Capture the real preview/player at actual speed; no reconstructed frames. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-interactions'),frames=path.join(out,'gif-frames');fs.mkdirSync(frames,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--disable-dev-shm-usage']});
 let index=0;try{const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:2});await page.goto('http://127.0.0.1:5173/?preview=wardrobe');await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('junior');await page.getByRole('button',{name:'衣橱上一页',exact:true}).click();await page.getByRole('button',{name:'试戴紫色魔法帽',exact:true}).click();await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
 for(const scene of ['witch','crown']){if(scene==='crown'){await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('middle');await page.getByRole('button',{name:'衣橱下一页',exact:true}).click();await page.getByRole('button',{name:'试戴皇冠猫耳',exact:true}).click();await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});}
 const box=await page.locator('.wardrobe-mirror').boundingBox(),clip={x:Math.max(0,box.x-35),y:box.y-24,width:230,height:260};
 const capture=async()=>{const began=Date.now();await page.screenshot({path:path.join(frames,String(index++).padStart(4,'0')+'.png'),clip});const remaining=125-(Date.now()-began);if(remaining>0)await page.waitForTimeout(remaining);};
 await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();for(let i=0;i<24;i++){await capture();}
 const x=box.x+box.width*.5,y=box.y+box.height*.6;await page.mouse.move(x,y);await page.mouse.down();
 for(let i=0;i<14;i++){await page.mouse.move(x+i*5,y);await capture();}
 for(let i=0;i<20;i++){await page.mouse.move(x+65-i*5,y);await capture();}
 await page.mouse.up();for(let i=0;i<12;i++){await capture();}
 }
 execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'穿衣摸头与拖动.gif')],{stdio:'ignore'});
 console.log('Recorded real original outfit + adapted petting/elastic interactions.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
