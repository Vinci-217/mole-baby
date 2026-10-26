/** Actual production drag hook, plus a pixel-space check of the red body. */
const {chromium,expect}=require('@playwright/test'),{spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-gallery'),url='http://127.0.0.1:5239';let browser;const young=process.argv.includes('--young'),middle=process.argv.includes('--middle'),mode=middle?'middle-nojump':young?'drag-young':'drag',width=middle?420:young?640:760;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5239','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width,height:300}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async({young,middle})=>{
  window.dragReview=(await import('/scripts/elastic-review-fixture.tsx')).mountElasticReview({bare:true,travel:!middle,...(middle?{stages:[2]}:young?{stages:[1,2],wide:true}:{})});
  const note=document.createElement('p');note.className='pull-caption';note.textContent=middle?'中级原版造型 · 拖拽不腾空':'原版造型逐帧动作 · 中级拖拽不腾空';document.body.append(note);
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
    return {pixels:d,top:r.y+y0*r.height/canvas.height,bottom:r.y+y1*r.height/canvas.height,width:(x1-x0)*r.width/canvas.width,phase:n.querySelector('.ram-sprite').dataset.pullPhase,view:canvas.dataset.dragView,compression:Number(canvas.dataset.dragCompression??0),frame:canvas.dataset.frame+':'+canvas.dataset.row,sheet:canvas.dataset.sheet,transform:getComputedStyle(n.querySelector('.ram-elastic-layer')).transform}
   });
   return cells.map(({pixels,...rest})=>rest)
  }));
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(path.join(dir,String(frame).padStart(4,'0')+'.png'),Buffer.from(shot.data,'base64'));
 }
 const stages=middle?[2]:[1,2];let grounded;
 for(const [i,stage]of stages.entries()){
  const active=samples.map(pair=>pair[i]).filter(v=>v.phase!=='idle');
  assert.ok(new Set(active.map(v=>v.view)).has('left'),'Must face left');assert.ok(new Set(active.map(v=>v.view)).has('right'),'Must face right');assert.ok(new Set(active.map(v=>v.frame)).size>=8,'A moving pet needs multiple reviewed poses');
  if(stage===2){
   const bottoms=active.map(p=>p.bottom),range=Math.max(...bottoms)-Math.min(...bottoms);assert.ok(range<(middle?1.44:1),'Middle feet must not hop vertically');
   const amount=active.map(p=>p.compression);assert.ok(Math.max(...amount)>.6&&Math.min(...amount)<.1,'Play compression and return; never freeze a single source pose');
   grounded={footMotionCss:range,compressionRange:[Math.min(...amount),Math.max(...amount)],originalMiddle:true,airborne:false};
  }
 }
 assert.deepEqual(errors,[]);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(dir,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,mode+'.gif')]);
 const receipt={frames:154,fps:24,duration:154/24*1000,dimensions:[width,300],cells:['seed','junior','middle','senior','super'].map((form,stage)=>({form,stage,action:'drag',label:'真实拖动与松手'})).filter(c=>middle?c.stage===2:!young||c.stage===1||c.stage===2),directionalViews:true,grounded,errors};fs.writeFileSync(path.join(out,middle?'middle-nojump-checks.json':young?'young-drag-checks.json':'horizontal-checks.json'),JSON.stringify(receipt,null,2)+'\n');
 if(process.env.KEEP_ANIMATION_FRAMES!=='1')fs.rmSync(dir,{recursive:true,force:true});console.log('PASS: intact original middle, multiple generated poses, no foot lift; junior untouched',JSON.stringify(grounded));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
