/** Real shipping renderer: all stages/tools, source frames and intact outfit reuse. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/original-tools-review');
const manifest=require('../public/assets/original/official/manifest.json'),index=require('../public/assets/original/uploaded-actions/index.json');
const forms=['junior','middle','senior','classic','super','water','wood','fire'];
const ids=['180004','180011','180012','180013','180023','180026','180097','tuya1','tuya2','tuya3','tuya4'];
fs.mkdirSync(out,{recursive:true});
async function main(){
 const context=await chromium.launchPersistentContext(path.join(out,'browser-qa-profile'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1150,height:850},args:['--disable-dev-shm-usage']});
 try{
  const page=await context.newPage(),errors=[],missing=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.clock.install();await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:5173/')+'?preview=size-review&form=junior&outfit=warm-scarf');
  await page.waitForFunction(()=>Boolean(window.animationSizeReview));
  const choose=value=>page.evaluate(value=>window.animationSizeReview.select(value),value);
  const subject=page.locator('[data-review-subject]');
  for(const form of forms){
   await choose({form,outfit:'warm-scarf',action:'idle'});
   const outfit=subject.locator('.ram-outfit-source .official-ram-clip');await expect(outfit).toHaveAttribute('data-loaded','true',{timeout:45000});
   const originalFrame=await outfit.locator('iframe').elementHandle(),iframeURL=await outfit.locator('iframe').getAttribute('src');
   const target=['junior','middle','senior'].includes(form)?form:'classic',level={junior:2,middle:3,senior:4,classic:101}[target];
   for(const id of ids){
    // A stale source ID from another stage must still play THIS pet's stage.
    const stale=manifest.clips.find(c=>c.kind==='care'&&c.level===2&&c.path.endsWith('/'+id+'.swf'));
    const expected=manifest.clips.find(c=>c.kind==='care'&&c.level===level&&c.path.endsWith('/'+id+'.swf'));
    const start=Date.now();await choose({form,outfit:'warm-scarf',action:'official-'+stale.id});
    await expect(subject.locator('[data-animation-mode=original-tool]')).toHaveAttribute('data-tool-source',expected.path);
    await expect(subject.locator('.ram-outfit-source')).toBeHidden();
    assert(await originalFrame.evaluate(node=>node.isConnected),'Outfit engine must stay mounted during the original tool');
    assert.equal(await outfit.locator('iframe').getAttribute('src'),iframeURL);
    assert.equal(await subject.locator('.social-ball,.outfit-action-cue[data-toy]').count(),0,'No generated toy cue');
    const actor=subject.locator('.ram-original-tool'),spec=index[target+'-'+id];
    let ink,firstFrame,lastFrame;
    if(spec){
     const canvas=actor.locator('canvas[data-sheet=uploaded]');await expect(canvas).toHaveAttribute('data-loaded','true',{timeout:45000});
     await expect(canvas).toHaveAttribute('data-source-form',target);await expect(canvas).toHaveAttribute('width',String(spec.width));await expect(canvas).toHaveAttribute('height',String(spec.height));
     firstFrame=Number(await canvas.getAttribute('data-source-frame'));await page.clock.fastForward(250);
     lastFrame=Number(await canvas.getAttribute('data-source-frame'));assert(lastFrame>firstFrame,id+' source timeline advances');
     ink=await canvas.evaluate(node=>{let count=0;const data=node.getContext('2d').getImageData(0,0,node.width,node.height).data;for(let p=3;p<data.length;p+=4)if(data[p]>100)count++;return count});assert(ink>100,'Original actor must paint');
    }else{
     assert.equal(id,'180097');const swf=actor.locator('.official-ram-clip');await expect(swf).toHaveAttribute('data-source',expected.path);await expect(swf).toHaveAttribute('data-loaded','true',{timeout:45000});
    }
    checks.push({form,id,sourceForm:target,source:expected.path,readyMs:Date.now()-start,ink,firstFrame,lastFrame,originalOutfitEngineRetained:true});
    console.log('PASS',form,id,Date.now()-start+'ms');
    if(id==='180004'||id==='tuya1')await page.screenshot({path:path.join(out,form+'-'+id+'.png')});
   }
   const began=Date.now();await choose({form,outfit:'warm-scarf',action:'idle'});await expect(subject.locator('.ram-outfit-source')).toBeVisible();await expect(outfit).toHaveAttribute('data-loaded','true');
   assert(await originalFrame.evaluate(node=>node.isConnected));checks.push({form,restoredOutfitMs:Date.now()-began,iframeUnchanged:true});
   await originalFrame.dispose();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),tools:88,checks,errors,missing},null,2));
 }finally{await context.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
