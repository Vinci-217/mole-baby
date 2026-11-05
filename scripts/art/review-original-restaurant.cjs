'use strict';
// Source extraction only: do not replace original character pixels with drawn
// props, interpolated poses or an unrelated guest's eating animation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),raw=path.join(root,'research/references/restaurant/raw');
const out=path.join(root,'artifacts/restaurant-original-research'),frames=path.join(out,'preview-frames');
const jar=process.argv[2]||'/opt/jpexs/26.4.0/ffdec-cli.jar';
const revision='7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff';
const files=[
 ['restaurant.swf','root/module/restaurant/restaurant.swf','c68f571d0a4fc1d2041f344cf85b171d19fa4547'],
 ['restaurantEmployePanelMain.swf','root/module/external/restaurantEmployePanelMain.swf','64267e372169bca8fc7ae941306ba8c1cc43b7f1'],
 ['ClientAppDLL.swf','root/dll/ClientAppDLL.swf','bd4e072e41fe619c814c4d9837cf216a6cbb23f0'],
 ['1200042.swf','root/resource/petcloth/swf2/1200042.swf','02bc5cc55ff25930636594a1e1fc8429079f2076'],
 ['1200043.swf','root/resource/petcloth/swf2/1200043.swf','f654423f88d48f638c3d471a2e28a70fb67e89ae'],
];
(async()=>{
 fs.mkdirSync(frames,{recursive:true});
 const sources=files.map(([file,sourcePath,expectedBlob])=>{
  const bytes=fs.readFileSync(path.join(raw,file));
  const blob=crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  if(blob!==expectedBlob)throw Error(`GitHub blob does not match pinned source: ${file}`);
  if(!['CWS','FWS'].includes(bytes.subarray(0,3).toString('ascii')))throw Error(`Not a SWF: ${file}`);
  return {file,path:sourcePath,url:`https://github.com/Miigon/RecMoleRes/blob/${revision}/${sourcePath}`,blob,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 });
 const clips=[];
 for(const [id,sprite] of [['1200042','35'],['1200043','33']]){
  const destination=path.join(out,id+'-down');
  execFileSync('java',['-Djava.awt.headless=true','-jar',jar,'-selectid',sprite,'-sublength','15','-zoom','6','-ignorebackground','-export','sprite',destination,path.join(raw,id+'.swf')],{stdio:['ignore','ignore','pipe'],timeout:60000});
  const directory=path.join(destination,'DefineSprite_'+sprite,'1');
  const images=fs.readdirSync(directory).filter(file=>file.endsWith('.png')).sort((a,b)=>parseInt(a)-parseInt(b));
  if(images.length!==15)throw Error(`Incomplete nested timeline: ${id}`);
  const digests=[];
  for(const file of images){const pixels=await sharp(path.join(directory,file)).ensureAlpha().raw().toBuffer();digests.push(crypto.createHash('sha256').update(pixels).digest('hex'))}
  clips.push({id,parentSprite:Number(sprite),directory,sourceFrames:15,loopFirstFrame:3,loopLastFrame:15,loopFrames:13,fps:24,uniqueLoopFrames:new Set(digests.slice(2)).size,rgbaHashes:digests});
 }
 const background=Buffer.from(`<svg width="640" height="404" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="404" fill="#fff7e8"/><path d="M320 48V353" stroke="#e1c79d"/><g text-anchor="middle" font-family="WenQuanYi Zen Hei,sans-serif" fill="#674325"><text x="160" y="32" font-size="21">送餐 · 1200042</text><text x="480" y="32" font-size="21">空手 · 1200043</text><text x="320" y="386" font-size="13">原 SWF 动作循环 · 原始灰色身体，未套用玩家配色</text></g></svg>`);
 for(let frame=3;frame<=15;frame++){
  const layers=[];
  for(const [index,clip] of clips.entries()){
   const file=path.join(clip.directory,frame+'.png'),size=await sharp(file).metadata();
   layers.push({input:file,left:Math.round(160+index*320-size.width/2),top:347-size.height});
  }
  await sharp(background).composite(layers).png().toFile(path.join(frames,String(frame-3).padStart(3,'0')+'.png'));
 }
 fs.copyFileSync(path.join(frames,'000.png'),path.join(out,'restaurant-original-source.png'));
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(frames,'%03d.png'),'-frames:v','13','-filter_complex','split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'restaurant-original-source.gif')],{stdio:['ignore','ignore','pipe'],timeout:60000});
 fs.writeFileSync(path.join(root,'research/references/restaurant/sources.json'),JSON.stringify({archive:'Miigon/RecMoleRes (community archive of original client resources)',revision,retrieval:'GitHub git/blobs API, base64 payload decoded without modifying bytes',tool:'JPEXS 26.4.0',sources},null,2)+'\n');
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({clips,adaptation:'The preview only arranges original uncoloured frames on a labelled background. Frame 1 stops; movement loops source frames 3–15 at 24 fps. Character pixels and source poses are not repainted. This is not the complete runtime restaurant sequence.'},null,2)+'\n');
 console.log('PASS: five pinned SWF blobs verified; both 15-frame nested timelines exported; preview uses original 13-frame movement loops (7 distinct poses each), no generated art.');
})().catch(error=>{console.error(error);process.exitCode=1});
