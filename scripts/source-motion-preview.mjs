/** REVIEW ONLY. Complete original source frames plus clearly separate props.
 * This module is not imported by the application or its release bundle. */
const BASE='/artifacts/v30-source/';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const pulse=(t,c,w)=>ease(1-Math.abs(t-c)/w);
export const PREVIEW_DURATIONS={move:6400,drag:6400,butterfly:10200,pet:5600};
const LABELS={seed:'种子',junior:'初级',middle:'中级',senior:'高级',super:'神力超拉'};

export function travel(t){
 if(t<700)return {x:0,direction:0,held:false,phase:'先看清原来的样子'};
 if(t<1900)return {x:44*ease((t-700)/1200),direction:1,held:true,phase:'向右 · 原版侧脸与身体动作'};
 if(t<2850)return {x:44-82*ease((t-1900)/950),direction:-1,held:true,phase:'换向 · 回头再往左'};
 if(t<3500)return {x:-38+38*ease((t-2850)/650),direction:1,held:true,phase:'再轻轻拉回来'};
 return {x:0,direction:0,held:false,phase:t<4400?'松手 · 落稳，收回叶片':'放好了，继续陪着你'};
}
export function sourcePose(meta,form,action,elapsed,{loop=true}={}){
 const spec=meta.forms[form],clip=spec.clips[action];
 if(!clip)throw Error(`Missing original clip ${form}/${action}`);
 const frame=loop?Math.floor(Math.max(0,elapsed)*meta.fps/1000)%clip.frameCount:clamp(Math.floor(Math.max(0,elapsed)*meta.fps/1000),0,clip.frameCount-1);
 return {cell:clip.frameMap[frame],frame,pose:clip.poses[frame],clip};
}
export function dragPose(meta,form,t,adapted){
 const motion=travel(t);let action=motion.direction<0?'left':motion.direction>0?'right':'down',elapsed=t-(t<1900?700:t<2850?1980:2930);
 // A real front view bridges the two source side views at a reversal.
 if(t>=1900&&t<1980||t>=2850&&t<2930){action='down';elapsed=0}
 const spec=meta.forms[form];
 let result=sourcePose(meta,form,action,elapsed);
 if(!motion.held){result= t>=3500&&t<3500+spec.clips.down.frameCount/meta.fps*1000?sourcePose(meta,form,'down',t-3500,{loop:false}):sourcePose(meta,form,'down',spec.canonical/meta.fps*1000,{loop:false})}
 const horizontalOnly=adapted&&['junior','middle'].includes(form);
 // The walking timeline itself changes body height. A held pet uses one
 // registered side pose, not a walking cycle with its vertical offset hidden.
 if(horizontalOnly)result=sourcePose(meta,form,motion.held?action:'down',0,{loop:false});
 const lift=adapted&&!horizontalOnly?-13*ease((t-700)/180)*ease((3500-t)/180):0;
 const velocity=(travel(t+8).x-travel(t-8).x)/16,strength=clamp(Math.abs(velocity)*8);
 const lag=adapted&&motion.held?-Math.sign(velocity)*3.5*strength:0;
 const release=adapted&&!horizontalOnly&&t>=3500?Math.sin((t-3500)/1000*Math.PI*4)*Math.exp(-(t-3500)/210)*4:0;
 return {...result,action,x:motion.x+lag,y:lift+release,angle:adapted&&motion.held&&!horizontalOnly?-Math.sign(velocity)*1.8*strength:0,motion};
}
export function affectionPose(meta,form,t){
 if(meta.forms[form].clips.affection){
  const elapsed=t<2450?t-550:t-2450,active=elapsed>=0&&elapsed<1900;
  const frame=Math.max(0,Math.min(7,Math.floor(Math.max(0,elapsed)/1900*8)));
  return {...sourcePose(meta,form,active?'affection':'down',active?frame/meta.fps*1000:0,{loop:false}),active};
 }
 // The source super/happy performance is a large laugh and wide crown roll.
 // A stroke should use its normal small-faced hovering cycle instead.
 if(form==='super')return {...sourcePose(meta,form,'down',Math.max(0,t-550)),active:t>=550&&t<3700};
 const spec=meta.forms[form];const duration=spec.clips.happy.frameCount/meta.fps*1000;
 let since=t-550;if(duration<1900&&t>=2450)since=t-2450;
 const active=since>=0&&since<duration;
 return {...sourcePose(meta,form,active?'happy':'down',active?since:spec.canonical/meta.fps*1000,{loop:false}),active};
}

