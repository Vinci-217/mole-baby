const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const {adopt,openActions,enterHome,roomTab,toDesktop,selectPocket,buy}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5201';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5201','--strictPort'],{cwd:root,stdio:'pipe'});
let logs='',browser;server.stdout.on('data',s=>logs+=s);server.stderr.on('data',s=>logs+=s);
const save=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break}catch{}if(i===99)throw Error(logs);await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const p=await browser.newPage({viewport:{width:1180,height:820},timezoneId:'Asia/Shanghai'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  if(!localStorage.getItem('ramu-house-preferences-v2'))localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:true,soundVolume:.45,presence:false,lively:true,reminderMinutes:40}));
  window.__sounds=[];window.__audioCreated=0;window.__disconnects=0;
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
   constructor(...args){super(...args);window.__audioCreated++}
   createOscillator(){const n=super.createOscillator(),start=n.start.bind(n);n.start=at=>{window.__sounds.push({kind:'tone',time:performance.now(),pitch:n.frequency.value,action:document.querySelector('.desktop-character .ram-sprite')?.dataset.action});return start(at)};return n}
   createBufferSource(){const n=super.createBufferSource(),start=n.start.bind(n);n.start=at=>{window.__sounds.push({kind:'noise',time:performance.now(),action:document.querySelector('.desktop-character .ram-sprite')?.dataset.action});return start(at)};return n}
  };
  const disconnect=AudioNode.prototype.disconnect;AudioNode.prototype.disconnect=function(...args){window.__disconnects++;return disconnect.apply(this,args)};
 });
 await p.clock.install();await p.goto(url);await adopt(p,'蓝色','小芽');await p.clock.pauseAt(new Date(Date.now()+1000));
 await p.clock.fastForward(16000);await p.clock.runFor(40);assert.equal(await p.evaluate(()=>window.__audioCreated),0,'no startup audio/context or automatic focus');
 const before=await save(p);const memories=await p.evaluate(()=>localStorage.getItem(`ramu-companion-memory-v1:${JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt}`));
 await p.clock.fastForward(245000);await p.clock.runFor(80);const ram=p.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-action',/^(look-around|watch-butterfly|happy|waving|mood-joy|mood-content)$/);
 const pot=await ram.locator('.seed-pot-original').evaluate(n=>getComputedStyle(n).transform);assert.equal(pot,'none');
 await p.clock.runFor(6600);await expect(ram).toHaveAttribute('data-action','idle');assert.equal((await save(p)).coins,before.coins);assert.deepEqual((await save(p)).inventory,before.inventory);assert.equal(await p.evaluate(()=>localStorage.getItem(`ramu-companion-memory-v1:${JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt}`)),memories,'passive motion cannot farm memories or affection');
 await openActions(p);await p.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await p.getByRole('button',{name:'看看小蝴蝶',exact:true}).click();await p.clock.runFor(1200);
 await expect(ram.locator('.social-butterfly>img')).toBeVisible();await p.screenshot({path:path.join(root,'artifacts/v15-play-pocket.png')});const a=await ram.locator('.ram-pose-layer').evaluate(n=>getComputedStyle(n).transform);await p.clock.runFor(1000);const b=await ram.locator('.ram-pose-layer').evaluate(n=>getComputedStyle(n).transform);assert.notEqual(a,b);
 await p.getByRole('button',{name:'关闭小窗',exact:true}).click();await p.clock.runFor(4500);await expect(ram).toHaveAttribute('data-action','idle');
 await p.getByRole('button',{name:'拉姆：悬停互动，点击摸摸，按住拖动',exact:true}).click();await p.clock.runFor(800);assert.ok((await p.evaluate(()=>window.__sounds)).some(s=>s.action==='pet'));
 await p.clock.runFor(2000);await enterHome(p);await buy(p,'biscuit','熊熊饼干','食物');await toDesktop(p);await openActions(p);await p.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();await(await selectPocket(p,'biscuit','熊熊饼干')).click();await p.clock.runFor(90);const initial=await p.evaluate(()=>window.__sounds.length);await p.clock.runFor(1300);const contacts=await p.evaluate(()=>window.__sounds.slice(-8));assert.ok(contacts.filter(s=>s.action==='eat-bear-biscuit'&&s.kind==='noise').length>=2,'crunches occur during actual eating');assert.ok(await p.evaluate(()=>window.__sounds.length)>initial);
 await p.clock.runFor(1000);await p.getByRole('button',{name:'关闭小窗',exact:true}).click();
 console.log('PASS silent launch, finite natural seed curiosity, stationary pot, explicit butterfly play, no passive affection and real contact-synchronized crunches');
 // Actual sound clocks, mute/volume/speech gates and cancellation use Web Audio.
 const audio=await p.evaluate(async()=>{
  const {createPetSoundClock,configurePetSound,renderFoley}=await import('/src/pet-audio.ts');
  const count=()=>window.__sounds.length;
  configurePetSound({enabled:true,volume:.45,speechBusy:false});const score={cues:[{at:100,kind:'ball',strength:.6},{at:500,kind:'ball',strength:.6}]};
  const base=count(),c=createPetSoundClock(score,true);c.tick(0);c.tick(100);c.tick(100);const once=count()-base;c.tick(510);const twice=count()-base;const disconnects=window.__disconnects;c.stop();c.tick(600);const disconnected=window.__disconnects>disconnects;
  const late=createPetSoundClock(score,true),old=count();late.tick(900);const stale=count()-old;late.stop();
  const blocked=[];for(const setting of [{enabled:false,volume:.45,speechBusy:false},{enabled:true,volume:0,speechBusy:false},{enabled:true,volume:.45,speechBusy:true}]){configurePetSound(setting);const n=count(),s=createPetSoundClock(score,true);s.tick(100);s.stop();blocked.push(count()-n)}
  configurePetSound({enabled:true,volume:.45,speechBusy:false});
  const kinds=['nibble','crunch','sip','gulp','bubble','brush','water','cloth','page','ball','magic','voice'],renders=[];
  for(const kind of kinds){const ctx=new OfflineAudioContext(1,24000,48000);renderFoley(ctx,kind,0,.7,ctx.destination);const data=(await ctx.startRendering()).getChannelData(0);let peak=0,sum=0,last=0;for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));sum+=data[i]*data[i];if(Math.abs(data[i])>.00001)last=i}renders.push({kind,peak,rms:Math.sqrt(sum/data.length),end:last/48000})}
  return {once,twice,stale,blocked,disconnected,renders};
 });
 assert.equal(audio.once,1);assert.equal(audio.twice,2);assert.equal(audio.stale,0);assert.deepEqual(audio.blocked,[0,0,0]);assert.ok(audio.disconnected);for(const r of audio.renders){assert.ok(r.peak>0&&r.peak<.5&&r.rms>0&&r.end<.5,JSON.stringify(r))}
 fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/v15-audio-review.json'),JSON.stringify(audio,null,2));console.log('PASS 12 offline-rendered foley timbres have audible finite signal/no clipping; live clocks deduplicate, skip stale cues, disconnect on cancel and respect mute/zero-volume/native-speech priority');
 // Same actual prop contact for every original form/colour, including potted seeds.
 const forms=[['seed',0],['junior',60],['middle',180],['senior',420],['super',840],['water',840],['wood',840],['fire',840]],pictures=[];
 for(const [form,growth]of forms)for(const color of ['red','yellow','blue','pink']){
  await p.evaluate(({form,growth,color})=>{const x=JSON.parse(localStorage.getItem('ramu-house-save-v1'));x.growth=growth;x.color=color;x.stats={hunger:90,thirst:90,cleanliness:90,health:100,happiness:90,energy:90};x.lastTick=Date.now();x.sleeping=false;delete x.evolution;if(growth===840)x.evolution=form;localStorage.setItem('ramu-house-save-v1',JSON.stringify(x));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}))},{form,growth,color});
  await p.reload();await p.clock.runFor(100);await openActions(p);await p.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await p.getByRole('button',{name:'看看小蝴蝶',exact:true}).click();await p.getByRole('button',{name:'关闭小窗',exact:true}).click();await p.clock.runFor(1000);
  await expect(ram.locator('.social-butterfly>img')).toBeVisible();await expect(ram).toHaveAttribute('data-color',color);await expect(ram.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-form',form);await expect(ram).not.toHaveAttribute('data-fallback','true');const butterfly=await ram.locator('.social-butterfly').boundingBox(),box=await ram.boundingBox();assert.ok(butterfly.x>=box.x-1&&butterfly.x+butterfly.width<=box.x+box.width+1&&butterfly.y>=box.y-1,JSON.stringify({form,color,butterfly,box}));
  if(growth>=420){await expect(ram).toHaveClass(/is-flying/);await expect(ram.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-row','0')}
  if(growth===0)assert.equal(await ram.locator('.seed-pot-original').evaluate(n=>getComputedStyle(n).transform),'none');
  const filename=path.join(root,`artifacts/v15-review/${form}-${color}.png`);fs.mkdirSync(path.dirname(filename),{recursive:true});await p.locator('.compact-pet').screenshot({path:filename,animations:'allow'});pictures.push({form,color,file:filename});await p.clock.fastForward(5700);await p.clock.runFor(40);await expect(ram).toHaveAttribute('data-action','idle');
 }
 fs.writeFileSync(path.join(root,'artifacts/v15-review/index.json'),JSON.stringify(pictures));
 console.log('PASS 32 original form/colour butterfly interactions, clipped-area guards, finite exits, seed pot isolation and preserved flight registration');
 await enterHome(p);await roomTab(p,'设置');await p.getByRole('checkbox',{name:'自然小动作',exact:true}).uncheck();await p.getByRole('slider',{name:'拉姆音量',exact:true}).fill('23');await toDesktop(p);await p.reload();await p.clock.fastForward(300000);await expect(ram).toHaveAttribute('data-action','idle');
 await enterHome(p);await roomTab(p,'设置');await expect(p.getByRole('checkbox',{name:'自然小动作',exact:true})).not.toBeChecked();await expect(p.getByRole('slider',{name:'拉姆音量',exact:true})).toHaveValue('23');assert.deepEqual(errors,[]);
 console.log('PASS persisted natural-motion toggle and volume, no forced timer or renderer errors');
 await p.getByRole('checkbox',{name:'自然小动作',exact:true}).check();await p.getByRole('switch',{name:'安静陪伴',exact:true}).click();await toDesktop(p);await p.clock.fastForward(300000);await expect(ram).toHaveAttribute('data-action','idle');
 await enterHome(p);await roomTab(p,'设置');await p.getByRole('switch',{name:'安静陪伴',exact:true}).click();await toDesktop(p);await openActions(p);await p.getByRole('button',{name:'开始计时',exact:true}).click();await p.clock.fastForward(300000);await p.clock.runFor(50);await expect(ram).toHaveAttribute('data-action','focus');
 console.log('PASS quiet mode and a running manual timer suppress autonomous curiosity');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
