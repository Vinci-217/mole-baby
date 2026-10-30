const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const visibility=require('../electron/edge-visibility.json'),proof=require('../research/tuya-size-calibration.json');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const results=[],out=path.resolve(__dirname,'../artifacts/tuya-size');fs.mkdirSync(out,{recursive:true});
 try{
  {
   const page=await browser.newPage({viewport:{width:1600,height:1400}}),cdp=await page.context().newCDPSession(page);
   await page.goto(process.env.TUYA_REVIEW_URL||'http://127.0.0.1:5241');
   await page.evaluate(async()=>window.tuyaReview=(await import('/scripts/tuya-scale-fixture.tsx')).mountTuyaReview());
   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+500));
   for(const form of ['junior','middle','senior','classic'])for(const id of ['tuya1','tuya2','tuya3','tuya4']){
    const {rect,spec}=await page.evaluate(({form,id})=>window.tuyaReview.show(form,id),{form,id});
    const canvas=page.locator('.tuya-review canvas[data-sheet=uploaded]');
    await expect.poll(async()=>{await page.clock.runFor(20);return canvas.getAttribute('data-loaded')},{timeout:45000}).toBe('true');
    for(const dpr of [1,1.25,1.5,2]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1400,deviceScaleFactor:dpr,mobile:false});
    assert.equal(await page.evaluate(()=>devicePixelRatio),dpr);
    const box=await canvas.boundingBox(),record=proof.records.find(r=>r.key===form+'-'+id),bodyWidth=record.bodyAtlasWidth/spec.width*box.width;
    const target=visibility.forms[form].body[2]-visibility.forms[form].body[0];
    assert.ok(Math.abs(bodyWidth-target)<.1,`${form}/${id} DPR${dpr}: ${bodyWidth} vs ${target}`);
    assert.ok(Math.abs(box.width-rect.width)<.1,'Canvas CSS width must not multiply by devicePixelRatio');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1700,height:1500,deviceScaleFactor:dpr,mobile:false});assert.ok(Math.abs((await canvas.boundingBox()).width-box.width)<.1,'Expanding the native viewport must not enlarge the pet');
    if(dpr===1&&id==='tuya1')await page.screenshot({path:path.join(out,form+'.png'),clip:{x:450,y:860,width:260,height:200}});
    results.push({form,id,dpr,bodyWidth,target});
    }
    console.log('Checked',form,id);
   }
   await page.close();
  }
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({cases:results.length,results},null,2)+'\n');console.log('PASS 64 graffiti/form/DPR cases: first body matches idle, window expansion preserves scale');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
