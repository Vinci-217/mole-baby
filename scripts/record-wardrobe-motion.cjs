const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const measureContact=require('./wardrobe-contact-metrics.cjs');
const arg=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1]};
const dir=path.resolve(__dirname,'..',arg('--out','artifacts/wardrobe-motion-review')),framesRoot=path.resolve(__dirname,'..',arg('--frames','local-assets/research/wardrobe-motion-recording'));
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(framesRoot,{recursive:true});
const forms=arg('--forms','junior,middle,senior,classic,super,water,wood,fire').split(',');let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:960,height:760}}),errors=[],failed=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()])});
 await page.addInitScript(()=>localStorage.setItem('ramu-house-save-v1','recording-must-not-touch-player-save'));
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto('http://localhost:5173/?preview=wardrobe-motion');
 const ready=async()=>{await expect.poll(async()=>{await page.clock.runFor(25);return page.locator('.wardrobe-motion-grid .ram-wear[data-loaded=true]').evaluateAll(ns=>ns.filter(n=>getComputedStyle(n).visibility==='visible').length)},{timeout:30000}).toBe(12);await expect(page.locator('.wardrobe-motion-grid [data-fallback=true]')).toHaveCount(0)};
 for(const form of forms){
  console.log('Recording',form,'with all 12 outfits');
  await page.getByRole('combobox',{name:'移动预览形态',exact:true}).selectOption(form);
  // Warm front/left/right costume atlases; cached/loading frames never enter GIFs.
  for(let i=0;i<10;i++){await page.clock.runFor(900);await ready()}
  await page.getByRole('button',{name:'重新播放',exact:true}).click();await ready();
  const frames=path.join(framesRoot,form);fs.mkdirSync(frames,{recursive:true});
  const bodyFrames=new Set(),wearFrames=new Set(),directions=new Set();let contactChecks=0,maxContactGap=-Infinity;
  for(let i=0;i<108;i++){
   await page.clock.runFor(i%3===2?84:83);
   await expect(page.locator('.wardrobe-motion-grid .ram-wear')).toHaveCount(12);
   assert.equal(await page.locator('.wardrobe-motion-grid [data-fallback=true]').count(),0);
   const state=await page.locator('.wardrobe-motion-grid').evaluate(n=>{
    const clipping=[];
    for(const c of n.querySelectorAll('.ram-wear')){
     if(c.dataset.outfit!=='party-cap'&&c.dataset.registration!=='original-source')throw Error(`${c.dataset.outfit} unexpectedly fell back to its shop icon`);
     const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
     let left=c.width,top=c.height,right=0,bottom=0;
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>40){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1)}
     if(right<=left||bottom<=top)throw Error(`${c.dataset.outfit} has no painted clothing pixels`);
     const box=c.getBoundingClientRect(),track=c.closest('.wardrobe-motion-track').getBoundingClientRect();
     const ink={left:box.left+left/c.width*box.width,top:box.top+top/c.height*box.height,right:box.left+right/c.width*box.width,bottom:box.top+bottom/c.height*box.height};
     if(ink.left<track.left-1||ink.top<track.top-1||ink.right>track.right+1||ink.bottom>track.bottom+1)clipping.push({outfit:c.dataset.outfit,ink,track:{left:track.left,top:track.top,right:track.right,bottom:track.bottom}});
     if(c.dataset.outfit==='angel-wings'&&(c.dataset.mount!=='body-back'||Number(getComputedStyle(c).zIndex)>=Number(getComputedStyle(c.parentElement.querySelector('canvas:not(.ram-wear)')).zIndex)))throw Error('Wings must be mounted behind the body');
    }
    return {clipping,missing:[...n.querySelectorAll('.ram-wear')].filter(c=>getComputedStyle(c).visibility!=='visible'||c.dataset.loaded!=='true').map(c=>c.dataset.outfit),actions:[...n.querySelectorAll('.ram-sprite')].map(s=>s.dataset.action),bodies:[...n.querySelectorAll('canvas:not(.ram-wear)')].map(c=>c.dataset.frame+':'+c.dataset.row+':'+c.dataset.sourceFrame),wears:[...n.querySelectorAll('.ram-wear')].map(c=>c.dataset.paint+':'+c.dataset.sourceFrame+':'+c.style.cssText)};
   });
   assert.deepEqual(state.missing,[],`${form} frame ${i}: costume must stay visible`);
   assert.deepEqual(state.clipping,[],`${form} frame ${i}: painted clothing must stay inside the movement preview`);
   if(process.argv.includes('--contact-check'))for(const contact of await page.evaluate(measureContact)){
    assert(contact.contactColumns>0,`Missing head contact: ${JSON.stringify(contact)}`);
    assert(contact.gap<=.6&&contact.gap>=-3.5,`Floating or deeply overlapping headwear: ${JSON.stringify(contact)}`);
    maxContactGap=Math.max(maxContactGap,contact.gap);contactChecks++;
   }
   state.actions.forEach(a=>directions.add(a));bodyFrames.add(state.bodies.join('|'));wearFrames.add(state.wears.join('|'));
   await page.screenshot({path:path.join(frames,`${String(i).padStart(3,'0')}.png`)});
  }
  assert(directions.has('walk-left')&&directions.has('walk-right')&&directions.has('idle'));assert(bodyFrames.size>8);assert(wearFrames.size>8);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',path.join(frames,'%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle','-loop','0',path.join(dir,`desktop-outfits-${form}.gif`)],{stdio:'inherit'});
  checks.push({form,outfits:12,frames:108,fps:12,duration:9,bodyStates:bodyFrames.size,costumeStates:wearFrames.size,actions:[...directions],...(contactChecks?{contactChecks,maxContactGap}: {})});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'recording-must-not-touch-player-save');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const reportFile=path.join(dir,'movement-recording-checks.json'),previous=process.argv.includes('--merge')&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')).checks:[];
 const merged=[...previous.filter(check=>!forms.includes(check.form)),...checks];
 fs.writeFileSync(reportFile,JSON.stringify({passed:true,actualDesktopRamRenderer:true,playerSaveUntouched:true,checks:merged,errors,failed},null,2));
 console.log(JSON.stringify({passed:true,forms:checks.length,outfitsPerForm:12,gifs:checks.length}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
