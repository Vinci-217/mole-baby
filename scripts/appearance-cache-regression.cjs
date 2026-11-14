/** Real renderer checks: live AVM reuse, lossless growth atlases after restart,
 * and the legacy-WebView fallback. This review never opens a player save. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/appearance-cache-review');
const forms=['seed','junior','middle','senior','classic','super','water','wood','fire'];
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const context=await chromium.launchPersistentContext(path.join(out,'browser-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1150,height:700},args:['--disable-dev-shm-usage']});
 try{
  const page=await context.newPage(),errors=[],missing=[],checks=[],base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)missing.push(response.url())});
  await page.goto(base+'?preview=size-review&form=super&outfit=leaf-hood');
  const subject=page.locator('[data-review-subject]'),clip=subject.locator('.official-ram-clip');
  const choose=value=>page.evaluate(value=>window.animationSizeReview.select(value),value);
  const rows=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('ramu-original-frame-cache-v1',1);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('frames')){db.close();resolve([]);return}const q=db.transaction('frames').objectStore('frames').getAll();q.onsuccess=()=>{resolve(q.result.map(row=>row.key));db.close()};q.onerror=()=>reject(q.error)};r.onerror=()=>reject(r.error)}));
  await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect(clip.locator('iframe')).toHaveCSS('opacity','1');
  const iframe=await clip.locator('iframe').elementHandle(),runtime=await iframe.contentFrame();
  const origin=await runtime.evaluate(()=>{window.__cacheOriginalPlayer=window.player;return performance.timeOrigin});
  await expect.poll(async()=>(await rows()).some(key=>key.includes(':junior:super:')),{timeout:10000}).toBe(true);
  for(let n=0;n<3;n++){
   await choose({form:'super',outfit:'leaf-hood',action:'still'});
   await expect(subject.locator('[data-cached-original=true]')).toBeVisible();
   assert.equal(await subject.locator('iframe').count(),0,'The static portrait has no extra engine');
   assert(await iframe.evaluate(node=>node.isConnected),'The ready engine stays connected while parked');
   const began=Date.now();await choose({form:'super',outfit:'leaf-hood',action:'idle'});
   await expect(clip).toHaveAttribute('data-loaded','true',{timeout:10000});
   await expect(clip.locator('iframe')).toHaveCSS('opacity','1');
   assert(await subject.locator('iframe').evaluate((node,previous)=>node===previous,iframe),'The same live iframe returns');
   assert.equal(await runtime.evaluate(()=>performance.timeOrigin),origin,'Iframe document was not reloaded');
   assert(await runtime.evaluate(()=>window.__cacheOriginalPlayer===window.player),'The original AVM is reused');
   assert.equal(await subject.locator('.official-outfit-status').count(),0,'A cached appearance does not claim to download again');
   checks.push({case:'outfit-remount',round:n+1,readyMs:Date.now()-began,sameFrame:true,sameAVM:true});
  }
  const painted={};
  for(const form of forms){
   await choose({form,action:'still'});const canvas=subject.locator('canvas[data-loaded=true]').first();
   await expect(canvas).toBeVisible({timeout:20000});
   painted[form]=await canvas.evaluate(canvas=>canvas.toDataURL());
   const token=form==='seed'?':seed:junior:':':'+form+':';
   await expect.poll(async()=>(await rows()).some(key=>key.startsWith('growth-atlas:')&&key.includes(token)),{timeout:15000}).toBe(true);
  }
  // Reset module memory, retaining IndexedDB. Deny the original neutral/mask
  // images: every base stage must now render from its lossless disk cache.
  await page.route(/\/assets\/(?:classic\/|original\/(?:grounded|flight)\/|original\/seed\/body)/,route=>route.abort('internetdisconnected'));
  await page.reload();await page.waitForFunction(()=>Boolean(window.animationSizeReview));
  for(const form of forms){
   const began=Date.now();await choose({form,action:'still'});const canvas=subject.locator('canvas[data-loaded=true]').first();
   await expect(canvas).toBeVisible({timeout:10000});
   assert.equal(await canvas.evaluate(canvas=>canvas.toDataURL()),painted[form],form+' cached pixels remain lossless');
   checks.push({case:'persisted-growth',form,readyMs:Date.now()-began,losslessPixels:true,originalImagesBlocked:true});
  }
  await page.unrouteAll({behavior:'wait'});
  // Browsers without state-preserving moves must load normally and keep the
  // cached appearance visible, rather than trying an iframe move that reloads.
  await page.evaluate(()=>{Element.prototype.moveBefore=undefined});
  await choose({form:'super',outfit:'leaf-hood',action:'idle'});await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  await choose({form:'super',outfit:'leaf-hood',action:'still'});await expect(subject.locator('[data-cached-original=true]')).toBeVisible();
  await choose({form:'super',outfit:'leaf-hood',action:'idle'});await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  assert.equal(await subject.locator('.official-outfit-status').count(),0);
  await choose({form:'super',outfit:'leaf-hood',action:'walk-left'});await expect(clip).toHaveAttribute('data-loaded','true');
  const live=await (await clip.locator('iframe').elementHandle()).contentFrame();
  assert.equal(await live.evaluate(()=>window.player.ruffle().isPlaying),true,'Walking stays live after restoration');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,legacyMoveFallback:true,walkingRemainsLive:true,errors,missing},null,2)+'\n');
  console.log('PASS live engine reuse, all nine lossless persisted growth appearances, legacy fallback and walking');
 }finally{await context.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
