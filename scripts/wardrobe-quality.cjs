/** Browser audit of the actual outfit path. Fixtures use the isolated preview,
 * never the player's persistent storage. Keep this script for later releases. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),base=process.env.PREVIEW_URL||'http://127.0.0.1:5173';
const before=process.argv.includes('--before'),label=before?'before':'after';
const out=path.join(root,'artifacts/wardrobe-quality');fs.mkdirSync(out,{recursive:true});
const samples=[['junior','1200020'],['middle','1200052'],['senior','1200040'],['classic','1200025'],['super','1200026'],['water','1200113'],['wood','1200005'],['fire','1200036']].filter(([form])=>!process.env.AUDIT_FORM||process.env.AUDIT_FORM===form);
const manifest=require('../public/assets/original/official/manifest.json');
const executablePath=process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome';
async function ready(page){
 const source=page.locator('.wardrobe-mirror .official-ram-clip');
 await expect(source).toHaveAttribute('data-loaded','true',{timeout:45000});
 await expect(page.locator('.wardrobe-mirror .official-hit-mask')).toHaveAttribute('data-loaded','true');
 const frame=await(await page.locator('.wardrobe-mirror iframe').elementHandle()).contentFrame();
 await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').settled)).toBe(true);
 return frame;
}
async function sourceState(frame){return frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));}
async function drag(page,direction){
 const box=await page.locator('.wardrobe-mirror').boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.65;
 await page.mouse.move(x,y);await page.mouse.down();
 for(let i=1;i<=18;i++){await page.mouse.move(x+direction*i*4,y);await page.waitForTimeout(25);}
 await page.waitForTimeout(200);
}
async function choose(page,id){
 const source=manifest.clips.find(c=>c.kind==='outfit'&&c.path.endsWith('/'+id+'.swf'));
 const legacy={'1200020':'紫色魔法帽','1200052':'皇冠猫耳','1200040':'天使羽翼','1200026':'魔法书','1200036':'火焰羽翼'};
 const button=page.getByRole('button',{name:'试戴'+(legacy[id]||source.name),exact:true});
 const prev=page.getByRole('button',{name:'衣橱上一页'}),next=page.getByRole('button',{name:'衣橱下一页'});
 while(!await button.count()&&await prev.isEnabled())await prev.click();
 while(!await button.count()&&await next.isEnabled())await next.click();
 await button.click();
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--disable-dev-shm-usage','--disk-cache-size=10485760']});
 const checks=[],errors=[],missing=[];
 try{
  for(const [form,id] of samples){
   const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>{errors.push(e.message);console.error(JSON.stringify({form,error:e.message,stack:e.stack}))});page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
   if(process.env.TRACE_AUDIO){
    page.on('console',message=>{if(message.text().startsWith('AUDIO_'))console.error(message.text())});
    await page.addInitScript(()=>{Error.stackTraceLimit=30;const original=AudioContext.prototype.resume,close=AudioContext.prototype.close;AudioContext.prototype.close=function(){console.error('AUDIO_CLOSE',new Error().stack);return close.call(this)};AudioContext.prototype.resume=function(){const stack=new Error().stack;return original.call(this).catch(error=>{console.error('AUDIO_RESUME_FAILURE',this.state,window.player?.isConnected,document.visibilityState,stack);throw error})}});
   }
   await page.goto(`${base}/?preview=wardrobe&form=${form}&outfit=${id}`);
   let frame=await ready(page);const initial=await sourceState(frame),token=await page.locator('.wardrobe-mirror iframe').getAttribute('src');
   const row={form,id,renderedForm:initial.form,registration:initial.registration,drag:[]};
   const box=await page.locator('.wardrobe-mirror').boundingBox(),clip={x:box.x-65,y:box.y-30,width:box.width+130,height:box.height+65};
   await page.screenshot({path:path.join(out,`${label}-${form}-${id}-idle.png`),clip});
   for(const direction of [-1,1]){
    await drag(page,direction);const state=await sourceState(frame);row.drag.push({expected:direction<0?'left':'right',direction:state.direction,moving:state.moving});
    if(!before){assert.equal(state.direction,direction<0?'left':'right');assert.equal(state.moving,true);assert.deepEqual(state.registration,initial.registration);}
    await page.screenshot({path:path.join(out,`${label}-${form}-${id}-${direction<0?'left':'right'}.png`),clip});
    await page.mouse.up();await page.waitForTimeout(350);
   }
   await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
   await expect(page.locator('.wardrobe-mirror [data-petting-adaptation]')).toHaveAttribute('data-petting-adaptation','project');
   await expect.poll(()=>page.locator('.wardrobe-mirror [data-petting-body]').count()).toBe(1);
   assert.equal(await page.locator('.wardrobe-mirror iframe').getAttribute('src'),token,'Petting and drag keep the loaded original source');
   await page.getByRole('button',{name:'预览玩球动作',exact:true}).click();
   await expect(page.locator('.wardrobe-mirror .ram-football-frame')).toBeVisible();
   await choose(page,id==='1200020'?'1200052':'1200020');
   row.actionAfterSelection=await page.locator('.wardrobe-mirror>.ram-sprite').getAttribute('data-action');
   if(!before){assert.equal(row.actionAfterSelection,'idle','Selecting an outfit must leave the prior toy/care action immediately');frame=await ready(page);assert.equal((await sourceState(frame)).form,'level2');}
   checks.push(row);console.log(`${label}: ${form}/${id} ${JSON.stringify(row.drag)} selection=${row.actionAfterSelection}`);await page.close();
  }
  if(!before){
   const page=await browser.newPage({viewport:{width:1100,height:850}});
   await page.goto(base+'/?preview=wardrobe&form=super&outfit=1200020');await ready(page);
   let release,seenRequest;const held=new Promise(resolve=>release=resolve),waiting=new Promise(resolve=>seenRequest=resolve);
   await page.route('**/1200026.swf',async route=>{seenRequest();await held;await route.continue().catch(()=>{});});
   await choose(page,'1200026');await waiting;await choose(page,'1200113');await ready(page);
   release();await page.waitForTimeout(600);
   await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-source','resource/petcloth/swf2/1200113.swf');
   assert.equal((await sourceState(await ready(page))).form,'level2');
   checks.push({rapidSelection:true,staleSourceCannotReplaceLatest:true});await page.close();
   const retry=await browser.newPage({viewport:{width:1100,height:850}});let attempts=0;
   await retry.route('**/1200020.swf',route=>{attempts++;return route.abort();});
   await retry.goto(base+'/?preview=wardrobe&form=senior&outfit=1200020');
   await expect.poll(()=>attempts,{timeout:15000}).toBeGreaterThanOrEqual(2);
   await expect(retry.locator('.wardrobe-mirror .official-ram-clip')).toHaveClass(/is-failed/,{timeout:10000});
   await retry.unroute('**/1200020.swf');await choose(retry,'1200020');await ready(retry);
   checks.push({loadFailureRecovery:true,automaticRetry:true,reselectSameOutfitRetries:true});await retry.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,label+'-interactions.json'),JSON.stringify({checks,errors,missing},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
