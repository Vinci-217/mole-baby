const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/wardrobe-interactions');fs.mkdirSync(out,{recursive:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173';
async function choose(page,name){const button=page.getByRole('button',{name:'试戴'+name,exact:true}),prev=page.getByRole('button',{name:'衣橱上一页',exact:true}),next=page.getByRole('button',{name:'衣橱下一页',exact:true});while(!await button.count()&&await prev.isEnabled())await prev.click();while(!await button.count()&&await next.isEnabled())await next.click();await button.click();}
async function ready(page){await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:45000});await expect(page.locator('.wardrobe-mirror .official-hit-mask')).toHaveAttribute('data-loaded','true');return (await page.locator('.wardrobe-mirror iframe').elementHandle()).contentFrame();}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--disable-dev-shm-usage']});
 const errors=[],missing=[],checks={gestures:[],pages:[]};
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});
  await page.goto(base+'/?preview=wardrobe');
  for(const [form,name] of [['junior','紫色魔法帽'],['super','魔法书'],['senior','天使羽翼'],['middle','皇冠猫耳']]){
   await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption(form);await choose(page,name);const frame=await ready(page),iframe=page.locator('.wardrobe-mirror iframe'),token=await iframe.getAttribute('src');
   const registration=JSON.parse(await iframe.getAttribute('data-registration'));
   for(const key of ['x','y','scale','bodyWidth','bodyHeight'])assert(Number.isFinite(registration[key]),`${name}: ${key} must be finite`);
   if(name==='皇冠猫耳'){
    assert.equal(await page.locator('.wardrobe-mirror>.ram-sprite').getAttribute('data-stage'),'1');
    assert.equal(await page.locator('.wardrobe-mirror>.ram-sprite').getAttribute('data-growth-stage'),'2');
    assert.equal(await frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').form),'level2','original layer 45 must choose the junior body, not a middle body with ears');
   }
   await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();await expect(page.locator('.social-hand')).toBeVisible();
   await expect.poll(()=>page.locator('.wardrobe-mirror>.ram-sprite').evaluate(n=>parseFloat(n.style.getPropertyValue('--social-angle'))||0)).toBeGreaterThan(.2);
   const pose=await page.locator('.wardrobe-mirror .ram-pose-layer').first().evaluate(n=>getComputedStyle(n).transform);assert.notEqual(pose,'none');
   assert.equal(await iframe.getAttribute('src'),token,'petting must reuse the loaded source');
   if(form==='junior')await page.screenshot({path:path.join(out,'petting.png')});
   const mirror=page.locator('.wardrobe-mirror'),box=await mirror.boundingBox(),point={x:box.x+box.width*.5,y:box.y+box.height*.6};
   await page.mouse.move(point.x,point.y);await page.mouse.down();
   for(let i=1;i<=16;i++){await page.mouse.move(point.x+i*5,point.y);await page.waitForTimeout(18);}
   const elastic=await page.locator('.wardrobe-mirror .ram-elastic-layer').first().evaluate(n=>getComputedStyle(n).transform);assert(!['none','matrix(1, 0, 0, 1, 0, 0)'].includes(elastic),'held clothing needs the real elastic transform');
   await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('right');
   if(form==='junior')await page.screenshot({path:path.join(out,'dragging.png')});
   for(let i=1;i<=22;i++){await page.mouse.move(point.x+80-i*5,point.y);await page.waitForTimeout(18);}
   await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('left');await page.mouse.up();
   await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus').direction)).toBe('down');
   assert.equal(await iframe.getAttribute('src'),token,'dragging must not reload the player');
   assert.deepEqual(JSON.parse(await iframe.getAttribute('data-registration')),registration,'body registration must not change during contact or turning');
   checks.gestures.push({form,name,petting:true,left:true,right:true,stableRegistration:true});
  }
  for(const width of [1100,393,320]){
   await page.setViewportSize({width,height:900});const prev=page.getByRole('button',{name:'衣橱上一页',exact:true}),next=page.getByRole('button',{name:'衣橱下一页',exact:true});while(await prev.isEnabled())await prev.click();
   const first=await page.locator('.wardrobe-pages').evaluate(n=>n.offsetTop),pages=[];
   do{assert.equal(await page.locator('.wardrobe-grid').locator(':scope > *').count(),9);assert.equal(await page.locator('.wardrobe-pages').evaluate(n=>n.offsetTop),first);pages.push(await page.locator('.wardrobe-pages>span').textContent());if(!await next.isEnabled())break;await next.click();}while(true);
   assert(await page.locator('.wardrobe-empty').count()>0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(out,`wardrobe-${width}.png`),fullPage:true});checks.pages.push({width,pages:pages.length,nineSlots:true,fixedFooter:true});
  }
  await page.getByRole('combobox',{name:'预览形态',exact:true}).selectOption('seed');await choose(page,'紫色魔法帽');assert.equal(await page.locator('.wardrobe-mirror .official-ram-clip').count(),0);await expect(page.locator('.wardrobe-choice>button')).toBeDisabled();
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);fs.writeFileSync(path.join(out,'interaction-checks.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