async function loadImage(path){const im=new Image();im.src=path;await im.decode();return im}
export async function loadSourcePreview(){
 const response=await fetch(BASE+'manifest.json');if(!response.ok)throw Error('Preview source manifest missing');const meta=await response.json();
 const keys=[...Object.keys(meta.forms).map(f=>f+'-red'),'middle-boring-original','seed-red','hand-ready','hand-stroke','hand-leave','net','butterfly-0','butterfly-1','butterfly-2','butterfly-3'];
 const entries=await Promise.all(keys.map(async k=>[k,await loadImage(BASE+k+'.png')]));const images=Object.fromEntries(entries);
 const affection=await (await fetch('/assets/original/affection/source.json')).json();
 for(const form of Object.keys(meta.forms)){
  const [neutral,mask]=await Promise.all(['neutral','mask'].map(k=>loadImage(`/assets/original/affection/${form}-${k}.png`)));
  const c=document.createElement('canvas');c.width=1536;c.height=208;const context=c.getContext('2d');context.drawImage(mask,0,0);const m=context.getImageData(0,0,c.width,c.height).data;context.clearRect(0,0,c.width,c.height);context.drawImage(neutral,0,0);const n=context.getImageData(0,0,c.width,c.height);
  const ds=[255,204,153].map(b=>[255,-199,-250].map(v=>Math.max(0,Math.min(255,b+v))-b));
  for(let i=0;i<n.data.length;i+=4)for(let k=0;k<3;k++)n.data[i+k]=Math.max(0,Math.min(255,n.data[i+k]+ds[0][k]*m[i]/255+ds[1][k]*m[i+1]/255+ds[2][k]*m[i+2]/255));context.putImageData(n,0,0);
  const atlas=document.createElement('canvas');atlas.width=256*8;atlas.height=256;const a=atlas.getContext('2d'),poses=[];
  for(let frame=0;frame<8;frame++){
   a.drawImage(c,frame*192,0,192,208,frame*256+32,24,192,208);
   const pixels=context.getImageData(frame*192,0,192,208).data;let top=208,bottom=0,left=192,right=0,hx=96;
   for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(pixels[(y*192+x)*4+3]>100){if(y<top){top=y;hx=x}left=Math.min(left,x);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1)}
   poses.push({body:affection.forms[form].body[frame].map((v,i)=>v+(i%2?24:32)),art:[left+32,top+24,right+32,bottom+24],head:[hx+32,top+24],sourceFrame:affection.forms[form].sourceFrames[frame]});
  }
  images[form+'-affection-red']=atlas;meta.forms[form].clips.affection={kind:'affection',frameCount:8,frameMap:[0,1,2,3,4,5,6,7],poses};
 }
 return {meta,images,pot:await loadImage('/assets/original/seed/pot.png')};
}

