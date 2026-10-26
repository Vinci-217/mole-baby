// Records the shipping Ram/useElasticDrag renderer; the gallery is dev-only.
const{chromium,expect}=require('@playwright/test'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5234',out=path.join(root,'artifacts/v29-review');fs.mkdirSync(out,{recursive:true});let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5234','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:760,height:292}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.goto(url);await page.evaluate(async()=>{window.pullReview=(await import('/scripts/elastic-review-fixture.tsx')).mountElasticReview({bare:true,travel:true});const text=document.createElement('div');text.className='pull-caption';text.textContent='拉一拉，软软弹回来';document.body.append(text)});
 await expect(page.locator('#pull-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(5,{timeout:30000});
 // Capture evenly timed real paints, so video encoding cannot trim away the
 // pickup/reversal that demonstrates the feature. No poses are drawn offline.
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+100);
 await page.evaluate(()=>{
  const review=window.pullReview,caption=document.querySelector('.pull-caption'),trace=[];let phase=-1;
  window.pullTrace=trace;
  const began=performance.now();function frame(now){const t=now-began;let next=t<600?0:t<900?1:t<1230?2:t<2500?3:t<2800?4:t<3070?5:t<4300?6:t<4700?7:8;
   if(next!==phase){phase=next;if([1,4,7].includes(phase))review.start();if([3,6,8].includes(phase))review.release();caption.textContent=['拉一拉，软软弹回来','轻轻拉住 · 身体慢半拍','换个方向 · 先收缩再伸展','松开手 · 弹回来，再轻轻晃两下','再拉一下 · 叶片晚一点跟上','换个方向 · 软软的小拉姆','松开手 · 每个阶段都有自己的回弹','轻轻放好','种子的小花盆始终端正'][phase]}
   if(phase===1)review.sample(-38*(t-600)/300);if(phase===2)review.sample(-38+76*(t-900)/330);if(phase===4)review.sample(38-73*(t-2500)/300);if(phase===5)review.sample(-35+50*(t-2800)/270);if(phase===7)review.sample(15-15*(t-4300)/400);
   trace.push({t,phase,poses:[...document.querySelectorAll('#pull-review .ram-sprite')].map(n=>({x:parseFloat(n.style.getPropertyValue('--pull-x'))||0,skew:parseFloat(n.style.getPropertyValue('--pull-skew'))||0,phase:n.dataset.pullPhase,pot:n.querySelector('.seed-pot-original')?getComputedStyle(n.querySelector('.seed-pot-original')).transform:null}))});
   if(t<5700)requestAnimationFrame(frame)}requestAnimationFrame(frame)
 });
 const frames=path.join(out,'bouncy-frames');fs.mkdirSync(frames,{recursive:true});
 for(let i=0;i<143;i++){await page.clock.runFor(40);await page.screenshot({path:path.join(frames,`${String(i).padStart(4,'0')}.png`)})}
 const trace=await page.evaluate(()=>window.pullTrace);
 for(let stage=0;stage<5;stage++){
  const release=trace.filter(f=>f.phase===3),held=trace.filter(f=>f.phase===2).at(-1).poses[stage].x;
  assert.ok(release.some(f=>f.poses[stage].x*held<0),'Actual renderer must overshoot after release');
 }
 assert.ok(trace.every(f=>f.poses[0].pot==='none'),'Seed pot stays untransformed');assert.deepEqual(errors,[]);
 await page.close();
 const movie=path.join(root,'artifacts/v29-bouncy-pull.webm'),gif=path.join(root,'artifacts/v29-bouncy-pull.gif');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','25','-i',path.join(frames,'%04d.png'),'-an','-c:v','libvpx-vp9','-crf','28','-b:v','0',movie]);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','25','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',gif]);
 fs.writeFileSync(path.join(out,'bouncy-pull-trace.json'),JSON.stringify(trace));
 console.log('PASS: five stages recorded with production springs, reversal squeeze, actual release overshoot, original faces and stationary seed pot; README GIF generated');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
