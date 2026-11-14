/** Real board writes and proportional resizing; only persistent isolated QA profiles. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('@playwright/test');
const {enterHome,toDesktop,roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/board-scale-review');
const native=process.argv.includes('--native'),url=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
fs.mkdirSync(out,{recursive:true});
function assertBundledCss(){
 let images=0;
 for(const file of fs.readdirSync(path.join(root,'dist/assets')).filter(name=>name.endsWith('.css'))){
  const sheet=path.join(root,'dist/assets',file),css=fs.readFileSync(sheet,'utf8');
  for(const match of css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)){
   const resource=match[2];if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(resource))continue;
   assert(!resource.startsWith('/'),'A file:// app has no website root: '+resource);
   assert(fs.existsSync(path.resolve(path.dirname(sheet),decodeURIComponent(resource).split(/[?#]/)[0])),'Missing CSS artwork: '+resource);images++;
  }
 }
 return images;
}
async function openBoard(page,app){
 const opened=app?.waitForEvent('window');
 if(!await page.locator('.room-placed-item[data-furniture="message-board"]').count()){
  await page.getByRole('button',{name:'布置小屋',exact:true}).click();
  const drawer=page.getByRole('complementary',{name:'小屋布置工具'}),layer=page.locator('.time-scene>.room-furnishing-layer.is-editing');
  const card=drawer.locator('.warehouse-drag-card');await card.scrollIntoViewIfNeeded();
  const box=await layer.boundingBox();await card.dragTo(layer,{targetPosition:{x:box.width*.3,y:box.height*.35}});
  await expect(page.locator('.room-placed-item[data-furniture="message-board"]')).toHaveCount(1);
  await drawer.getByRole('button',{name:'完成布置',exact:true}).click();
 }
 // A physical click on the visible board must win over the floor destination.
 await page.getByRole('button',{name:'小屋留言板',exact:true}).click();
 const board=app?await opened:page;await expect(board.getByRole('dialog',{name:'小屋留言板',exact:true})).toBeVisible();return board;
}
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function exercise(page,app){
 const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.failure()?.errorText.includes('ERR_FILE_NOT_FOUND'))missing.push(r.url())});
 const before=await read(page);assert(before);const initialNotes=before.notes??[];
 await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__boardFailWrites&&key==='ramu-house-save-v1')throw new DOMException('QA storage failure','QuotaExceededError');return write.call(this,key,value)}});
 // Capture a complete official resting frame before replacing the view.
 if(before.wearing){await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});await page.waitForTimeout(650)}
 const homeBegan=Date.now();await enterHome(page);
 let cachedFirstPaint=null;
 if(before.wearing){await expect(page.locator('.scene-character .official-cached-preview')).toBeVisible();cachedFirstPaint=Date.now()-homeBegan;await expect(page.locator('.scene-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});}
 const character=page.locator('.scene-character'),getSize=()=>character.boundingBox(),first=await getSize();
 await page.getByRole('button',{name:'调整小屋拉姆大小',exact:true}).click();
 const editor=page.getByRole('toolbar',{name:'小屋拉姆大小设置'});await expect(editor).toBeVisible();
 const handle=page.getByRole('button',{name:'调整小屋拉姆大小 se',exact:true}),box=await handle.boundingBox();
 // Reuse the last QA preferences indefinitely without reaching the size cap.
 const sign=first.width>=300?-1:1;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60*sign,box.y+box.height/2+65.2*sign,{steps:12});await page.mouse.up();
 const changed=await getSize();assert(Math.abs(changed.width-first.width)>1);assert(Math.abs(changed.width/changed.height-first.width/first.height)<.001);
 await expect(page.locator('.room-walker')).toHaveAttribute('data-moving','false');await expect(page.locator('.room-walk-surface')).toBeDisabled();
 const scale=Number(await page.locator('.room-walker').getAttribute('data-pet-scale'));
 await editor.getByRole('button',{name:'完成',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-preferences-v2')).roomPetScale)).toBe(scale);
 await page.getByRole('button',{name:'调整小屋拉姆大小',exact:true}).click();await page.getByRole('button',{name:'调整小屋拉姆大小 ne',exact:true}).press('ArrowRight');await editor.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(Number(await page.locator('.room-walker').getAttribute('data-pet-scale')),scale);
 await page.getByRole('button',{name:'调整小屋拉姆大小',exact:true}).click();await editor.getByRole('button',{name:'默认',exact:true}).click();await expect(page.locator('.room-walker')).toHaveAttribute('data-pet-scale','1');await editor.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.room-walker')).toHaveAttribute('data-pet-scale',String(scale));
 await page.screenshot({path:path.join(out,native?'native-house.png':'browser-house.png')});
 const b=await openBoard(page,app);if(b!==page){b.on('pageerror',e=>errors.push(e.message));b.on('requestfailed',r=>{if(r.failure()?.errorText.includes('ERR_FILE_NOT_FOUND'))missing.push(r.url())})}
 const note='留言回归 '+Date.now();await b.getByRole('button',{name:'我要留言',exact:true}).click();
 const emptySave=b.getByRole('button',{name:'保存',exact:true});await expect(emptySave).toBeDisabled();
 assert.equal(await emptySave.evaluate(n=>getComputedStyle(n).opacity),'1','Disabled button must fully cover the old label in the original background art');
 await b.screenshot({path:path.join(out,native?'native-compose-empty.png':'browser-compose-empty.png')});
 const text=b.locator('#board-note');await text.fill(note);
 await expect.poll(()=>b.locator('.board-compose-art').evaluate(n=>n.naturalWidth)).toBeGreaterThan(0);
 for(const label of ['取消','保存']){
  const button=b.locator('.board-compose-actions').getByRole('button',{name:label,exact:true});await expect(button).toBeVisible();
  const style=await button.evaluate(n=>({color:getComputedStyle(n).color,size:parseFloat(getComputedStyle(n).fontSize)}));assert(style.color!=='rgba(0, 0, 0, 0)');assert(style.size>=12);
 }
 await b.screenshot({path:path.join(out,native?'native-compose.png':'browser-compose.png')});
 await page.evaluate(()=>window.__boardFailWrites=true);await b.getByRole('button',{name:'保存',exact:true}).click();
 await expect(b.locator('.board-compose').getByRole('alert')).toContainText(/保留/);await expect(text).toHaveValue(note);
 assert(!(await read(page)).notes?.some(n=>n.text===note));
 await page.evaluate(()=>window.__boardFailWrites=false);await b.getByRole('button',{name:'保存',exact:true}).click();await expect(b.locator('.board-compose')).toHaveCount(0);
 await expect.poll(async()=>((await read(page)).notes??[]).filter(n=>n.text===note).length).toBe(1);
 await b.getByRole('button',{name:'编辑留言：'+note,exact:true}).click();await text.fill(note+' 已编辑');await b.getByRole('button',{name:'保存',exact:true}).click();await expect(b.locator('.board-compose')).toHaveCount(0);
 await b.getByRole('button',{name:'回复留言：'+note+' 已编辑',exact:true}).click();await text.fill('回复也能保存');await b.getByRole('button',{name:'保存',exact:true}).click();await expect(b.locator('.board-compose')).toHaveCount(0);
 const card=b.getByRole('article',{name:'留言',exact:true}).filter({hasText:note});await card.getByRole('button',{name:'□ 待完成',exact:true}).click();await expect(card.getByRole('button',{name:'✓ 已完成',exact:true})).toBeVisible();
 await b.screenshot({path:path.join(out,native?'native-board.png':'browser-board.png')});
 await card.getByRole('button',{name:'删除留言：'+note+' 已编辑',exact:true}).click();await b.getByRole('button',{name:'确认删除',exact:true}).click();await expect(b.locator('.board-remove')).toHaveCount(0);
 await expect.poll(async()=>((await read(page)).notes??[]).some(n=>n.text.startsWith(note))).toBe(false);
 for(const note of initialNotes)assert.deepEqual((await read(page)).notes.find(n=>n.id===note.id),note);
 if(app){await b.getByRole('button',{name:'关闭留言板',exact:true}).last().click();await expect.poll(()=>b.isClosed()).toBe(true)}else await b.getByRole('button',{name:'关闭留言板',exact:true}).last().click();
 await page.reload();await expect(page.getByTestId('desktop-character')).toBeVisible({timeout:45000});
 if(before.wearing)await expect(page.locator('.desktop-character .official-cached-preview')).toBeVisible();
 await enterHome(page);
 await expect(page.locator('.room-walker')).toHaveAttribute('data-pet-scale',String(scale));
 const after=await read(page);for(const key of ['createdAt','name','color','growth','evolution','wearing'])assert.deepEqual(after[key],before[key],key);
 if(!app){
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'调整小屋拉姆大小',exact:true}).click();
  await expect(editor).toBeVisible();const small=await getSize();assert(small.width<=366);assert(Math.abs(small.width/small.height-150/163)<.001);
  const controls=await editor.boundingBox();assert(controls.x>=0&&controls.x+controls.width<=390);
  for(const corner of ['nw','ne','sw','se']){const r=await page.getByRole('button',{name:'调整小屋拉姆大小 '+corner,exact:true}).boundingBox();assert(r.x>=0&&r.x+r.width<=390,'Every touch handle must stay on screen')}
  await expect(page.locator('.scene-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  await page.screenshot({path:path.join(out,'phone-size.png')});await editor.getByRole('button',{name:'取消',exact:true}).click();
  const mobileBoard=await openBoard(page);await mobileBoard.getByRole('button',{name:'我要留言',exact:true}).click();await mobileBoard.locator('#board-note').fill('手机预览');
  await mobileBoard.screenshot({path:path.join(out,'phone-compose.png')});await mobileBoard.getByRole('button',{name:'取消',exact:true}).click();await mobileBoard.getByRole('button',{name:'关闭留言板',exact:true}).first().click();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 return {proportionalScale:scale,resizeSavedAfterReload:true,cancelRetainedScale:true,messageCreateEditReplyCompleteDelete:true,failedWriteRetainsInput:true,retryAddsOnlyOneNote:true,priorNotesRetained:initialNotes.length,identityRetained:true,originalFrameCacheSurvivesReload:true,cachedViewFirstPaintMs:cachedFirstPaint,missingAssetRequests:missing,errors};
}
(async()=>{let context,app;try{
 const cssImages=assertBundledCss();let page;
 if(native){app=await _electron.launch({...(process.env.MOLE_QA_EXECUTABLE?{executablePath:process.env.MOLE_QA_EXECUTABLE}:{}),args:[...(process.env.MOLE_QA_EXECUTABLE?[]:[root,'--no-sandbox']),'--user-data-dir='+path.join(root,'artifacts/loading-save-review/native-qa-profile')],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');await expect(page.getByTestId('desktop-character')).toBeVisible({timeout:45000});}
 else{
  context=await chromium.launchPersistentContext(path.join(out,'browser-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--disable-dev-shm-usage'],viewport:{width:1000,height:850}});
  const fixture=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
  await context.addInitScript(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const[key,value]of Object.entries(snapshot))localStorage.setItem(key,value)},fixture.snapshot);
  page=await context.newPage();await page.goto(url);await expect(page.getByTestId('desktop-character')).toBeVisible({timeout:45000});
 }
 const result={cssLocalImagesVerified:cssImages,...await exercise(page,app)};
 fs.writeFileSync(path.join(out,native?'native-checks.json':'browser-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await app?.close();await context?.close()}})().catch(error=>{console.error(error);process.exitCode=1});
