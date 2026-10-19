const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const {makeTired,adopt,openActions,enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5196';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5196','--strictPort'],{cwd:root,stdio:'pipe'});
let logs='',browser;server.stdout.on('data',v=>logs+=v);server.stderr.on('data',v=>logs+=v);
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem(`ramu-presence-v1:${JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt}`)||'null'));
const memory=page=>page.evaluate(()=>JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt}`)||'null'));
(async()=>{
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok)break;}catch{}if(n===99)throw Error('Vite not ready');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
 const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('api.deepseek.com'))requests.push(r.url());});
 await page.addInitScript(()=>{if(!localStorage.getItem('ramu-house-preferences-v2'))localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:true,presenceMinutes:10}));});
 await page.clock.install();await page.goto(url);await adopt(page,'蓝色','小芽');await page.clock.pauseAt(new Date(Date.now()+1000));
 await expect(page.getByRole('timer')).toHaveCount(0);assert.equal(await journal(page),null);
 await page.clock.fastForward(20000);const before=await memory(page);assert.ok(before,'pet memory is persisted');
 await page.clock.fastForward(180000);await expect(page.locator('.compact-bubble')).toHaveClass(/visible/);
 assert.equal((await journal(page)).history.length,1);assert.deepEqual(await memory(page),before,'spontaneous speech cannot create user facts or affection events');
 const first=await page.locator('.compact-bubble').innerText();
 await page.getByRole('button',{name:'回应拉姆的话',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'拉姆对话'})).toBeVisible();await expect(page.getByRole('log')).toContainText(first);
 const shared=await memory(page);assert.equal(shared.messages.at(-1).role,'assistant');assert.equal(shared.messages.at(-1).content,first);assert.equal(shared.events.at(-1).kind,'presence');
 await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.clock.fastForward(15000);await page.clock.fastForward(180000);
 assert.equal((await journal(page)).history.length,1,'no repeat after only three minutes');
 await page.reload();await page.clock.fastForward(180000);assert.equal((await journal(page)).history.length,1,'reload respects persisted cadence');
 await page.clock.fastForward(240000);assert.equal((await journal(page)).history.length,2);
 await expect(page.locator('.compact-bubble')).toHaveClass(/visible/);assert.notEqual(await page.locator('.compact-bubble').innerText(),first);
 console.log('PASS thoughtful cadence, no startup timer, no fabricated memories or passive affection, clickable context and restart-safe cooldown');

 await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
 let culture=false;
 for(let i=0;i<40;i++){
  await page.getByRole('button',{name:'听拉姆说一句',exact:true}).click();
  if((await journal(page)).history.at(-1).topic==='culture'){culture=true;break;}
 }
 assert.ok(culture,'cultural conversation is reachable');const quote=await page.locator('.compact-bubble').innerText();
 await page.getByRole('button',{name:'回应拉姆的话',exact:true}).click();await expect(page.getByRole('log')).toContainText(quote);
 await page.getByRole('textbox',{name:'和拉姆说话',exact:true}).fill('这句话是什么意思？');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await expect.poll(async()=> (await memory(page)).messages.at(-1).role).toBe('assistant');
 const reply=(await memory(page)).messages.at(-1).content;assert.match(reply,/出自|见于|让我想到/);
 await page.getByRole('textbox',{name:'和拉姆说话',exact:true}).fill('叫我小米，我喜欢草莓。希望你安静陪我。');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('小米');
 await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.clock.fastForward(16000);const quietCount=(await journal(page)).history.length;
 await page.clock.fastForward(1200000);assert.equal((await journal(page)).history.length,quietCount,'remembered quiet boundary prevents interruptions');
 await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();await page.getByRole('button',{name:'听拉姆说一句',exact:true}).click();
 await expect(page.locator('.compact-bubble')).toHaveClass(/visible/);assert.notEqual((await journal(page)).history.length,quietCount,'explicit invitation overrides silence');
 await page.getByRole('button',{name:'回应拉姆的话',exact:true}).click();await page.locator('.companion-memories>summary').click();
 await page.getByRole('button',{name:'忘记喜欢草莓',exact:true}).click();await expect(page.locator('.compact-bubble')).not.toHaveClass(/visible/);
 assert.ok(!(await memory(page)).facts.some(f=>f.value==='草莓'));
 console.log('PASS culture follow-up without API, actual preferences, remembered boundaries, explicit invitation and forgetting visible context');

 await enterHome(page);await roomTab(page,'设置');await page.getByRole('checkbox',{name:'主动陪伴',exact:true}).uncheck();
 await page.getByRole('combobox',{name:'主动陪伴频率',exact:true}).selectOption('40');await toDesktop(page);await page.clock.fastForward(1800000);
 const disabledCount=(await journal(page)).history.length;await page.reload();await page.clock.fastForward(1800000);assert.equal((await journal(page)).history.length,disabledCount);
 await enterHome(page);await roomTab(page,'设置');await expect(page.getByRole('checkbox',{name:'主动陪伴',exact:true})).not.toBeChecked();await expect(page.getByRole('combobox',{name:'主动陪伴频率',exact:true})).toHaveValue('40');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS disabled/restart preferences, adjustable frequency and zero DeepSeek requests');
 await page.close();
 // Fresh pet: focus and sleep independently suppress spontaneous speech.
 const p=await browser.newPage();await p.addInitScript(()=>localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:true,presenceMinutes:10,reminderMinutes:40})));
 await p.clock.install();await p.goto(url);await adopt(p);await p.clock.pauseAt(new Date(Date.now()+1000));
 await openActions(p);await p.getByRole('button',{name:'开始计时',exact:true}).click();await p.clock.fastForward(1200000);assert.equal(await journal(p),null);
 await p.getByRole('button',{name:'取消计时',exact:true}).click();await openActions(p);await makeTired(p);await p.clock.fastForward(1200000);assert.equal(await journal(p),null);
 await expect(p.getByTestId('desktop-character').locator('.seed-body-frame')).toHaveAttribute('data-frame','61');await expect(p.getByRole('timer')).toHaveCount(0);
 console.log('PASS focus and seed sleep suppress spontaneous bubbles without changing the manual timer');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill('SIGTERM');});
