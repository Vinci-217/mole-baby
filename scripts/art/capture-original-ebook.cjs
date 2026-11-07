/** Run the ORIGINAL nested SWF timelines in Ruffle. The capture adapter only
 * selects a supported costume level/direction, applies the client's bone events
 * and toggles layer visibility. It never draws or interpolates artwork. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),sharp=require('sharp'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/original-reading-runtime');
const suffix='';
const forms={junior:'level2',middle:'level3',senior:'level4',classic:'level101',super:'level101_7',water:'level5_2',wood:'level5_4',fire:'level5_1'};
async function freeze(p){
 await p.evaluate(()=>{window.freeze=true;window.fakeTime=performance.now();Object.defineProperty(performance,'now',{value:()=>window.fakeTime});});
 await p.waitForTimeout(80);
}
async function installClock(p){await p.addInitScript(()=>{
 const native=window.requestAnimationFrame,stop=window.cancelAnimationFrame;let id=0;
 window.pending=new Map();window.freeze=false;
 window.requestAnimationFrame=fn=>{if(window.freeze){const key=--id;window.pending.set(key,fn);return key;}return native.call(window,t=>{if(window.freeze)window.pending.set(--id,fn);else fn(t)});};
 window.cancelAnimationFrame=i=>i<0?window.pending.delete(i):stop.call(window,i);
 window.advance=delta=>{window.fakeTime+=delta;const q=[...window.pending.values()];window.pending.clear();for(const fn of q)fn(window.fakeTime);return q.length};
});}
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});const checks={fps:24,ruffle:JSON.parse(fs.readFileSync(path.join(out,'ruffle/package.json'))).version,forms:{}};
 try{for(const[form,label]of Object.entries(forms)){
  if(process.env.EBOOK_FORM&&form!==process.env.EBOOK_FORM)continue;
  const p=await b.newPage({viewport:{width:960,height:560}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await installClock(p);await p.goto('http://127.0.0.1:5186/capture.html');await p.waitForFunction(()=>window.loaded&&window.player?.ruffle().callExternalInterface('poseInfo')?.[1]);await freeze(p);
  await p.evaluate(label=>player.ruffle().callExternalInterface('selectForm',label),label);
  const dir=path.join(out,'captures'+suffix,form);fs.mkdirSync(dir,{recursive:true});const states=[],samples=[];
  let cycleStart=-1,cycleLength=0;
  for(let i=0;i<420;i++){
   const captured=await p.evaluate(async()=>{
    advance(1000/24+.00001);await new Promise(resolve=>setTimeout(resolve,4));
    const pose=JSON.stringify(player.ruffle().callExternalInterface('poseInfo'));
    return {pose};
   });
   captured.full=(await p.screenshot({omitBackground:true,clip:{x:200,y:10,width:560,height:500}})).toString('base64');
   states.push(captured.pose);
   const frame=String(i).padStart(4,'0');
   for(const[layer,data]of [['full',captured.full]]){
    await sharp(Buffer.from(data,'base64')).png().toFile(path.join(dir,`${frame}-${layer}.png`));
   }
   samples.push({pose:JSON.parse(captured.pose),sha256:crypto.createHash('sha256').update(Buffer.from(captured.full,'base64')).digest('hex')});
   // Two equal complete timeline states are only a cycle when the following
   // 12 states also match; this excludes still frames and one-frame holds.
   if(i>=36){for(let start=0;start<i-24;start++){
    const period=i-start-12;if(period<12)continue;
    if(states.slice(start,start+13).every((s,j)=>s===states[start+period+j]&&samples[start+j].sha256===samples[start+period+j].sha256)){cycleStart=start;cycleLength=period;break;}
   }}
   if(cycleStart>=0)break;
  }
  assert(!errors.length,errors.join('\n'));assert(cycleStart>=0,`No verified loop found for ${form}`);
  // Visual equality also checks that unchanged nested frame numbers do not
  // hide a tween/transform mismatch in our detected cycle.
  for(let j=0;j<13;j++)assert.equal(samples[cycleStart+j].sha256,samples[cycleStart+cycleLength+j].sha256,`${form} visual loop ${j}`);
  const wanted=new Map();
  for(let i=cycleStart;i<cycleStart+cycleLength;i++){
   const key=states[i];if(!wanted.has(key))wanted.set(key,[]);wanted.get(key).push(i);
  }
  const colours={yellow:[0,-21,-255],blue:[-215,-57,31],purple:[-115,-171,-55],red:[255,-199,-250],pink:[51,-148,0]};
  for(const[colour,offsets]of Object.entries(colours)){
   await p.evaluate(offsets=>player.ruffle().callExternalInterface('setBodyColor',...offsets),offsets);
   const remaining=new Map(wanted);
   for(let i=0;i<cycleLength*3+24&&remaining.size;i++){
    const pose=await p.evaluate(async()=>{advance(1000/24+.00001);await new Promise(resolve=>setTimeout(resolve,4));return JSON.stringify(player.ruffle().callExternalInterface('poseInfo'));});
    const targets=remaining.get(pose);if(!targets)continue;
    const png=await p.screenshot({omitBackground:true,clip:{x:200,y:10,width:560,height:500}});
    for(const frame of targets)fs.writeFileSync(path.join(dir,`${String(frame).padStart(4,'0')}-${colour}.png`),png);
    remaining.delete(pose);
   }
   assert.equal(remaining.size,0,`${form}/${colour}: incomplete source states`);
  }
  checks.forms[form]={label,frames:samples.length,loopStart:cycleStart,loopFrames:cycleLength,states:samples};fs.writeFileSync(path.join(out,'captures'+suffix+'.json'),JSON.stringify(checks,null,2)+'\n');
  console.log(`${form}: original 24 fps, loop ${cycleStart}+${cycleLength}, ${samples.length} captured frames; no script errors`);await p.close();
 }}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
