/** Side-by-side capture of the actual wardrobe with an explicitly supplied old
 * controller. Same pet, CSS size and source SWF; only body registration differs. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp'),{execFileSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/outfit-size'),frames=path.join(out,'review-frames');
(async()=>{
 assert(process.env.BASELINE_CONTROLLER,'Supply the pre-fix controller for a genuine before/after capture');fs.mkdirSync(frames,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const pages=[];
  for(const before of [true,false]){
   const page=await browser.newPage({viewport:{width:1100,height:850}});
   if(before)await page.route('**/controller.swf?*',route=>route.fulfill({path:process.env.BASELINE_CONTROLLER,contentType:'application/x-shockwave-flash'}));
   await page.goto('http://127.0.0.1:5173/?preview=wardrobe&form=super&outfit=1200113');
   await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
   await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-source','resource/petcloth/swf2/1200113.swf');
   await expect(page.getByRole('combobox',{name:'预览形态'})).toHaveValue('super');
   const mirror=await page.locator('.wardrobe-mirror').boundingBox();pages.push({page,clip:{x:mirror.x-28,y:mirror.y-28,width:220,height:235}});
  }
  let index=0;
  for(const [button,label,count] of [[null,'正面',12],['预览左走动作','向左走',12],['预览右走动作','向右走',12],['预览摸摸动作','摸头 · 项目适配',24]]){
   if(button)for(const {page} of pages)await page.getByRole('button',{name:button,exact:true}).click();
   for(let i=0;i<count;i++){
    const started=Date.now(),tiles=[];
    for(const [column,{page,clip}] of pages.entries()){
     const capture=await page.screenshot({clip});
     tiles.push({input:await sharp(capture).resize(264,282).png().toBuffer(),left:column*320+28,top:88});
    }
    const title=Buffer.from(`<svg width="640" height="88"><rect width="640" height="88" fill="#fbf5e8"/><g font-family="sans-serif" text-anchor="middle" fill="#725633"><text x="320" y="25" font-size="18">点点拉姆装 · ${label}</text><text x="160" y="57" font-size="18">修复前</text><text x="480" y="57" font-size="18">修复后</text><text x="320" y="80" font-size="12">同一超级拉姆 · 同一显示比例 · 原版服装 SWF</text></g></svg>`);
    tiles.push({input:title,left:0,top:0});
    const png=await sharp({create:{width:640,height:386,channels:4,background:'#fbf5e8'}}).composite(tiles).png().toBuffer();
    fs.writeFileSync(path.join(frames,String(index++).padStart(4,'0')+'.png'),png);
    if(index===6)fs.writeFileSync(path.join(out,'点点拉姆装大小修复对照.png'),png);
    if(Date.now()-started<125)await pages[0].page.waitForTimeout(125-(Date.now()-started));
   }
  }
  for(const {page} of pages)await expect(page.locator('.wardrobe-mirror>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:8000});
  execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%04d.png'),'-frames:v',String(index),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'点点拉姆装大小修复对照.gif')],{stdio:'ignore'});
  console.log(`Recorded ${index} actual wardrobe frames, with resting, left/right movement and petting.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
