const assert=require('node:assert/strict'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium}=require('@playwright/test');
const {adopt}=require('./smoke-helpers.cjs');const{verifyClassicBook}=require('./classic-book-checks.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5215';let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5215','--strictPort'],{cwd:root,stdio:'pipe'});
(async()=>{
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Production preview failed');try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await adopt(page,'蓝色','小叶');await verifyClassicBook(page);assert.deepEqual(errors,[]);
 console.log('PASS production classic inventory at 1180, 1000, 800 and 390 pixels without renderer errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
