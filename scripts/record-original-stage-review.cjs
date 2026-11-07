const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('@playwright/test');const sharp=require('sharp');sharp.concurrency(1);
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/gameplay-originals-review');fs.mkdirSync(out,{recursive:true});
const manifest=require('../public/assets/original/official/manifest.json');
const forms=[['junior','初级拉姆','level2'],['middle','中级拉姆','level3'],['senior','高级拉姆','level4'],['classic','经典超拉','level101'],['super','神力超拉','level101_7'],['water','水系拉姆','level5_2'],['wood','木系拉姆','level5_4'],['fire','火系拉姆','level5_1']];
const report=[];let browser;
function freezeClock(){const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,now=performance.now.bind(performance);let k=0,frozen=false,time=0,q=new Map();window.requestAnimationFrame=fn=>frozen?(q.set(--k,fn),k):raf.call(window,t=>frozen?q.set(--k,fn):fn(t));window.cancelAnimationFrame=id=>id<0?q.delete(id):caf.call(window,id);window.freezeCapture=()=>{time=now();frozen=true;Object.defineProperty(performance,'now',{value:()=>time,configurable:true})};window.advanceCapture=dt=>{time+=dt;const f=[...q.values()];q.clear();f.forEach(fn=>fn(time))};}
async function capture(clip,form,moving){
 await browser?.close();browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disable-dev-shm-usage','--disable-gpu','--renderer-process-limit=2']});
 const page=await browser.newPage({viewport:{width:200,height:216}});await page.addInitScript(freezeClock);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:5173/assets/original/official/runtime.html?id=${clip.id}&form=${form}&token=stage-review&loop=1&color=-215,-57,31`);
 await page.waitForFunction(()=>window.player?.ruffle().callExternalInterface('previewStatus')?.settled&&window.player?.ruffle().callExternalInterface('previewStatus')?.width>0,{},{timeout:25000});
 const status=await page.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));assert(!status.error);await page.evaluate(()=>{player.ruffle().volume=0;freezeCapture()});
 const encoded=await page.evaluate(async({symbol,form,moving})=>{
  const result=[];player.ruffle().callExternalInterface('previewSymbol',symbol);player.ruffle().callExternalInterface('setBodyColor',-215,-57,31);player.ruffle().callExternalInterface('previewPose',form,'down',false);
  for(let t=0;t<12;t++){advanceCapture(1000/24);await new Promise(r=>setTimeout(r,2))}
  for(let i=0;i<48;i++){
   if(moving&&(i===16||i===32))player.ruffle().callExternalInterface('previewPose',form,i<32?'left':'right',true);
   const state=player.ruffle().callExternalInterface('previewStatus');if(state.ended){player.ruffle().callExternalInterface('previewSymbol',symbol);player.ruffle().callExternalInterface('previewPose',form,'down',false)}
   advanceCapture(1000/12);await new Promise(r=>setTimeout(r,3));result.push(player.shadowRoot.querySelector('canvas').toDataURL('image/png').split(',')[1]);
  }return result;
 },{symbol:clip.symbol,form,moving});
 const frames=await Promise.all(encoded.map(png=>sharp(Buffer.from(png,'base64')).resize(190,206).png().toBuffer()));
 const hashes=new Set(frames.map(frame=>crypto.createHash('sha256').update(frame).digest('hex')));assert(hashes.size>1);assert.deepEqual(errors,[]);
 report.push({id:clip.id,path:clip.path,sha256:clip.sha256,form,uniqueFrames:hashes.size,frames:frames.length,status});await page.close();console.log(form,clip.name,hashes.size);return frames;
}
async function sheet(rows,name,title,subtitle,cols){
 const tileWidth=220,tileHeight=254,width=tileWidth*cols,height=82+Math.ceil(rows.length/cols)*tileHeight,raw=[];
 const head=Buffer.from(`<svg width="${width}" height="82"><rect width="100%" height="100%" fill="#fbf5e8"/><text x="20" y="30" fill="#725633" font-family="sans-serif" font-size="21" font-weight="bold">${title}</text><text x="20" y="57" fill="#9a7e58" font-family="sans-serif" font-size="13">${subtitle}</text></svg>`);
 for(let i=0;i<48;i++){
  const overlays=[{input:head,left:0,top:0}];
  rows.forEach((row,j)=>{const left=(j%cols)*tileWidth,top=82+Math.floor(j/cols)*tileHeight;overlays.push({input:row.frames[i],left:left+15,top:top+6});overlays.push({input:Buffer.from(`<svg width="220" height="36"><text x="110" y="24" text-anchor="middle" fill="#725633" font-family="sans-serif" font-size="15">${row.label}</text></svg>`),left,top:top+212});});
  raw.push(await sharp({create:{width,height,channels:4,background:'#fffdf8'}}).composite(overlays).raw().toBuffer());
 }
 const file=path.join(out,name);await sharp(Buffer.concat(raw),{raw:{width,height:height*48,channels:4,pageHeight:height}}).gif({loop:0,delay:80,effort:3,dither:.5}).toFile(file);const meta=await sharp(file,{animated:true}).metadata();assert.equal(meta.pages,48);return file;
}
(async()=>{
 const book=manifest.clips.find(clip=>clip.kind==='outfit'&&clip.path.endsWith('/1200026.swf'));const rows=[];
 for(const [id,label,form] of forms){assert(book.forms.includes(form));rows.push({label,frames:await capture(book,form,true)});}
 await sheet(rows,'八种成长形态原版魔法书.gif','八种成长形态 · 同一套原版魔法书','原SWF图形与时间轴；依次站立、朝左、朝右；拼图与文字为预览排版',4);
 rows.length=0;
 for(const [id,label,form] of forms.slice(0,4)){
  const level={junior:2,middle:3,senior:4,classic:101}[id],clip=manifest.clips.find(clip=>clip.path===`resource/lahmClassRoom/lahmMovie/pet${level}Movie/14.swf`);rows.push({label,frames:await capture(clip,form,false)});
 }
 await sheet(rows,'四阶段原版自然读书.gif','原版课堂角色 · 已转为自然小动作','各成长阶段使用各自原片；在桌面和小屋不定时展示',4);
 fs.writeFileSync(path.join(out,'stage-captures.json'),JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
