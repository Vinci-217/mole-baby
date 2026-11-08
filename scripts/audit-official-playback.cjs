/** Load every reachable local source in the same engine host, including the
 * first painted frame. A successful download/ready message alone is not proof. */
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/animation-semantics');
const formFor=c=>c.kind==='outfit'&&[45,65].includes(c.clothingLayer)?'level2':c.forms.includes('level101_7')?'level101_7':c.forms.includes('level4')?'level4':c.forms.includes('level2')?'level2':c.forms.find(f=>f!=='level1')||({1:'level1',2:'level2',3:'level3',4:'level4',101:'level101'}[c.level]||'level2');
const selected=manifest.clips.filter(c=>c.kind==='outfit'||c.kind==='care'||c.kind==='magic'||c.kind==='school'&&/\/lahmMovie\/pet\d+Movie\//.test(c.path)||['skill','transform'].includes(c.kind)&&c.animated&&!c.path.includes('/tatter/')).filter(c=>!process.env.AUDIT_KINDS||process.env.AUDIT_KINDS.split(',').includes(c.kind)).filter(c=>!process.env.AUDIT_IDS||process.env.AUDIT_IDS.split(',').some(id=>c.path.endsWith('/'+id+'.swf')));
(async()=>{
 fs.mkdirSync(out,{recursive:true});const label=process.env.AUDIT_LABEL||'playback';
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disable-dev-shm-usage']});
 let context,page,sequence=0;const rows=[],errors=[],missing=[];
 try{for(const [i,clip] of selected.entries()){
  if(i%12===0){await context?.close();context=await browser.newContext({viewport:{width:640,height:691}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});await page.goto('http://127.0.0.1:5173/assets/original/official/runtime.html?token=audit');sequence=0;}
  const began=Date.now(),form=formFor(clip);
  const result=await page.evaluate(({id,form,sequence})=>new Promise(resolve=>{
   let latest,ready=false,timer=setTimeout(()=>finish({error:'No painted frame in 12s',state:latest}),12000),sample;
   const finish=value=>{clearTimeout(timer);clearInterval(sample);removeEventListener('message',receive);resolve(value)};
   const pixels=()=>{const canvas=window.player?.shadowRoot.querySelector('canvas');if(!canvas)return 0;const tmp=document.createElement('canvas');tmp.width=160;tmp.height=173;const ctx=tmp.getContext('2d');ctx.drawImage(canvas,0,0,160,173);const rgba=ctx.getImageData(0,0,160,173).data;let ink=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>32)ink++;return ink};
   const receive=e=>{const d=e.data;if(d.id!==id||d.sequence!==sequence)return;if(d.type==='ram-original-error')finish({error:d.value});if(d.type==='ram-original-ready')ready=true;if(d.type==='ram-original-state'){latest=d.value;const r=latest.registration;if(!r||['x','y','scale','bodyWidth','bodyHeight'].some(key=>!Number.isFinite(r[key])))finish({...latest,error:'Missing or invalid body registration'})}};
   addEventListener('message',receive);sample=setInterval(()=>{if(ready&&latest){const ink=pixels();if(ink>10)finish({...latest,ink});}},100);
   postMessage({type:'ram-original-load',token:'audit',sequence,value:{id,loop:true,registerBody:true,referenceForm:form,pose:{form,direction:'down',moving:false,color:[0,-21,-255],sound:false,volume:0}}},'*');
  }),{id:clip.id,form,sequence:++sequence});
  rows.push({id:clip.id,name:clip.name,kind:clip.kind,path:clip.path,form,elapsed:Date.now()-began,...result});
  fs.appendFileSync(path.join(out,label+'.jsonl'),JSON.stringify(rows.at(-1))+'\n');
  if(result.error)console.log('FAILED',clip.path,result.error);
  if((i+1)%20===0)console.log(`Painted ${i+1}/${selected.length}`);
 }
 const failed=rows.filter(r=>r.error||!r.ink),report={checked:rows.length,failed,errors,missing,rows};
 fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checked:rows.length,failed:failed.map(r=>({path:r.path,error:r.error})),errors,missing},null,2));
 if(failed.length||errors.length||missing.length)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
