/** Render each shipped source in the same isolated runtime used by Ram. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'public/assets/original/official');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
const report=path.join(root,'artifacts/embedded-originals-audit.jsonl');
const engine=crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,'controller.swf'))).update(fs.readFileSync(path.join(folder,'runtime.js'))).digest('hex');
const done=new Map();if(fs.existsSync(report))for(const line of fs.readFileSync(report,'utf8').trim().split('\n').filter(Boolean)){const row=JSON.parse(line);if(row.engine===engine&&row.pass)done.set(row.id,row)}
const rows=manifest.clips.filter(row=>!done.has(row.id));
const limits=process.env.OFFICIAL_AUDIT_LIMIT?Number(process.env.OFFICIAL_AUDIT_LIMIT):rows.length;
const todo=rows.slice(0,limits),base='http://127.0.0.1:5173/assets/original/official/';
let cursor=0,completed=0;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:640,height:400}});
  await page.goto(base+'runtime.html');
  await page.evaluate(()=>{
   document.body.replaceChildren();window.audit={};
   addEventListener('message',event=>{
    const d=event.data;if(!d||!d.id||!d.type?.startsWith('ram-original-'))return;
    const r=window.audit[d.id]??={};
    if(d.type==='ram-original-ready')r.ready=true;
    if(d.type==='ram-original-error')r.error=d.value;
    if(d.type==='ram-original-state')r.state=d.value;
    if(d.type==='ram-original-mask')r.alpha=Array.isArray(d.value)?d.value.filter(v=>v>32).length:0;
   });
  });
  async function worker(index){
   while(cursor<todo.length){
    const clip=todo[cursor++],form=clip.forms.includes('level2')?'level2':clip.forms[0]||'level2';
    await page.evaluate(({index,id,form,base})=>{
     document.getElementById('audit-'+index)?.remove();
     const iframe=document.createElement('iframe');iframe.id='audit-'+index;
     iframe.style.cssText=`position:absolute;left:${index*300}px;top:0;width:200px;height:216px;border:0`;
     iframe.src=base+'runtime.html?id='+id+'&form='+form+'&token=audit';document.body.append(iframe);
    },{index,id:clip.id,form,base});
    let result;
    try{await page.waitForFunction(id=>{const r=window.audit[id];return r?.error||r?.alpha>0},clip.id,{timeout:6000});result=await page.evaluate(id=>window.audit[id],clip.id)}
    catch{result=await page.evaluate(id=>window.audit[id]||{error:'No painted source pixels within 6 seconds'},clip.id)}
    const row={id:clip.id,path:clip.path,kind:clip.kind,form,engine,pass:!result.error&&result.alpha>0,...result};
    fs.appendFileSync(report,JSON.stringify(row)+'\n');done.set(clip.id,row);completed++;
    if(completed%20===0)console.log(`Checked ${completed}/${todo.length}; playable ${[...done.values()].filter(row=>row.pass).length}`,true);
   }
  }
  await Promise.all([worker(0),worker(1)]);
  const failed=[...done.values()].filter(row=>!row.pass);
  console.log(JSON.stringify({checked:done.size,failed:failed.map(row=>({path:row.path,error:row.error,alpha:row.alpha}))}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
