const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-interactions'),profile=path.resolve(process.env.SIZE_QA_PROFILE||path.join(out,'electron-profile'));
(async()=>{
 const desktop=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});
 try{
  const page=await desktop.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const snapshot=JSON.parse(fs.readFileSync(path.join(out,'previous-record-before.json'),'utf8'));
  await page.evaluate(snapshot=>{
   if(localStorage.getItem('ramu-house-save-v1'))return;
   for(const [key,value] of Object.entries(snapshot))localStorage.setItem(key,value);
   const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(pet,{lastTick:Date.now(),growth:180,growthLocked:true,wearing:'original-1200041',sleeping:false});delete pet.evolution;delete pet.activity;delete pet.outing;
   pet.wardrobe=[...new Set([...pet.wardrobe,'original-1200041'])];pet.stats={hunger:85,thirst:85,cleanliness:85,happiness:85,health:100,energy:85};
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,roomWander:false}));
  },snapshot);
  await page.reload();await page.evaluate(async()=>{await window.desktop.setPetMode(true);await window.desktop.setPetCanMove(false)});await expect(page.getByTestId('desktop-character')).toBeVisible();
  const initialBounds=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds()),initialState=await page.evaluate(()=>window.desktop.getState());
  await page.evaluate(({dx,dy})=>window.desktop.movePet(dx,dy),{dx:480-initialBounds.x-initialState.petOffset.x*initialState.petScale,dy:300-initialBounds.y-initialState.petOffset.y*initialState.petScale});
  await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const frame=await(await page.locator('.desktop-character iframe').elementHandle()).contentFrame();assert(frame.url().startsWith('ram-original://'));
  await expect(page.locator('.desktop-character .official-hit-mask')).toHaveAttribute('data-loaded','true');
  const bounds=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const anchor=async()=>{const b=await bounds(),s=await page.evaluate(()=>window.desktop.getState());return{x:b.x+s.petOffset.x*s.petScale,y:b.y+s.petOffset.y*s.petScale}};
  const before=await anchor(),expanded=await bounds();assert(expanded.width>=360&&expanded.height>=420,'large outfit has its complete native drawing surface');
  await page.evaluate(()=>window.desktop.setPetArtworkBounds(null));assert.deepEqual(await anchor(),before);assert.equal((await bounds()).width,160);
  await page.evaluate(()=>window.desktop.setPetArtworkBounds({x:-100,y:-80,width:360,height:420}));assert.deepEqual(await anchor(),before);
  const beforePetting=await page.locator('.desktop-character iframe').getAttribute('src');
  await page.getByTestId('desktop-character').press('Enter');await expect(page.locator('.desktop-character [data-petting-adaptation]')).toHaveAttribute('data-petting-adaptation','project');
  await expect.poll(()=>page.locator('.desktop-character>.ram-sprite').evaluate(n=>parseFloat(n.style.getPropertyValue('--social-opacity'))||0)).toBeGreaterThan(.5);
  assert.equal(await page.locator('.desktop-character iframe').getAttribute('src'),beforePetting);
  await page.screenshot({path:path.join(out,'electron-outfit.png')});
  await expect(page.locator('.desktop-character>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:8000});
  await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const restored=await(await page.locator('.desktop-character iframe').elementHandle()).contentFrame();
  const source=await restored.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));assert.equal(source.form,'level2');assert(source.registration);assert.deepEqual(errors,[]);
  // Exercise a large original prop through the actual desktop menu, then
  // verify its wider native drawing surface restores the same screen anchor.
  await page.getByTestId('desktop-character').hover();await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByRole('tab',{name:'道具',exact:true}).click();const propAnchor=await anchor();
  await page.getByRole('button',{name:'播放涂鸦一',exact:true}).click();
  const prop=page.locator('.desktop-character .official-ram-clip');
  await expect(prop).toHaveAttribute('data-loaded','true',{timeout:45000});
  const propWindow=await bounds(),propSize=await page.locator('.desktop-character iframe').evaluate(n=>({width:parseFloat(n.style.width),height:parseFloat(n.style.height)}));
  assert(propSize.width>=1000&&propSize.height>=1000,'native care has a fixed wider drawing surface');
  assert.deepEqual(await anchor(),propAnchor,'native expansion preserves the logical screen anchor');
  assert(propWindow.width>expanded.width&&propWindow.height>expanded.height,'actual Electron window expands for original source travel');
  await page.keyboard.press('Escape');
  await expect(prop).toHaveAttribute('data-source','resource/petcloth/swf2/1200041.swf',{timeout:5000});
  await expect(prop).toHaveAttribute('data-loaded','true',{timeout:45000});assert.deepEqual(await anchor(),propAnchor,'restoring the outfit preserves the anchor');
  const restoredBounds=await bounds();assert(restoredBounds.width<=expanded.width+1&&restoredBounds.height<=expanded.height+1,'restore the original costume drawing surface');
  fs.writeFileSync(path.join(out,'electron-checks.json'),JSON.stringify({passed:true,protocol:frame.url().split('?')[0],expanded,anchor:before,form:source.form,petting:true,nativeCare:{propWindow,propSize,restoredBounds,stableAnchor:true},errors},null,2));
  console.log('PASS actual Electron custom-protocol outfit, enlarged transparent window, unchanged screen anchor, real petting and saved prior identity');
 }finally{await desktop.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
