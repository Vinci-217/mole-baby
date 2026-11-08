const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,expect}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json');
const out=path.resolve(__dirname,'../artifacts/animation-semantics');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 try{
  const page=await browser.newPage({viewport:{width:900,height:760}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.goto('http://127.0.0.1:5173/assets/original/official/runtime.html?token=switch');
  await page.evaluate(()=>{window.received=[];addEventListener('message',e=>received.push(e.data))});
  const clip=id=>manifest.clips.find(c=>c.path.endsWith('/'+id+'.swf'));
  const load=(id,sequence)=>page.evaluate(({id,sequence})=>postMessage({type:'ram-original-load',token:'switch',sequence,value:{id,loop:true,registerBody:true,pose:{form:'level2',direction:'down',moving:false,color:[0,-21,-255],sound:false}}},'*'),{id,sequence});
  // Simulate an obsolete engine whose initialization promise never completes.
  // This is fault injection, not a claim of reproducing a user's network.
  await page.evaluate(()=>{
   const original=RufflePlayer.newest.bind(RufflePlayer);let first=true;
   RufflePlayer.newest=()=>{const api=original(),create=api.createPlayer.bind(api);return new Proxy(api,{get(target,key){if(key==='createPlayer')return()=>{const player=create();if(first){first=false;const ruffle=player.ruffle.bind(player);player.ruffle=()=>{const instance=ruffle(),load=instance.load.bind(instance);return new Proxy(instance,{get(target,key){if(key==='load')return async options=>{await load(options);await new Promise((resolve,reject)=>window.rejectObsolete=reject)};const value=target[key];return typeof value==='function'?value.bind(target):value}})}}return player};const value=target[key];return typeof value==='function'?value.bind(target):value}})};
  });
  await load(clip('1200020').id,1);await expect.poll(()=>page.evaluate(()=>typeof rejectObsolete)).toBe('function');
  await load(clip('1200052').id,2);
  await expect.poll(()=>page.evaluate(()=>received.some(d=>d.sequence===2&&d.type==='ram-original-ready')),{timeout:15000}).toBe(true);
  await page.evaluate(()=>rejectObsolete(Error('Obsolete engine failed late')));await page.waitForTimeout(200);
  assert(!await page.evaluate(()=>received.some(d=>d.sequence===2&&d.type==='ram-original-error')));
  // Rapid real selections still end on the latest source, not a stale fallback.
  let sequence=2;const timings=[];
  for(const id of ['1200020','1200021','1200033','1200040','1200052']){const start=Date.now();await load(clip(id).id,++sequence);const current=sequence;await expect.poll(()=>page.evaluate(sequence=>received.some(d=>d.sequence===sequence&&d.type==='ram-original-ready'),current),{timeout:15000}).toBe(true);timings.push({id,ms:Date.now()-start});}
  for(const id of ['1200026','1200033','1200040','1200021','1200052']){await load(clip(id).id,++sequence);await page.waitForTimeout(45);}
  await expect.poll(()=>page.evaluate(sequence=>received.some(d=>d.sequence===sequence&&d.type==='ram-original-ready'),sequence),{timeout:15000}).toBe(true);
  assert.equal(await page.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').form),'level2');
  const movie=manifest.clips.find(c=>c.kind==='care'&&c.level===2&&c.path.endsWith('/180011.swf'));
  await page.goto('http://127.0.0.1:5173/?preview=official&group=care&form=middle&compare=1&clip='+movie.id);
  await expect(page.locator('[data-clip] .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const first=await page.locator('[data-clip] iframe').getAttribute('src');
  await expect.poll(()=>page.locator('[data-clip] iframe').getAttribute('src'),{timeout:26000,intervals:[500]}).not.toBe(first);
  await expect(page.locator('[data-clip] .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'load-switching.json'),JSON.stringify({obsoleteLoadDoesNotBlock:true,lateFailureIgnored:true,latestSelectionPainted:true,finitePreviewReplays:true,timings,errors,missing},null,2));
  console.log('PASS stalled initialization, late failure, real rapid switching and finite preview replay',JSON.stringify(timings));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
