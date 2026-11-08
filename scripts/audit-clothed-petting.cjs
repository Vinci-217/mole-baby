/** All outfits: real source frames remain visible for the complete adapted
 * petting action. In particular, junior-only clothes never reveal a bare super. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,expect}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/clothed-petting'),manifest=require('../public/assets/original/official/manifest.json');
const legacy=[...fs.readFileSync(path.join(root,'src/wardrobe.ts'),'utf8').matchAll(/^  \{id:'([^']+)',name:'([^']+)',sourceId:'([^']+)'/gm)].map(m=>({id:m[1],name:m[2],sourceId:m[3]}));
const outfits=[...legacy,...manifest.outfits],label=process.env.AUDIT_LABEL||'all-outfits';
const cases=outfits.map((o,index)=>({...o,index})).filter(o=>!process.env.AUDIT_IDS||process.env.AUDIT_IDS.split(',').includes(o.sourceId)).slice(Number(process.env.AUDIT_START||0));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--disk-cache-size=10485760']});
 const checks=[],errors=[],missing=[];
 let context,page,currentPage=0;
 try{
  for(const [index,o] of cases.entries()){
   if(index%16===0){await context?.close();context=await browser.newContext({viewport:{width:1100,height:850}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url())});await page.goto('http://127.0.0.1:5173/?preview=wardrobe');await page.getByRole('combobox',{name:'预览形态'}).selectOption('super');while(await page.getByRole('button',{name:'衣橱上一页'}).isEnabled())await page.getByRole('button',{name:'衣橱上一页'}).click();currentPage=0;}
   const targetPage=Math.floor((o.index+1)/9);
   while(currentPage<targetPage){await page.getByRole('button',{name:'衣橱下一页'}).click();currentPage++;}
   while(currentPage>targetPage){await page.getByRole('button',{name:'衣橱上一页'}).click();currentPage--;}
   await page.locator('.wardrobe-grid>button').nth((o.index+1)%9).click();
   const player=page.locator('.wardrobe-mirror .official-ram-clip'),sprite=page.locator('.wardrobe-mirror>.ram-sprite'),art=page.locator('.wardrobe-mirror .ram-artwork').first(),iframe=page.locator('.wardrobe-mirror iframe');
   await expect(player).toHaveAttribute('data-loaded','true',{timeout:45000});await expect(player).toHaveAttribute('data-source',`resource/petcloth/swf2/${o.sourceId}.swf`);
   await expect.poll(()=>iframe.getAttribute('data-registration')).not.toBeNull();
   const token=await iframe.getAttribute('src'),registration=await iframe.getAttribute('data-registration'),form=await sprite.getAttribute('data-form');
   await page.evaluate(()=>{window.pettingLostCostume=false;window.pettingWatch=new MutationObserver(()=>{const p=document.querySelector('.wardrobe-mirror>.ram-sprite');if(!p?.classList.contains('ram-official')||p.querySelector('.ram-daily-frame'))window.pettingLostCostume=true});window.pettingWatch.observe(document.querySelector('.wardrobe-mirror'),{childList:true,subtree:true});});
   await page.getByRole('button',{name:'预览摸摸动作',exact:true}).click();
   await expect(art).toHaveAttribute('data-petting-adaptation','project');await expect.poll(()=>art.getAttribute('data-petting-body')).not.toBeNull();
   await expect.poll(()=>sprite.evaluate(n=>parseFloat(n.style.getPropertyValue('--social-opacity'))||0)).toBeGreaterThan(.5);
   const contact=await sprite.evaluate(n=>({x:parseFloat(n.style.getPropertyValue('--social-hx')),y:parseFloat(n.style.getPropertyValue('--social-hy')),width:parseFloat(n.style.getPropertyValue('--social-handwidth')),angle:parseFloat(n.style.getPropertyValue('--social-angle'))}));
   assert(Object.values(contact).every(Number.isFinite),o.sourceId+' finite hand/body pose');assert(contact.width>=18&&contact.width<=58);
   assert.equal(await iframe.getAttribute('src'),token);assert.equal(await sprite.getAttribute('data-form'),form);
   if(process.env.AUDIT_IDS)await page.screenshot({path:path.join(out,o.sourceId+'-petting.png')});
   await expect(sprite).toHaveAttribute('data-action','idle',{timeout:8000});
   assert.equal(await page.evaluate(()=>{pettingWatch.disconnect();return pettingLostCostume}),false,o.sourceId+' must retain clothing throughout petting');
   assert.equal(await iframe.getAttribute('src'),token,o.sourceId+' petting must reuse its loaded source');assert.equal(await iframe.getAttribute('data-registration'),registration);
   checks.push({id:o.id,sourceId:o.sourceId,form,actualForm:'super',contact,sourceRetained:true,registrationUnchanged:true,completed:true});
   fs.appendFileSync(path.join(out,label+'.jsonl'),JSON.stringify(checks.at(-1))+'\n');
   if((index+1)%10===0)console.log(`Adapted and checked ${index+1}/${cases.length}`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({checked:checks.length,checks,errors,missing},null,2));console.log('PASS clothed petting',checks.length);
 }catch(error){if(page)await page.screenshot({path:path.join(out,label+'-failure.png')});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
