const {verifyRegisteredWardrobe}=require('./registered-wardrobe-checks.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium,expect}=require('@playwright/test');
const {adopt,enterHome,toDesktop,verifyMoodWardrobe}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5214';let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5214','--strictPort'],{cwd:root,stdio:'pipe'});
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Production preview failed');try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('RENDERER',e.message)});
 await page.goto(url);await adopt(page,'蓝色','小叶');await verifyMoodWardrobe(page);
  await verifyRegisteredWardrobe(page);
 for(let i=0;i<16;i++){
  await enterHome(page);await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();
  await page.locator('.wardrobe').getByRole('button',{name:i%2?'试戴金色羽毛':'试戴紫色魔法帽',exact:true}).click();
  await expect(page.locator('.wardrobe-mirror .ram-wear')).toBeVisible();
  await page.locator('.paper-tabs').getByRole('button',{name:'状态',exact:true}).click();
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();
  await page.locator('.wardrobe').getByRole('button',{name:'试戴庆生小帽',exact:true}).click();
  await toDesktop(page);
 }
 await page.waitForTimeout(250);assert.deepEqual(errors,[]);
 console.log('PASS production React: wardrobe, profile and desktop unmount/remount leave no detached-canvas callbacks or renderer errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
