const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const {openActions,enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const {verifyRendererPolicy}=require('./renderer-policy-checks.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/embedded-originals-review');
const manifest=require('../public/assets/original/official/manifest.json');
const origin='http://127.0.0.1:5173';fs.mkdirSync(out,{recursive:true});
const checks={errors:[],media:[],clothes:[],mobile:[]};let browser;
function observe(page){page.on('pageerror',error=>checks.errors.push(error.message));}
async function loaded(page,count=1){await expect(page.locator('.official-ram-clip[data-loaded=true]')).toHaveCount(count,{timeout:30000});await expect(page.locator('.official-hit-mask[data-loaded=true]')).toHaveCount(count,{timeout:15000});}
function clockScript(){
 const native=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,now=performance.now.bind(performance);let key=0;
 window.capturePending=new Map();window.captureFrozen=false;window.captureNow=0;
 window.requestAnimationFrame=fn=>window.captureFrozen?(window.capturePending.set(--key,fn),key):native.call(window,t=>window.captureFrozen?window.capturePending.set(--key,fn):fn(t));
 window.cancelAnimationFrame=id=>id<0?window.capturePending.delete(id):cancel.call(window,id);
 window.freezeCapture=()=>{if(!window.captureFrozen){window.captureNow=now();window.captureFrozen=true;Object.defineProperty(performance,'now',{value:()=>window.captureNow,configurable:true});}};
 window.advanceCapture=delta=>{window.captureNow+=delta;const queue=[...window.capturePending.values()];window.capturePending.clear();queue.forEach(fn=>fn(window.captureNow));};
}
async function freeze(page){for(const frame of page.frames())await frame.evaluate(()=>window.freezeCapture());await page.waitForTimeout(80);}
async function frames(page,locator,name,count,start=0){
 const dir=path.join(out,name+'-frames');fs.mkdirSync(dir,{recursive:true});
 for(let i=0;i<count;i++){
  for(const frame of page.frames())await frame.evaluate(()=>window.advanceCapture(1000/12));
  await page.waitForTimeout(5);
  await locator.screenshot({path:path.join(dir,String(start+i).padStart(4,'0')+'.png'),animations:'allow'});
 }
}
function encode(name,count){
 const dir=path.join(out,name+'-frames'),file=path.join(out,name+'.gif');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','12','-i',path.join(dir,'%04d.png'),'-filter_complex_threads','1','-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-threads','2','-loop','0',file],{timeout:60000});
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,duration','-of','json',file]));
 assert.equal(Number(info.streams[0].nb_read_frames),count);assert(fs.readFileSync(file).includes(Buffer.from('NETSCAPE2.0')));
 checks.media.push({file,frames:count,...info.streams[0]});fs.rmSync(dir,{recursive:true,force:true});
}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});
 const page=await browser.newPage({viewport:{width:1000,height:750},deviceScaleFactor:3});observe(page);await page.addInitScript(clockScript);
 await page.addInitScript(()=>{
  if(localStorage.getItem('ramu-house-save-v1'))return;
  const now=Date.now(),id=now-100000;
  localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小紫',color:'#784fb8',createdAt:id,lastTick:now,growth:60,highestGrowth:840,growthLocked:true,coins:1000,wardrobe:['party-cap','wizard-cap'],wearing:'party-cap',stats:{hunger:100,thirst:100,happiness:100,cleanliness:100,health:100,energy:100},inventory:{berry:3},sleeping:false,completedGames:0,lastRewardAt:0}));
  localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,gameSound:false,soundVolume:.2,lively:false,presence:false,outings:false,roomWander:false,reminders:false}));
  localStorage.setItem('ramu-companion-memory-v1:'+id,JSON.stringify({version:1,petId:String(id),personality:'慢慢陪伴',facts:[{id:'old-boundary',kind:'boundary',value:'保留旧约定',at:id}],events:[{id:'old-memory',kind:'play',detail:'保留这段旧回忆',at:id}],messages:[]}));
 });
 await page.goto(origin);await page.getByTestId('desktop-character').waitFor();await verifyRendererPolicy(page);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 const care=manifest.clips.find(row=>row.path==='resource/pet/swf/pet2/180013.swf');
 async function playFromFootball(){
  await openActions(page);await page.getByRole('button',{name:'玩耍',exact:true}).click();
  const menu=page.locator('.official-clip-menu');await menu.locator('summary').click();await menu.getByRole('button',{name:'道具互动',exact:true}).click();await menu.getByRole('textbox',{name:'搜索原版动作'}).fill('180013');
  await menu.getByRole('button',{name:'播放原版'+care.name,exact:true}).click();await loaded(page);
 }
 await playFromFootball();
 const mask=await page.locator('.official-hit-mask').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,100,108).data;return {corner:data[3],painted:[...data].filter((value,index)=>index%4===3&&value>32).length}});
 assert.equal(mask.corner,0);assert(mask.painted>20);checks.pixelHitMask=mask;
 await openActions(page);await page.getByRole('button',{name:'玩耍',exact:true}).click();await page.locator('.official-clip-menu summary').click();await page.getByRole('button',{name:'结束原版动作',exact:true}).click();await expect(page.locator('.ram-official')).toHaveCount(0);
 await enterHome(page);await roomTab(page,'衣橱');await page.getByRole('button',{name:'衣橱下一页',exact:true}).click();
 const cap=manifest.outfits.find(row=>row.sourceId==='1200001');
 await page.getByRole('button',{name:'试戴'+cap.name,exact:true}).click();await loaded(page);
 await page.locator('.wardrobe-choice button').click();await expect(page.locator('.wardrobe-choice button')).toHaveText('给拉姆戴上');await page.locator('.wardrobe-choice button').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).wearing)).toBe(cap.id);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).coins)).toBe(940);
 await page.locator('.game-overlay').getByRole('button',{name:'关闭面板',exact:true}).click();await loaded(page);
 await roomTab(page,'设置');
 const playerFrame=()=>page.frames().find(frame=>frame.url().includes('/official/runtime.html'));
 await expect.poll(()=>playerFrame().evaluate(()=>player.ruffle().volume)).toBe(0);
 const oldURL=playerFrame().url();await page.getByRole('switch',{name:'游戏音效',exact:true}).click();await expect.poll(()=>playerFrame().evaluate(()=>player.ruffle().volume)).toBeCloseTo(.2,5);
 await page.getByRole('slider',{name:'拉姆音量',exact:true}).press('End');await expect.poll(()=>playerFrame().evaluate(()=>player.ruffle().volume)).toBe(1);
 await page.getByRole('switch',{name:'游戏音效',exact:true}).click();await expect.poll(()=>playerFrame().evaluate(()=>player.ruffle().volume)).toBe(0);assert.equal(playerFrame().url(),oldURL);checks.soundPreferences=true;
 await page.reload();await loaded(page);
 const restored=await page.evaluate(()=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return {pet,memory:JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+pet.createdAt))}});
 for(const key of ['name','color','createdAt'])assert.equal(restored.pet[key],before[key]);assert.equal(restored.pet.wearing,cap.id);assert(restored.pet.wardrobe.includes('wizard-cap'));assert(restored.pet.wardrobe.includes(cap.id));assert.equal(restored.pet.inventory.berry,3);assert(restored.memory.events.some(row=>row.detail==='保留这段旧回忆'));assert(restored.memory.facts.some(row=>row.value==='保留旧约定'));checks.savePreserved=true;
 await enterHome(page);await roomTab(page,'衣橱');await page.getByRole('button',{name:'收好装扮',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).wearing)).toBe(undefined);
 await page.locator('.game-overlay').getByRole('button',{name:'关闭面板',exact:true}).click();await toDesktop(page);
 for(const width of [393,320]){await page.setViewportSize({width,height:760});await openActions(page);await page.getByRole('button',{name:'玩耍',exact:true}).click();await page.locator('.official-clip-menu summary').click();const sizes=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));assert(sizes.body<=width);checks.mobile.push(sizes);await page.getByRole('button',{name:'关闭小窗',exact:true}).click();}
 await page.setViewportSize({width:1000,height:750});await playFromFootball();await page.mouse.move(950,700);await page.waitForTimeout(300);await freeze(page);await frames(page,page.getByTestId('desktop-character'),'desktop-original-action',60);await expect(page.locator('.ram-official')).toHaveCount(0);checks.sourceEndRestoresPet=true;checks.startsFromFootballMenu=true;await page.close();

 const gallery=await browser.newPage({viewport:{width:960,height:850}});observe(gallery);await gallery.addInitScript(clockScript);await gallery.addInitScript(()=>localStorage.setItem('ramu-house-save-v1','preserve-preview-sentinel'));
 await gallery.goto(origin+'/?preview=official');await loaded(gallery,4);const main=gallery.locator('.official-animation-preview');
 checks.clothes.push(...await gallery.locator('figcaption').allTextContents());await gallery.screenshot({path:path.join(out,'new-outfits.png')});await freeze(gallery);await frames(gallery,main,'new-outfits',96);
 await gallery.getByRole('button',{name:'下一组',exact:true}).click({force:true});await loaded(gallery,4);checks.clothes.push(...await gallery.locator('figcaption').allTextContents());await freeze(gallery);await frames(gallery,main,'new-outfits',96,96);
 await gallery.getByRole('button',{name:'道具互动',exact:true}).click({force:true});await loaded(gallery,4);await freeze(gallery);await frames(gallery,main,'original-care',96);
 assert.equal(await gallery.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'preserve-preview-sentinel');checks.previewStorageUntouched=true;await gallery.close();await browser.close();browser=null;
 encode('new-outfits',192);encode('original-care',96);encode('desktop-original-action',60);
 assert.deepEqual(checks.errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2)+'\n');console.log('PASS actual app play/stop, purchase/equip/reload, colour and memories, audio, masks, phone layout; three GIFs recorded.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
