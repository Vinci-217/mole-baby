const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
const manifest=require('../public/assets/original/official/manifest.json'),out=path.resolve(__dirname,'../artifacts/native-outfits-review');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:400,height:432}}),rows=[];
try{await page.goto('http://127.0.0.1:5173/assets/original/official/runtime.html?token=audit');let sequence=0;
for(const clip of manifest.clips.filter(c=>c.kind==='outfit')){
 const form=clip.forms.includes('level101_7')?'level101_7':'level2';
 const row=await page.evaluate(({id,form,sequence})=>new Promise(resolve=>{
  let completed=false;const finish=value=>{if(completed)return;completed=true;removeEventListener('message',listen);clearTimeout(timeout);resolve(value)};
  const listen=event=>{if(event.data.sequence!==sequence)return;if(event.data.type==='ram-original-error')finish({error:event.data.value});if(event.data.type==='ram-original-state'&&event.data.value.settled)finish(event.data.value)};
  const timeout=setTimeout(()=>finish({error:'timeout'}),20000);addEventListener('message',listen);postMessage({type:'ram-original-load',token:'audit',sequence,value:{id,loop:true,registerBody:true,referenceForm:'level101_7',pose:{form,direction:'down',moving:false,color:[-99,-160,-43],sound:false,volume:0}}},'*');
 }),{id:clip.id,form,sequence:++sequence});rows.push({id:clip.id,path:clip.path,...row});
 if(row.error)console.log('ERROR',clip.path,row.error);if(sequence%20===0)console.log('Checked',sequence);
}
fs.writeFileSync(path.join(out,'all-native-clothes.json'),JSON.stringify(rows,null,2));const failed=rows.filter(r=>r.error||!r.width||!r.registration);console.log(JSON.stringify({count:rows.length,failed:failed.map(r=>({path:r.path,error:r.error,bones:r.bones,registration:r.registration}))},null,2));if(failed.length)process.exitCode=1;
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
