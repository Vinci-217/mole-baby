const{spawn}=require('node:child_process'),path=require('node:path'),{chromium}=require('@playwright/test');
const{adopt}=require('./smoke-helpers.cjs'),{verifyWorkflow}=require('./workflow-checks.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5228';let browser,page;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),...(process.argv.includes('--dev')?[]:['preview']),'--host','127.0.0.1','--port','5228','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});page=await browser.newPage({viewport:{width:1180,height:820}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});await page.goto(url);await adopt(page,'蓝色','小叶');await verifyWorkflow(page,{full:!process.argv.includes('--quick')});require('node:assert/strict').deepEqual(errors,[]);
})().catch(async error=>{console.error(error);await page?.screenshot({path:path.join(root,'artifacts/v30-workflow/failed.png')}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server.kill()});
