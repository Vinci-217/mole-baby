/** Sweep effective native costume forms and every reachable original action.
 * Sample the actual full playback window, retain pixels for visual review and
 * flag anatomical/edge outliers independently of the reported body rectangle.
 * No save bridge, source artwork mutation, or automatic artwork rescaling. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),manifest=require('../public/assets/original/official/manifest.json');
const vault=path.join(root,'local-assets/ram-official-sweep/2026-11-06'),out=path.join(root,'artifacts/all-animation-sizes');
const label=process.env.AUDIT_LABEL||'before',folder=path.join(out,label),nativeForms={junior:'level2',middle:'level3',senior:'level4',classic:'level101',super:'level101_7',water:'level5_2',wood:'level5_4',fire:'level5_1',seed:'level1'};
const formName=f=>Object.keys(nativeForms).find(k=>nativeForms[k]===f)||'junior';
const catalog=new Map(require(path.join(vault,'catalog.json')).items.map(c=>[c.path,c]));
const reachable=c=>c.kind==='outfit'||c.kind==='care'||c.kind==='magic'||c.kind==='school'&&/\/lahmMovie\/pet\d+Movie\//.test(c.path)||['skill','transform'].includes(c.kind)&&c.animated&&!c.path.includes('/tatter/');
const costumeForm=(c,f)=>[45,65].includes(c.clothingLayer)?'level2':c.forms.includes(f)?f:c.forms.includes('level2')?'level2':['level101','level101_7','level3','level4','level5_2','level5_4','level5_1'].find(f=>c.forms.includes(f));
function duration(c){const cat=catalog.get(c.path);if(!cat)return 6000;const t=JSON.parse(fs.readFileSync(path.join(vault,cat.timelineUrl)));return Math.min(16000,Math.max(1200,...t.timelines.map(t=>t.frames/c.fps*1000)));}
let cases=manifest.clips.filter(reachable).flatMap(c=>{
 const forms=c.kind==='outfit'?[...new Set(Object.values(nativeForms).filter(f=>f!=='level1').map(f=>costumeForm(c,f)))]:[c.forms.includes('level101_7')?'level101_7':c.forms.includes('level4')?'level4':c.forms.includes('level2')?'level2':c.forms.find(f=>f!=='level1')||({1:'level1',2:'level2',3:'level3',4:'level4',101:'level101'}[c.level]||'level2')];
 return forms.filter(Boolean).map(form=>({key:c.id+'-'+form,c,form,reference:form,duration:c.kind==='outfit'?6400:duration(c)+350}));
}).filter(row=>!process.env.AUDIT_KINDS||process.env.AUDIT_KINDS.split(',').includes(row.c.kind)).filter(row=>!process.env.AUDIT_IDS||process.env.AUDIT_IDS.split(',').some(id=>row.c.path.endsWith('/'+id+'.swf')));
const pixelScan=()=>{
 const canvas=player?.shadowRoot.querySelector('canvas');if(!canvas)return null;
 const width=canvas.width,height=canvas.height,ctx=canvas.getContext('2d'),rgba=ctx.getImageData(0,0,width,height).data;
 let ink=0,left=width,top=height,right=-1,bottom=-1;const white=new Uint8Array(width*height),visited=new Uint8Array(width*height),eyes=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=y*width+x,i=p*4;if(rgba[i+3]>128){ink++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(rgba[i]>235&&rgba[i+1]>235&&rgba[i+2]>235)white[p]=1;}
 }
 const queue=new Int32Array(width*height);
 for(let p=0;p<white.length;p++)if(white[p]&&!visited[p]){
  let head=0,tail=1,x0=width,x1=-1,y0=height,y1=-1;queue[0]=p;visited[p]=1;
  while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1);for(const q of [x>0?n-1:-1,x+1<width?n+1:-1,y>0?n-width:-1,y+1<height?n+width:-1])if(q>=0&&white[q]&&!visited[q]){visited[q]=1;queue[tail++]=q;}}
  const w=x1-x0+1,h=y1-y0+1;if(tail>=5&&w>=3&&h>=3&&w/h>.35&&w/h<1.8&&tail/(w*h)>.3)eyes.push({x0,x1,y0,y1,w,h,cx:(x0+x1)/2,cy:(y0+y1)/2,area:tail});
 }
 const state=player.ruffle().callExternalInterface('previewStatus'),b=state?.body,sx=width/1280,sy=height/1382.4,pairs=[];
 if(b){const ratio=3.2/(state.viewportScale||3.2),ox=(1280-400*ratio)/2,oy=(1382.4-432*ratio)/2,cx=(ox+(b.x+b.width/2)*4*ratio)*sx,cy=(oy+(b.y+b.height*.55)*4*ratio)*sy,expected=b.width*4*sx*ratio;
  for(let i=0;i<eyes.length;i++)for(let j=i+1;j<eyes.length;j++){const a=eyes[i],b=eyes[j],gap=Math.abs(a.cx-b.cx),spread=Math.max(a.x1,b.x1)-Math.min(a.x0,b.x0),px=(a.cx+b.cx)/2,py=(a.cy+b.cy)/2;
   if(Math.abs(a.cy-b.cy)>Math.max(a.h,b.h)*.25||a.w/b.w<.6||a.w/b.w>1.7||gap<Math.max(a.w,b.w)*.7||gap>expected*.85||Math.abs(px-cx)>expected*.6||Math.abs(py-cy)>expected*.75)continue;
   const row=Math.round(py),x=Math.round(px);let l=x,r=x;const alpha=x=>rgba[(row*width+x)*4+3];while(l>0&&alpha(l)>128)l--;while(r<width&&alpha(r)>128)r++;
   pairs.push({bodyRowWidth:r-l-1,eyeSpan:spread,expectedBodyWidth:expected,bodyRatio:(r-l-1)/expected,eyeRatio:spread/expected,score:Math.abs(px-cx)/expected+Math.abs(py-cy)/expected});
  }
 }
 pairs.sort((a,b)=>a.score-b.score);
 return {ink,painted:[left,top,right,bottom],touchesStageEdge:ink>0&&(left<2||top<2||right>=width-2||bottom>=height-2),face:pairs[0]||null};
};
async function inspect(page,row){
 await page.goto('http://127.0.0.1:5173/assets/original/official/runtime.html?token=size-sweep');
 const viewportScale=process.env.AUDIT_VIEWPORT==='auto'?(row.c.viewportScale||(['care','magic','skill','transform'].includes(row.c.kind)?8:3.2)):3.2;
 await page.evaluate(({id,form,reference,viewportScale})=>{
  window.sweep={states:[],errors:[],finished:false};
  addEventListener('message',e=>{const d=e.data;if(d.type==='ram-original-state')sweep.states.push(d.value);if(d.type==='ram-original-error')sweep.errors.push(d.value);if(d.type==='ram-original-finished')sweep.finished=true;});
  postMessage({type:'ram-original-load',token:'size-sweep',sequence:1,value:{id,loop:false,registerBody:true,referenceForm:reference,viewportScale,pose:{form,direction:'down',moving:false,color:[-99,-160,-43],sound:false,volume:0}}},'*');
 },{id:row.c.id,form:row.form,reference:row.reference,viewportScale});
 await page.waitForFunction(()=>sweep.states.length>=1||sweep.errors.length||sweep.finished,null,{timeout:45000});
 const snapshots=[],began=Date.now();let nextSnapshot=0;
 while(Date.now()-began<=row.duration){
  const elapsed=Date.now()-began;
  if(row.c.kind==='outfit'){
   const direction=elapsed<2000?'down':elapsed<4000?'left':'right';
   if(await page.evaluate(()=>sweep.states.at(-1)?.direction)!==direction)await page.evaluate(({form,direction})=>postMessage({type:'ram-original-pose',token:'size-sweep',sequence:1,value:{form,direction,moving:direction!=='down',color:[-99,-160,-43],sound:false}},'*'),{form:row.form,direction});
  }
  if(elapsed>=nextSnapshot){
   const state=await page.evaluate(()=>sweep.states.at(-1)),pixels=await page.evaluate(pixelScan);
   const name=row.key+'-'+snapshots.length+'.png';
   const canvas=await page.evaluate(()=>player.shadowRoot.querySelector('canvas')?.toDataURL('image/png').split(',')[1]);
   if(!canvas)break;
   const ratio=3.2/viewportScale;
   await sharp(Buffer.from(canvas,'base64')).extract({left:Math.round(320-200*ratio),top:Math.round(345.5-225.5*ratio),width:Math.round(400*ratio),height:Math.round(480*ratio)}).resize(200,240).png().toFile(path.join(folder,name));
   snapshots.push({elapsed,state,pixels,image:name});nextSnapshot+=row.duration/3;
  }
  const done=await page.evaluate(()=>sweep.finished||sweep.errors.length);if(done)break;
  await page.waitForTimeout(90);
 }
 const result=await page.evaluate(()=>sweep),states=result.states,first=states[0]?.registration,bodyWidths=states.map(s=>s.body?.width).filter(Number.isFinite),faces=snapshots.map(s=>s.pixels?.face).filter(Boolean);
 return {key:row.key,id:row.c.id,name:row.c.name,path:row.c.path,kind:row.c.kind,form:row.form,reference:row.reference,duration:row.duration,observed:Date.now()-began,states:states.length,errors:result.errors,finished:result.finished,registration:first,
  bodyRange:[Math.min(...bodyWidths),Math.max(...bodyWidths)],
  requiredBodyViewport:Math.max(1,...states.filter(s=>s.body?.width>0&&s.body?.height>0).flatMap(s=>[Math.abs(s.body.x-50)/50,Math.abs(s.body.x+s.body.width-50)/50,Math.abs(s.body.y-54)/54,Math.abs(s.body.y+s.body.height-54)/54])),registrationStable:states.every(s=>JSON.stringify(s.registration)===JSON.stringify(first)),
  flags:[...result.errors,...(!first?['missing-registration']:[]),...(!snapshots.some(s=>s.pixels?.ink>5)?['empty']:[]),...(snapshots.some(s=>s.pixels?.touchesStageEdge)?['stage-edge']:[]),...(faces.some(f=>f.bodyRatio<.65||f.bodyRatio>1.65)?['visible-body-outlier']:[])],snapshots};
}
async function sheets(rows){
 for(const kind of [...new Set(rows.map(r=>r.kind))]){const subset=rows.filter(r=>r.kind===kind);for(let start=0;start<subset.length;start+=20){const part=subset.slice(start,start+20),tiles=[];
  for(const [i,r] of part.entries()){const s=r.snapshots?.[Math.min(1,r.snapshots.length-1)];if(!s)continue;const x=i%5*240,y=Math.floor(i/5)*285;
   const caption=Buffer.from(`<svg width="240" height="45"><g font-family="sans-serif" fill="${r.flags.length?'#ba3219':'#725633'}"><text x="8" y="17" font-size="12">${r.name.replace(/[<>&]/g,'')} · ${formName(r.form)}</text><text x="8" y="35" font-size="10">${r.path.split('/').slice(-2).join('/')} ${r.flags.join(',')}</text></g></svg>`);
   tiles.push({input:caption,left:x,top:y},{input:path.join(folder,s.image),left:x+20,top:y+45});
  }
  await sharp({create:{width:1200,height:Math.ceil(part.length/5)*285,channels:4,background:'#fbf5e8'}}).composite(tiles).png().toFile(path.join(folder,`${kind}-sheet-${String(start/20+1).padStart(2,'0')}.png`));
 }}
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const completedPath=path.join(folder,'rows.jsonl'),rows=fs.existsSync(completedPath)?fs.readFileSync(completedPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],done=new Set(rows.map(r=>r.key));
 cases=cases.filter(r=>!done.has(r.key));const total=rows.length+cases.length;
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});let index=0;
 try{await Promise.all(Array.from({length:Number(process.env.AUDIT_WORKERS||4)},async()=>{let context,page,used=0;while(index<cases.length){const row=cases[index++];if(used++%10===0){await context?.close();context=await browser.newContext({viewport:{width:640,height:691}});page=await context.newPage();}
  let result;try{result=await inspect(page,row);}catch(error){result={key:row.key,id:row.c.id,path:row.c.path,kind:row.c.kind,form:row.form,name:row.c.name,error:String(error),flags:['audit-error'],snapshots:[]};}
  rows.push(result);fs.appendFileSync(completedPath,JSON.stringify(result)+'\n');if(result.flags.length)console.log('REVIEW',row.c.path,row.form,result.flags.join(','));if(rows.length%10===0)console.log(`Checked ${rows.length}/${total}`);
 }await context?.close()}));}finally{await browser.close()}
 rows.sort((a,b)=>a.path.localeCompare(b.path)||a.form.localeCompare(b.form));
 fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({checked:rows.length,byKind:rows.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{}),outliers:rows.filter(r=>r.flags.length).map(({snapshots,...r})=>r),rows},null,2));
 await sheets(rows);console.log(JSON.stringify({checked:rows.length,flagged:rows.filter(r=>r.flags.length).length,errors:rows.filter(r=>r.error).length}));
})().catch(e=>{console.error(e);process.exitCode=1});
