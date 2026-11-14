/** Shipping renderer: original meals, retained outfit engines and persisted portraits. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/care-outfit-review');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const context=await chromium.launchPersistentContext(path.join(out,'browser-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1150,height:700},args:['--disable-dev-shm-usage']});
 try{
  const page=await context.newPage(),errors=[],missing=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)missing.push(response.url())});
  await page.clock.install();await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:5173/')+'?preview=size-review&form=super&outfit=leaf-hood');
  const subject=page.locator('[data-review-subject]');
  const choose=value=>page.evaluate(value=>window.animationSizeReview.select(value),value);
  const source=subject.locator('.ram-outfit-source .official-ram-clip');
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire']){
   await choose({form,outfit:'leaf-hood',action:'idle'});
   await expect(source).toHaveAttribute('data-loaded','true',{timeout:45000});
   const engine=await source.locator('iframe').elementHandle();
   for(const itemId of ['biscuit','180001','juice','180003','energy-drink','180071','180073']){
    const level={junior:2,middle:3,senior:4}[form]??101,target=level===101?'classic':form;
    const id={biscuit:'180017',juice:'180008','energy-drink':'180014','180071':'180070','180073':'180002'}[itemId]??itemId;
    const expected=manifest.clips.find(clip=>clip.kind==='care'&&clip.level===level&&clip.path.endsWith('/'+id+'.swf'));
    const started=Date.now();await choose({form,outfit:'leaf-hood',action:'use',itemId});
    await expect(subject.locator('[data-animation-mode=original-care]')).toHaveAttribute('data-care-source',expected.path);
    const canvas=subject.locator('.ram-original-care canvas[data-sheet=uploaded]');
    await expect(canvas).toHaveAttribute('data-loaded','true',{timeout:45000});await expect(canvas).toHaveAttribute('data-source-form',target);
    await expect(subject.locator('.ram-outfit-source')).toBeHidden();assert(await engine.evaluate(node=>node.isConnected));
    assert.equal(await subject.locator('.ram-item-cue').count(),0,'No generated feeding overlay');
    const first=Number(await canvas.getAttribute('data-source-frame'));await page.clock.fastForward(200);
    assert(Number(await canvas.getAttribute('data-source-frame'))>first,'Original eating timeline advances');
    checks.push({form,itemId,source:expected.path,readyMs:Date.now()-started});
    if(itemId==='biscuit')await page.screenshot({path:path.join(out,form+'-original-meal.png')});
    await choose({form,outfit:'leaf-hood',action:'idle'});await expect(subject.locator('.ram-outfit-source')).toBeVisible();
    assert(await engine.evaluate(node=>node.isConnected),'The same original outfit engine returns after eating');
   }
   await engine.dispose();console.log('PASS original meals and retained clothing:',form);
  }
  await choose({form:'super',outfit:'leaf-hood',action:'idle'});await expect(source).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect.poll(()=>page.evaluate(async()=>{const req=indexedDB.open('ramu-original-frame-cache-v1',1);return new Promise((resolve,reject)=>{req.onsuccess=()=>{const db=req.result,tx=db.transaction('frames'),r=tx.objectStore('frames').getAll();r.onsuccess=()=>{resolve(r.result.some(row=>row.key.includes(':junior:super:')&&row.key.includes('false:true:3.2')));db.close()};r.onerror=()=>reject(r.error)};req.onerror=()=>reject(req.error)})}),{timeout:10000}).toBe(true);
  const started=Date.now();await choose({form:'super',outfit:'leaf-hood',action:'still'});
  await expect(subject.locator('.ram-outfit-portrait [data-cached-original=true]')).toBeVisible();
  assert.equal(await subject.locator('iframe').count(),0,'A cached portrait does not start another animation engine');
  const memoryPortraitMs=Date.now()-started;
  await page.reload();await page.waitForFunction(()=>Boolean(window.animationSizeReview));
  await choose({form:'super',outfit:'leaf-hood',action:'still'});
  await expect(subject.locator('.ram-outfit-portrait [data-cached-original=true]')).toBeVisible({timeout:10000});
  assert.equal(await subject.locator('iframe').count(),0,'Persisted original frame is reused after reopening');
  await choose({form:'super',outfit:'leaf-hood',action:'walk-left'});await expect(source).toHaveAttribute('data-loaded','true',{timeout:45000});
  assert.equal(await subject.locator('.ram-outfit-portrait').count(),0,'Walking remains animated');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,memoryPortraitMs,portraitReusedAfterReload:true,noPlayerForCachedPortrait:true,errors,missing},null,2)+'\n');
  console.log('PASS persisted original portrait, no extra portrait engine, live walking preserved');
 }finally{await context.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
