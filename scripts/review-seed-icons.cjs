'use strict';
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {enterHome,roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/readme-seed-review');
const origin=process.env.MOLE_REVIEW_URL||'http://127.0.0.1:5173';
function fixture(){
 const now=Date.now();
 localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小叶',color:'blue',createdAt:now-60000,lastTick:now,growth:0,highestGrowth:0,coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90},inventory:{biscuit:2,juice:2,'180003':1,'180006':1},sleeping:false,completedGames:0,lastRewardAt:0,education:{lessons:{language:1},graduated:{language:now-1000}}}));
 localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,roomWander:false,sound:false,reminders:false}));
}
async function checkIcons(p){
 const pocket=p.locator('.care-inventory');
 await expect(pocket).toBeVisible();
 const labels=['食物','饮品','清洁','药水'],icons=['icon-food','icon-water','icon-clean','icon-bottle'];
 for(let i=0;i<labels.length;i++){
  const tab=pocket.getByRole('tab',{name:labels[i],exact:true});await tab.click();
  await expect(tab).toHaveAttribute('aria-selected','true');
  const image=tab.locator('img');await expect(image).toBeVisible();
  assert.ok(await image.evaluate(async(im)=>{await im.decode();return im.naturalWidth>0}));
  assert.ok((await image.getAttribute('src')).includes(icons[i]));
  assert.equal(await tab.getAttribute('title'),null,'Labels stay inside the existing window');
  assert.equal(await pocket.locator('.pocket-slot[data-item-id]').count(),1,'Each category still displays its owned item');
  assert.equal(await pocket.locator('.pocket-slot').count(),16,'The backpack retains all sixteen slots');
 }
 const last=pocket.getByRole('tab',{name:'药水',exact:true});await last.focus();await p.keyboard.press('Home');
 await expect(pocket.getByRole('tab',{name:'食物',exact:true})).toBeFocused();
 await p.keyboard.press('ArrowDown');await expect(pocket.getByRole('tab',{name:'饮品',exact:true})).toBeFocused();
 await p.keyboard.press('Home');
}
async function recordSeed(p,character){
 const frames=path.join(out,'seed-frames');fs.mkdirSync(frames,{recursive:true});
 const crop=await character.locator('.ram-sprite').boundingBox(),input=await p.context().newCDPSession(p);
 await p.clock.pauseAt(new Date(Date.now()+100));
 try{
  for(let i=0;i<61;i++){
   const shot=await input.send('Page.captureScreenshot',{format:'png',clip:{...crop,scale:3}});
   fs.writeFileSync(path.join(frames,`seed-${String(i).padStart(3,'0')}.png`),Buffer.from(shot.data,'base64'));
   await p.clock.runFor(42);
  }
 }finally{await p.clock.resume();await input.detach()}
 const result=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(frames,'seed-%03d.png'),'-vf','split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',path.join(out,'seed-idle.gif')],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||'Could not render the captured seed preview');
}
const escapeHTML=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function inline(markdown){
 return escapeHTML(markdown).replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(_all,alt,file)=>{
  assert.ok(file.startsWith('docs/sponsors/'));const image=fs.readFileSync(path.join(root,file));
  return `<img alt="${alt}" src="data:image/png;base64,${image.toString('base64')}">`;
 }).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}
