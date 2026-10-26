/** Deterministic review GIFs from the actual browser canvas preview renderer.
 * No release, version tag, installer or shipping renderer is touched. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/v30-preview'),url='http://127.0.0.1:5235';fs.mkdirSync(out,{recursive:true});let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5235','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:900,height:500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.evaluate(async()=>{document.getElementById('root').style.display='none';const m=await import('/scripts/source-motion-preview.mjs');window.motionModule=m;window.motionAssets=await m.loadSourcePreview();const c=document.createElement('canvas');c.id='source-motion-preview';document.body.append(c);window.motionCanvas=c;await document.fonts.ready});
 const meta=await page.evaluate(()=>window.motionAssets.meta);
 for(const [form,spec] of Object.entries(meta.forms))for(const [name,clip]of Object.entries(spec.clips)){assert.equal(clip.frameMap.length,clip.frameCount);assert.equal(clip.poses.length,clip.frameCount);assert.ok(clip.frameMap.every(v=>v>=0&&v<spec.count));assert.equal(clip.poses[0].sourceFrame,1);assert.equal(clip.poses.at(-1).sourceFrame,clip.frameCount);for(const p of clip.poses){assert.ok(p.body.every(x=>x>=0&&x<=256),`${form}/${name} source body clipped`);assert.ok(p.head.every(x=>x>=0&&x<=256));}}
 const greens=await page.evaluate(()=>{const{meta,images}=window.motionAssets,c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');return [0,30,60,100,160,200].map(i=>{const k=meta.forms.middle.clips.boring.frameMap[i];ctx.clearRect(0,0,256,256);ctx.drawImage(images['middle-red'],k%8*256,Math.floor(k/8)*256,256,256,0,0,256,256);const d=ctx.getImageData(0,0,256,256).data;let n=0;for(let j=0;j<d.length;j+=4)if(d[j+1]>d[j]*1.2&&d[j+1]>d[j+2]*1.3&&d[j+3]>50)n++;return n})});assert.ok(greens.every(n=>n>500),'Original moving leaves must remain in insect-free chase frames');
 const allTraces={};
 for(const mode of ['move','drag','butterfly','pet']){
  const duration=await page.evaluate(mode=>{window.motionPlayer=window.motionModule.createSourceMotionPreview(window.motionCanvas,window.motionAssets,mode);return window.motionPlayer.duration},mode);
  const dir=path.join(out,mode+'-frames');fs.mkdirSync(dir,{recursive:true});const count=Math.ceil(duration*24/1000),traces=[];
  for(let i=0;i<count;i++){
   const frame=await page.evaluate(t=>{const trace=window.motionPlayer.render(t);return {png:window.motionCanvas.toDataURL('image/png').split(',')[1],trace}},i/24*1000);
   fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'.png'),Buffer.from(frame.png,'base64'));traces.push(frame.trace);
  }
  const input=path.join(dir,'%04d.png'),movie=path.join(out,mode+'.webm'),gif=path.join(out,mode+'.gif');
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',input,'-frames:v',String(count),'-an','-c:v','libvpx-vp9','-crf','27','-b:v','0',movie]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',input,'-frames:v',String(count),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',gif]);
  allTraces[mode]=traces;console.log(`PASS ${mode}: ${count} browser-rendered source-frame previews; GIF ${fs.statSync(gif).size} bytes`);
 }
 assert.ok(allTraces.move.some(f=>f.trace.some(p=>p.clip==='left')));assert.ok(allTraces.move.some(f=>f.trace.some(p=>p.clip==='right')));
 assert.ok(allTraces.pet.some(f=>f.trace.some(p=>p.event==='stroke')));assert.ok(allTraces.butterfly.some(f=>f.trace.some(p=>p.event==='butterfly')));assert.deepEqual(errors,[]);
 for(const form of ['junior','middle']){const ys=allTraces.move.flatMap(f=>f.trace.filter(p=>p.form===form&&p.held).map(p=>p.body[1]));assert.ok(Math.max(...ys)-Math.min(...ys)<.01,`${form} held path must not hop vertically`)}
 assert.ok(allTraces.pet.every(f=>f.trace.filter(p=>p.form==='super').every(p=>p.clip!=='happy')),'Super affection must not use the wide-mouth laughter clip');
 fs.writeFileSync(path.join(out,'recording-checks.json'),JSON.stringify({sourceSHA256:meta.sourceSHA256,fps:24,frames:Object.fromEntries(Object.entries(allTraces).map(([k,v])=>[k,v.length])),errors},null,2)+'\n');
 console.log('PASS: original full timelines, source turns, original pupils/expressions and separate interaction props; no shipping application or release changes');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
