/** Check rendered anatomy, not just the envelope reported by the SWF. The old
 * controller can report a perfectly sized petBody while the face is 60% smaller. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/outfit-size');
const manifest=require('../public/assets/original/official/manifest.json');
const clip=manifest.clips.find(c=>c.path.endsWith('/1200113.swf'));
const forms={junior:'level2',middle:'level3',senior:'level4',super:'level101_7',classic:'level101',water:'level5_2',wood:'level5_4',fire:'level5_1'};
async function load(page,referenceForm){
 await page.goto('http://127.0.0.1:5173/assets/original/official/runtime.html?token=size');
 await page.evaluate(({id,referenceForm})=>{
  window.sizeStates=[];window.sizeErrors=[];
  addEventListener('message',e=>{if(e.data.type==='ram-original-state')sizeStates.push(e.data.value);if(e.data.type==='ram-original-error')sizeErrors.push(e.data.value)});
  postMessage({type:'ram-original-load',token:'size',sequence:1,value:{id,loop:true,registerBody:true,referenceForm,pose:{form:'level2',direction:'down',moving:false,color:[-99,-160,-43],sound:false}}},'*');
 },{id:clip.id,referenceForm});
 await page.waitForFunction(()=>sizeStates.length>=4||sizeErrors.length,{timeout:45000});
 assert.deepEqual(await page.evaluate(()=>sizeErrors),[]);
}
async function facePixels(page,form){
 return page.evaluate(target=>{
  const canvas=player.shadowRoot.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  // In this verified original costume the only white artwork here is the two
  // eyes. Locate the face independently of the selected registration node.
  let x0=canvas.width,x1=-1,y0=canvas.height,y1=-1;
  const bottom=475.2+target[3]*4,width=(target[2]-target[0])*4,centre=440+(target[0]+target[2])*2;
  for(let y=Math.max(0,Math.floor(bottom-width*1.3));y<Math.min(canvas.height,Math.ceil(bottom+4));y++){
   for(let x=Math.floor(centre-width*.7);x<Math.ceil(centre+width*.7);x++){
    const i=(y*canvas.width+x)*4;
    if(data[i+3]>220&&data[i]>245&&data[i+1]>245&&data[i+2]>245){x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1)}
   }
  }
  const row=Math.floor((y0+y1)/2),cx=Math.round((x0+x1)/2);let left=cx,right=cx;
  const alpha=x=>data[(row*canvas.width+x)*4+3];
  if(x1>=x0){while(left>0&&alpha(left)>128)left--;while(right<canvas.width&&alpha(right)>128)right++;}
  return {eyeBounds:[x0,y0,x1,y1],bodyPixelWidth:right-left-1,expectedBodyPixelWidth:width,ratio:(right-left-1)/width};
 },manifest.bodyBounds[form]);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/assets/original/official/files',clip.path))).digest('hex'),clip.sha256);
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 const rows=[];
 try{
  if(process.env.BASELINE_CONTROLLER){
   const page=await browser.newPage({viewport:{width:1280,height:1382}});
   await page.route('**/controller.swf?*',route=>route.fulfill({path:process.env.BASELINE_CONTROLLER,contentType:'application/x-shockwave-flash'}));
   await load(page,forms.super);const before=await facePixels(page,'super');assert(before.ratio<.6,'The baseline must reproduce the visibly shrunken body');
   fs.writeFileSync(path.join(out,'before-measurement.json'),JSON.stringify(before,null,2));await page.close();
  }
  for(const [form,reference] of Object.entries(forms)){
   const page=await browser.newPage({viewport:{width:1280,height:1382}});await load(page,reference);
   const state=await page.evaluate(()=>sizeStates.at(-1)),pixels=await facePixels(page,form);
   assert(pixels.ratio>.88&&pixels.ratio<1.12,`${form}: actual face/body pixels must match the bare pet, got ${pixels.ratio}`);
   assert.equal(state.registration.basis,'verified-body-node');assert(state.registration.bodyWidth<25,'Exclude the 55.95-wide decorated envelope');
   for(const direction of ['left','right','down']){
    await page.evaluate(direction=>postMessage({type:'ram-original-pose',token:'size',sequence:1,value:{form:'level2',direction,moving:direction!=='down',color:[-99,-160,-43],sound:false}},'*'),direction);
    await page.waitForFunction(direction=>{const s=sizeStates.at(-1);return s?.direction===direction&&s.settled},direction);
    const pose=await page.evaluate(()=>sizeStates.at(-1));
    assert.deepEqual(pose.registration,state.registration,'Directions retain one scale and anchor');
    assert(pose.body.width>state.body.width*.7&&pose.body.width<state.body.width*1.3,'Follow the actual moving body');
   }
   rows.push({form,sourceForm:'level2',pixels,registration:state.registration});await page.close();
  }
  fs.writeFileSync(path.join(out,'body-size-checks.json'),JSON.stringify({checked:rows.length,rows},null,2));
  console.log('PASS rendered body size in 8 actual forms, original left/right poses and stable registration; original source SHA unchanged.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