export function createSourceMotionPreview(canvas,assets,mode){
 if(!Object.hasOwn(PREVIEW_DURATIONS,mode))throw Error('Unknown preview');
 const {meta,images}=assets,ctx=canvas.getContext('2d'),size=256;let trace=[];
 canvas.width=mode==='move'?720:mode==='butterfly'?760:850;canvas.height=mode==='move'?440:mode==='butterfly'?320:300;
 const text=(str,x,y,size=15,color='#795b39')=>{ctx.fillStyle=color;ctx.font=`500 ${size}px "Noto Sans CJK SC",sans-serif`;ctx.textAlign='center';ctx.fillText(str,x,y)};
 const sprite=(image,index,x,y,w,h,cols=8,cell=256)=>ctx.drawImage(image,index%cols*cell,Math.floor(index/cols)*cell,cell,cell,x,y,w,h);
 function body(form,result,cx,baseY,scale=0.6,rotation=0,original=false,paint=true,held=false){
  const grip=b=>[(b[0]+b[2])/2,b[1]];
  const canonical=meta.forms[form].clips.down.poses[meta.forms[form].canonical],cg=grip(canonical.body),g=grip(result.pose.body);
  const cursor=[cx+(cg[0]-128)*scale,baseY+(cg[1]-195)*scale];
  if(['junior','middle'].includes(form)&&mode!=='pet'&&mode!=='butterfly'){cx-=(g[0]-cg[0])*scale;baseY-=(result.pose.body[3]-canonical.body[3])*scale}else if(held){cx-=(g[0]-cg[0])*scale;baseY-=(g[1]-cg[1])*scale}
  const x=cx-128*scale,y=baseY-195*scale;
  const pivot=held?[x+g[0]*scale,y+g[1]*scale]:[cx,baseY];
  if(paint){ctx.save();ctx.translate(...pivot);ctx.rotate(rotation*Math.PI/180);ctx.translate(-pivot[0],-pivot[1]);
  sprite(images[original?'middle-boring-original':result.clip.kind==='affection'?form+'-affection-red':form+'-red'],original?result.frame:result.cell,x,y,size*scale,size*scale);ctx.restore();}
  const project=b=>[x+b[0]*scale,y+b[1]*scale,x+b[2]*scale,y+b[3]*scale];
  if(paint)trace.push({form,clip:result.action??(result.clip===meta.forms[form].clips.happy?'happy':original?'original-boring':'source'),sourceFrame:result.pose.sourceFrame,held,body:project(result.pose.body)});
  return {x,y,scale,body:project(result.pose.body),art:project(result.pose.art),head:[x+result.pose.head[0]*scale,y+result.pose.head[1]*scale],cursor,result};
 }
 function hand(anchor,t){
  let age=t<1850?t-180:t-2080;const active=age>=0&&age<1500;if(!active)return;
  const arrive=ease(age/370),leave=ease((age-1020)/350),contact=age>370&&age<1020;
  const image=images[contact?'hand-stroke':age<370?'hand-ready':'hand-leave'];
  const width=42,height=width*image.naturalHeight/image.naturalWidth;
  const stroke=contact?Math.sin((age-370)/650*Math.PI*2)*4:0;
  const cx=anchor.head[0]+stroke+32*(1-arrive)+24*leave;
  const crown=anchor.head[1];
  const cy=crown+2-24*(1-arrive)-20*leave;
  ctx.save();ctx.globalAlpha=ease(age/180)*(1-ease((age-1200)/270));ctx.drawImage(image,cx-width*.24,cy-height*.82,width,height);ctx.restore();
  if(contact)trace.push({event:'stroke',x:cx,y:cy,headY:crown});
 }
 function seed(cx,baseY,scale,t,held=false){
  const x=cx-128*scale,y=baseY-222*scale;
  ctx.drawImage(assets.pot,x+68*scale,y+119*scale,119*scale,103*scale);
  const frame=held?(mode==='pet'?[0,1,2,4,4,2,1,0][Math.min(7,Math.floor(Math.max(0,t-550)/400))]:Math.floor(Math.max(0,t)*24/1000)%24):0;
  ctx.drawImage(images['seed-red'],frame%8*96,Math.floor(frame/8)*99,96,99,x+83*scale,y+60*scale,96*scale,99*scale);
  return {body:[x+88*scale,y+68*scale,x+170*scale,y+151*scale],art:[x+83*scale,y+60*scale,x+179*scale,y+159*scale],head:[cx,y+73*scale],x,y,scale};
 }
 function heart(x,y,opacity){
  ctx.save();ctx.globalAlpha=clamp(opacity);ctx.font='22px sans-serif';ctx.fillStyle='#ef6b7e';ctx.textAlign='center';ctx.fillText('♥',x,y);ctx.restore();
 }
 function moving(t){
  text('拿起之前  /  水平拖拽与松手',canvas.width/2,30,18);text(travel(t).phase,canvas.width/2,56,13);
  for(let row=0;row<2;row++){
   const form=row?'middle':'junior',baseline=191+row*180;
   for(let col=0;col<2;col++){
    const adapted=col===1,p=adapted?dragPose(meta,form,t,true):{...dragPose(meta,form,0,true),x:0,y:0,angle:0},cx=180+col*360+p.x;
    if(!adapted){ctx.fillStyle='#745b4820';ctx.beginPath();ctx.ellipse(cx,baseline+3,27,5,0,0,Math.PI*2);ctx.fill()}
    const a=body(form,p,cx,baseline+p.y,.68,p.angle,false,true,adapted&&p.motion.held);
    if(adapted&&p.motion.held){ctx.strokeStyle='#8a6846';ctx.lineWidth=1.6;ctx.fillStyle='#fff9';ctx.beginPath();ctx.arc(a.cursor[0]+p.motion.x-p.x,a.cursor[1],4,0,Math.PI*2);ctx.fill();ctx.stroke()}
    text(`${LABELS[form]} · ${adapted?'拖动 / 松手':'安静站好'}`,180+col*360,baseline+33,14);
   }
  }
 }
 function dragging(t){
  text('手动拖拽 · 五阶段动作预览',425,30,18);text(travel(t).phase,425,57,13);
  ['seed','junior','middle','senior','super'].forEach((form,i)=>{
   const m=travel(t),cx=85+i*170+m.x*.65,base=213;
   let anchor;
   if(form==='seed'){anchor=seed(cx,base,.55,t,m.held);anchor.cursor=[cx,anchor.body[1]+8]}
   else{const p=dragPose(meta,form,t,true);anchor=body(form,p,cx+(p.x-m.x)*.65,base+p.y,.55,p.angle,false,true,m.held)}
   if(m.held){ctx.strokeStyle='#8a6846';ctx.fillStyle='#fff9';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...anchor.cursor,3.5,0,Math.PI*2);ctx.fill();ctx.stroke()}
   text(LABELS[form],85+i*170,266,14);
  });
 }
 function petting(t){
  text('摸摸 · 闭眼享受，轻轻靠向手掌',425,30,18);text(t<550?'手伸过来，拉姆看见你了':t<1650?'摸到啦，身体和叶片一起回应':t<2450?'它还在开心地晃着呢':t<3650?'再摸一下，软软地靠过来':'好啦，继续陪你',425,57,13);
  ['seed','junior','middle','senior','super'].forEach((form,i)=>{
   const cx=85+i*170,base=218;
   let x=cx,y=base;
   if(form==='super'){
    const pose=affectionPose(meta,form,t).pose.body,rest=meta.forms.super.clips.down.poses[0].body;
    y-=(pose[3]-rest[3])*.6;
    x-=((pose[0]+pose[2]-rest[0]-rest[2])/2)*.6;
    y+=Math.sin(t/1100)*.7;
   }
   const a=form==='seed'?seed(cx,base,.6,t,t>550&&t<3700):body(form,affectionPose(meta,form,t),x,y,.6);
   hand(a,t);
   const thanks=pulse(t,4100,600);if(thanks>0)heart(cx+20,a.art[1]-8-ease((t-3500)/1200)*16,thanks);
   text(LABELS[form],cx,266,14);
  });
 }
 function butterfly(t){
  text('中级追蝶 · 原版追虫动作改编',380,29,18);
  const elapsed=clamp(t-550,0,meta.forms.middle.clips.boring.frameCount/meta.fps*1000-1),p={...sourcePose(meta,'middle','boring',elapsed,{loop:false}),action:'boring'};
  const clock=elapsed/1000;
  text(t<550?'先发现它':clock<2?'抬头看见它，慢慢凑近':clock<4.5?'挥网扑空了，回头再找找':clock<7?'再试一次，它又绕开啦':'目送它飞走，下次再一起玩',380,54,13);
  body('middle',p,190,237,.88,0,true);const right=body('middle',p,570,237,.88,0,false,false);
  text('原著完整追虫动作',190,294,14);text('追蝴蝶适配 · 角色保留原帧',570,294,14);
  const route=p.clip.insect;
  function pointAt(index){const pt=route[index];if(!pt)return null;const b=p.clip.poses[index].body,mid=(b[0]+b[2])/2;return [570+(pt[0]-mid)*right.scale*.8,Math.max(114,Math.min(right.y+pt[1]*right.scale,right.art[1]-12))]}
  let insect=pointAt(p.frame);
  // The original fly leaves the scene between its two passes. Continue the
  // butterfly through the edge instead of making it blink out next to a leaf.
  if(!insect&&p.frame>88&&p.frame<=102){const a=pointAt(88);if(a)insect=[a[0]-110*ease((p.frame-88)/14),a[1]-14*ease((p.frame-88)/14)]}
  if(!insect&&p.frame>=122&&p.frame<133){const b=pointAt(133);if(b)insect=[350+(b[0]-350)*ease((p.frame-122)/11),98+(b[1]-98)*ease((p.frame-122)/11)]}
  if(!insect&&p.frame>164&&p.frame<190){const a=pointAt(164);if(a)insect=[a[0]-230*ease((p.frame-164)/25),a[1]-22*ease((p.frame-164)/25)]}
  function drawButterfly(){if(insect&&t>=550){
   const bx=insect[0],by=insect[1]+Math.sin(elapsed/230)*3-26*(pulse(elapsed,1900,200)+pulse(elapsed,6100,200));
   const appear=ease((t-1350)/250)*ease((10000-t)/250);
   // The butterfly follows the SOURCE insect's route, so the original pupil
   // direction, head turn and leaf reactions still look at the same target.
   const image=images['butterfly-'+Math.floor(t/75)%4],width=48;
   ctx.save();ctx.beginPath();ctx.rect(380,60,380,220);ctx.clip();ctx.globalAlpha=appear;ctx.translate(bx,by);ctx.rotate(Math.sin(t/270)*.1);ctx.drawImage(image,-width/2,-width/2,width,width);ctx.restore();
   trace.push({event:'butterfly',sourceFrame:p.pose.sourceFrame,x:bx,y:by});
  }}
  // Grip stays on the lower side of the body, below the face. The hoop swings
  // toward the source target, then passes BEHIND it: these are two misses.
  const first=elapsed<4500,swing=pulse(elapsed,first?1900:6100,500),gripX=first?right.body[2]+2:right.body[0]-2,gripY=right.body[1]+(right.body[3]-right.body[1])*.85-20*swing;
  const net=images.net,width=88,height=width*net.naturalHeight/net.naturalWidth;
  const angle=(first?105-40*swing:-15+25*swing)*Math.PI/180;
  ctx.save();ctx.globalAlpha=ease((t-650)/350)*ease((10100-t)/350)*(1-pulse(elapsed,4500,430));ctx.translate(gripX,gripY);ctx.rotate(angle);ctx.drawImage(net,-width*.93,-height*.94,width,height);ctx.restore();
  body('middle',p,570,237,.88);drawButterfly();
  // Keep the approved football playback untouched; only these review props
  // and character clips are involved in this new preview.
 }
 return {duration:PREVIEW_DURATIONS[mode],render(t){
  trace=[];ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7f2e6';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(mode==='move')moving(t);else if(mode==='drag')dragging(t);else if(mode==='pet')petting(t);else butterfly(t);
  return {t,mode,trace};
 }};
}