async function reviewReadme(browser){
 const markdown=fs.readFileSync(path.join(root,'README.md'),'utf8'),section=markdown.slice(markdown.indexOf('## Token 赞助鸣谢'));
 assert.equal((section.match(/!\[/g)||[]).length,6,'All sponsor portraits use Markdown image links');
 const parts=[];let table=false;
 for(const line of section.split('\n')){
  if(line.startsWith('|')){
   if(!table){parts.push('<table>');table=true}
   if(line.includes('---')||!line.includes('!['))continue;
   parts.push('<tr>'+line.split('|').slice(1,-1).map(cell=>`<td>${inline(cell.trim())}</td>`).join('')+'</tr>');continue;
  }
  if(table){parts.push('</table>');table=false}
  if(line.startsWith('## '))parts.push(`<h2>${escapeHTML(line.slice(3))}</h2>`);
  else if(line.trim())parts.push(`<p>${inline(line)}</p>`);
 }
 const p=await browser.newPage({viewport:{width:1040,height:900}});
 await p.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:32px 46px;background:#fff;color:#24292f;font:16px/1.8 "Noto Sans CJK SC",sans-serif}h2{font-size:25px;border-bottom:1px solid #d8dee4;margin:18px 0 14px;padding-bottom:8px}p{margin:12px 0}a{color:#0969da}table{border-collapse:collapse;width:100%;margin:20px 0}td{border:1px solid #d0d7de;text-align:center;width:33.333%;padding:14px}td img{display:block;width:88px;height:88px;margin:0 auto 8px}td strong{font-weight:500}</style>'+parts.join('\n'));
 await expect(p.locator('img')).toHaveCount(6);
 await p.locator('img').evaluateAll(async images=>{for(const image of images){await image.decode();if(image.naturalWidth!==88)throw Error('Portrait did not load')}});
 await p.screenshot({path:path.join(out,'readme-sponsors-disclaimer.png'),fullPage:true});await p.close();
 console.log('PASS README: six original local portraits render from Markdown, with names and source disclaimer');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true});
 try{
 for(const viewport of [{width:1180,height:820},{width:360,height:640}]){
  const p=await browser.newPage({viewport,hasTouch:viewport.width===360,isMobile:viewport.width===360});
  if(viewport.width===1180)await p.clock.install();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(fixture);await p.goto(origin);
  const character=p.getByTestId('desktop-character'),canvas=character.locator('canvas.seed-body-frame');
  await expect(canvas).toHaveAttribute('data-loaded','true');
  const potBefore=await character.locator('.seed-pot-original').boundingBox();
  await canvas.evaluate(c=>{window.__seedFrames=new Set([Number(c.dataset.frame)]);window.__seedObserver=new MutationObserver(()=>window.__seedFrames.add(Number(c.dataset.frame)));window.__seedObserver.observe(c,{attributes:true,attributeFilter:['data-frame']})});
  await expect.poll(()=>p.evaluate(()=>window.__seedFrames.size),{timeout:10000}).toBe(61);
  assert.deepEqual(await character.locator('.seed-pot-original').boundingBox(),potBefore,'The independent pot stays stationary during the full source loop');
  const frames=await p.evaluate(()=>[...window.__seedFrames].sort((a,b)=>a-b));assert.deepEqual(frames,Array.from({length:61},(_,i)=>i));
  await p.emulateMedia({reducedMotion:'reduce'});await expect(canvas).toHaveAttribute('data-frame','0');await p.waitForTimeout(200);await expect(canvas).toHaveAttribute('data-frame','0');await p.emulateMedia({reducedMotion:'no-preference'});
  if(viewport.width===1180)await recordSeed(p,character);
  await p.getByRole('button',{name:'打开拉姆背包',exact:true}).click();await checkIcons(p);await p.mouse.move(3,3);await p.screenshot({path:path.join(out,`desktop-icons-${viewport.width}.png`)});await p.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await character.click();await expect(p.locator('.compact-bubble')).toContainText('bibobibo');assert.ok(!(await p.locator('.compact-bubble').innerText()).includes('咕噜'));
  await enterHome(p);await roomTab(p,'背包');await checkIcons(p);await p.mouse.move(3,3);await p.screenshot({path:path.join(out,`room-icons-${viewport.width}.png`)});
  assert.deepEqual(errors,[]);await p.close();
  console.log(`PASS ${viewport.width}: 61 original seed poses, fixed pot, reduced motion, four original category icons and keyboard selection, bibo speech`);
 }
 await reviewReadme(browser);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
