const{chromium,expect}=require('@playwright/test'),{spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5242';let browser;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5242','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 for(const color of ['red','yellow','blue','pink'])for(const outfit of ['wizard-cap','warm-scarf']){
  const p=await browser.newPage({viewport:{width:640,height:300}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(url);await p.clock.pauseAt(new Date(Date.now()+1000));
  await p.evaluate(async args=>{window.dragReview=(await import('/scripts/elastic-review-fixture.tsx')).mountElasticReview({stages:[1,2],wide:true,...args})},{color,outfit});
  const load=async()=>expect.poll(async()=>{await p.clock.runFor(25);return p.locator('#pull-review canvas:not(.ram-wear)[data-loaded=true]').count()},{timeout:30000}).toBe(2);await load();
  await expect.poll(async()=>{await p.clock.runFor(25);return p.locator('.ram-wear[data-loaded=true]').count()},{timeout:30000}).toBe(2);
  await p.evaluate(()=>window.dragReview.start());await load();
  for(const direction of [1,-1]){
   for(let i=1;i<=24;i++){
    await p.evaluate(x=>window.dragReview.sample(x,0),direction*i*5);await p.clock.runFor(16)

   }
   const canvases=p.locator('#pull-review canvas:not(.ram-wear)');for(const c of await canvases.all()){await expect(c).toHaveAttribute('data-sheet','drag');await expect(c).toHaveAttribute('data-drag-view',direction===1?'right':'left');await expect(c).toHaveAttribute('data-loaded-color',color)}
   for(const gear of await p.locator('.ram-wear').all()){await expect(gear).toBeVisible();await expect(gear).toHaveAttribute('data-registration','drag-source');const ink=await gear.evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(d[(y*canvas.width+x)*4+3]>64){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1)}const style=getComputedStyle(canvas),r=canvas.getBoundingClientRect();return{x:r.x,y:r.y,width:(x1-x0)/canvas.width*parseFloat(style.width),height:(y1-y0)/canvas.height*parseFloat(style.height)}});assert.ok([ink.x,ink.y,ink.width,ink.height].every(Number.isFinite)&&ink.width>5&&ink.width<130&&ink.height>5&&ink.height<130,`${color}/${outfit}: visible accessory bounds ${JSON.stringify(ink)}`)}
   if(color==='red'&&outfit==='wizard-cap')await p.screenshot({path:`/tmp/mole-v33-gear-${direction}.png`});
  }
  await p.evaluate(()=>window.dragReview.release());await p.clock.runFor(3200);await expect(p.locator('#pull-review canvas:not(.ram-wear)').first()).toHaveAttribute('data-sheet','grounded');assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS: junior/middle, four colours, two original outfits, both turn directions, real moving sprites, attached clothing and release to idle');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
