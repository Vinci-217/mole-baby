/** Record every shipping catalogue case from the actual React/native renderer.
 * Sample at 10 fps, at original playback speed. Stream each page into one GIF;
 * original SWFs, saved pets and completed earlier recordings are never edited.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process'),{once}=require('node:events'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.RECORD_OUTPUT_DIR||path.join(root,'artifacts/complete-animation-review')),pageOffset=Number(process.env.RECORD_PAGE_OFFSET||0),fps=10,manifest=require('../public/assets/original/official/manifest.json');
const output=path.join(out,'全部拉姆动画总览.gif'),journalPath=path.join(out,'recording-checks.json');
function controlledClock(){
 const raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window),now=performance.now.bind(performance);let frozen=false,time=0,key=0,queue=new Map();
 window.requestAnimationFrame=fn=>frozen?(queue.set(--key,fn),key):raf(t=>frozen?queue.set(--key,fn):fn(t));
 window.cancelAnimationFrame=id=>id<0?queue.delete(id):caf(id);
 window.freezeAnimationRecording=()=>{if(frozen)return;time=now();frozen=true;Object.defineProperty(performance,'now',{value:()=>time,configurable:true});};
 if(window===window.parent)addEventListener('message',event=>{if(event.data?.type==='ram-original-ready'&&typeof event.source?.freezeAnimationRecording==='function')event.source.freezeAnimationRecording();});
 window.advanceAnimationRecording=delta=>{time+=delta;const pending=[...queue.values()];queue.clear();for(const fn of pending)fn(time);};
}
function gifBlocks(buffer){
 assert(['GIF89a','GIF87a'].includes(buffer.subarray(0,6).toString()));const packed=buffer[10],global=packed&128?buffer.subarray(13,13+3*2**((packed&7)+1)):null;
 let p=13+(global?.length||0),frames=0;const parts=[];
 const subBlocks=()=>{while(true){const n=buffer[p++];assert(p<=buffer.length);if(!n)break;p+=n;assert(p<=buffer.length)}};
 while(p<buffer.length){const start=p,tag=buffer[p++];if(tag===59)break;
  if(tag===33){const type=buffer[p++];subBlocks();if(type!==255)parts.push(buffer.subarray(start,p));}
  else if(tag===44){const descriptor=Buffer.from(buffer.subarray(start,p+9));p+=9;const local=descriptor[9];let palette;
   if(local&128){palette=buffer.subarray(p,p+3*2**((local&7)+1));p+=palette.length;}
   else{assert(global);palette=global;descriptor[9]=(local&120)|128|(packed&7);}
   const dataStart=p;p++;subBlocks();parts.push(descriptor,palette,buffer.subarray(dataStart,p));frames++;
  }else throw Error('Invalid GIF block '+tag+' at '+start);
 }
 return {header:buffer.subarray(0,13+(global?.length||0)),parts,frames};
}
function appendPage(file,journal){
 const parsed=gifBlocks(fs.readFileSync(file));assert(parsed.frames>0);
 if(!fs.existsSync(output)){const loop=Buffer.from([33,255,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0]);fs.writeFileSync(output,Buffer.concat([parsed.header,loop,Buffer.from([59])]));}
 const size=fs.statSync(output).size;if(journal.bytes){assert(size>=journal.bytes);fs.truncateSync(output,journal.bytes);}
 const handle=fs.openSync(output,'r+');try{let offset=fs.statSync(output).size-1;for(const block of parsed.parts){fs.writeSync(handle,block,0,block.length,offset);offset+=block.length;}fs.writeSync(handle,Buffer.from([59]),0,1,offset);fs.ftruncateSync(handle,offset+1);fs.fsyncSync(handle);}finally{fs.closeSync(handle)}
 return {frames:parsed.frames,bytes:fs.statSync(output).size};
}
async function recordPage(page,batch,inventory,pageNumber,pages){
 const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
 await page.addInitScript(controlledClock);await page.goto('http://127.0.0.1:5173/?preview=all-animations');
 await page.evaluate(({batch,pageNumber,pages})=>{allAnimationReview.show({indices:batch,page:pageNumber,pages});document.querySelector('.all-animation-review').classList.add('is-recording');},{batch,pageNumber,pages});
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-animation-case]')].every(tile=>{
  const player=tile.querySelector('.official-ram-clip');if(player)return player.dataset.loaded==='true';
  if(tile.querySelector('[data-ready="false"]'))return false;
  return [...tile.querySelectorAll('canvas:not(.all-animation-overview)')].some(c=>c.dataset.loaded==='true'||c.dataset.sourceFrame);
 }),null,{timeout:90000});
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await page.evaluate(()=>{allAnimationReview.restart();freezeAnimationRecording();for(const frame of document.querySelectorAll('iframe'))frame.contentWindow.freezeAnimationRecording();});
 await page.waitForTimeout(40);
 const duration=Math.max(...batch.map(i=>inventory[i].duration)),count=Math.ceil(duration/1000*fps),target=path.join(out,'current-page.gif');
 const encoder=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-i',path.join(out,'recording-palette.png'),'-filter_complex','[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[gif]','-map','[gif]','-loop','0',target],{stdio:['pipe','ignore','pipe']});
 let encoderError='';encoder.stderr.on('data',d=>encoderError+=d.toString());const closed=once(encoder,'close'),cdp=await page.context().newCDPSession(page);
 try{
  for(let frame=0;frame<count;frame++){
   const elapsed=frame/fps*1000;
   // Full 2.4-second petting, while keeping the whole wardrobe demo at 10s.
   // Only the phase boundaries change; source clocks still advance at 1x.
   const knots=[[0,0],[1000,1400],[2400,3000],[3800,4600],[6400,6200],[7600,7400],[8800,8600],[10000,10000]];
   let phaseTime=elapsed;if(batch.every(i=>inventory[i].outfit)){const k=knots.findIndex((p,i)=>i>0&&elapsed<p[0]);if(k>0){const a=knots[k-1],b=knots[k];phaseTime=a[1]+(elapsed-a[0])/(b[0]-a[0])*(b[1]-a[1]);}}
   await page.evaluate(({elapsed,phaseTime,delta})=>{
    allAnimationReview.tick(phaseTime);
    for(const node of document.querySelectorAll('iframe'))node.contentWindow.advanceAnimationRecording(delta);
    advanceAnimationRecording(delta);
    window.recordingAnimationBirths??=new WeakMap();for(const animation of document.getAnimations()){if(!recordingAnimationBirths.has(animation))recordingAnimationBirths.set(animation,elapsed);animation.pause();animation.currentTime=elapsed-recordingAnimationBirths.get(animation);}
    allAnimationReview.overviews();
   },{elapsed,phaseTime,delta:frame?1000/fps:0});
   await page.waitForTimeout(2);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
   if(!encoder.stdin.write(Buffer.from(shot.data,'base64')))await once(encoder.stdin,'drain');
   if(frame===Math.min(8,count-1))await page.screenshot({path:path.join(out,`page-${String(pageNumber).padStart(3,'0')}.png`)});
  }
  encoder.stdin.end();const [exitCode]=await closed;assert.equal(exitCode,0,encoderError);
 }catch(error){encoder.stdin.destroy();encoder.kill();throw error;}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 const failed=await page.locator('[data-animation-case][data-failed=true]').evaluateAll(ns=>ns.map(n=>n.dataset.animationCase));assert.deepEqual(failed,[],'Every listed source must load and play');
 return {file:target,frames:count,duration:count/fps,errors,missing};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 if(!fs.existsSync(path.join(out,'recording-palette.png'))){
  const rgb=[];for(let r=0;r<6;r++)for(let g=0;g<6;g++)for(let b=0;b<6;b++)rgb.push([r*51,g*51,b*51]);
  for(const c of ['fbf5e8','fffdf8','725633','eadac0','aa9476','f0e6d6','fffcf8','4ec3f6','5dc1f7','74d0ff','3198d6','9c5fd4','ffd15d','9cd654','b4e5fe','795b39','d6bd91','887052','947954','c74426','f7f2e6','624824','a77d45','ff835f','ffa5c7'])rgb.push([0,2,4].map(i=>parseInt(c.slice(i,i+2),16)));
  while(rgb.length<256){const n=Math.round((rgb.length-241)/14*255);rgb.push([n,n,n]);}
  await require('sharp')(Buffer.from(rgb.flat()),{raw:{width:16,height:16,channels:3}}).png().toFile(path.join(out,'recording-palette.png'));
 }
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
  const discovery=await browser.newPage({viewport:{width:1120,height:800}});await discovery.goto('http://127.0.0.1:5173/?preview=all-animations');await discovery.waitForFunction(()=>window.allAnimationReview);
  const inventory=await discovery.evaluate(()=>allAnimationReview.cases);await discovery.close();
  const selected=process.env.RECORD_ONLY?inventory.map((r,i)=>({r,i})).filter(({r})=>process.env.RECORD_ONLY.split(',').some(v=>r.id.includes(v))).map(({i})=>i):inventory.map((_,i)=>i);
  const batches=[];for(const index of selected){const last=batches.at(-1);if(last&&last.length<12&&inventory[last[0]].group===inventory[index].group)last.push(index);else batches.push([index]);}
  const engine=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/index.html'))).update(fs.readFileSync(__filename)).update(JSON.stringify(selected)).digest('hex');
  let journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath)):null;
  assert(!journal||journal.engine===engine,'Recording engine changed: use a fresh output directory');journal??={engine,fps,width:1120,height:800,inventory,pages:[],bytes:0,totalPages:batches.length};
  if(journal.bytes&&fs.existsSync(output)){fs.truncateSync(output,journal.bytes);const h=fs.openSync(output,'r+');fs.writeSync(h,Buffer.from([59]),0,1,journal.bytes-1);fs.closeSync(h);}
  for(let n=journal.pages.length;n<batches.length;n++){
   // Recycle all WASM engines and textures after each page. No growing cache.
   const context=await browser.newContext({viewport:{width:1120,height:800},deviceScaleFactor:1});await context.addInitScript(m=>{window.recordingManifest=m;},manifest);const page=await context.newPage();
   let result;
   try{result=await recordPage(page,batches[n],inventory,n+1+pageOffset,Number(process.env.RECORD_TOTAL_PAGES)||batches.length+pageOffset);}finally{await context.close()}
   const appended=appendPage(result.file,journal);fs.unlinkSync(result.file);const start=journal.pages.reduce((sum,p)=>sum+p.duration,0);
   journal.pages.push({page:n+1+pageOffset,start,duration:result.duration,indices:batches[n],frames:appended.frames,errors:result.errors,missing:result.missing});journal.bytes=appended.bytes;
   fs.writeFileSync(journalPath+'.tmp',JSON.stringify(journal,null,2)+'\n');fs.renameSync(journalPath+'.tmp',journalPath);
   console.log(JSON.stringify({page:n+1+pageOffset,pages:batches.length+pageOffset,cases:batches[n].map(i=>inventory[i].id),recordedCases:journal.pages.reduce((a,p)=>a+p.indices.length,0),gifMiB:Math.round(journal.bytes/10485.76)/100}));
  }
  const count=journal.pages.reduce((n,p)=>n+p.indices.length,0);assert.equal(count,selected.length);
  const stamp=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const index=['开始时间,页码,类别,形态,名称,动画标识'];for(const p of journal.pages)for(const i of p.indices){const r=inventory[i];index.push([stamp(p.start),p.page,r.group,r.form,r.name,r.id].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','));}
  fs.writeFileSync(path.join(out,'全部动画时间索引.csv'),'\uFEFF'+index.join('\n')+'\n');
  fs.writeFileSync(path.join(out,'recording-summary.json'),JSON.stringify({complete:true,cases:count,pages:journal.pages.length,duration:journal.pages.reduce((a,p)=>a+p.duration,0),fps,bytes:journal.bytes,groups:inventory.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{}),source:'Shipping React character, original offline SWF runtime; no synthesised animation frames; sampled at 10 fps at original speed.'},null,2));
  console.log('COMPLETE',count,'cases recorded into a single GIF');
 }finally{await browser?.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
