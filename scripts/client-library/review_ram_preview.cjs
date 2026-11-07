/** Verify actual SWF playback, controls and the catalogue's preview lifecycle. */
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.RAM_CATALOG_URL||'http://127.0.0.1:5187/';
const root=path.resolve(__dirname,'../..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sources=['resource/petcloth/swf2/1200026.swf','resource/petcloth/swf2/1200042.swf',
 'resource/pet/swf/pet2/180013.swf','resource/lahmClassRoom/lahmMovie/pet3Movie/5.swf',
 'resource/petcloth/icon/1200026.swf'];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:980,height:820}}),errors=[],results=[];
  page.on('pageerror',error=>errors.push(error.message));
  const state=()=>page.evaluate(()=>player.ruffle().callExternalInterface('previewStatus'));
  const settled=()=>page.waitForFunction(()=>player?.ruffle().callExternalInterface('previewStatus')?.settled);
  for(const source of sources){
   await page.goto(base+'preview.html?path='+encodeURIComponent(source));
   await page.waitForFunction(()=>window.previewReady,{},{timeout:30000});
   const initial=await state();
   if(initial.error||initial.width<=0||!initial.settled)throw Error('Empty preview: '+source);
   const result={source,initial};
   if(source.includes('/swf2/')){
    const before=await page.locator('#stage').screenshot();await delay(460);
    result.pixelsAdvance=!before.equals(await page.locator('#stage').screenshot());
    if(!result.pixelsAdvance)throw Error('Frozen animation: '+source);
    await page.locator('#pause').click();await delay(80);
    const paused=await page.locator('#stage').screenshot();await delay(160);
    if(!paused.equals(await page.locator('#stage').screenshot()))throw Error('Pause did not freeze pixels');
    await page.locator('#pause').click();result.pause=true;
    result.forms=await page.locator('#form option').evaluateAll(nodes=>nodes.map(node=>node.value));
    for(const form of result.forms){
     await page.locator('#form').selectOption(form);await settled();
     const current=await state();
     if(current.form!==form||current.width<=0||current.error)throw Error('Form failed: '+form);
    }
    for(const direction of ['left','up','rightdown']){
     await page.locator('#direction').selectOption(direction);await settled();
     if((await state()).direction!==direction)throw Error('Direction failed: '+direction);
    }
    await page.locator('#form').selectOption('level101_7');
    await page.locator('#direction').selectOption('down');await settled();
    await page.screenshot({path:path.join(root,'artifacts/ram-swf-preview-'+(source.includes('1200026')?'book':'waiter')+'.png')});
   }
   results.push(result);
  }
  await page.goto(base);await page.locator('#total').filter({hasText:'1,290'}).waitFor();
  await page.locator('#search').fill('1200026');
  const open=async()=>{
   await page.locator('.row').filter({hasText:'resource/petcloth/swf2/1200026.swf'}).getByRole('button',{name:'预览',exact:true}).click();
   await page.locator('#preview[open]').waitFor();
   await page.frameLocator('#preview iframe').locator('#pause:not([disabled])').waitFor();
  };
  const close=async()=>{
   await page.getByRole('button',{name:'关闭动画预览',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('#preview iframe'));
  };
  await open();await close();
  const phone=[];
  for(const width of [393,320]){
   await page.setViewportSize({width,height:852});await open();
   const frame=page.frames().find(frame=>frame.url().includes('preview.html'));
   const layout=await frame.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));
   if(layout.body>layout.width)throw Error('Preview phone overflow: '+JSON.stringify(layout));
   phone.push(layout);await close();
  }
  if(errors.length)throw Error(errors.join('\n'));
  const report={results,phone,modalUnload:true,pageErrors:errors};
  fs.writeFileSync(path.join(root,'local-assets/ram-official-sweep/2026-11-06/animation-preview-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
