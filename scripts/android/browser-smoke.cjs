'use strict';
const{chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:5239',output=path.join(root,'artifacts/android');let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),...(process.argv.includes('--dev')?[]:['preview']),'--host','127.0.0.1','--port','5239','--strictPort'],{cwd:root,stdio:'ignore'});
function mockNative(){
 const storage=JSON.parse(sessionStorage.getItem('android-native-mirror')||'{}'),calls=[];
 const state={petMode:false,alwaysOnTop:true,wandering:true,companionPanel:false,panelSide:'right',edgeHiding:true,edgeSide:null,edgePose:'visible',windowVisible:true};
 const permissions={overlay:false,notifications:true,exactAlarms:true,installPackages:false,batteryOptimized:true,touchThrough:false,autoDownloadWifi:false,api:35,version:'0.32.0-preview.1',channel:'android-preview'};
 const emit=(event,value)=>window.__moleAndroidEvent?.(event,value);
 window.__androidTest={storage,calls,state,permissions,emit,failWrites:false};
 window.MoleAndroid={bootstrap:()=>JSON.stringify({storage,state,permissions}),persist:(key,value)=>{if(window.__androidTest.failWrites)return false;if(value===null)delete storage[key];else storage[key]=value;sessionStorage.setItem('android-native-mirror',JSON.stringify(storage));return true;},invoke:(id,method,raw)=>{
  const a=JSON.parse(raw);calls.push({method,args:a});let value=true,error=null;
  if(method==='getState')value={...state};
  if(method==='permissions')value={...permissions};
  if(method==='permission'){if(a.kind==='overlay')permissions.overlay=true;emit('permissions',permissions);}
  if(method==='updatesState')value={status:'idle',currentVersion:permissions.version,version:null,percent:0,enabled:true,automaticInstall:false,checkedAt:null,message:'安卓预览渠道待发布'};
  if(method==='updatesWifi'){permissions.autoDownloadWifi=a.enabled;value={...permissions};emit('permissions',permissions);}
  if(method==='setPetMode'){if(a.enabled&&!permissions.overlay)error='请先允许拉姆显示在其他应用上层，再点击悬浮陪伴。';else{state.petMode=a.enabled;value=a.enabled;emit('state',state);}}
  if(method==='setCompanionPanel'){state.companionPanel=a.open;state.panelGeometry=a.open?{petX:90,petY:0,panelX:8,panelY:230,panelWidth:324,panelHeight:362,scale:1}:null;value={...state};emit('state',state);}
  if(method==='setPetAppearance'||method==='setPetEffectBounds'||method==='revealPet')value={...state};
  if(method==='wasNotified')value=false;
  setTimeout(()=>window.__moleAndroidReceive?.(id,value,error),0);
 }};
}
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function artwork(page){await expect.poll(()=>page.evaluate(()=>[...document.images].filter(im=>im.getBoundingClientRect().width>0&&im.getBoundingClientRect().height>0).filter(im=>!im.complete||im.naturalWidth===0).map(im=>im.currentSrc||im.src)),{timeout:20000,message:'Visible original artwork must load before review screenshots'}).toEqual([]);}
async function panel(page,name){if(await page.locator('.game-panel').isVisible())await page.getByRole('button',{name:'关闭面板',exact:true}).click();await page.locator('.room-dock').getByRole('button',{name,exact:true}).click();await expect(page.locator('.game-panel')).toBeVisible();}
async function fit(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'The page must not overflow horizontally');const header=page.locator('.game-panel .panel-header');if(await header.isVisible()){const box=await header.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=page.viewportSize().height,'Dialog heading and close control must remain on screen');}}
async function swipeDock(page){
 const dock=page.locator('.room-dock');
 if(!await dock.evaluate(n=>n.scrollWidth>n.clientWidth+1))return;
 const bounds=await dock.boundingBox(),x=bounds.x+bounds.width-20,y=bounds.y+bounds.height/2;
 const input=await page.context().newCDPSession(page);
 try{
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let step=1;step<=12;step++){
   await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(bounds.width-40)*step/12,y,id:1}]});
   await page.waitForTimeout(20);
  }
  await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>dock.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
  const settings=dock.getByRole('button',{name:'陪伴设置',exact:true});
  await expect.poll(()=>settings.evaluate(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right})).toBe(true);
  await settings.tap();await expect(page.getByRole('region',{name:'安卓陪伴设置',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'关闭面板',exact:true}).tap();
 }finally{await input.detach();}
}
async function fitLandscapeSpeech(page,label){
 if(page.viewportSize().height>500||page.viewportSize().width<600)return;
 await page.getByRole('button',{name:'摸摸拉姆',exact:true}).tap();
 const speech=page.getByRole('button',{name:'收起拉姆提示',exact:true});await expect(speech).toBeVisible();
 const check=async()=>{
  const bubble=await speech.boundingBox(),top=await page.locator('.cottage-top').boundingBox(),dock=await page.locator('.room-dock').boundingBox();
  assert.ok(bubble.x>=0&&bubble.x+bubble.width<=page.viewportSize().width,'Landscape speech must fit horizontally');
  assert.ok(bubble.y>=top.y+top.height&&bubble.y+bubble.height<=dock.y,'Landscape speech must clear top controls and bottom navigation');
 };
 await check();
 const floor=page.getByRole('button',{name:'小屋地面，点击让拉姆走过去',exact:true}),bounds=await floor.boundingBox();
 await floor.tap({position:{x:bounds.width/2+110,y:bounds.height/2}});
 await expect(page.locator('.room-pet-position')).toHaveAttribute('data-speech-side','left');
 await expect(page.locator('.room-walker')).toHaveAttribute('data-moving','false');
 await check();await page.screenshot({path:path.join(output,`${label}-speech.png`)});
}
async function scenario(viewport,label){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(mockNative);await page.goto(origin);
 await page.getByRole('button',{name:'选择蓝色拉姆',exact:true}).click();await page.getByRole('button',{name:'给它起名',exact:true}).click();await page.locator('#pet-name').fill('安卓小蓝');await page.getByRole('button',{name:'带拉姆回家！',exact:true}).click();await expect(page.locator('.room-dock')).toBeVisible();assert.equal(await page.evaluate(()=>window.__androidTest.state.petMode),false);await fit(page);
 await expect.poll(async()=>JSON.parse(await page.evaluate(()=>window.__androidTest.storage['ramu-house-save-v1'])).name).toBe('安卓小蓝');
 await expect.poll(()=>page.evaluate(()=>{const audio=document.querySelector('audio[data-ramu-bgm]');return Boolean(audio&&!audio.paused&&audio.readyState>=2)}),{timeout:15000}).toBe(true);
 await artwork(page);await page.screenshot({path:path.join(output,`${label}-house.png`)});await fitLandscapeSpeech(page,label);await swipeDock(page);
 await panel(page,'进入商店');await expect(page.locator('.book-product')).toHaveCount(9);const selected=await page.locator('.book-item-detail').getAttribute('data-selected-item');const prior=await save(page);await page.locator('.book-buy').click();await expect.poll(async()=>(await save(page)).inventory[selected]).toBe((prior.inventory[selected]||0)+1);await fit(page);await artwork(page);await page.screenshot({path:path.join(output,`${label}-shop.png`)});
 await panel(page,'打开背包');await expect(page.locator('.pocket-slot')).toHaveCount(16);const slot=page.locator('.pocket-slot[data-item-id]').first(),id=await slot.getAttribute('data-item-id'),before=await save(page);await slot.click();await expect.poll(async()=>(await save(page)).inventory[id]).toBe(before.inventory[id]-1);assert.equal(await page.locator('.pocket-slot').first().evaluate(e=>Math.abs(e.getBoundingClientRect().width-e.getBoundingClientRect().height)<1),true);await fit(page);
 await panel(page,'陪伴设置');await expect(page.getByRole('region',{name:'安卓陪伴设置',exact:true})).toBeVisible();await page.getByRole('button',{name:'设置悬浮窗权限',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>window.__androidTest.permissions.overlay)).toBe(true);await page.getByRole('switch',{name:'Wi-Fi 下自动下载更新',exact:true}).click();await expect(page.getByRole('switch',{name:'Wi-Fi 下自动下载更新',exact:true})).toHaveAttribute('aria-checked','true');await fit(page);
 await page.evaluate(()=>{localStorage.setItem('ramu-write-test','original');window.__androidTest.failWrites=true;let failed=false;try{localStorage.setItem('ramu-write-test','bad')}catch{failed=true}window.__androidTest.failWrites=false;if(!failed||localStorage.getItem('ramu-write-test')!=='original')throw Error('Native save failure must roll back the renderer storage');localStorage.removeItem('ramu-write-test');});
 await panel(page,'成长手册');await page.getByRole('button',{name:'固定形态',exact:true}).click();await page.getByRole('button',{name:'切换到初级拉姆',exact:true}).click();await page.getByRole('button',{name:'应用成长设置',exact:true}).click();await page.getByRole('button',{name:'确认切换',exact:true}).click();await expect.poll(async()=>(await save(page)).growthLocked).toBe(true);
 await panel(page,'进入拉姆学院');const language=page.locator('.school-course-grid article').filter({has:page.getByRole('heading',{name:'语言课',exact:true})});await expect(language.getByRole('button',{name:'上这一课',exact:true})).toBeEnabled({timeout:25000});await language.getByRole('button',{name:'上这一课',exact:true}).click();await expect.poll(async()=>(await save(page)).activity?.course).toBe('language');let activity=(await save(page)).activity;assert.equal(activity.endsAt-activity.startedAt,180000);await expect(page.getByRole('progressbar',{name:'语言课进度',exact:true})).toHaveAttribute('max','180000');
 await page.clock.setFixedTime(new Date(activity.endsAt+1000));await page.evaluate(()=>window.__androidTest.emit('resume',{}));await expect.poll(async()=>(await save(page)).education?.graduated?.language).toBeTruthy();const learned=await save(page);await page.evaluate(()=>window.__androidTest.emit('resume',{}));await expect.poll(async()=>(await save(page)).education.graduated.language).toBe(learned.education.graduated.language);await fit(page);await artwork(page);await page.screenshot({path:path.join(output,`${label}-school.png`)});
 await panel(page,'游乐时光');await page.getByRole('button',{name:'开始寻宝',exact:true}).click();await expect(page.locator('.treasure-dialog')).toBeVisible();await fit(page);await page.evaluate(()=>window.__androidTest.emit('back',{}));await expect(page.locator('.treasure-dialog')).toHaveCount(0);
 await panel(page,'陪伴设置');await page.getByRole('button',{name:'开始计时',exact:true}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('ramu-android-focus-v1'))).not.toBeNull();const timer=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-android-focus-v1')));await page.reload();await expect(page.locator('.room-dock')).toBeVisible();await panel(page,'陪伴设置');await expect(page.getByRole('button',{name:'取消计时',exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-android-focus-v1')).deadline),timer.deadline);await page.getByRole('button',{name:'取消计时',exact:true}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('ramu-android-focus-v1'))).toBeNull();await artwork(page);await page.screenshot({path:path.join(output,`${label}-settings.png`)});
 // The Android house permits saving/installing while idle; the desktop's
 // "in the house" busy restriction must not strand updates in settings.
 await expect.poll(()=>page.evaluate(()=>window.__androidTest.calls.filter(c=>c.method==='updatesBusy').at(-1)?.args.busy)).toBe(false);
 await page.getByRole('button',{name:'设置悬浮窗权限',exact:true}).click();await page.getByRole('button',{name:'关闭面板',exact:true}).click();await page.getByRole('button',{name:'悬浮陪伴',exact:true}).click();await expect(page.getByTestId('desktop-character')).toBeVisible();await page.setViewportSize({width:160,height:240});
 // Android long-press emits contextmenu; it must not open the desktop's right-click backpack.
 await page.getByTestId('desktop-character').dispatchEvent('contextmenu',{button:2,pointerType:'touch'});
 await expect(page.getByTestId('companion-panel')).toHaveCount(0);
 await page.getByTestId('desktop-character').tap();await expect(page.getByTestId('pet-actions')).toBeVisible();await page.getByRole('button',{name:'状态',exact:true}).click();await page.setViewportSize({width:340,height:600});await expect(page.getByTestId('companion-panel')).toBeVisible();await page.getByRole('button',{name:'打开背包',exact:true}).click();await expect(page.locator('.pocket-slot')).toHaveCount(16);await artwork(page);await page.screenshot({path:path.join(output,`${label}-floating-bag.png`)});await fit(page);await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.getByTestId('desktop-character').tap();await page.getByRole('button',{name:'进入小屋',exact:true}).click();await page.setViewportSize(viewport);await expect(page.locator('.room-dock')).toBeVisible();
 assert.deepEqual(errors,[]);console.log(`PASS ${label}: adoption, mobile layouts, shop/use, native save rollback, course deadline/settlement, back, timer restore and overlay bridge`);await page.close();
}
(async()=>{fs.mkdirSync(output,{recursive:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});await scenario({width:393,height:852},'phone');await scenario({width:360,height:640},'phone-small');await scenario({width:852,height:393},'phone-landscape');await scenario({width:1280,height:800},'tablet');})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
