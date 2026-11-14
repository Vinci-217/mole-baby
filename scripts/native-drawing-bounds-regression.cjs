/** Real Electron window: a complete original doodle may exceed the pet body. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron,expect}=require('@playwright/test');
const {adopt,enterHome,toDesktop,roomTab,openActions}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/native-drawing-review');
fs.mkdirSync(out,{recursive:true});
async function main(){
 const app=await _electron.launch({args:[root,'--no-sandbox','--user-data-dir='+path.join(out,'qa-profile')],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});
 try{
  const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
  if(await page.getByRole('button',{name:'给它起名',exact:true}).isVisible())await adopt(page,'蓝色','动画回归测试');
  await enterHome(page);await roomTab(page,'设置');
  const {pet,snapshot}=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
  const memory=JSON.parse(snapshot['ramu-companion-memory-v1:'+pet.createdAt]);
  // Retain the QA pet's identity, source growth, ownership and memories. Only
  // put its outfit away to inspect the previously clipped uncostumed source.
  await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles({name:'qa-drawing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...pet,wearing:undefined,lastTick:Date.now(),companionMemory:memory}))});
  await toDesktop(page);
  await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);await window.desktop.movePet(-700,-100)});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const windowBefore=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const sizeBefore=await page.getByTestId('desktop-character').boundingBox();
  const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByRole('tab',{name:'道具',exact:true}).click();await page.getByRole('button',{name:'播放涂鸦一',exact:true}).click();
  const canvas=page.locator('.desktop-character canvas[data-sheet=uploaded]');
  await expect(canvas).toHaveAttribute('data-loaded','true',{timeout:45000});
  await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).effectExpanded)).toBe(true);
  const evidence=await canvas.evaluate(c=>{const r=c.getBoundingClientRect(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i]>100)ink++;return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],ink}});
  assert(evidence.left>=-1&&evidence.top>=-1&&evidence.right<=evidence.viewport[0]+1&&evidence.bottom<=evidence.viewport[1]+1,'The whole drawing canvas must fit the expanded native surface: '+JSON.stringify(evidence));
  assert(evidence.ink>50);
  const sizeDuring=await page.getByTestId('desktop-character').boundingBox();
  assert.equal(sizeDuring.width,sizeBefore.width);assert.equal(sizeDuring.height,sizeBefore.height);
  assert.equal(await page.locator('.desktop-character iframe').count(),0,'The existing raster fallback must not load a new source engine');
  await page.screenshot({path:path.join(out,'complete-drawing.png')});
  await page.keyboard.press('Escape');await expect(canvas).toHaveCount(0);
  await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).effectExpanded)).toBe(false);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const key of ['createdAt','color','growth','evolution','wearing','wardrobe','inventory','naturalGrowth','highestGrowth'])assert.deepEqual(after[key],before[key],key);
  const windowAfter=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  assert.deepEqual(windowAfter,windowBefore,'Finite artwork must restore the same native pet window');
  const report={checkedAt:new Date().toISOString(),platform:'Electron on Linux',evidence,bodySizeUnchanged:true,wholeCanvasWithinNativeWindow:true,windowRestored:true,identityAndGrowthRetained:true};
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await app.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
