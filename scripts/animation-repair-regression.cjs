/** Run against a built preview; --native uses a real Electron process on DISPLAY.
 * All writes are confined to a named QA profile and a persisted QA fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('@playwright/test');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const {ramBodyPosition,openActions,adopt,enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-repair');
const native=process.argv.includes('--native'),mobile=process.argv.includes('--mobile'),quick=process.argv.includes('--quick'),base='http://127.0.0.1:5173/';
const {snapshot,pet:original}=require('./animation-repair-fixture.cjs')(out);
let expected=original;
const checks=[],errors=[],missing=[];
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});}
async function worn(page){
 await expect(page.locator('.desktop-character .ram-outfit-source')).toBeVisible({timeout:45000});
 try{await expect(page.locator('.desktop-character .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});}
 catch(error){
  console.log('Outfit diagnostics',await page.evaluate(()=>({visibility:document.visibilityState,clips:[...document.querySelectorAll('.desktop-character iframe')].map(n=>({src:n.src,...n.dataset}))})));
  for(const frame of page.frames().filter(f=>f.url().includes('runtime.html')))console.log('Engine diagnostics',await frame.evaluate(()=>({visibility:document.visibilityState,status:window.player?.ruffle().callExternalInterface('previewStatus'),error:window.originalRuntimeError})).catch(e=>String(e)));
  throw error;
 }
}
async function playMenu(page,tab){const actions=await openActions(page);await actions.getByRole('button',{name:'玩耍',exact:true}).click();await page.getByRole('tab',{name:tab,exact:true}).click();}
async function identity(page){
 const pet=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 for(const key of ['createdAt','name','color','growth','naturalGrowth','highestGrowth','evolution','wearing','coins','inventory'])assert.deepEqual(pet[key],expected[key],key);
 assert.deepEqual([...pet.wardrobe].sort(),[...expected.wardrobe].sort(),'owned costumes');
 const key='ramu-companion-memory-v1:'+original.createdAt,old=JSON.parse(snapshot[key]);
 const memory=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 for(const event of old.events)assert(memory.events.some(next=>next.id===event.id),'old memory survives');
}
async function exercise(page){
 observe(page);
 // Refresh elapsed time in this isolated copy; the fixture itself is immutable.
 if(native){
  // Use the real backup-import flow in Electron. Renderer init scripts are
  // not a reliable fixture bridge for an already running native window.
  if(await page.getByRole('button',{name:'给它起名',exact:true}).isVisible())await adopt(page,'蓝色','动画回归测试');
  await enterHome(page);await roomTab(page,'设置');
  const memory=JSON.parse(snapshot['ramu-companion-memory-v1:'+original.createdAt]);
  await page.locator('input[type=file]').setInputFiles({name:'qa-record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...original,lastTick:Date.now(),companionMemory:memory}))});
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).education?.lessons?.['element-fire'])).toBe(1);
  await toDesktop(page);
 }else await reloadWithStorage(page,{...snapshot,'ramu-house-save-v1':JSON.stringify({...original,lastTick:Date.now()})});
 const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 for(const key of ['createdAt','name','color','growth','evolution','wearing','coins','inventory'])assert.deepEqual(imported[key],original[key],key);
 assert(imported.naturalGrowth>=original.naturalGrowth&&imported.highestGrowth>=original.highestGrowth,'Backup restoration must not reduce previously earned growth');
 expected=imported;
 await worn(page);
 console.log('Loaded QA record',native?'Electron':'Chromium',await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return {growth:p.growth,evolution:p.evolution,education:p.education}}));
 await playMenu(page,'活动');await page.getByRole('button',{name:'摸摸拉姆',exact:true}).click();
 await expect(page.locator('[data-petting-adaptation=project]')).toBeVisible();
 await expect(page.locator('.desktop-character>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:8000});
 checks.push('clothed petting completes and unlocks interaction');
 const character=page.getByTestId('desktop-character');
 for(let i=0;i<5;i++)await character.click({position:await ramBodyPosition(character)});
 await expect(character.locator('.ram-sprite').first()).toHaveAttribute('data-action','dizzy');
 await expect(character.locator('.ram-sprite').first()).toHaveAttribute('data-action','idle',{timeout:12000});await worn(page);
 checks.push('rapid clothed petting retains the original dizziness reaction and restores the costume');
 await playMenu(page,'道具');await page.getByRole('button',{name:'播放足球',exact:true}).click();
 const football=page.locator('.desktop-character .ram-original-tool canvas[data-sheet=uploaded]');await expect(football).toHaveAttribute('data-loaded','true',{timeout:45000});
 await expect(football).toHaveAttribute('data-source-form','classic');
 await expect(page.locator('.desktop-character .ram-outfit-source')).toBeHidden();
 const first=await football.getAttribute('data-source-frame');await expect.poll(()=>football.getAttribute('data-source-frame')).not.toBe(first);
 await expect(page.locator('.desktop-character>.ram-sprite')).toHaveAttribute('data-growth-form','super');
 await expect(page.locator('.desktop-character>.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:12000});
 await page.screenshot({path:path.join(out,(native?'electron':'browser')+'-football.png')});
 await worn(page);await identity(page);checks.push('football temporarily plays the complete classic source, restores clothing and preserves actual growth');
 await playMenu(page,'魔法');
 const menu=page.locator('.official-clip-grid');assert.equal(await menu.getByRole('button').count(),19);
 const names=await menu.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
 assert(names.includes('播放变盒子'));assert(!names.some(n=>/星辰|先知|时空|变身\d|碎片·/.test(n)));
 assert(await menu.locator('img').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0)));
 await page.screenshot({path:path.join(out,(native?'electron':'browser')+'-magic-menu.png')});
 checks.push('magic contains only eighteen original elemental skills and the box, with valid icons');
 if(mobile){const rect=await menu.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390,'mobile magic menu fits the screen');checks.push('mobile-width magic buttons stay inside the viewport');}
 const skills=native||mobile||quick?['fire-1','water-1','wood-1']:Object.keys(require('../public/assets/original/element-skills/clips.json'));
 const titles={fire:['小火苗','旺盛火焰','爆烈燃烧','火焰漩涡','流星火','星火涅槃'],water:['小水滴','水花碎片','水上蔓延','似水奔腾','水龙','水上狂舞'],wood:['小树苗','树根缠绕','通天藤蔓','飞花炫舞','野蛮生长','上天入地']};
 for(const id of skills){
  if(!await page.getByRole('tab',{name:'魔法',exact:true}).isVisible())await playMenu(page,'魔法');
  const [type,level]=id.split('-');await page.getByRole('button',{name:'播放'+titles[type][Number(level)-1],exact:true}).click();
  const performance=page.locator('.desktop-character .magic-box-performance');await expect(performance).toHaveAttribute('data-ready','true',{timeout:45000});
  const clip=page.locator(`.desktop-character [data-element-skill="${id}"]`);await expect(clip).toBeAttached();
  await expect.poll(()=>clip.getAttribute('data-source-frame')).not.toBeNull();
  if(id==='fire-1'){
   // A pointer-up after a blocked pointer-down must not replace the spell
   // with petting. Exercise the real control while its action is busy.
   await page.getByTestId('desktop-character').click({position:{x:50,y:70},force:true});
   await expect(performance).toHaveAttribute('data-ready','true');
  }
  await expect(performance).toHaveAttribute('data-magic-subject','box',{timeout:8000});
  await expect.poll(()=>clip.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i]>100&&++ink>20)return true;return false})).toBe(true);
  const frame=Number(await clip.getAttribute('data-source-frame'));await expect.poll(async()=>Number(await clip.getAttribute('data-source-frame'))).toBeGreaterThan(frame);
  await expect(performance).toHaveCount(0,{timeout:25000});await worn(page);await identity(page);
  checks.push(id+' original atlas advances, completes, restores growth/outfit and memories');console.log('PASS',native?'Electron':'Chromium',id);
 }
 await playMenu(page,'魔法');await page.getByRole('button',{name:'播放变盒子',exact:true}).click();await expect(page.locator('.desktop-character .magic-box-performance')).toHaveAttribute('data-magic-subject','box',{timeout:8000});await worn(page);
 await playMenu(page,'魔法');await page.getByRole('button',{name:'播放小水滴',exact:true}).click();await expect(page.locator('.desktop-character .magic-box-performance')).toHaveAttribute('data-ready','true',{timeout:45000});
 await page.keyboard.press('Escape');await expect(page.locator('.desktop-character .magic-box-performance')).toHaveCount(0);await worn(page);checks.push('manual Escape stop restores clothing and cancels the old magic timeline');
 await identity(page);await page.reload();await worn(page);await identity(page);checks.push('box and ordinary reload retain growth, colour, clothing, inventory and the QA record');
}
async function wardrobeMatrix(browser){
 const p=await browser.newPage({viewport:{width:1000,height:760}});observe(p);
 for(const outfit of ['warm-scarf','magic-book','party-cap']){
  await p.goto(base+'?preview=wardrobe&form=super&outfit='+outfit);
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire']){
   await p.getByRole('combobox',{name:'预览形态'}).selectOption(form);
   const clip=p.locator('.wardrobe-mirror .official-ram-clip');await expect(clip).toHaveAttribute('data-loaded','true',{timeout:45000});
   const iframe=p.locator('.wardrobe-mirror iframe'),src=await iframe.getAttribute('src'),source=await clip.getAttribute('data-source');
   const box=await p.locator('.wardrobe-mirror').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.65);await p.mouse.down();
   await p.mouse.move(box.x+box.width*.72,box.y+box.height*.55,{steps:12});
   await expect(p.locator('[data-drag-adaptation=project]')).toBeVisible();assert.equal(await iframe.getAttribute('src'),src);assert.equal(await clip.getAttribute('data-source'),source);
   await p.mouse.up();await expect(clip).toHaveAttribute('data-loaded','true');assert.equal(await iframe.getAttribute('src'),src);
   checks.push(outfit+':'+form+' drag keeps the same original player and costume');
  }
 }
 await p.close();
}
(async()=>{
 let browser,desktop;
 try{
  let p;
  if(native){desktop=await _electron.launch({args:[root,'--no-sandbox','--user-data-dir='+path.join(out,'electron-profile')],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});p=await desktop.firstWindow();await p.waitForLoadState('domcontentloaded');}
  else{browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1100,height:850}});await p.goto(base);}
  await exercise(p);if(browser&&!mobile&&!quick)await wardrobeMatrix(browser);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,(native?'electron':mobile?'mobile':quick?'browser-quick':'browser')+'-checks.json'),JSON.stringify({checks,errors,missing,profileIsolated:true},null,2));console.log('PASS',checks.length,'checks');
 }finally{await desktop?.close();await browser?.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
