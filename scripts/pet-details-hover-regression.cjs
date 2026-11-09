/** Exercise the real tray checkbox and renderer on an isolated copy of the QA record. */
const {_electron,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-hover-review-'));
const out=path.join(root,'artifacts/pet-details-hover');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'artifacts/wardrobe-interactions/previous-record-before.json'),'utf8'));
const label='仅悬停时显示名字和状态';
let desktop;
const errors=[];
async function start(){
 desktop=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});
 const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);return page;
}
async function captureTray(page){
 await desktop.evaluate(({Tray})=>{
  const original=Tray.prototype.setContextMenu;
  Tray.prototype.setContextMenu=function(menu){globalThis.__hoverReviewMenu=menu;return original.call(this,menu)};
 });
 await page.evaluate(()=>{window.desktop.readyToShow(false);window.desktop.readyToShow(true)});
 await expect.poll(()=>desktop.evaluate((_,label)=>Boolean(globalThis.__hoverReviewMenu?.items.find(item=>item.label===label)),label)).toBe(true);
}
async function toggle(enabled){
 await desktop.evaluate((_,{label,enabled})=>{
  const item=globalThis.__hoverReviewMenu.items.find(item=>item.label===label);
  if(item.checked!==enabled)item.click();
 },{label,enabled});
}
async function checkRecord(page){
 const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 const before=JSON.parse(snapshot['ramu-house-save-v1']),after=JSON.parse(saved['ramu-house-save-v1']);
 for(const key of ['name','createdAt','color','growth','evolution','wearing','wardrobe','inventory'])assert.deepEqual(after[key],before[key],`keep previous ${key}`);
 for(const [key,value] of Object.entries(snapshot))if(key.startsWith('ramu-companion-memory')){
  const oldMemory=JSON.parse(value),memory=JSON.parse(saved[key]);
  for(const field of ['petId','personality','facts','messages'])assert.deepEqual(memory[field],oldMemory[field],`keep memory ${field}`);
  for(const event of oldMemory.events)assert.deepEqual(memory.events.find(item=>item.id===event.id),event,'keep every previous memory; petting may add a new one');
 }
}
async function checkVisibleImages(page){
 await expect.poll(()=>page.locator('img').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&getComputedStyle(n).visibility!=='hidden'&&(!n.complete||!n.naturalWidth)).map(n=>n.src)),{timeout:15000}).toEqual([]);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 let page=await start();
 const fixture={...snapshot},pet=JSON.parse(fixture['ramu-house-save-v1']);pet.lastTick=Date.now();fixture['ramu-house-save-v1']=JSON.stringify(pet);
 fixture['ramu-house-preferences-v2']=JSON.stringify({...JSON.parse(fixture['ramu-house-preferences-v2']),reminders:true});
 await reloadWithStorage(page,fixture);
 await page.evaluate(async()=>{await window.desktop.setPetMode(true);await window.desktop.setPetCanMove(false);await window.desktop.setEdgeHiding(false)});
 const character=page.getByTestId('desktop-character'),name=page.locator('.compact-pet-name'),condition=page.getByTestId('desktop-condition');
 await expect(character).toBeVisible();await captureTray(page);
 await page.mouse.move(1,1);await expect(name).toBeVisible();await expect(condition).toBeVisible();
 const position=await character.boundingBox();
 await toggle(true);await expect(name).toBeHidden();await expect(condition).toBeHidden();
 await page.screenshot({path:path.join(out,'01-mouse-away.png'),omitBackground:true});
 await character.hover();await expect(name).toBeVisible();await expect(condition).toBeVisible();await checkVisibleImages(page);
 assert.deepEqual(await character.boundingBox(),position,'hover does not move or resize the pet');
 await page.screenshot({path:path.join(out,'02-mouse-hover.png'),omitBackground:true});
 await name.hover();await expect(name).toBeVisible();await condition.hover();await expect(condition).toBeVisible();
 await character.click();await page.mouse.move(1,1);await expect(name).toBeHidden();await expect(condition).toBeHidden();
 // A forwarded native move must also hide the labels when the pointer exits the window.
 await character.hover();await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{clientX:-20,clientY:-20,bubbles:true})));
 await expect(name).toBeHidden();await expect(condition).toBeHidden();
 await toggle(false);await expect(name).toBeVisible();await expect(condition).toBeVisible();
 await toggle(true);await expect(name).toBeHidden();
 await character.hover();await page.getByRole('button',{name:'开始计时',exact:true}).click();
 await expect(character.locator('.ram-daily-frame')).toHaveAttribute('data-loaded','true');
 await expect(character.locator('.ram-sprite')).toHaveAttribute('data-evolution','super');
 await checkVisibleImages(page);
 const readingPosition=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),body=await character.boundingBox();
 await page.mouse.move(body.x+body.width/2,body.y+body.height*.7);await page.mouse.down();await page.mouse.move(body.x+body.width/2+30,body.y+body.height*.7+20,{steps:4});await page.mouse.up();
 assert.deepEqual(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),readingPosition,'reading stays at its native desktop position');
 await page.screenshot({path:path.join(out,'03-super-reading.png'),omitBackground:true});
 await character.hover();await page.getByRole('button',{name:'取消计时',exact:true}).click();
 await checkRecord(page);await desktop.close();desktop=null;
 page=await start();
 await expect(page.getByTestId('desktop-character')).toBeVisible();await page.evaluate(()=>window.desktop.setPetCanMove(false));
 assert.equal((await page.evaluate(()=>window.desktop.getState())).petDetailsOnHover,true);
 await page.mouse.move(1,1);await expect(page.locator('.compact-pet-name')).toBeHidden();await expect(page.getByTestId('desktop-condition')).toBeHidden();
 await captureTray(page);assert.equal(await desktop.evaluate((_,label)=>globalThis.__hoverReviewMenu.items.find(item=>item.label===label).checked,label),true);
 await page.getByTestId('desktop-character').hover();await expect(page.locator('.compact-pet-name')).toBeVisible();
 await checkRecord(page);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,previousName:pet.name,trayToggle:true,bodyHover:true,transparentAreaHidden:true,clickThenLeave:true,forwardedNativeMove:true,persistedAfterRestart:true,superReadingLoaded:true,visibleIconsLoaded:true,readingPositionStable:true,oldRecordPreserved:true,errors},null,2));
 console.log('PASS real Electron tray toggle, body/label hover, click then leave, forwarded move, restart and previous QA record');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await desktop?.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})});
