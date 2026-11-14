/** Actual renderer/native checkpoints, all inside an isolated QA profile. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('@playwright/test');
const {enterHome,roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/loading-save-review'),native=process.argv.includes('--native'),base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
fs.mkdirSync(out,{recursive:true});
const ready=scope=>expect(scope.locator('.official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
async function paintedPlayer(iframe){
 const frame=await iframe.contentFrame();
 await expect.poll(()=>frame.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight/2)===player)).toBe(true);
 assert(await frame.evaluate(()=>{const rect=player.getBoundingClientRect();return rect.top===0&&rect.left===0&&Math.abs(rect.width-innerWidth)<=1&&Math.abs(rect.height-innerHeight)<=1}),'The active source must occupy the actual visible viewport, never flow below a hidden cached source');
 const pooled=await frame.evaluate(()=>[...document.querySelectorAll('ruffle-player')].map(node=>({active:node===player,volume:node.ruffle().volume,playing:typeof node.ruffle().isPlaying==='function'?node.ruffle().isPlaying():node.ruffle().isPlaying})));
 assert(pooled.length<=2);for(const entry of pooled)if(!entry.active){assert.equal(entry.volume,0);assert.equal(entry.playing,false)}
}
async function wardrobe(page){
 let wasm=0;page.on('request',request=>{if(/\.wasm(?:\?|$)/.test(request.url()))wasm++});
 await page.goto(base+'?preview=wardrobe&form=super&outfit=1200020');
 const mirror=page.locator('.wardrobe-mirror');await ready(mirror);
 const original=await mirror.locator('iframe').elementHandle(),measurements=[];
 for(const name of ['庆生小帽','紫色魔法帽','金色羽毛','紫色魔法帽']){
  await page.getByRole('button',{name:'试戴'+name,exact:true}).click();await ready(mirror);
  assert(await original.evaluate(node=>node.isConnected),'Switching a source must reuse its loaded iframe/WASM module');
  assert.equal(await mirror.locator('>.ram-sprite').getAttribute('data-growth-stage'),'4');
  await paintedPlayer(original);
  measurements.push({name,...await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ramu-animation-load-log-v1')).filter(event=>event.event==='ready').at(-1))});
 }
 assert.equal(wasm,1,'Repeated wardrobe changes must request only one WASM module');
 const frame=await original.contentFrame();
 const body=await mirror.boundingBox();await page.mouse.move(body.x+body.width/2,body.y+body.height*.6);await page.mouse.down();
 for(const offset of [70,-70,80,-80,0]){await page.mouse.move(body.x+body.width/2+offset,body.y+body.height*.6,{steps:5});assert.equal(await frame.evaluate(()=>player.ruffle().callExternalInterface('previewTextCount')),0,'Original name placeholders must be removed before painting');}
 await page.mouse.up();await ready(mirror);
 await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();assert(await original.evaluate(node=>node.isConnected));
 await page.screenshot({path:path.join(out,'wardrobe.png'),fullPage:true});
 return {wasmRequests:wasm,sourceChanges:measurements.length,measurements,dragHasNoPlaceholderFields:true};
}
async function saves(page,desktop){
 const api=await page.evaluate(()=>Boolean(window.desktop?.localSaves));assert(api);
 const seed=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
 await page.evaluate(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const[key,value]of Object.entries(snapshot))localStorage.setItem(key,value);},seed.snapshot);await page.reload();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 const before=await saved();await expect.poll(()=>page.evaluate(async()=>Boolean(await window.desktop.localSaves.read()))).toBe(true);
 await enterHome(page);await roomTab(page,'衣橱');
 const mirror=page.locator('.wardrobe-mirror');await ready(mirror);const source=await mirror.locator('iframe').elementHandle(),times=[];
 for(const name of ['庆生小帽','紫色魔法帽','庆生小帽']){
  const button=page.getByRole('button',{name:'试戴'+name,exact:true});
  while(!await button.count()&&await page.getByRole('button',{name:'衣橱上一页',exact:true}).isEnabled())await page.getByRole('button',{name:'衣橱上一页',exact:true}).click();
  await button.click();await ready(mirror);assert(await source.evaluate(node=>node.isConnected));
  await paintedPlayer(source);
  times.push(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ramu-animation-load-log-v1')).filter(event=>event.event==='ready').at(-1)));
 }
 const frame=await source.contentFrame();assert.equal(await frame.evaluate(()=>player.ruffle().callExternalInterface('previewTextCount')),0);
 await roomTab(page,'设置');await page.getByRole('button',{name:'检查本地存档',exact:true}).click();
 await expect(page.locator('.local-save-paths')).toContainText('save-backups');
 const info=await page.evaluate(()=>window.desktop.localSaves.inspect());assert(info.profileDirectory.startsWith(out));assert(fs.existsSync(path.join(info.backupDirectory,'latest.json')));
 const exported=path.join(out,'exported-save.json');
 await desktop.evaluate(({session},file)=>{global.localSaveDownload='waiting';session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(file);item.once('done',(_event,state)=>global.localSaveDownload=state)})},exported);
 await page.getByRole('button',{name:'导出存档',exact:true}).click();await expect.poll(()=>desktop.evaluate(()=>global.localSaveDownload),{timeout:15000}).toBe('completed');
 const backup=JSON.parse(fs.readFileSync(exported));for(const key of ['createdAt','name','color','growth','evolution','wearing'])assert.deepEqual(backup[key],before[key],key);assert(backup.companionMemory);assert(backup.localData);
 await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles(exported);await expect(page.getByRole('status').filter({hasText:'存档已恢复'}).first()).toBeVisible();
 // Remove the browser entry in this QA profile before the NEXT React mount,
 // after pagehide has checkpointed it. Never clear a real player profile.
 await page.addInitScript(()=>{if(sessionStorage.getItem('qa-remove-primary')!=='yes')return;sessionStorage.removeItem('qa-remove-primary');localStorage.removeItem('ramu-house-save-v1')});
 await page.evaluate(()=>sessionStorage.setItem('qa-remove-primary','yes'));await page.reload();await expect(page.getByTestId('desktop-character')).toBeVisible();
 const restored=await saved();for(const key of ['createdAt','name','color','growth','evolution','wearing','inventory'])assert.deepEqual(restored[key],before[key],key);assert.deepEqual([...restored.wardrobe].sort(),[...before.wardrobe].sort(),'all wardrobe ownership is retained through canonical import ordering');
 const checkpoints=fs.readdirSync(info.backupDirectory);assert(checkpoints.some(name=>name.includes('before-import')));
 await desktop.close();
 return {saveDirectoryReported:true,exportImport:true,recoveredMissingBrowserRecordBeforeAdoption:true,identityAndGrowthAndClothingRetained:true,backupFiles:checkpoints.length,nativeSourceSwitches:times};
}
(async()=>{let browser,desktop;const errors=[];try{
 if(native){desktop=await _electron.launch({...(process.env.MOLE_QA_EXECUTABLE?{executablePath:process.env.MOLE_QA_EXECUTABLE}:{}),args:[...(process.env.MOLE_QA_EXECUTABLE?[]:[root,'--no-sandbox']),'--user-data-dir='+path.join(out,'native-qa-profile')],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForLoadState('domcontentloaded');const result=await saves(page,desktop);desktop=null;assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'native-checks.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));}
 else{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1000,height:850}});page.on('pageerror',e=>errors.push(e.message));const result=await wardrobe(page);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));}
 }finally{await desktop?.close();await browser?.close()}})().catch(error=>{console.error(error);process.exitCode=1});
