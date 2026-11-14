/** Reproduce complete actions between clothed poses and deliberately slow
 * reading loads in the shipping renderer, without touching a player save. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const out=path.resolve(__dirname,'../artifacts/animation-stability'),base=process.env.PREVIEW_URL||'http://127.0.0.1:5173';
fs.mkdirSync(out,{recursive:true});
const playing=frame=>frame.evaluate(()=>{const api=player.ruffle();return typeof api.isPlaying==='function'?api.isPlaying():api.isPlaying});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--disable-dev-shm-usage','--disk-cache-size=10485760']});
 const checks={},errors=[],missing=[];
 try{
  let page=await browser.newPage({viewport:{width:1000,height:850}}),wasmRequests=0;
  page.on('request',request=>{if(/\.wasm(?:\?|$)/.test(request.url()))wasmRequests++});
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)missing.push(response.url())});
  await page.goto(base+'/?preview=wardrobe&form=super&outfit=1200020');
  const mirror=page.locator('.wardrobe-mirror'),source=mirror.locator('.ram-outfit-source'),clip=source.locator('.official-ram-clip'),iframe=source.locator('iframe');
  await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect(source.locator('.official-hit-mask')).toHaveAttribute('data-loaded','true');
  const original=await iframe.elementHandle(),frame=await original.contentFrame(),token=await iframe.getAttribute('src'),initialWasm=wasmRequests;
  for(const [label,selector] of [['玩球','.ram-football-frame'],['吃东西','.ram-item-cue'],['开心','.ram-daily-frame,canvas[data-loaded="true"]']]){
   await page.getByRole('button',{name:`预览${label}动作`,exact:true}).click();
   await expect(source).toBeHidden();await expect(mirror.locator('.ram-outfit-action').locator(selector).first()).toBeVisible({timeout:20000});
   await expect.poll(()=>playing(frame),{timeout:5000}).toBe(false);
   assert.equal(await mirror.locator('>.ram-sprite').getAttribute('data-growth-stage'),'4');
   await expect(source).toBeVisible({timeout:30000});await expect(clip).toHaveAttribute('data-loaded','true');
   assert(await original.evaluate(node=>node.isConnected),'The loaded costume engine must survive full actions');
   assert.equal(await iframe.getAttribute('src'),token);assert.equal(wasmRequests,initialWasm,'Full actions must not request another outfit engine');
  }
  await page.getByRole('button',{name:'预览右走动作',exact:true}).click();
  await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('right');
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>playing(frame)).toBe(false);
  await page.getByRole('button',{name:'预览左走动作',exact:true}).click();
  await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('left');
  await expect.poll(()=>playing(frame)).toBe(false);
  checks.continuity={actions:['football','eat','emotion'],sameIframe:true,wasmRequests,initialWasm,hiddenEnginePaused:true,originalGrowthRetained:true,reducedMotionDirectionSettles:true};
  console.log('PASS full actions retain and pause the clothed player; return without another WASM request');await page.close();

  page=await browser.newPage({viewport:{width:800,height:650}});page.on('pageerror',error=>errors.push(error.message));
  let release;const held=new Promise(resolve=>release=resolve);
  await page.route('**/assets/original/daily-frames/**',async route=>{await held;await route.continue().catch(()=>{})});
  await page.goto(base+'/?preview=reading&form=super');await page.getByRole('button',{name:'自己翻书 · 18秒',exact:true}).click();
  await page.waitForTimeout(3500);await expect(page.locator('.reading-preview-pet>.ram-sprite')).toHaveAttribute('data-action','focus');
  release();await expect(page.locator('.ram-daily-frame')).toHaveAttribute('data-loaded','true',{timeout:30000});
  const firstPaint=Date.now();await expect(page.locator('.reading-preview-pet>.ram-sprite')).toHaveAttribute('data-action','still',{timeout:22000});
  const visibleMs=Date.now()-firstPaint;assert(visibleMs>=17500&&visibleMs<21000,`Reading should play 18s after first paint, got ${visibleMs}ms`);
  checks.reading={artificialLoadDelayMs:3500,visibleMs,fullPlaybackAfterLoading:true};console.log('PASS slow reading atlas loading does not consume playback time: '+visibleMs+'ms');await page.close();
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);fs.writeFileSync(path.join(out,'continuity-checks.json'),JSON.stringify({...checks,errors,missing},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
