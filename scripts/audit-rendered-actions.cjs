/** Exercise the public renderer vocabulary in every growth form, using the
 * same component/CSS as the application, on a save-free comparison page. */
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/all-animation-sizes/rendered');
async function loaded(page){
 for(let n=0;n<250;n++){
  await page.clock.runFor(25);
  const result=await page.evaluate(()=>{
   const root=document.querySelector('[data-review-subject]');if(root?.querySelector('iframe'))return 'native';
   const canvases=[...root?.querySelectorAll('canvas')??[]];
   if(canvases.some(c=>c.dataset.loaded==='true'||c.dataset.sourceFrame))return 'raster';
   if(root?.querySelector('[data-fallback]'))return 'fallback';return null;
  });if(result)return result;await new Promise(r=>setTimeout(r,8));
 }return 'timeout';
}
async function geometry(page){return page.locator('[data-review-subject]').evaluate(root=>{
 const box=root.getBoundingClientRect(),nodes=[...root.querySelectorAll('canvas')].filter(c=>!c.classList.contains('official-hit-mask'));
 return nodes.map(c=>{
  const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data,style=getComputedStyle(c),rect=c.getBoundingClientRect();let ink=0,x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>160){ink++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  const sx=parseFloat(style.width)/c.width/Number(c.dataset.registrationX||1),sy=parseFloat(style.height)/c.height/Number(c.dataset.registrationY||1);
  return {class:c.className,sheet:c.dataset.sheet,form:c.dataset.form,loaded:c.dataset.loaded,sourceFrame:c.dataset.sourceFrame,ink,painted:[x0,y0,x1,y1],cssScale:[sx,sy],aspectError:Math.abs(sx-sy)/Math.max(sx,sy),size:[rect.width,rect.height],relative:[rect.x-box.x,rect.y-box.y]};
 });
});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']}),rows=[],errors=[];
 try{const page=await browser.newPage({viewport:{width:1000,height:760}});page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:5173/?preview=size-review');
  const inventory=await page.evaluate(()=>({actions:animationSizeReview.actions,forms:animationSizeReview.forms}));
  for(const form of inventory.forms)for(const action of inventory.actions){
   await page.evaluate(value=>animationSizeReview.select(value),{form,action});const renderer=await loaded(page);
   const samples=[];if(renderer==='raster')for(const ms of [0,600,1000]){if(ms)await page.clock.runFor(ms);samples.push(await geometry(page));}
   const flags=[...(['timeout','fallback'].includes(renderer)?[renderer]:[]),...(samples.flat().some(c=>!Number.isFinite(c.aspectError)||c.aspectError>.035)?['aspect']:[]),...(samples.length&&!samples.flat().some(c=>c.ink>5)?['empty']:[])];
   const row={form,action,renderer,flags,samples};rows.push(row);if(flags.length){console.log('REVIEW',form,action,flags);await page.screenshot({path:path.join(out,form+'-'+action+'.png')});}
   if(rows.length%30===0)console.log('Rendered',rows.length);
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checked:rows.length,errors,flagged:rows.filter(r=>r.flags.length),rows},null,2));console.log(JSON.stringify({checked:rows.length,errors,flagged:rows.filter(r=>r.flags.length).map(({samples,...r})=>r)}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
