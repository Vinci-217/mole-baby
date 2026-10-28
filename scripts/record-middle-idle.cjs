const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),mode=before?'before':'after';
const out=path.join(root,'artifacts/middle-calm-idle'),frames=fs.mkdtempSync(path.join(os.tmpdir(),'ram-middle-idle-'));
const url='http://127.0.0.1:5243';fs.mkdirSync(out,{recursive:true});let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5243','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const p=await browser.newPage({viewport:{width:640,height:270}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async()=>{window.review=(await import('/scripts/middle-idle-review-fixture.tsx')).mountMiddleIdleReview()});
 await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#middle-idle-review canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:30000}).toBe(4);
 const samples=[];
 for(let i=0;i<288;i++){
  const t=i*1000/24;
  if(i===192)await p.evaluate(()=>{window.review.gaze({x:.7,y:0});window.review.caption('鼠标靠近 · 轻轻看过来')});
  if(i===240)await p.evaluate(()=>{window.review.gaze({x:0,y:0});window.review.caption('移开鼠标 · 回到平视')});
  await p.clock.runFor(1000/24);
  await p.evaluate(t=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t}},t);
  const gaze=await p.locator('#middle-idle-review canvas:not(.ram-wear)').first().evaluate(c=>({x:Number(c.dataset.gazeX),y:Number(c.dataset.gazeY)}));
  samples.push({t,...gaze});
  await p.screenshot({path:path.join(frames,`${String(i).padStart(4,'0')}.png`)});
 }
 assert.deepEqual(errors,[]);
 if(!before){assert.ok(samples.slice(0,192).every(p=>p.x===0&&p.y===0),'Unattended idle must not orbit its pupils');assert.ok(samples.slice(210,240).every(p=>p.x>.3&&p.y===0),'Nearby pointer still receives a gentle glance');assert.ok(Math.abs(samples.at(-1).x)<.02,'Gaze returns to centre');}
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,mode+'.gif')]);
 fs.copyFileSync(path.join(frames,'0000.png'),path.join(out,mode+'.png'));
 fs.writeFileSync(path.join(out,mode+'-checks.json'),JSON.stringify({mode,frames:288,fps:24,renderer:'src/components/Ram.tsx',petSize:[100,109],errors,samples},null,2)+'\n');
 console.log(`PASS ${mode}: 12 seconds of real middle Ram playback, four colours, 288 captured frames`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM');fs.rmSync(frames,{recursive:true,force:true})});
