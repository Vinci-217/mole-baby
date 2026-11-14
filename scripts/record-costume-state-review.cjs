/** Record the shipping renderer at real speed; original SWFs stay untouched. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/costume-state-review'),frames=path.join(out,'gif-frames');
(async()=>{fs.mkdirSync(frames,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});let index=0;
try{const p=await browser.newPage({viewport:{width:900,height:650},deviceScaleFactor:1});await p.goto('http://127.0.0.1:5173/?preview=size-review&form=super&outfit=warm-scarf');
 const subject=p.locator('[data-review-subject]'),clip=await p.locator('main>section').boundingBox();
 const take=async()=>{const start=Date.now();await p.screenshot({path:path.join(frames,String(index++).padStart(5,'0')+'.png'),clip});const remaining=125-(Date.now()-start);if(remaining>0)await p.waitForTimeout(remaining);};
 for(const [outfit,name]of [['warm-scarf','皇冠猫耳'],['original-1200113','原版整套造型'],['magic-book','魔法书装扮']]){
  await p.evaluate(outfit=>animationSizeReview.select({form:'super',action:'idle',outfit}),outfit);await expect(subject.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const iframe=await subject.locator('iframe').elementHandle();
  for(const [action,label]of [['dizzy','摇晃后眩晕'],['pet','摸头'],['play','踢足球']]){
   await p.evaluate(({outfit,action})=>animationSizeReview.select({form:'super',action,outfit}),{outfit,action});
   await p.evaluate(({name,label})=>{document.querySelectorAll('figcaption')[0].textContent='实际成长：神力超拉（对照）';document.querySelectorAll('figcaption')[1].textContent=name+' · '+label+'（项目适配）';},{name,label});
   const deadline=Date.now()+12000;
   while(await subject.getAttribute('data-finished')!=='true'){if(Date.now()>deadline)throw Error('Gesture did not finish');await take();}
   if(!await iframe.evaluate(n=>n.isConnected))throw Error('Clothing engine replaced');
   for(let i=0;i<2;i++)await take();
  }
  console.log('Recorded',outfit);
 }
 execFileSync('ffmpeg',['-y','-framerate','8','-i',path.join(frames,'%05d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'穿衣摇晃摸头玩球.gif')],{stdio:'ignore'});
 console.log('GIF ready',index,'frames');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
