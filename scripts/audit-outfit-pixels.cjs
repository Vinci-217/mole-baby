/** Exercise source pixels, not just a successful SWF load. Use small batches
 * to release each isolated engine before loading the next wardrobe page. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),manifest=require('../public/assets/original/official/manifest.json');
const label=process.env.AUDIT_LABEL||'after',base=process.env.PREVIEW_URL||'http://127.0.0.1:5173';
const out=path.join(root,'artifacts/wardrobe-interactions');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const rows=[],clips=manifest.clips.filter(c=>c.kind==='outfit'&&(!process.env.AUDIT_IDS||process.env.AUDIT_IDS.split(',').some(id=>c.path.endsWith('/'+id+'.swf')))).slice(Number(process.env.AUDIT_START||0),process.env.AUDIT_END?Number(process.env.AUDIT_END):undefined);
 let context,page,sequence=0;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--disable-dev-shm-usage']});
 try{for(const [index,clip] of clips.entries()){
  if(index%8===0){await context?.close();context=await browser.newContext({viewport:{width:600,height:648}});page=await context.newPage();await page.goto(base+'/assets/original/official/runtime.html?token=audit');sequence=0;}
  const loadSequence=++sequence;
  {
   const forms=process.env.ALL_FORMS==='1'?(clip.forms.length?clip.forms.filter(form=>form!=='level1'&&form!=='level5'):['level2']):[clip.forms.includes('level101_7')?'level101_7':clip.forms.includes('level2')?'level2':clip.forms[0]||'level2'];
   let first=true;
   for(const form of forms){
    const state=await page.evaluate(({id,form,seq,first})=>new Promise(resolve=>{
     let state,alpha,completed=false;const finish=value=>{if(completed)return;completed=true;removeEventListener('message',receive);clearTimeout(timer);resolve(value)};
     const receive=e=>{const d=e.data;if(d.sequence!==seq||d.id!==id)return;if(d.type==='ram-original-error')finish({error:d.value});if(d.type==='ram-original-state'&&d.value.form===form)state=d.value;if(d.type==='ram-original-mask')alpha=d.value;if(state?.settled&&alpha){let ink=0,edge=0;for(let y=0;y<108;y++)for(let x=0;x<100;x++)if(alpha[y*100+x]>32){ink++;if(x===0||x===99||y===0||y===107)edge++}finish({...state,ink,edge});}};
     const timer=setTimeout(()=>finish({error:'No settled painted source within 45s',state}),45000);addEventListener('message',receive);const pose={form,direction:'down',moving:false,color:[0,-21,-255],sound:false,volume:0};if(first)postMessage({type:'ram-original-load',token:'audit',sequence:seq,value:{id,loop:true,registerBody:true,referenceForm:'level101_7',pose}},'*');else postMessage({type:'ram-original-pose',token:'audit',sequence:seq,value:pose},'*');
    }),{id:clip.id,form,seq:loadSequence,first});first=false;
    const pixels=await page.evaluate(()=>{const canvas=window.player?.shadowRoot.querySelector('canvas');if(!canvas)return {};const sample=document.createElement('canvas');sample.width=canvas.width;sample.height=canvas.height;const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;let ink=0,edge=0,x0=canvas.width,y0=canvas.height,x1=0,y1=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba[(y*canvas.width+x)*4+3]>32){ink++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(x===0||x===canvas.width-1||y===0||y===canvas.height-1)edge++}return {ink,edge,pixels:{x0,x1,y0,y1,width:canvas.width,height:canvas.height}};});
    rows.push({id:clip.id,name:clip.name,path:clip.path,form,...state,...pixels});
    fs.appendFileSync(path.join(out,`${label}-pixels.jsonl`),JSON.stringify(rows.at(-1))+'\n');
    if(form===(forms.includes('level101_7')?'level101_7':forms.includes('level3')?'level3':forms[0])){
     const folder=path.join(out,`${label}-outfits`);fs.mkdirSync(folder,{recursive:true});
     await page.screenshot({path:path.join(folder,clip.path.split('/').pop()+'.png'),clip:{x:150,y:162,width:300,height:324}});
    }
    if(state.error||!pixels.ink||pixels.edge)await page.screenshot({path:path.join(out,`${label}-${clip.path.split('/').pop()}-${form}.png`)});
   }
  }
  if((index+1)%10===0)console.log(`Checked ${index+1}/${clips.length}`);
 }
 fs.writeFileSync(path.join(out,`${label}-pixels.json`),JSON.stringify(rows,null,2));
 const failed=rows.filter(r=>r.error||!r.ink),clipped=rows.filter(r=>r.edge);
 console.log(JSON.stringify({checked:rows.length,failed,clipped:clipped.map(r=>({path:r.path,form:r.form,edge:r.edge}))},null,2));
 if(label!=='before')assert.equal(failed.length+clipped.length,0,'every outfit must paint without touching the viewport edge');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
