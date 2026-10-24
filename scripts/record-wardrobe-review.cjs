const {chromium,expect}=require('@playwright/test'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5218';let browser;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5218','--strictPort'],{cwd:root,stdio:'ignore'});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});const p=await browser.newPage({viewport:{width:640,height:360},recordVideo:{dir:path.join(root,'artifacts/v24-review'),size:{width:640,height:360}}});await p.goto(url);
 await p.evaluate(async()=>{const {mountComfortReview}=await import('/scripts/comfort-review-fixture.tsx');window.review=mountComfortReview([['junior',1],['middle',2]]);const style=document.createElement('style');style.textContent='#motion-review{grid-template-columns:repeat(2,160px);width:320px;margin:auto}';document.head.append(style)});
 // Load every required atlas before the recorded review begins.
 const scenes=[['idle','wizard-cap',2500],['mood-joy','wizard-cap',2100],['mood-grumpy','wizard-cap',1600],['eat-bear-biscuit','wizard-cap',4200],['play','wizard-cap',10200],['sleep','rabbit-hood',6800],['pet','rabbit-hood',3200],['idle','magic-book',2300]];
 for(const [action,costume]of scenes){await p.evaluate(({action,costume})=>{window.review.render(action,'blue');window.review.refresh({costume})},{action,costume});await expect(p.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(2,{timeout:30000});await expect(p.locator('#motion-review .ram-wear[data-loaded=true]')).toHaveCount(2,{timeout:30000})}
 const begins=Date.now();
 for(const[action,costume,duration]of scenes){await p.evaluate(({action,costume})=>{window.review.render(action,'blue');window.review.refresh({costume})},{action,costume});await expect(p.locator('#motion-review canvas:not(.ram-wear)[data-loaded=true]')).toHaveCount(2);await expect(p.locator('#motion-review .ram-wear[data-loaded=true]')).toHaveCount(2);await p.waitForTimeout(duration);if(action==='pet')await p.screenshot({path:path.join(root,'artifacts/v24-review/rabbit-corrected.png')})}
 const video=p.video();await p.close();await video.saveAs(path.join(root,'artifacts/v24-review/untrimmed.webm'));const reviewSeconds=(Date.now()-begins)/1000,input=path.join(root,'artifacts/v24-review/untrimmed.webm'),output=path.join(root,'artifacts/v24-wardrobe-motion.webm');
 const total=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',input],{encoding:'utf8'}).trim());
 execFileSync('ffmpeg',['-y','-loglevel','error','-ss',String(Math.max(0,total-reviewSeconds+.25)),'-i',input,'-an','-c:v','libvpx-vp9','-crf','35','-b:v','0',output],{stdio:'inherit'});
 console.log(JSON.stringify({reviewSeconds,output}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
