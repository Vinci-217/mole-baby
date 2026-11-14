/** Browser/PWA gameplay and offline checks; persistent isolated QA profiles only. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit,expect}=require('@playwright/test');
const {roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/web-review'),base=(process.env.PREVIEW_URL||'http://127.0.0.1:5173/').replace(/\/?$/,'/');
const safari=process.argv.includes('--webkit'),engine=safari?webkit:chromium,label=safari?'webkit':'chromium';
fs.mkdirSync(out,{recursive:true});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function context(name,mobile=false){
 const profile=path.join(out,label+'-'+name+'-profile'),options={headless:true,executablePath:safari?'/usr/local/share/ms-playwright/webkit-2370/pw_run.sh':'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',...(safari?{}:{args:['--disable-dev-shm-usage']}),viewport:mobile?{width:390,height:844}:{width:1000,height:850},...(mobile?{isMobile:true,hasTouch:true}:{})};
 let ctx=await engine.launchPersistentContext(profile,options),page=ctx.pages()[0]||await ctx.newPage();
 await page.goto(base+'manifest.webmanifest');
 const updateWaiting=await page.evaluate(async()=>{const r=await navigator.serviceWorker?.getRegistration();if(!r)return false;await r.update();const w=r.installing;if(w)await new Promise(resolve=>{if(['installed','redundant'].includes(w.state))return resolve();w.addEventListener('statechange',()=>{if(['installed','redundant'].includes(w.state))resolve()})});return Boolean(r.waiting)});
 // Close the installed app completely for a pending update. Retain its whole
 // profile; no forced worker takeover, unregister, or save/cache reset.
 if(updateWaiting){await ctx.close();ctx=await engine.launchPersistentContext(profile,options)}
 return ctx;
}
async function prepare(ctx,snapshot,{coldEngine=false}={}){
 let page=ctx.pages()[0]||await ctx.newPage();
 // A non-app document lets a waiting update install and all old app clients
 // close naturally. Keep every save key; do not unregister or clear storage.
 await page.goto(base+'manifest.webmanifest');
 const previous=await page.evaluate(async()=>Boolean(await navigator.serviceWorker?.getRegistration()));
 if(previous)await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r?.waiting&&r?.active?.state==='activated'}),{timeout:15000}).toBe(true);
 if(snapshot)await page.evaluate(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const[key,value]of Object.entries(snapshot))localStorage.setItem(key,value)},snapshot);
 if(!previous)await page.evaluate(async()=>{await(await caches.open('qa-unrelated-keep')).put('./qa-keep',new Response('keep'));await(await caches.open('mole-baby-web-core-old-qa')).put('./qa-old',new Response('obsolete'))});
 // Remove only engine bytes in the isolated QA cache to exercise a cold
 // write on every run. Pet saves, memories, preferences and backups survive.
 if(coldEngine)await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('mole-baby-web-media-')){const cache=await caches.open(name);for(const request of await cache.keys())if(/\.wasm(?:\?|$)/.test(request.url))await cache.delete(request)}});
 if(!safari){const session=await ctx.newCDPSession(page);await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true})}
 await page.goto(base);await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker?.controller)),{timeout:25000}).toBe(true);
 if(!previous){const keys=await page.evaluate(()=>caches.keys());assert(keys.includes('qa-unrelated-keep'));assert(!keys.includes('mole-baby-web-core-old-qa'));}
 return {page,oldApplicationCacheOnlyCleanupVerified:!previous};
}
async function newPlayer(){
 const ctx=await context('new-player',true),errors=[];
 try{
  await ctx.addInitScript(()=>{if(!localStorage.getItem('ramu-house-preferences-v2'))localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,roomWander:false,sound:false,gameSound:false}))});
  const {page,oldApplicationCacheOnlyCleanupVerified}=await prepare(ctx);page.on('pageerror',e=>errors.push(e.message));
  let pet=await saved(page),adopted=false;
  if(!pet){
   await expect(page.getByRole('button',{name:'选择蓝色拉姆',exact:true})).toBeVisible();
   await expect(page.locator('.web-app-help.is-compact')).toBeVisible();
   await page.getByRole('button',{name:'选择蓝色拉姆',exact:true}).click();await page.getByRole('button',{name:'给它起名',exact:true}).click();await page.locator('#pet-name').fill('网页体验测试');await page.getByRole('button',{name:'带拉姆回家！',exact:true}).click();adopted=true;
  }
  await expect(page.locator('.cottage-scene')).toBeVisible();await expect(page.locator('.desktop-preview')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'回到桌面',exact:true})).toHaveCount(0);
  pet=await saved(page);assert(pet?.createdAt);
  const manifest=await page.evaluate(async()=>{const response=await fetch(document.querySelector('link[rel=manifest]').href);return response.json()});assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
  for(const icon of manifest.icons){const response=await page.request.get(new URL(icon.src,base+'manifest.webmanifest').href);assert(response.ok());assert(response.headers()['content-type'].includes('image/png'))}
  await page.screenshot({path:path.join(out,label+'-house-phone.png')});
  await roomTab(page,'设置');await expect(page.getByText('苹果主屏幕版与 Safari 的存档各自独立。',{exact:false})).toBeVisible();
  await expect(page.getByRole('switch',{name:'桌面散步',exact:true})).toHaveCount(0);
  const exported=path.join(out,label+'-web-save.json'),downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档',exact:true}).click();const download=await downloaded;await download.saveAs(exported);
  assert.equal(JSON.parse(fs.readFileSync(exported)).createdAt,pet.createdAt);
  await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles(exported);await expect(page.getByRole('status').filter({hasText:'存档已恢复'}).first()).toBeVisible();
  await page.reload();await expect(page.locator('.cottage-scene')).toBeVisible();assert.equal((await saved(page)).createdAt,pet.createdAt);
  await ctx.setOffline(true);await page.reload();await expect(page.locator('.cottage-scene')).toBeVisible({timeout:25000});assert.equal((await saved(page)).createdAt,pet.createdAt);
  await page.screenshot({path:path.join(out,label+'-offline-phone.png')});await ctx.setOffline(false);
  assert.deepEqual(errors,[]);
  return {adoptedThisRun:adopted,roomFirst:true,oldApplicationCacheOnlyCleanupVerified,saveExportImport:true,offlineShellAndSave:true,petId:pet.createdAt,errors};
 }finally{await ctx.close()}
}
async function clothedPlayer(){
 const ctx=await context('source-player'),errors=[],missing=[];
 try{
  const fixture=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
  const {page}=await prepare(ctx,fixture.snapshot,{coldEngine:true});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))missing.push({url:r.url(),status:r.status()})});
  await expect(page.locator('.cottage-scene')).toBeVisible();const before=await saved(page),clip=page.locator('.scene-character .official-ram-clip');
  await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  await page.reload();await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect.poll(()=>page.evaluate(async()=>{const keys=await caches.keys(),name=keys.find(k=>k.startsWith('mole-baby-web-media-'));return name?(await(await caches.open(name)).keys()).map(r=>r.url).filter(u=>/\.wasm(?:\?|$)/.test(u)).length:0}),{timeout:15000}).toBeGreaterThan(0);
  const runtimeKeys=await page.evaluate(async()=>{const keys=await caches.keys(),name=keys.find(k=>k.startsWith('mole-baby-web-media-'));return(await(await caches.open(name)).keys()).map(r=>r.url).filter(u=>u.includes('/runtime.html'))});
  assert(runtimeKeys.length>0);assert(runtimeKeys.every(u=>!u.includes('token=')&&!u.includes('restart=')));
  await ctx.setOffline(true);await page.reload();await expect(page.locator('.cottage-scene')).toBeVisible();await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
  const after=await saved(page);for(const key of ['createdAt','name','color','growth','evolution','wearing'])assert.deepEqual(after[key],before[key],key);
  const frame=await(await page.locator('.scene-character iframe').elementHandle()).contentFrame();
  const status=await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));assert(status.ready&&status.settled);
  assert(await frame.evaluate(()=>{const r=player.getBoundingClientRect();return Math.abs(r.top)<1&&Math.abs(r.left)<1&&document.elementFromPoint(innerWidth/2,innerHeight/2)===player}),'Original source must actually occupy the visible viewport');
  await expect.poll(()=>page.locator('.scene-character .official-hit-mask').evaluate(canvas=>{const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let pixels=0;for(let i=3;i<a.length;i+=4)if(a[i]>32)pixels++;return pixels})).toBeGreaterThan(100);
  await page.screenshot({path:path.join(out,label+'-offline-outfit.png')});await ctx.setOffline(false);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  return {originalOutfitReadyOffline:true,sameSourceAndIdentity:true,iframeTokenNotCached:true,wasmCachedAfterColdFetch:true,httpCacheDisabled:!safari,petId:before.createdAt,errors,missing};
 }finally{await ctx.close()}
}
(async()=>{const result={engine:label,newPlayer:await newPlayer(),clothedPlayer:await clothedPlayer()};fs.writeFileSync(path.join(out,label+'-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))})().catch(error=>{console.error(error);process.exitCode=1});
