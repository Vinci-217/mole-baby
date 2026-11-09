/** Actual production renderer, fixed anatomy scale through every original
 * frame. Isolated review page; never creates, loads or resets a player save. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const {chromium}=require('@playwright/test');
const clips=require('../public/assets/original/element-skills/clips.json'),visibility=require('../electron/edge-visibility.json');
const out=path.resolve(__dirname,'../artifacts/all-animation-sizes/element-fixed');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const rows=[],errors=[];
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:5173/?preview=size-review');
  for(const form of Object.keys(visibility.forms))for(const clip of Object.values(clips)){
   await page.evaluate(s=>animationSizeReview.select(s),{form,action:'element-'+clip.id});
   for(let n=0;n<200;n++){
    await page.clock.runFor(25);
    if(await page.locator('[data-review-subject] [data-ready="true"]').count())break;
    await new Promise(r=>setTimeout(r,10));
   }
   assert(await page.locator('[data-review-subject] [data-ready="true"]').count(),form+' '+clip.id+' load');
   const host=page.locator('[data-review-subject]'),canvas=host.locator('[data-element-skill]');
   const samples=[];
   const playStart=await host.locator('[data-magic-start]').getAttribute('data-magic-start');
   const milestones=[0,Math.floor(clip.frames/2),clip.frames-1];
   for(const frame of milestones){
    const delta=await page.evaluate(({start,frame,fps})=>Number(start)+1520+frame*1000/fps+20-performance.now(),{start:playStart,frame,fps:clip.fps});
    if(delta>0)await page.clock.runFor(Math.ceil(delta));
    const geometry=await canvas.evaluate(c=>{const h=c.closest('[data-review-subject]').getBoundingClientRect(),r=c.getBoundingClientRect(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)ink++;return{frame:Number(c.dataset.sourceFrame),kx:r.width/c.width/(h.width/100),ky:r.height/c.height/(h.width/100),ink}});
    assert(Math.abs(geometry.kx-geometry.ky)<.001,'Uniform scaling '+form+' '+clip.id+' '+JSON.stringify(geometry));
    const expected=visibility.forms[form].body[2]-visibility.forms[form].body[0];
    assert(Math.abs(geometry.kx*clip.registration.referenceBodyWidth-expected)<.05,'Body matches '+form);
    samples.push(geometry);
    if(form==='super'&&frame===milestones[1]){
     const box=await host.boundingBox();await page.screenshot({path:path.join(out,clip.id+'.png'),clip:{x:box.x-140,y:box.y-160,width:440,height:430}});
    }
   }
   assert(samples.some(s=>s.ink>5),'Original frames painted');
   assert(samples.every(s=>Math.abs(s.kx-samples[0].kx)<.001),'Fixed scale over full source motion');
   rows.push({form,id:clip.id,samples});
  }
  assert.deepEqual(errors,[]);
  const tiles=[];for(const [i,clip] of Object.values(clips).entries()){
   const input=await sharp(path.join(out,clip.id+'.png')).resize(240,235).png().toBuffer();
   tiles.push({input,left:i%6*240,top:Math.floor(i/6)*265+30});
   tiles.push({input:Buffer.from(`<svg width="240" height="30"><text x="10" y="21" fill="#725633" font-size="14" font-family="sans-serif">${clip.name} · ${clip.id}</text></svg>`),left:i%6*240,top:Math.floor(i/6)*265});
  }
  await sharp({create:{width:1440,height:795,channels:4,background:'#fbf5e8'}}).composite(tiles).png().toFile(path.join(out,'element-sheet.png'));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checked:rows.length,errors,rows},null,2));console.log('PASS',rows.length,'element/form combinations, first/middle/last frame, fixed anatomical scaling, original images unchanged');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
