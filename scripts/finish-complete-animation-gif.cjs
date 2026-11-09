/** Join independently recorded chapters without re-encoding source artwork. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'artifacts/complete-animation-review'),tailFolder=path.join(root,'artifacts/complete-animation-native-tail'),wardrobeFolder=path.join(root,'artifacts/complete-animation-wardrobe-full'),name='全部拉姆动画总览.gif';
function readGif(file,skipFrames=0){
 const data=fs.readFileSync(file);assert.equal(data.subarray(0,6).toString(),'GIF89a');const packed=data[10],headerEnd=13+(packed&128?3*2**((packed&7)+1):0);let p=headerEnd,frames=0,keptFrames=0,duration=0,delay=0,pending=[];const blocks=[];
 const skip=()=>{for(;;){const n=data[p++];assert(p<=data.length);if(!n)break;p+=n;assert(p<=data.length)}};
 while(p<data.length){const start=p,tag=data[p++];if(tag===59)break;
  if(tag===33){const label=data[p++];if(label===249)delay=data.readUInt16LE(p+2)/100;skip();if(label!==255)pending.push(data.subarray(start,p));}
  else if(tag===44){p+=9;const flags=data[start+9];assert(flags&128,'Every joined frame has its own palette');p+=3*2**((flags&7)+1);p++;skip();frames++;if(frames>skipFrames){blocks.push(...pending,data.subarray(start,p));keptFrames++;duration+=delay;}pending=[];}
  else throw Error('Invalid GIF data at '+start);
 }
 assert.equal(data.at(-1),59,'Completed GIF trailer');return {data,header:data.subarray(0,headerEnd),blocks,frames,keptFrames,duration};
}
const output=path.join(folder,name),summaryFile=path.join(folder,'recording-summary.json');
if(!fs.existsSync(summaryFile)||!JSON.parse(fs.readFileSync(summaryFile)).complete){
 const a=JSON.parse(fs.readFileSync(path.join(folder,'recording-checks.json'))),b=JSON.parse(fs.readFileSync(path.join(tailFolder,'recording-checks.json'))),c=JSON.parse(fs.readFileSync(path.join(wardrobeFolder,'recording-checks.json')));
 assert.equal(a.pages.length,54,'Nine complete form chapters');assert.equal(b.pages.length,b.totalPages,'Original/item chapters complete');assert.equal(c.pages.length,c.totalPages,'Full wardrobe gestures complete');
 const inventory=a.inventory,oldClothes=b.pages.filter(p=>p.indices.every(i=>inventory[i].kind==='outfit'));
 assert.equal(oldClothes.length,18);assert.deepEqual(c.pages.flatMap(p=>p.indices),oldClothes.flatMap(p=>p.indices));
 const rest=b.pages.slice(oldClothes.length),pages=[...a.pages,...c.pages,...rest],ids=pages.flatMap(p=>p.indices);
 assert.equal(ids.length,inventory.length);assert.equal(new Set(ids).size,inventory.length);assert(ids.every((id,i)=>id===i),'No omissions, duplicates, or reordering');
 fs.truncateSync(output,a.bytes);const x=readGif(output),z=readGif(path.join(wardrobeFolder,name)),skipFrames=oldClothes.reduce((n,p)=>n+p.frames,0),y=readGif(path.join(tailFolder,name),skipFrames);
 assert(x.header.equals(y.header)&&x.header.equals(z.header),'Global dimensions and palette match');
 assert.equal(x.frames,a.pages.reduce((n,p)=>n+p.frames,0));assert.equal(y.frames,b.pages.reduce((n,p)=>n+p.frames,0));assert.equal(z.frames,c.pages.reduce((n,p)=>n+p.frames,0));
 let cursor=0;for(const page of pages){page.start=cursor;cursor+=page.duration;}
 assert(Math.abs(x.duration+y.duration+z.duration-cursor)<.2,'Frame delays preserve playback speed');
 // All replacement blocks are already validated and held in memory. Release
 // only these reproducible intermediates before appending on a small disk.
 fs.copyFileSync(path.join(folder,'recording-checks.json'),path.join(folder,'prefix-recording-checks.json'));
 fs.unlinkSync(path.join(tailFolder,name));fs.unlinkSync(path.join(wardrobeFolder,name));
 const handle=fs.openSync(output,'r+');try{let offset=a.bytes-1;for(const group of [z.blocks,y.blocks])for(const block of group){fs.writeSync(handle,block,0,block.length,offset);offset+=block.length;}fs.writeSync(handle,Buffer.from([59]),0,1,offset);fs.ftruncateSync(handle,offset+1);fs.fsyncSync(handle);}finally{fs.closeSync(handle)}
 const stamp=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
 const formNames={seed:'种子',junior:'初级拉姆',middle:'中级拉姆',senior:'高级拉姆',classic:'经典超级拉姆',super:'神力超级拉姆',water:'神奇水系拉姆',wood:'弹力木系拉姆',fire:'霹雳火系拉姆'};
 const csv=['开始时间,页码,类别,形态,名称,动画标识'];for(const p of pages)for(const i of p.indices){const r=inventory[i];csv.push([stamp(p.start),p.page,r.group,formNames[r.form]??r.form,r.name,r.id].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','));}
 fs.writeFileSync(path.join(folder,'全部动画时间索引.csv'),'\uFEFF'+csv.join('\n')+'\n');
 const summary={complete:true,cases:inventory.length,pages:pages.length,frames:x.frames+y.keptFrames+z.frames,duration:cursor,fps:a.fps,width:a.width,height:a.height,bytes:fs.statSync(output).size,groups:inventory.reduce((r,c)=>(r[c.kind]=(r[c.kind]||0)+1,r),{}),recordingEngines:[a.engine,c.engine,b.engine],fullClothedPetting:true,source:'Shipping React character and original offline SWF renderer, sampled at 10 fps at original speed; no redrawn artwork. Wardrobe phases include the full 2.4-second petting action.'};
 fs.writeFileSync(summaryFile,JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(path.join(folder,'recording-checks.json'),JSON.stringify({...a,complete:true,pages,bytes:summary.bytes,recordingEngines:summary.recordingEngines},null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
}
execFileSync('ffmpeg',['-v','error','-xerror','-err_detect','explode','-y','-i',output,'-vf','scale=960:-2:flags=lanczos','-c:v','libx264','-crf','29','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(folder,'全部拉姆动画总览.mp4')],{stdio:'inherit'});
console.log('PASS one complete GIF, seekable MP4, and full time index');
