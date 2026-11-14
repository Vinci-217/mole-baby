/** Shipping renderer: actual pixels, local frame loading and transform size.
 * Uses the existing QA identity, never a player's profile or save directory. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/visual-bounds-review');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const bodies=require('../electron/edge-visibility.json').forms;
const clips=require('../public/assets/original/official/manifest.json').clips;
const uploaded=require('../public/assets/original/uploaded-actions/index.json');
const forms=['junior','middle','senior','classic','super','water','wood','fire'];
fs.mkdirSync(out,{recursive:true});
async function pixelBody(page){
 return page.locator('[data-review-baseline]').evaluate(root=>{
  let left=Infinity,right=-Infinity,bottom=-Infinity;
  for(const c of root.querySelectorAll('canvas')){
   if(getComputedStyle(c).opacity==='0'||getComputedStyle(c).visibility==='hidden')continue;
   const r=c.getBoundingClientRect(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const ink=new Uint8Array(c.width*c.height),seen=new Uint8Array(ink.length);let largest=null;
   for(let i=0;i<ink.length;i++){const p=i*4;ink[i]=d[p+3]>=128&&d[p+2]>=d[p]+45&&d[p+2]>=d[p+1]+20?1:0;}
   // Blue droplets and wing ornaments are not the body. Compare the largest
   // connected body-colour region, excluding disconnected source accessories.
   for(let i=0;i<ink.length;i++)if(ink[i]&&!seen[i]){
    const queue=[i];seen[i]=1;let l=c.width,rr=0,b=0;
    for(let q=0;q<queue.length;q++){
     const p=queue[q],x=p%c.width,y=Math.floor(p/c.width);l=Math.min(l,x);rr=Math.max(rr,x+1);b=Math.max(b,y+1);
     for(const n of [x>0?p-1:-1,x<c.width-1?p+1:-1,p-c.width,p+c.width])if(n>=0&&n<ink.length&&ink[n]&&!seen[n]){seen[n]=1;queue.push(n)}
    }
    if(!largest||queue.length>largest.count)largest={count:queue.length,l,r:rr,b};
   }
   if(largest){left=Math.min(left,r.x+largest.l/c.width*r.width);right=Math.max(right,r.x+largest.r/c.width*r.width);bottom=Math.max(bottom,r.y+largest.b/c.height*r.height)}
  }
  return {width:right-left,bottom};
 });
}
async function main(){
 const ctx=await chromium.launchPersistentContext(path.join(out,'browser-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1700,height:1800},args:['--disable-dev-shm-usage']});
 try{
  const page=await ctx.newPage(),errors=[],missing=[],results=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()})});
  await page.clock.install();await page.goto(base+'?preview=size-review');
  await page.waitForFunction(()=>Boolean(window.animationSizeReview));
  for(const form of forms){
   await page.evaluate(form=>window.animationSizeReview.select({form,action:'spell'}),form);
   await expect(page.locator('[data-review-baseline] canvas[data-loaded=true]')).toHaveCount(1,{timeout:45000});
   await expect(page.locator('[data-review-subject] .magic-box-performance')).toHaveAttribute('data-ready','true');
   await page.clock.fastForward(1800);
   const box=page.locator('[data-review-subject] .magic-box-subject');await expect(box).toBeVisible();
   const body=await pixelBody(page),host=await page.locator('[data-review-subject]').boundingBox(),image=await box.boundingBox();
   const expected=(bodies[form].body[2]-bodies[form].body[0])*host.width/100;
   const width=image.width*145/288;
   assert(Math.abs(width-expected)<.15,form+' box registration');
   assert(body.width>20,form+' baseline body is painted');
   console.log('BOX',form,JSON.stringify({width,baseline:body.width,ratio:width/body.width}));
   // The original water/divine silhouettes include extra coloured details.
   // The box follows the anatomical reference and may be smaller than that
   // silhouette; it must never be enlarged by the former fixed 160% canvas.
   assert(width/body.width<1.1&&width/body.width>.7,form+' visible box/body ratio '+width/body.width);
   results.push({form,boxWidth:width,baselineBodyWidth:body.width,ratio:width/body.width});
   if(form==='super'||form==='junior')await page.screenshot({path:path.join(out,form+'-box.png')});
  }
  // Put the wide source canvas in a large neutral review area. This changes
  // no source/body scale and leaves enough room to inspect the complete ink.
  await page.addStyleTag({content:'.animation-size-review{max-width:none}.animation-size-review [data-review-subject]{position:fixed!important;left:700px;top:1400px}.animation-size-review [data-review-baseline]{position:fixed!important;left:400px;top:1400px}'});
  const draws=[];
  for(const form of ['junior','middle','senior','classic'])for(const id of ['tuya1','tuya2','tuya3','tuya4']){
   const level={junior:2,middle:3,senior:4,classic:101}[form];
   const clip=clips.find(c=>c.kind==='care'&&c.level===level&&c.path.endsWith('/'+id+'.swf'));
   const began=Date.now();await page.evaluate(({form,id})=>window.animationSizeReview.select({form,action:'official-'+id}),{form,id:clip.id});
   const canvas=page.locator('[data-review-subject] canvas[data-sheet=uploaded]');
   await expect(canvas).toHaveAttribute('data-loaded','true',{timeout:45000});
   const firstPaintMs=Date.now()-began;
   assert.equal(await page.locator('[data-review-subject] iframe').count(),0,'Recorded action must not start another SWF engine');
   const spec=uploaded[form+'-'+id];
   assert.equal(Number(await canvas.getAttribute('width')),spec.width);assert.equal(Number(await canvas.getAttribute('height')),spec.height);
   for(const fraction of [.15,.3,.3]){await page.clock.fastForward(Math.floor(spec.durationMs*fraction));await expect(canvas).toHaveAttribute('data-loaded','true');}
   const ink=await canvas.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>100)n++;return n});
   assert(ink>50,'Original doodle must paint visible ink throughout its timeline');
   draws.push({form,id,firstPaintMs,width:spec.width,height:spec.height,sourceFrame:Number(await canvas.getAttribute('data-source-frame')),ink});
   if(id==='tuya1')await page.screenshot({path:path.join(out,form+'-drawing.png')});
  }
  const replay=clips.find(c=>c.kind==='care'&&c.level===101&&c.path.endsWith('/tuya4.swf'));
  const warmBegan=Date.now();await page.evaluate(id=>window.animationSizeReview.select({form:'classic',action:'official-'+id}),replay.id);
  await expect(page.locator('[data-review-subject] canvas[data-sheet=uploaded]')).toHaveAttribute('data-loaded','true');
  const warmReplayMs=Date.now()-warmBegan;
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  const report={checkedAt:new Date().toISOString(),bodySizedBoxes:results,fullCanvasDoodles:draws,warmReplayMs,errors,missing};
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await ctx.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
