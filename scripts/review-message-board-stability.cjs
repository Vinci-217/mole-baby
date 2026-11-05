'use strict';
// Run headed (xvfb-run -a on Linux): headless Chromium uses overlay scrollbars
// and misses the width-changing scrollbars used by Windows/Electron.
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),origin=process.env.MOLE_REVIEW_URL||'http://127.0.0.1:5173';
const label=process.env.MOLE_BOARD_REVIEW_LABEL||'after',out=path.join(root,'artifacts/board-jitter-review',label);
const cases=[
 {width:980,height:711,deviceScaleFactor:1},
 ...[1,1.25,1.5,2].flatMap(deviceScaleFactor=>[710,720,740].map(height=>({width:980,height,deviceScaleFactor}))),
 {width:980,height:700,deviceScaleFactor:1},
 {width:844,height:390,deviceScaleFactor:1},
 {width:700,height:640,deviceScaleFactor:1},
 {width:701,height:640,deviceScaleFactor:1},
 {width:360,height:640,deviceScaleFactor:2},
 {width:360,height:390,deviceScaleFactor:2},
];
function fixture(){
 let snapshot={name:'露珠',createdAt:1,notes:[{id:'one',text:'2026.11.05\n露珠今天长到二阶段了，叶子萌萌的，跳起来老可爱了。看着它，有决心上班了。',createdAt:Date.now(),done:false}]};
 const listeners=new Set();
 window.desktop={messageBoard:{get:async()=>snapshot,onSnapshot:cb=>{listeners.add(cb);return()=>listeners.delete(cb)},close:async()=>{},change:async change=>{snapshot={...snapshot,notes:change.notes};for(const cb of listeners)cb(snapshot);return snapshot}}};
 window.boardErrors=[];window.addEventListener('error',event=>window.boardErrors.push(event.message));
}
async function measure(page){
 return page.evaluate(async()=>{
  const scroll=document.querySelector('.message-board-scroll'),stage=document.querySelector('.message-board-stage');
  const art=document.querySelector('.message-board-original-art'),card=document.querySelector('.message-card');
  const frames=[];
  for(let i=0;i<60;i++){
   await new Promise(requestAnimationFrame);
   const box=element=>{const r=element?.getBoundingClientRect();return r?[r.x,r.y,r.width,r.height]:null};
   frames.push({stage:box(stage),art:box(art),card:box(card),clientWidth:scroll.clientWidth,clientHeight:scroll.clientHeight,scrollWidth:scroll.scrollWidth,scrollHeight:scroll.scrollHeight});
  }
  return {states:[...new Set(frames.map(value=>JSON.stringify(value)))].map(JSON.parse),changes:frames.filter((value,i)=>i&&JSON.stringify(value)!==JSON.stringify(frames[i-1])).length,errors:window.boardErrors};
 });
}
async function settled(page){await page.waitForTimeout(150);return measure(page)}
async function record(page){
 const session=await page.context().newCDPSession(page),frames=[];
 session.on('Page.screencastFrame',event=>{frames.push(event);void session.send('Page.screencastFrameAck',{sessionId:event.sessionId})});
 await session.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:980,maxHeight:711,everyNthFrame:1});
 return async()=>{
  await session.send('Page.stopScreencast');await session.detach();
  const directory=path.join(out,'frames');fs.mkdirSync(directory,{recursive:true});const lines=[];
  frames.forEach((frame,i)=>{const file=`${String(i).padStart(4,'0')}.jpg`;fs.writeFileSync(path.join(directory,file),Buffer.from(frame.data,'base64'));lines.push(`file '${file}'`,`duration ${Math.max(1/120,frames[i+1]?frames[i+1].metadata.timestamp-frame.metadata.timestamp:1/60)}`)});
  fs.writeFileSync(path.join(directory,'frames.txt'),lines.join('\n')+'\n');
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(directory,'frames.txt'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-an',path.join(out,'board.mp4')]);
 };
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const results=[];
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:false,args:['--disable-features=OverlayScrollbar,OverlayScrollbars']});
 try{
  for(const [index,config] of cases.entries()){
   const {deviceScaleFactor,...viewport}=config;
   const context=await browser.newContext({viewport,deviceScaleFactor});
   const page=await context.newPage();await page.addInitScript(fixture);
   try{
    await page.goto(`${origin}/#message-board`);await page.getByRole('dialog',{name:'小屋留言板',exact:true}).waitFor();
    await page.locator('.message-board-original-art').evaluate(image=>image.decode());await page.evaluate(()=>document.fonts.ready);
    const stopRecording=index===0?await record(page):null;
    const result={...config,...await settled(page)};results.push(result);
    if(index===0){await page.screenshot({path:path.join(out,'board.png')});await stopRecording()}
    assert.equal(result.changes,0,`Board moves while idle at ${JSON.stringify(config)}: ${JSON.stringify(result.states)}`);
    assert.deepEqual(result.errors,[]);
    if(index===0){
     const board=page.getByRole('dialog',{name:'小屋留言板',exact:true});
     for(let i=2;i<=7;i++){
      await board.getByRole('button',{name:'我要留言',exact:true}).click();await page.locator('#board-note').fill(`第 ${i} 条留言`);await board.getByRole('button',{name:'保存',exact:true}).click();await expect(page.locator('#board-note')).toHaveCount(0);
     }
     await expect(board.locator('.message-card')).toHaveCount(6);assert.equal((await settled(page)).changes,0,'Six-card page stays still');
     await board.getByRole('button',{name:'留言下一页',exact:true}).click();await expect(board.locator('.message-card')).toHaveCount(1);assert.equal((await settled(page)).changes,0,'Second page stays still');
     // Repeatedly cross the old scrollbar threshold without leaving an
     // observer loop running after the user stops resizing the window.
     for(const height of [700,711,720,710,740,711]){
      await page.setViewportSize({width:980,height});assert.equal((await settled(page)).changes,0,`Resize settles at height ${height}`);
     }
     // Old Android WebViews lack scrollbar-gutter. Exercise the shipped
     // overflow-y fallback even in this newer Chromium.
     await page.addStyleTag({content:'.message-board-scroll{scrollbar-gutter:auto;overflow-y:scroll}'});
     assert.equal((await settled(page)).changes,0,'Legacy scrollbar fallback stays still');
     assert.ok(await page.locator('.message-board-scroll').evaluate(e=>e.offsetWidth-e.clientWidth>0),'Test must use scrollbars that consume width');
    }
    if(viewport.width===360){
     const scroll=page.locator('.message-board-scroll');assert.ok(await scroll.evaluate(e=>e.scrollWidth>e.clientWidth),'Phone keeps horizontal scrolling');
     const before=await scroll.evaluate(e=>e.scrollLeft);await scroll.evaluate(e=>{e.scrollLeft=e.scrollWidth});assert.ok(await scroll.evaluate(e=>e.scrollLeft)>before);
     await expect(page.locator('.message-board-mobile-bar').getByRole('button',{name:'关闭留言板',exact:true})).toBeInViewport();
    }
    console.log(`PASS board stable ${viewport.width}x${viewport.height} @ ${deviceScaleFactor}x`);
   }finally{
    await context.close();
   }
  }
 }finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2)+'\n');await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
