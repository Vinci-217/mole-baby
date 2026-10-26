/** Actual production drag hook, plus a pixel-space check of the red body. */
const {chromium,expect}=require('@playwright/test'),{spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-gallery'),url='http://127.0.0.1:5239';let browser;const young=process.argv.includes('--young'),middle=process.argv.includes('--middle'),mode=middle?'middle-bound':young?'drag-young':'drag',width=middle?420:young?640:760,origin=require('../public/assets/original/drag/runtime.json').forms.middle.origin,padding=Math.ceil(Math.max(90,54-origin[1]*100/192)),height=Math.max(300,padding+180);
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5239','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async({young,middle,padding})=>{
  window.dragReview=(await import('/scripts/elastic-review-fixture.tsx')).mountElasticReview({bare:true,travel:!middle,...(middle?{stages:[2]}:young?{stages:[1,2],wide:true}:{})});
  const note=document.createElement('p');note.className='pull-caption';note.textContent=middle?'初级黏滞身体 · 叶片逐帧绑定':'初级身体原帧＋绑定叶片 · 同步拖拽';document.body.append(note);
  const style=document.createElement('style');style.textContent=`#pull-review{padding-top:${padding}px}`;document.head.append(style)
 },{young,middle,padding});
 await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#pull-review canvas:not(.ram-wear)[data-loaded=true]').count()}).toBe(middle?1:young?2:5);
 const dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});const cdp=await p.context().newCDPSession(p),samples=[];
 for(let frame=0;frame<154;frame++){
  const t=frame/24*1000;if(frame===15)await p.evaluate(()=>window.dragReview.start());
  if(frame>=15&&frame<85){const x=frame<45?(frame-15)*1.5:45-(frame-45)*2.1;await p.evaluate(x=>window.dragReview.sample(x,0),x)}
  if(frame===85)await p.evaluate(()=>window.dragReview.release());
  await p.clock.runFor(1000/24);await p.evaluate(t=>{window.dragBirths??=new WeakMap();for(const a of document.getAnimations()){if(!window.dragBirths.has(a))window.dragBirths.set(a,t);a.pause();a.currentTime=t-window.dragBirths.get(a)}},t);
  if(frame>=18&&frame<120)samples.push(await p.locator('#pull-review figure').evaluateAll(nodes=>{
   const cells=nodes.filter(n=>['1','2'].includes(n.querySelector('.ram-sprite').dataset.stage)).map(n=>{
    const canvas=n.querySelector('canvas:not(.ram-wear)'),ox=Number(canvas.dataset.dragOriginX??0),oy=Number(canvas.dataset.dragOriginY??0),d=canvas.getContext('2d').getImageData(-ox,-oy,192,208).data,full=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let greens=0;for(let i=0;i<full.length;i+=4)if(full[i+3]>64&&full[i+1]>full[i]+8&&full[i+1]>full[i+2]+8)greens++;
    const css=getComputedStyle(canvas);return {pixels:d,greens,scale:[parseFloat(css.width)/canvas.width,parseFloat(css.height)/canvas.height],phase:n.querySelector('.ram-sprite').dataset.pullPhase,view:canvas.dataset.dragView,frame:canvas.dataset.frame+':'+canvas.dataset.row,sheet:canvas.dataset.sheet,transform:getComputedStyle(n.querySelector('.ram-elastic-layer')).transform}
   });
   if(cells.length===2&&cells.every(c=>c.sheet==='drag')){
    let difference=0;for(let i=0;i<cells[0].pixels.length;i+=4)if(cells[0].pixels[i+3]&&[0,1,2,3].some(k=>cells[0].pixels[i+k]!==cells[1].pixels[i+k]))difference++
    cells[1].bodyDiff=difference
   }
   return cells.map(({pixels,...rest})=>rest)
  }));
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(path.join(dir,String(frame).padStart(4,'0')+'.png'),Buffer.from(shot.data,'base64'));
 }
 const stages=middle?[2]:[1,2];let binding;
 for(const [i]of stages.entries()){
  const active=samples.map(pair=>pair[i]).filter(v=>v.phase!=='idle');assert.ok(new Set(active.map(v=>v.view)).has('left'));assert.ok(new Set(active.map(v=>v.view)).has('right'));assert.ok(new Set(active.map(v=>v.frame)).size>=8)
 }
 if(!middle){
  const pairs=samples.filter(p=>p[1].bodyDiff!==undefined);assert.ok(pairs.length>=60)
  for(const pair of pairs){
   assert.equal(pair[1].bodyDiff,0,'Keep every junior body pixel');assert.equal(pair[0].frame,pair[1].frame,'Same phase');assert.equal(pair[0].transform,pair[1].transform,'Same viscous motion');assert.ok(pair[1].greens>100,'Crown must stay visible')
   for(let i=0;i<2;i++)assert.ok(Math.abs(pair[0].scale[i]-pair[1].scale[i])<.001,'Padding must not shrink the body')
  }
  binding={framesCompared:pairs.length,bodyPixelDifferences:0,samePhase:true,sameElasticMotion:true,sameBodyScale:true}
 }
 assert.deepEqual(errors,[]);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(dir,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,mode+'.gif')]);
 const receipt={frames:154,fps:24,duration:154/24*1000,dimensions:[width,height],cells:['seed','junior','middle','senior','super'].map((form,stage)=>({form,stage,action:'drag',label:'真实拖动与松手'})).filter(c=>middle?c.stage===2:!young||c.stage===1||c.stage===2),directionalViews:true,binding,errors};fs.writeFileSync(path.join(out,middle?'middle-bound-checks.json':young?'young-drag-checks.json':'horizontal-checks.json'),JSON.stringify(receipt,null,2)+'\n');
 if(process.env.KEEP_ANIMATION_FRAMES!=='1')fs.rmSync(dir,{recursive:true,force:true});console.log('PASS: original junior pixels and viscous timing preserved; visible animated crown; padding does not scale the body',JSON.stringify(binding??{}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
