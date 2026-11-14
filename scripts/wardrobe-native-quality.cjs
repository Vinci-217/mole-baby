const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync,execFile}=require('node:child_process');
const {_electron,expect}=require('@playwright/test');
const {openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-quality');
const profile=path.join(out,'electron-qa-profile');fs.mkdirSync(out,{recursive:true});
const pointer=(...args)=>execFileSync('python3',[path.join(__dirname,'wardrobe-native-pointer.py'),...args.map(String)],{stdio:'pipe'});
const dragPointer=(...args)=>new Promise((resolve,reject)=>execFile('python3',[path.join(__dirname,'wardrobe-native-pointer.py'),...args.map(String)],error=>error?reject(error):resolve()));
(async()=>{
 const app=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu',`--user-data-dir=${profile}`],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});
 try{
  const page=await app.firstWindow(),errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));
  // Block the network before reopening the local production build. The
  // source protocol, atlases and local audio must work with no HTTP fallback.
  await app.context().route(/^https?:\/\//,route=>{remote.push(route.request().url());return route.abort('internetdisconnected')});
  await page.evaluate(()=>{
   if(localStorage.getItem('ramu-house-save-v1'))return;
   const now=Date.now();
   localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'服装检查专用拉姆',color:'#9c5fd4',createdAt:1793491200000,lastTick:now,growth:840,highestGrowth:840,naturalGrowth:840,growthLocked:true,evolution:'super',coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90},inventory:{biscuit:2},wardrobe:['wizard-cap','warm-scarf','magic-book'],wearing:'wizard-cap',sleeping:false,completedGames:0,lastRewardAt:0}));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,lively:false,presence:false,outings:false,reminders:false,roomWander:false}));
  });
  await page.reload();await page.evaluate(async()=>{await window.desktop.setPetMode(true);await window.desktop.setPetCanMove(false);});
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1'))),before=await save();
  const source=page.locator('.desktop-character .official-ram-clip');
  await expect(source).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect(page.locator('.desktop-character .official-hit-mask')).toHaveAttribute('data-loaded','true');
  let bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const state=await page.evaluate(()=>window.desktop.getState());
  await page.evaluate(({x,y})=>window.desktop.movePet(x,y),{x:460-bounds.x-state.petOffset.x*state.petScale,y:260-bounds.y-state.petOffset.y*state.petScale});
  const frame=await(await page.locator('.desktop-character iframe').elementHandle()).contentFrame();assert.ok(frame.url().startsWith('ram-original://'));
  await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus')?.settled)).toBe(true);
  const original=await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));
  const drags=[];
  for(const direction of [1,-1]){
   bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
   const point=await page.locator('.desktop-character .official-hit-mask').evaluate(canvas=>{
    const box=canvas.getBoundingClientRect(),rgba=canvas.getContext('2d').getImageData(0,0,100,108).data;
    for(let radius=0;radius<40;radius++)for(let y=78-radius;y<=78+radius;y++)for(let x=50-radius;x<=50+radius;x++)if(x>=0&&x<100&&y>=0&&y<108&&rgba[(y*100+x)*4+3]>100)return{x:box.x+(x+.5)/100*box.width,y:box.y+(y+.5)/108*box.height};
    throw Error('No painted source pixel to pick up');
   });
   const movement=dragPointer(bounds.x+point.x,bounds.y+point.y,direction);
   await expect.poll(()=>frame.evaluate(()=>{const state=player.ruffle().callExternalInterface('previewStatus');return state?.moving?state.direction:'stopped'}),{intervals:[30,50,75],timeout:5000}).toBe(direction>0?'right':'left');
   const moved=await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));
   await page.screenshot({path:path.join(out,`native-${direction>0?'right':'left'}.png`)});
   drags.push({direction:moved.direction,moving:moved.moving});
   assert.equal(moved.direction,direction>0?'right':'left');assert.equal(moved.moving,true);assert.deepEqual(moved.registration,original.registration);
   await movement;
   pointer('release');await expect.poll(async()=>Boolean((await page.evaluate(()=>window.desktop.getState())).dragPoint)).toBe(false);await page.waitForTimeout(300);
  }
  const outfitNode=await page.locator('.desktop-character iframe').elementHandle();
  const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  const panel=page.getByTestId('companion-panel');await panel.getByRole('tab',{name:'活动',exact:true}).click();await panel.getByRole('button',{name:'一起玩球',exact:true}).click();
  await expect(page.locator('.desktop-character .social-ball')).toBeVisible();
  await expect(page.locator('.desktop-character .ram-outfit-source')).toBeVisible();
  await expect(page.locator('.desktop-character>.ram-sprite')).not.toHaveAttribute('data-action','play',{timeout:12000});
  assert(await outfitNode.evaluate(node=>node.isConnected),'Offline play must restore the same loaded outfit');
  await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await page.reload();await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});
  const after=await save();for(const key of ['createdAt','name','color','growth','evolution','wearing','wardrobe','coins'])assert.deepEqual(after[key],before[key],key+' must survive dragging and reopening');
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);fs.writeFileSync(path.join(out,'native-checks.json'),JSON.stringify({platform:'Linux Electron with real X11 pointer events',profileReused:true,protocol:'ram-original',httpBlocked:true,remoteRequests:remote,drags,clothedFootballWithoutSourceReplacement:true,saveIdentityPreserved:true,errors},null,2));
  console.log('PASS offline Electron custom protocol, real native cursor drags in both directions, fixed registration and persistent save identity');
 }finally{try{pointer('release')}catch{}await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
