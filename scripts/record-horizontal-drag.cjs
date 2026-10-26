/** Actual production drag hook, plus a pixel-space check of the red body. */
const {chromium,expect}=require('@playwright/test'),{spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-gallery'),url='http://127.0.0.1:5239';let browser;const young=process.argv.includes('--young'),middle=process.argv.includes('--middle'),mode=middle?'middle-elastic':young?'drag-young':'drag',width=middle?420:young?640:760;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5239','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width,height:300}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async({young,middle})=>{
  window.dragReview=(await import('/scripts/elastic-review-fixture.tsx')).mountElasticReview({bare:true,travel:!middle,...(middle?{stages:[2]}:young?{stages:[1,2],wide:true}:{})});
  const note=document.createElement('p');note.className='pull-caption';note.textContent=middle?'中级 · 初级同款身体，加上原版叶片':'同一身体、同一动作 · 中级只增加叶片';document.body.append(note);
  if(middle){const style=document.createElement('style');style.textContent='#pull-review .pet{width:144px;height:156px}#pull-review figure{width:144px}#pull-review{padding-top:68px}#pull-review figcaption{margin-top:20px}';document.head.append(style)}
 },{young,middle});
 await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#pull-review canvas:not(.ram-wear)[data-loaded=true]').count()}).toBe(middle?1:young?2:5);
 const dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});const cdp=await p.context().newCDPSession(p),samples=[];
 for(let frame=0;frame<154;frame++){
  const t=frame/24*1000;if(frame===15)await p.evaluate(()=>window.dragReview.start());
  if(frame>=15&&frame<85){const x=frame<45?(frame-15)*1.5:45-(frame-45)*2.1;await p.evaluate(x=>window.dragReview.sample(x,0),x)}
  if(frame===85)await p.evaluate(()=>window.dragReview.release());
  await p.clock.runFor(1000/24);await p.evaluate(t=>{window.dragBirths??=new WeakMap();for(const a of document.getAnimations()){if(!window.dragBirths.has(a))window.dragBirths.set(a,t);a.pause();a.currentTime=t-window.dragBirths.get(a)}},t);
  if(frame>=18&&frame<120)samples.push(await p.locator('#pull-review figure').evaluateAll(nodes=>{
   const cells=nodes.filter(n=>['1','2'].includes(n.querySelector('.ram-sprite').dataset.stage)).map(n=>{
    const canvas=n.querySelector('canvas:not(.ram-wear)'),r=canvas.getBoundingClientRect(),d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let y0=canvas.height,y1=0,x0=canvas.width,x1=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(d[i]>140&&d[i+1]<110&&d[i+2]<100&&d[i+3]>100){y0=Math.min(y0,y);y1=Math.max(y1,y+1);x0=Math.min(x0,x);x1=Math.max(x1,x+1)}}
    return {pixels:d,top:r.y+y0*r.height/canvas.height,bottom:r.y+y1*r.height/canvas.height,width:(x1-x0)*r.width/canvas.width,phase:n.querySelector('.ram-sprite').dataset.pullPhase,view:canvas.dataset.dragView,frame:canvas.dataset.frame+':'+canvas.dataset.row,sheet:canvas.dataset.sheet,transform:getComputedStyle(n.querySelector('.ram-elastic-layer')).transform}
   });
   if(cells.length===2&&cells.every(c=>c.sheet==='drag')){
    let bodyDiff=0,leaves=0;const a=cells[0].pixels,b=cells[1].pixels;
    for(let i=0;i<a.length;i+=4){if(a[i+3]){if([0,1,2,3].some(k=>a[i+k]!==b[i+k]))bodyDiff++}else if(b[i+3]>64&&b[i+1]>b[i]&&b[i+1]>b[i+2])leaves++}
    cells[1].bodyDiff=bodyDiff;cells[1].leaves=leaves;
   }
   return cells.map(({pixels,...rest})=>rest)
  }));
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(path.join(dir,String(frame).padStart(4,'0')+'.png'),Buffer.from(shot.data,'base64'));
 }
 const stages=middle?[2]:[1,2];let comparison;
 for(const [i]of stages.entries()){
  const active=samples.map(pair=>pair[i]).filter(v=>v.phase!=='idle');
  assert.ok(new Set(active.map(v=>v.view)).has('left'),'Must face left');assert.ok(new Set(active.map(v=>v.view)).has('right'),'Must face right');assert.ok(new Set(active.map(v=>v.frame)).size>=8,'A moving pet needs multiple original poses');
 }
 if(!middle){
  const pairs=samples.filter(pair=>pair[1].bodyDiff!==undefined);assert.ok(pairs.length>=60,'Need a full paired recording, including turns and release');
  for(const pair of pairs){
   assert.equal(pair[1].bodyDiff,0,'Every visible junior body/face pixel must be identical in middle');assert.ok(pair[1].leaves>100,'The only addition is the middle green crown');
   assert.equal(pair[0].frame,pair[1].frame,'Shared phase');assert.equal(pair[0].transform,pair[1].transform,'Shared elastic transform');
   for(const key of ['top','bottom','width'])assert.ok(Math.abs(pair[0][key]-pair[1][key])<.1,'Shared body geometry '+key)
  }
  comparison={framesCompared:pairs.length,bodyPixelDifferences:0,samePhase:true,sameTransform:true,onlyAddedFoliage:true};
 }
 assert.deepEqual(errors,[]);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(dir,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,mode+'.gif')]);
 const receipt={frames:154,fps:24,duration:154/24*1000,dimensions:[width,300],cells:['seed','junior','middle','senior','super'].map((form,stage)=>({form,stage,action:'drag',label:'真实拖动与松手'})).filter(c=>middle?c.stage===2:!young||c.stage===1||c.stage===2),sharedBody:true,directionalViews:true,comparison,errors};fs.writeFileSync(path.join(out,middle?'middle-elastic-checks.json':young?'young-drag-checks.json':'horizontal-checks.json'),JSON.stringify(receipt,null,2)+'\n');
 if(young){
  // Show the verified dragging/recoil interval directly. Keep the full GIF
  // above as well, including each stage's unchanged idle pose before/after.
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-start_number','18','-i',path.join(dir,'%04d.png'),'-frames:v','102','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,'drag-shared-body.gif')]);
  fs.writeFileSync(path.join(out,'shared-body-checks.json'),JSON.stringify({...receipt,frames:102,duration:102/24*1000,sourceFrames:[18,119]},null,2)+'\n');
 }
 if(process.env.KEEP_ANIMATION_FRAMES!=='1')fs.rmSync(dir,{recursive:true,force:true});console.log('PASS: junior body preserved; middle adds original foliage; shared frames and movement',JSON.stringify(comparison??{}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
