/** Actual React/CSS/canvas recordings, deterministic clocks, no publication. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-gallery'),url='http://127.0.0.1:5236';fs.mkdirSync(out,{recursive:true});let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5236','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 const discovery=await browser.newPage();await discovery.goto(url);const modes=await discovery.evaluate(async()=>Object.keys((await import('/scripts/animation-gallery-fixture.tsx')).GALLERY));await discovery.close();
 const selected=process.argv.slice(2),checks=fs.existsSync(path.join(out,'checks.json'))?JSON.parse(fs.readFileSync(path.join(out,'checks.json'),'utf8')):{};
 for(const mode of modes.filter(m=>!selected.length||selected.includes(m)||selected.includes('--new')&&!checks[m])){
  const p=await browser.newPage({viewport:{width:750,height:1200}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
  const spec=await p.evaluate(async mode=>{window.gallery=(await import('/scripts/animation-gallery-fixture.tsx')).mountAnimationGallery(mode);return {width:window.gallery.width,height:window.gallery.height,...window.gallery.spec}},mode);
  await p.setViewportSize({width:spec.width,height:spec.height});
  const load=async()=>expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#animation-gallery canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:60000}).toBe(spec.cells.filter(c=>!c.locked).length);
  await load();if(mode==='wardrobe')await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#animation-gallery .ram-wear[data-loaded=true]').count()},{timeout:30000}).toBe(spec.cells.filter(c=>!c.locked).length);await p.locator('#animation-gallery img').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('[data-fallback=true]').count(),0,`${mode}: no illustration fallback`);
  await p.evaluate(()=>window.gallery.restart());await load();
  const began=await p.evaluate(()=>performance.now()),dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});const count=Math.ceil(spec.duration*24/1000),cdp=await p.context().newCDPSession(p);
  for(let i=0;i<count;i++){
   await p.evaluate(t=>{window.gallery.tick(t);window.animationBirths??=new WeakMap();for(const a of document.getAnimations()){if(!window.animationBirths.has(a))window.animationBirths.set(a,t);a.pause();a.currentTime=t-window.animationBirths.get(a)}},i/24*1000);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
   fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'.png'),Buffer.from(shot.data,'base64'));
   const now=await p.evaluate(()=>performance.now());await p.clock.runFor(Math.max(0,began+(i+1)/24*1000-now));
  }
  assert.deepEqual(errors,[],`${mode}: browser errors`);
  const gif=path.join(out,mode+'.gif');execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(dir,'%04d.png'),'-frames:v',String(count),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle','-loop','0',gif]);
  if(process.env.KEEP_ANIMATION_FRAMES!=='1')fs.rmSync(dir,{recursive:true,force:true});
  checks[mode]={frames:count,fps:24,duration:spec.duration,dimensions:[spec.width,spec.height],cells:spec.cells,errors};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');
  console.log(`PASS ${mode}: ${count} real application frames, ${spec.cells.length} cells, ${fs.statSync(gif).size} GIF bytes`);await p.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
