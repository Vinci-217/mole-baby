const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5204';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5204','--strictPort'],{cwd:root,stdio:'pipe'});
let browser,logs='';server.stderr.on('data',d=>logs+=d);
const forms=['senior','super','water','wood','fire'],colors=['red','yellow','blue','pink'];
(async()=>{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto(url);await page.clock.pauseAt(new Date(Date.now()+1000));
 // Exercise the actual renderer in isolation, without adding production debug controls.
 await page.evaluate(async()=>{
  const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js'),{default:{flushSync}}=await import('/node_modules/.vite/deps/react-dom.js'),{default:Ram}=await import('/src/components/Ram.tsx');
  document.getElementById('root').style.display='none';const host=document.createElement('div');host.id='flight-review';host.style.cssText='width:100px;margin:30px;background:#f1f4e8';document.body.appendChild(host);const root=createRoot(host);
  window.renderFlight=props=>flushSync(()=>root.render(React.createElement(Ram,{...props,stage:props.form==='senior'?3:4,evolution:props.form==='senior'?undefined:props.form,sound:false})));
 });
 const ram=page.locator('#flight-review .ram-sprite'),canvas=ram.locator('canvas'),dir=path.join(root,'artifacts/v173-facing');fs.mkdirSync(dir,{recursive:true});
 const paint=async props=>{await page.evaluate(p=>window.renderFlight(p),props);await expect.poll(async()=>{await page.clock.runFor(40);return canvas.getAttribute('data-loaded')}).toBe('true');await page.clock.runFor(80);};
 for(const form of forms)for(const color of colors){
  await paint({form,color,action:'idle'});await expect(canvas).toHaveAttribute('data-form',form);
  await ram.locator('.ram-flight-layer').evaluate(n=>{window.__facingFlight=n.getAnimations()[0]});
  for(const [action,row,label] of [['walk-left','2','left'],['idle','0','front'],['walk-right','1','right'],['idle','0',null]]){
   await paint({form,color,action});await expect(canvas).toHaveAttribute('data-row',row);await expect(canvas).toHaveAttribute('data-sheet','classic');
   assert.equal(await ram.locator('.ram-flight-layer').evaluate(n=>n.getAnimations()[0]===window.__facingFlight),true,'direction does not restart hovering');
   if(label)await page.locator('#flight-review').screenshot({path:path.join(dir,`${form}-${color}-${label}.png`)});
  }
  // The displayed pixels must match the chosen original row and body-only palette.
  await paint({form,color,action:'walk-right'});
  const difference=await canvas.evaluate(async c=>{
   const form=c.dataset.form,row=Number(c.dataset.row),frame=Number(c.dataset.frame),color=c.dataset.color;
   const images=await Promise.all(['neutral','mask'].map(async kind=>{const im=new Image();im.src=`./assets/classic/${form}-${kind}.png`;await im.decode();const x=document.createElement('canvas');x.width=192;x.height=208;x.getContext('2d').drawImage(im,frame*192,row*208,192,208,0,0,192,208);return x.getContext('2d').getImageData(0,0,192,208).data}));
   const offsets={red:[255,-199,-250],yellow:[0,-21,-255],blue:[-215,-57,31],pink:[51,-148,0]}[color],clamp=x=>Math.max(0,Math.min(255,x)),deltas=[255,204,153].map(base=>offsets.map(o=>clamp(base+o)-base)),[neutral,mask]=images;
   const actual=c.getContext('2d').getImageData(0,0,192,208).data;let max=0,count=0;
   for(let i=0;i<actual.length;i+=4){if(neutral[i+3]>0)count++;for(let ch=0;ch<3;ch++){const expected=clamp(neutral[i+ch]+deltas[0][ch]*mask[i]/255+deltas[1][ch]*mask[i+1]/255+deltas[2][ch]*mask[i+2]/255);if(neutral[i+3]>190)max=Math.max(max,Math.abs(actual[i+ch]-expected));}max=Math.max(max,Math.abs(actual[i+3]-neutral[i+3]));}
   return {max,count};
  });assert.ok(difference.count>1000);assert.ok(difference.max<=2,`${form}/${color} source pixels: ${JSON.stringify(difference)}`);
  if(color==='red'){
   const frames=new Set();for(let t=0;t<1000;t+=40){await page.clock.runFor(40);frames.add(Number(await canvas.getAttribute('data-frame')))}assert.equal(frames.size,8,form+' plays eight side poses');
  }
 }
 console.log('PASS 20 airborne form/colour variants: original left/right rows and pixels, eight side poses, uninterrupted hover and front-facing stop');
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const action of ['walk-left','walk-right']){await paint({form:'super',color:'blue',action});await expect(canvas).toHaveAttribute('data-row',action==='walk-left'?'2':'1');await expect(canvas).toHaveAttribute('data-frame','0');}
 const review=await browser.newPage({viewport:{width:1200,height:680}});await review.goto(url);await review.setContent(`<style>body{margin:0;background:#f1f4e8;font:12px sans-serif;color:#675134}main{display:grid;grid-template-columns:repeat(12,100px)}figure{margin:0;text-align:center}img{width:100px;height:109px}figcaption{height:25px;font-size:10px;white-space:nowrap}</style><main>${forms.flatMap(form=>colors.flatMap(color=>['left','front','right'].map(side=>`<figure><img src="${url}/artifacts/v173-facing/${form}-${color}-${side}.png"><figcaption>${form} ${color} ${side}</figcaption></figure>`))).join('')}</main>`);await review.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));await review.screenshot({path:path.join(root,'artifacts/v173-flight-facing.png')});
 assert.deepEqual(errors,[]);console.log('PASS reduced-motion facing, no renderer errors; visual contact sheet artifacts/v173-flight-facing.png');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
