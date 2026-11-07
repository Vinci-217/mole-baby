/** Sequential canvas capture of the exact offline runtime used by Ram. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const sharp=require('sharp');sharp.concurrency(1);
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/all-original-animations');
const base='http://127.0.0.1:5173/assets/original/official/';
const manifest=require('../public/assets/original/official/manifest.json');
const report=path.join(out,'captures.jsonl'),gifs=path.join(out,'gifs');
fs.mkdirSync(gifs,{recursive:true});
const engine=crypto.createHash('sha256').update('capture-v3-settled-blue').update(fs.readFileSync(path.join(root,'public/assets/original/official/controller.swf'))).update(fs.readFileSync(path.join(root,'public/assets/original/official/runtime.js'))).digest('hex');
const done=new Map();if(fs.existsSync(report))for(const line of fs.readFileSync(report,'utf8').trim().split('\n').filter(Boolean)){const row=JSON.parse(line);if(row.engine===engine&&row.ok&&fs.existsSync(path.join(out,row.gif)))done.set(row.id,row)}
const shard=process.env.CAPTURE_SHARD?.split('/').map(Number);
let rows=manifest.clips.filter((row,index)=>(!shard||index%shard[1]===shard[0])&&!done.has(row.id));
if(process.env.CAPTURE_IDS)rows=rows.filter(row=>process.env.CAPTURE_IDS.split(',').includes(row.id));
if(process.env.CAPTURE_LIMIT)rows=rows.slice(0,Number(process.env.CAPTURE_LIMIT));
function freezeClock(){
 const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,now=performance.now.bind(performance);let key=0,frozen=false,time=0,queue=new Map();
 window.requestAnimationFrame=fn=>frozen?(queue.set(--key,fn),key):raf.call(window,t=>frozen?queue.set(--key,fn):fn(t));
 window.cancelAnimationFrame=id=>id<0?queue.delete(id):caf.call(window,id);
 window.freezeCapture=()=>{time=now();frozen=true;Object.defineProperty(performance,'now',{value:()=>time,configurable:true});};
 window.advanceCapture=delta=>{time+=delta;const pending=[...queue.values()];queue.clear();pending.forEach(fn=>fn(time));};
}
let browser;
async function launch(){return chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disable-dev-shm-usage','--disable-gpu','--renderer-process-limit=2']})}
(async()=>{
 const began=Date.now();let count=0;
 try{
  for(const clip of rows){
   // Recycling avoids accumulating removed WASM instances and worker threads.
   if(!browser||count%8===0){await browser?.close();browser=await launch();}
   const page=await browser.newPage({viewport:{width:240,height:260},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(freezeClock);
   const form=clip.forms.includes('level2')?'level2':clip.forms[0]||`level${clip.level||2}`;
   let result={id:clip.id,path:clip.path,engine,form,ok:false};
   try{
    await page.goto(base+`runtime.html?id=${clip.id}&form=${form}&token=record&loop=1&color=-215,-57,31`,{timeout:20000});
    await page.waitForFunction(()=>window.player?.ruffle().callExternalInterface('previewStatus')?.settled&&window.player?.ruffle().callExternalInterface('previewStatus')?.width>0,{},{timeout:18000});
    const loadStatus=await page.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));
    if(loadStatus.error)throw Error(loadStatus.error);
    await page.evaluate(symbol=>{player.ruffle().volume=0;player.ruffle().callExternalInterface('setBodyColor',-215,-57,31);window.freezeCapture();player.ruffle().callExternalInterface('previewSymbol',symbol);},clip.symbol);
    const encodedFrames=await page.evaluate(async ({outfit,form,count})=>{
     const frames=[];
     async function settle(){for(let i=0;i<12;i++){window.advanceCapture(1000/24);await new Promise(resolve=>setTimeout(resolve,2));}}
     if(outfit)player.ruffle().callExternalInterface('previewPose',form,'down',false);
     await settle();
     for(let index=0;index<count;index++){
      if(outfit&&(index===16||index===32)){player.ruffle().callExternalInterface('previewPose',form,index<32?'left':'right',true);await settle();}
      window.advanceCapture(1000/12);
      await new Promise(resolve=>setTimeout(resolve,2));
      if(player.ruffle().callExternalInterface('previewStatus')?.ended&&frames.length)break;
      frames.push(player.shadowRoot.querySelector('canvas').toDataURL('image/png').split(',')[1]);
     }
     return frames;
    },{outfit:clip.kind==='outfit'||clip.kind==='body',form,count:clip.animated?48:1});
    const frames=[],visibleFrames=[];let painted=0;const hashes=new Set();
    for(const encoded of encodedFrames){
     const png=Buffer.from(encoded,'base64');
     const raw=await sharp(png).resize(240,260).ensureAlpha().raw().toBuffer();
     const visible=raw.some((value,index)=>index%4===3&&value>32);if(visible)painted++;visibleFrames.push(visible);
     frames.push(raw);hashes.add(crypto.createHash('sha256').update(raw).digest('hex'));
    }
    if(!painted)throw Error('No painted pixels');
    while(frames.length>1&&!visibleFrames[frames.length-1])frames.pop();
    const gif=`gifs/${clip.id}.gif`;
    await sharp(Buffer.concat(frames),{raw:{width:240,height:260*frames.length,channels:4,pageHeight:260}}).gif({loop:0,delay:frames.map(()=>80),effort:2,dither:.5}).toFile(path.join(out,gif));
    const meta=await sharp(path.join(out,gif),{animated:true}).metadata();
    result={...result,ok:true,gif,frames:meta.pages||1,capturedFrames:frames.length,paintedFrames:painted,uniqueFrames:hashes.size,width:240,height:260,bytes:fs.statSync(path.join(out,gif)).size,errors};
   }catch(error){result.error=String(error);}
   finally{await page.close();}
   fs.appendFileSync(report,JSON.stringify(result)+'\n');done.set(clip.id,result);count++;
   console.log(JSON.stringify({progress:`${count}/${rows.length}`,name:clip.name,ok:result.ok,unique:result.uniqueFrames,error:result.error,seconds:Math.round((Date.now()-began)/1000)}));
  }
 }finally{await browser?.close();}
 const failed=[...done.values()].filter(row=>!row.ok);console.log(JSON.stringify({total:done.size,failed}));if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
