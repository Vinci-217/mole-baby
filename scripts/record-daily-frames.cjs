const fs=require('node:fs'),path=require('node:path'),{chromium,expect}=require('@playwright/test');
let server,browser;const output='/tmp/mole-v31-daily-capture';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const{createServer}=await import('vite');server=await createServer({server:{host:'127.0.0.1',port:5252,strictPort:true,hmr:false}});await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:1620,height:660},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5252');await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 const meta=await page.evaluate(async()=>{const m=await import('/scripts/daily-frame-fixture.tsx');window.__daily=m.mountDailyFrames();return {cells:window.__daily.cells,actions:m.DAILY_ACTIONS,fps:24,scale:2,width:1620,height:660,rootOffset:[40,70]}});fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify(meta,null,2));
 for(const[action,duration]of Object.entries(meta.actions)){
  const directory=path.join(output,action);fs.mkdirSync(directory,{recursive:true});const count=Math.ceil(duration/1000*24);
  if(fs.readdirSync(directory).filter(n=>n.endsWith('.png')).length===count){console.log('Cached daily frames',action);continue}
  await page.evaluate(action=>window.__daily.show(action),action);
  await expect.poll(async()=>{await page.clock.runFor(34);return page.locator('#daily-source-review .daily-cell').evaluateAll(cells=>cells.every(c=>Array.from(c.querySelectorAll('canvas:not(.ram-wear)')).some(n=>n.dataset.loaded==='true')))} ,{timeout:30000}).toBe(true);
  await page.evaluate(action=>window.__daily.show(action),action);await page.clock.runFor(17);
  for(let i=0;i<count;i++){
   if(i>0)await page.clock.runFor(1000/24);
   await page.evaluate(time=>{for(const animation of document.getAnimations()){animation.pause();animation.currentTime=time}},17+i*1000/24);
   await page.screenshot({path:path.join(directory,String(i).padStart(4,'0')+'.png'),omitBackground:true,animations:'allow'});
  }
  console.log('Recorded full source composition',action,count,'time frames, nine forms, three colour probes');
 }
 require('node:assert/strict').deepEqual(errors,[]);console.log('PASS offline daily frame capture, real source body/props/CSS poses, 24fps');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();await server?.close()});
