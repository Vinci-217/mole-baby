'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/restaurant-loop'),metadata=JSON.parse(fs.readFileSync(path.join(out,'poses.json')));
const frames=path.join(out,'frames'),FPS=24,COUNT=264,SCALE=2.25;fs.mkdirSync(frames,{recursive:true});
const A={x:479,y:477},B={x:427,y:415},C={x:660,y:477};
const point=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function state(frame){const t=frame/FPS;
 if(t<1)return{id:'1200043',direction:'left',position:A,moving:false,phase:0};
 if(t<3)return{id:'1200043',direction:'leftup',position:point(A,B,(t-1)/2),moving:true,phase:1};
 if(t<3.6)return{id:t<3.3?'1200043':'1200042',direction:'rightdown',position:B,moving:false,phase:2};
 if(t<6.4)return{id:'1200042',direction:'rightdown',position:point(B,C,(t-3.6)/2.8),moving:true,phase:3};
 if(t<7)return{id:t<6.7?'1200042':'1200043',direction:'rightdown',position:C,moving:false,phase:4};
 if(t<9.4)return{id:'1200043',direction:'left',position:point(C,A,(t-7)/2.4),moving:true,phase:5};
 return{id:'1200043',direction:'left',position:A,moving:false,phase:0};
}
const labels=['等待接单','前往备餐台','取餐','端盘送餐','放下餐盘','空手返回'];
(async()=>{
 const poses={},hashes=[];let ground=-Infinity;
 for(const [id,directions]of Object.entries(metadata.actors))for(const [direction,spec]of Object.entries(directions)){
  const list=[];
  for(let index=1;index<=15;index++){
   const source=path.join(spec.directory,index+'.png'),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let bottom=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>40)bottom=Math.max(bottom,y+1);
   ground=Math.max(ground,spec.boundsTwips[1]/20+bottom/spec.zoom);
   list.push(await sharp(source).resize({width:Math.round(info.width/spec.zoom*SCALE)}).png().toBuffer());
  }
  poses[id+'/'+direction]={...spec,images:list};
 }
 const room=await sharp(metadata.room).png().toBuffer(),dish=await sharp(metadata.dish).trim().resize({width:41}).png().toBuffer();
 const dishSize=await sharp(dish).metadata();
 const base=Buffer.from('<svg width="960" height="624" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="624" fill="#f9eed9"/></svg>');
 const phases=[];
 for(let frame=0;frame<COUNT;frame++){
  const s=state(frame),pose=poses[s.id+'/'+s.direction],sourceIndex=s.moving?2+Math.floor(frame)%13:1;
  const position=s.position,t=frame/FPS,layers=[{input:room,left:0,top:42}];
  const plateAlpha=t>=6.7&&t<8.9?1:t>=8.9&&t<9.35?(9.35-t)/.45:0;
  if(plateAlpha>0){let plate=dish;if(plateAlpha<1){const {data,info}=await sharp(dish).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let p=3;p<data.length;p+=4)data[p]=Math.round(data[p]*plateAlpha);plate=await sharp(data,{raw:info}).png().toBuffer()}layers.push({input:plate,left:Math.round(632-dishSize.width/2),top:42+409-dishSize.height})}
  const left=Math.round(position.x+pose.boundsTwips[0]/20*SCALE),top=Math.round(42+position.y-ground*SCALE+pose.boundsTwips[1]/20*SCALE);
  layers.push({input:pose.images[sourceIndex],left,top});
  const header=Buffer.from(`<svg width="960" height="624" xmlns="http://www.w3.org/2000/svg"><g font-family="WenQuanYi Zen Hei,sans-serif"><text x="24" y="28" font-size="18" fill="#68462b">拉姆餐厅 · 完整送餐流程</text><rect x="754" y="7" rx="12" width="182" height="28" fill="#e3c58a"/><text x="845" y="27" text-anchor="middle" font-size="14" fill="#67431f">${labels[s.phase]}</text><text x="480" y="619" text-anchor="middle" font-size="12" fill="#957957">原版角色、服装、场景与餐盘 · 路线、节奏和演示清台为本地编排</text></g></svg>`);
  layers.push({input:header,left:0,top:0});
  const buffer=await sharp(base).composite(layers).png({compressionLevel:2}).toBuffer();
  fs.writeFileSync(path.join(frames,String(frame).padStart(4,'0')+'.png'),buffer);
  hashes.push(crypto.createHash('sha256').update(buffer).digest('hex'));phases.push(s.phase);
 }
 if(hashes[0]!==hashes.at(-1))throw Error('Loop endpoints do not match');
 if(new Set(phases).size!==6)throw Error('A delivery phase is missing');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',path.join(frames,'%04d.png'),'-frames:v',String(COUNT),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'restaurant-loop.mp4')],{timeout:120000});
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(out,'restaurant-loop.mp4'),'-vf','crop=500:300:300:282,scale=1000:600:flags=lanczos','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'restaurant-loop-closeup.mp4')],{timeout:120000});
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',path.join(frames,'%04d.png'),'-frames:v',String(COUNT),'-filter_complex','scale=720:-1,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'restaurant-loop.gif')],{timeout:120000});
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',path.join(out,'restaurant-loop-closeup.mp4'),'-filter_complex','scale=720:-1,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',path.join(out,'restaurant-loop-closeup.gif')],{timeout:120000});
 fs.mkdirSync(path.join(root,'local-assets/demo'),{recursive:true});
 for(const file of ['restaurant-loop.mp4','restaurant-loop-closeup.mp4'])fs.copyFileSync(path.join(out,file),path.join(root,'local-assets/demo',file));
 fs.writeFileSync(path.join(out,'loop-checks.json'),JSON.stringify({fps:FPS,frames:COUNT,durationSeconds:COUNT/FPS,phases:labels,firstFrameSha256:hashes[0],lastFrameSha256:hashes.at(-1),seamlessEndpointPixels:true,sourceColour:'ClientCommonDLL GV.petColor_3 applied only to original petBone1 instances',sourceScene:'resource/oneBigStree/swf/1330004.swf',sourceFood:'resource/restaurant/swf/1340002.swf, mc frame 6',adaptation:metadata.adaptation,automaticClearing:'The served dish is cleared before the next demo cycle. The official runtime clears it via the guest eating flow.'},null,2)+'\n');
 console.log('PASS 264 frames / 11 seconds: six delivery phases; first and last PNG pixels identical; original worker poses, original colour transform, original room and original dish.');
})().catch(error=>{console.error(error);process.exitCode=1});
