const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const dir=path.resolve(__dirname,'../artifacts/wardrobe-motion-review'),framesRoot=path.resolve(__dirname,'../local-assets/research/wardrobe-motion-recording');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(framesRoot,{recursive:true});
const forms=['junior','middle','senior','super','water','wood','fire'];let browser;
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
  const bodyFrames=new Set(),wearFrames=new Set(),directions=new Set();
  for(let i=0;i<108;i++){
   await page.clock.runFor(i%3===2?84:83);
   await expect(page.locator('.wardrobe-motion-grid .ram-wear')).toHaveCount(12);
   assert.equal(await page.locator('.wardrobe-motion-grid [data-fallback=true]').count(),0);
   const state=await page.locator('.wardrobe-motion-grid').evaluate(n=>({missing:[...n.querySelectorAll('.ram-wear')].filter(c=>getComputedStyle(c).visibility!=='visible'||c.dataset.loaded!=='true').map(c=>c.dataset.outfit),actions:[...n.querySelectorAll('.ram-sprite')].map(s=>s.dataset.action),bodies:[...n.querySelectorAll('canvas:not(.ram-wear)')].map(c=>c.dataset.frame+':'+c.dataset.row+':'+c.dataset.sourceFrame),wears:[...n.querySelectorAll('.ram-wear')].map(c=>c.dataset.paint+':'+c.dataset.sourceFrame+':'+c.style.cssText)}));
   assert.deepEqual(state.missing,[],`${form} frame ${i}: costume must stay visible`);
   state.actions.forEach(a=>directions.add(a));bodyFrames.add(state.bodies.join('|'));wearFrames.add(state.wears.join('|'));
   await page.screenshot({path:path.join(frames,`${String(i).padStart(3,'0')}.png`)});
  }
  assert(directions.has('walk-left')&&directions.has('walk-right')&&directions.has('idle'));assert(bodyFrames.size>8);assert(wearFrames.size>8);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',path.join(frames,'%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff:reserve_transparent=0[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle','-loop','0',path.join(dir,`desktop-outfits-${form}.gif`)],{stdio:'inherit'});
  checks.push({form,outfits:12,frames:108,fps:12,duration:9,bodyStates:bodyFrames.size,costumeStates:wearFrames.size,actions:[...directions]});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'recording-must-not-touch-player-save');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 fs.writeFileSync(path.join(dir,'movement-recording-checks.json'),JSON.stringify({passed:true,actualDesktopRamRenderer:true,playerSaveUntouched:true,checks,errors,failed},null,2));
 console.log(JSON.stringify({passed:true,forms:checks.length,outfitsPerForm:12,gifs:checks.length}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
