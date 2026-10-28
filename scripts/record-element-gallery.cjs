const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5247',frames=fs.mkdtempSync(path.join(os.tmpdir(),'ramu-element-gallery-'));
const box=process.argv.includes('--box'),cells=box?3:18;
const out=path.join(root,'artifacts/v30-workflow');fs.mkdirSync(out,{recursive:true});let browser;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5247','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width:600,height:box?220:1110}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.evaluate(async box=>{window.gallery=(await import('/scripts/element-gallery-fixture.tsx')).mountElementGallery(box)},box);
 await expect.poll(async()=>{await p.clock.runFor(10);return p.locator('#element-gallery .magic-box-performance[data-ready=true]').count()},{timeout:60000}).toBe(cells);
 await p.evaluate(()=>window.gallery.restart());await expect.poll(async()=>{await p.clock.runFor(1);return p.locator('#element-gallery .magic-box-performance[data-ready=true]').count()},{timeout:60000}).toBe(cells);
 const cdp=await p.context().newCDPSession(p),count=box?144:276;
 for(let i=0;i<count;i++){
  await p.clock.runFor(1000/24);await p.evaluate(t=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t}},i/24*1000);
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});fs.writeFileSync(path.join(frames,`${String(i).padStart(4,'0')}.png`),Buffer.from(shot.data,'base64'));
 }
 assert.deepEqual(errors,[]);assert.equal(await p.locator('#element-gallery .magic-box-performance').count(),0,'Every original spell must restore its Ram');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(frames,'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',path.join(out,box?'magic-box.gif':'original-elements.gif')]);
 fs.writeFileSync(path.join(out,box?'box-gallery-checks.json':'element-gallery-checks.json'),JSON.stringify({fps:24,frames:count,duration:count/24,petSize:[100,109],sourceFrames:box?null:1711,skills:cells,errors},null,2)+'\n');
 console.log(`PASS: actual renderer gallery, ${cells} performances, white smoke, complete return, ${count} recorded frames`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill();fs.rmSync(frames,{recursive:true,force:true})});
