/** Shipping renderer + a named isolated QA record. Never opens a player profile. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('@playwright/test');
const {openActions,ramBodyPosition,enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/costume-state-review'),base='http://127.0.0.1:5173/';
const sourcesOnly=process.argv.includes('--sources-only'),matrixOnly=process.argv.includes('--matrix-only'),applicationOnly=process.argv.includes('--application-only');
const native=process.argv.includes('--native'),mobile=process.argv.includes('--mobile'),quick=process.argv.includes('--quick');
const manifest=require('../public/assets/original/official/manifest.json');
const legacy=[...fs.readFileSync(path.join(root,'src/wardrobe.ts'),'utf8').matchAll(/^  \{id:'([^']+)',name:'([^']+)',sourceId:'([^']+)'/gm)].map(m=>({id:m[1],name:m[2],sourceId:m[3]}));
const outfits=[...legacy,...manifest.outfits],checks=[],errors=[],missing=[];
fs.mkdirSync(out,{recursive:true});
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.status()+' '+r.url())});}
async function ready(scope){await expect(scope.locator('.ram-outfit-source .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});await expect(scope.locator('.ram-outfit-source .official-hit-mask')).toHaveAttribute('data-loaded','true');}
async function select(page,outfit,action='idle',form='super',extra={}){await page.evaluate(value=>animationSizeReview.select(value),{outfit,action,form,...extra});}
async function catalogue(browser){
 const page=await browser.newPage({viewport:{width:1000,height:800}});observe(page);await page.goto(base+'?preview=size-review&form=super&outfit=warm-scarf');
 const subject=page.locator('[data-review-subject]');
 if(!matrixOnly)for(const [i,o]of (quick?outfits.filter(o=>['1200052','1200026','1200020','1200113','1200005','1200025'].includes(o.sourceId)):outfits).entries()){
  await select(page,o.id);await ready(subject);
  const iframe=await subject.locator('.ram-outfit-source iframe').elementHandle(),src=await iframe.getAttribute('src');
  const form=await subject.locator('>.ram-sprite').getAttribute('data-form');
  const ink=await subject.locator('.official-hit-mask').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,100,108).data;let n=0;for(let a=3;a<d.length;a+=4)if(d[a]>32)n++;return n;});assert(ink>40,o.id+' must paint real source pixels');
  for(const action of ['dizzy','pet','play','sleep','focus','eat-bear-biscuit','uploaded-180023']){
   await select(page,o.id,action);await page.waitForTimeout(100);
   assert(await iframe.evaluate(n=>n.isConnected),o.id+':'+action+' source retained');assert.equal(await iframe.getAttribute('src'),src);
   assert.equal(await subject.locator('>.ram-sprite').getAttribute('data-form'),form);await ready(subject);
   const transform=await subject.locator('.ram-outfit-source .ram-pose-layer').evaluate(n=>getComputedStyle(n).transform);assert(!/NaN|Infinity/.test(transform));
  }
  checks.push({outfit:o.id,source:o.sourceId,form,sourcePixels:ink,allSevenGesturesKeepSource:true});
  fs.writeFileSync(path.join(out,'catalogue-progress.json'),JSON.stringify(checks,null,2));
  if((i+1)%12===0)console.log('Costume sources checked',i+1);
 }
 if(sourcesOnly){await page.close();return;}
 const forms=['junior','middle','senior','classic','super','water','wood','fire'];
 for(const o of ['warm-scarf','wizard-cap','magic-book','original-1200113'])for(const form of forms){
  await select(page,o,'idle',form);await ready(subject);const iframe=await subject.locator('.ram-outfit-source iframe').elementHandle();
  const registration=await iframe.getAttribute('data-registration'),src=await iframe.getAttribute('src');
  for(const action of ['dizzy','pet','play','eat-bear-biscuit']){
   await select(page,o,action,form);await expect(subject).toHaveAttribute('data-finished','true',{timeout:10000});
   assert(await iframe.evaluate(n=>n.isConnected));assert.equal(await iframe.getAttribute('src'),src);assert.equal(await iframe.getAttribute('data-registration'),registration);
  }
  // The previous football's end must not end a subsequent persistent sleep.
  await select(page,o,'play',form);await page.waitForTimeout(100);await select(page,o,'sleep',form);await page.waitForTimeout(4300);await expect(subject).toHaveAttribute('data-finished','false');
  // Directions must use source SWF poses rather than an unrelated bare form.
  await select(page,o,'drag',form);const frame=await iframe.contentFrame();
  for(const [direction,view]of [['right',.85],['left',-.85]]){
   await subject.locator('>.ram-sprite').evaluate((sprite,view)=>{sprite.style.setProperty('--drag-view',String(view));sprite.style.setProperty('--drag-horizontal-speed','500');sprite.dispatchEvent(new Event('ram-drag-motion'));},view);
   await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus')?.direction)).toBe(direction);
  }
  checks.push({outfit:o,form,completeDizzyPetFootballCare:true,noStaleCompletion:true,leftAndRightNative:true,registrationStable:true});console.log('Completed interaction matrix',o,form);
 }
 // Actual original transformations restore the same dressed source.
 for(const action of ['spell','element-fire-1','element-water-1','element-wood-1']){
  await select(page,'warm-scarf','idle');await ready(subject);const iframe=await subject.locator('.ram-outfit-source iframe').elementHandle();
  await select(page,'warm-scarf',action);await expect(subject.locator('.magic-box-performance')).toHaveAttribute('data-ready','true',{timeout:45000});await expect(subject.locator('.magic-box-performance')).toHaveAttribute('data-magic-subject','box',{timeout:8000});
  await expect(subject).toHaveAttribute('data-finished','true',{timeout:25000});await expect(subject.locator('.ram-outfit-source')).toBeVisible();assert(await iframe.evaluate(n=>n.isConnected));
  checks.push({action,originalTransformation:true,clothingRestored:true});
 }
 await page.close();
}
async function application(page){
 observe(page);
 const fixture=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
 // Reuse the persisted QA identity. This initializes only the new QA profile.
 await page.evaluate(snapshot=>{if(localStorage.getItem('ramu-house-save-v1'))return;for(const [key,value] of Object.entries(snapshot))localStorage.setItem(key,value);const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.lastTick=Date.now();localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));},fixture.snapshot);
 await page.reload();const character=page.getByTestId('desktop-character');await ready(character);
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1'))),before=await save();
 const same=async()=>{const after=await save();for(const key of ['createdAt','name','color','growth','naturalGrowth','highestGrowth','evolution','wearing','inventory','coins'])assert.deepEqual(after[key],before[key],key);assert.deepEqual([...after.wardrobe].sort(),[...before.wardrobe].sort(),'all owned clothes survive');};
 const iframe=await character.locator('.ram-outfit-source iframe').elementHandle(),form=await character.locator('>.ram-sprite').getAttribute('data-form');
 for(let i=0;i<5;i++)await character.click({position:await ramBodyPosition(character)});
 await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','dizzy');assert.equal(await character.locator('>.ram-sprite').getAttribute('data-form'),form);assert(await iframe.evaluate(n=>n.isConnected));await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:7000});await same();
 checks.push({surface:native?'Electron':'browser',rapidTouchDizzy:true,noGrowthOrClothingChange:true});
 const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();await page.getByRole('tab',{name:'活动',exact:true}).click();await page.getByRole('button',{name:'一起玩球',exact:true}).click();await expect(character.locator('.social-ball')).toBeVisible();await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:9000});assert(await iframe.evaluate(n=>n.isConnected));await same();
 await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
 if(!native){
  const box=await character.boundingBox(),point=await ramBodyPosition(character);await page.mouse.move(box.x+point.x,box.y+point.y);await page.mouse.down();
  for(const x of [80,-80,80,-80,80]){await page.mouse.move(box.x+point.x+x,box.y+point.y,{steps:5});await page.waitForTimeout(35);}
  await page.mouse.up();await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','dizzy');assert.equal(await character.locator('>.ram-sprite').getAttribute('data-form'),form);await expect(character.locator('>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:7000});await same();
  checks.push({surface:'desktop pointer',physicalDragShake:true,retainsCostume:true});
 }
 await enterHome(page);await ready(page.locator('.scene-character'));await roomTab(page,'衣橱');const cap=page.getByRole('button',{name:'试戴紫色魔法帽',exact:true});while(!await cap.count()&&await page.getByRole('button',{name:'衣橱上一页',exact:true}).isEnabled())await page.getByRole('button',{name:'衣橱上一页',exact:true}).click();await cap.click();await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});await page.getByRole('button',{name:'预览玩球动作',exact:true}).click();await expect(page.locator('.wardrobe-mirror .social-ball')).toBeVisible();
 await toDesktop(page);await ready(character);await same();await page.reload();await ready(character);await same();
 checks.push({surface:native?'Electron':'browser',desktopRoomWardrobeReload:true,previousQaSavePreserved:true});
 await page.screenshot({path:path.join(out,native?'electron.png':mobile?'mobile.png':'desktop.png')});
}
(async()=>{let browser,desktop;try{
 if(native){const executable=process.env.MOLE_QA_EXECUTABLE;desktop=await _electron.launch({...(executable?{executablePath:executable}:{}),args:[...(executable?[]:[root,'--no-sandbox']),'--user-data-dir='+path.join(out,'electron-qa-profile')],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});const page=await desktop.firstWindow();await page.waitForLoadState('domcontentloaded');await application(page);}
 else{browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disk-cache-size=10485760']});if(!mobile&&!applicationOnly)await catalogue(browser);if(!sourcesOnly&&!matrixOnly){const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1100,height:850}});await p.goto(base);await application(p);}}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);const file=path.join(out,native?'electron-checks.json':mobile?'mobile-checks.json':sourcesOnly?'sources-checks.json':matrixOnly?'matrix-checks.json':applicationOnly?'app-checks.json':quick?'quick-checks.json':'browser-checks.json');fs.writeFileSync(file,JSON.stringify({checked:checks.length,checks,errors,missing,qaProfileOnly:true},null,2));console.log('PASS',checks.length,'checks');
 }catch(error){fs.writeFileSync(path.join(out,'last-failure.json'),JSON.stringify({checks,errors,missing,error:String(error)},null,2));throw error;}finally{await desktop?.close();await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
