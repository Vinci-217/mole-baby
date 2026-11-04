'use strict';
const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/local-room-review'),origin=process.env.MOLE_REVIEW_URL||'http://127.0.0.1:5173';
const {enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs');
function fixture(){
 const now=Date.now(),createdAt=now-86400000;
 if(!localStorage.getItem('ramu-house-save-v1'))localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'小叶',color:'blue',createdAt,lastTick:now,growth:180,highestGrowth:180,coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90},inventory:{biscuit:2,juice:2,'180003':1},sleeping:false,completedGames:0,lastRewardAt:0,room:{owned:[],placed:[]},notes:Array.from({length:7},(_,i)=>({id:'note-'+i,text:['记得给拉姆准备牛奶。','把小屋布置成喜欢的样子。','明天读完这一章。','陪拉姆去学院学习。','完成今天的小目标。','收好每一份回忆。','周末一起去看看花海。'][i],done:i===1,createdAt:now-i*86400000}))}));
 localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,roomWander:false,sound:false,reminders:false}));
}
const saved=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function placeBoard(p){
 assert.equal(await p.locator('.room-placed-item[data-furniture=message-board]').count(),0,'Board starts in the warehouse');
 assert.equal(await p.locator('.room-dock').getByRole('button',{name:/留言板/}).count(),0,'Board has no navigation tab');
 if(p.viewportSize().width===360){const top=await p.locator('.cottage-top').boundingBox();assert.ok(top.height<90,'Phone header must not cover the wall');assert.ok(await p.locator('.scene-top-actions').evaluate(e=>e.scrollWidth>e.clientWidth),'Crowded top controls scroll sideways')}
 await p.getByRole('button',{name:'布置小屋',exact:true}).click();const drawer=p.getByRole('complementary',{name:'小屋布置工具'});
 const card=drawer.locator('.warehouse-drag-card'),layer=p.locator('.time-scene>.room-furnishing-layer.is-editing');await card.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,`warehouse-${p.viewportSize().width}.png`)});
 if(p.viewportSize().width===360){
  const start=await card.boundingBox(),target=await layer.boundingBox(),x=start.x+start.width/2,y=start.y+start.height/2,end={x:target.x+target.width*.3,y:target.y+target.height*.35},input=await p.context().newCDPSession(p);
  try{await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=15;i++){await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(end.x-x)*i/15,y:y+(end.y-y)*i/15,id:1}]});await p.waitForTimeout(20)}await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await input.detach()}
 }else{const rect=await layer.boundingBox();await card.dragTo(layer,{targetPosition:{x:rect.width*.3,y:rect.height*.35}})}
 await expect.poll(async()=>(await saved(p)).room.placed.some(item=>item.id==='message-board')).toBe(true);await expect(p.getByRole('dialog',{name:'小屋留言板',exact:true})).toHaveCount(0);await drawer.getByRole('button',{name:'完成布置',exact:true}).click();
}
async function pocketLayout(p,compact){
 const pocket=p.locator('.care-inventory');await expect(pocket).toBeVisible();
 const layout=await pocket.evaluate(e=>({items:e.querySelector('.pocket-items').getBoundingClientRect().toJSON(),tabs:[...e.querySelectorAll('[role=tab]')].map(b=>b.getBoundingClientRect().toJSON()),footer:e.querySelector('.pocket-pages').getBoundingClientRect().toJSON(),panel:e.getBoundingClientRect().toJSON()}));
 for(let i=0;i<4;i++){assert.ok(layout.tabs[i].x>=layout.items.right-1,'Tabs stay on the right');assert.ok(layout.tabs[i].height<=30,'Tabs stay small');if(i)assert.ok(layout.tabs[i].y>layout.tabs[i-1].y);}
 const slot=await pocket.locator('.pocket-slot').first().boundingBox();assert.ok(Math.abs(slot.width-slot.height)<1,'Slots are square');
 assert.ok(layout.footer.bottom<=layout.panel.bottom+1,'Footer fits');await p.screenshot({path:path.join(out,`${compact?'desktop':'room'}-backpack-${p.viewportSize().width}.png`)});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true});
 try{
 for(const viewport of [{width:1180,height:820},{width:360,height:640}]){
  const p=await browser.newPage({viewport,hasTouch:viewport.width===360,isMobile:viewport.width===360}),errors=[],bad=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)bad.push(r.url())});await p.addInitScript(fixture);await p.goto(origin);await p.getByTestId('desktop-character').waitFor();
  await expect(p.getByTestId('desktop-character').locator('canvas[data-loaded=true]').first()).toBeVisible({timeout:15000});
  await p.getByRole('button',{name:'打开拉姆背包',exact:true}).click();await pocketLayout(p,true);await p.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await p.getByTestId('desktop-condition').click();const status=p.locator('.status-pocket');await expect(status).toBeVisible();const bars=await status.locator('progress').evaluateAll(xs=>xs.map(e=>e.getBoundingClientRect().width));assert.equal(bars.length,6);assert.ok(bars.every(w=>w>90),'Status uses the full pocket width');await p.screenshot({path:path.join(out,`desktop-status-${viewport.width}.png`)});await p.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await enterHome(p);await placeBoard(p);await roomTab(p,'状态');assert.equal(await p.getByRole('button',{name:/看看我的心情|回应心情/}).count(),0);const profile=await p.locator('.room-pet-card').evaluate(e=>({right:e.getBoundingClientRect().right,save:e.querySelector('form button').getBoundingClientRect().right}));assert.ok(profile.save<=profile.right-8,'Name form fits inside the status card');await p.screenshot({path:path.join(out,`room-status-${viewport.width}.png`)});
  await p.locator('.paper-tabs').getByRole('button',{name:'背包',exact:true}).click();await pocketLayout(p,false);const nav=await p.locator('.paper-tabs button').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().toJSON()));assert.ok(nav.every(x=>x.height<=28&&Math.abs(x.y-nav[0].y)<2),'Room tabs remain a small single row');await p.getByRole('button',{name:'关闭面板',exact:true}).click();
  await p.getByRole('button',{name:'小屋留言板',exact:true}).click();const board=p.getByRole('dialog',{name:'小屋留言板',exact:true});await expect(board).toBeVisible();assert.equal(await board.locator('.paper-tabs').count(),0);await expect(board.locator('.message-card-content')).toHaveCount(6);const artwork=await board.locator('.message-board-original-art').evaluate(async im=>{await im.decode();return {src:im.src,width:im.naturalWidth}});assert.ok(artwork.src.includes('message-board/window.'));assert.equal(artwork.width,1540);
  await p.screenshot({path:path.join(out,`official-board-${viewport.width}.png`)});
  // The original full board scrolls horizontally on phones; controls remain
  // keyboard accessible in the same independent dialog.
  await board.getByRole('button',{name:'我要留言',exact:true}).click();await p.locator('#board-note').fill('今晚把存档备份好');await p.screenshot({path:path.join(out,`official-compose-${viewport.width}.png`)});await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.length).toBe(8);
  await board.getByRole('button',{name:'回复留言：今晚把存档备份好',exact:true}).click();await p.locator('#board-note').fill('已经完成备份');await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.find(n=>n.text==='今晚把存档备份好')?.reply).toBe('已经完成备份');
  const noteBefore=(await saved(p)).notes.find(n=>n.id==='note-0');await board.getByRole('button',{name:'编辑留言：记得给拉姆准备牛奶。',exact:true}).click();await p.locator('#board-note').fill('记得给拉姆准备牛奶和饼干。');await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.find(n=>n.id==='note-0')?.text).toBe('记得给拉姆准备牛奶和饼干。');assert.equal((await saved(p)).notes.find(n=>n.id==='note-0').createdAt,noteBefore.createdAt);
  const card=board.locator('.message-card').filter({has:p.getByRole('button',{name:'编辑留言：今晚把存档备份好',exact:true})});await card.getByRole('button',{name:'□ 待完成',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.find(n=>n.text==='今晚把存档备份好')?.done).toBe(true);
  await board.getByRole('button',{name:'我要留言',exact:true}).click();await p.locator('#board-note').fill('临时测试留言');await board.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.length).toBe(9);await board.getByRole('button',{name:'删除留言：临时测试留言',exact:true}).click();await board.getByRole('button',{name:'保留',exact:true}).click();assert.equal((await saved(p)).notes.length,9);await board.getByRole('button',{name:'删除留言：临时测试留言',exact:true}).click();await board.getByRole('button',{name:'确认删除',exact:true}).click();await expect.poll(async()=>(await saved(p)).notes.length).toBe(8);
  const identity=(await saved(p)).createdAt;await p.keyboard.press('Escape');await expect(board).toHaveCount(0);await p.reload();await enterHome(p);assert.equal((await saved(p)).createdAt,identity);assert.equal((await saved(p)).notes.length,8);assert.ok((await saved(p)).notes.some(n=>n.reply==='已经完成备份'));
  if(viewport.width===1180)await p.screenshot({path:path.join(root,'docs/previews/room-overview.png')});
  await roomTab(p,'游戏');await p.getByRole('button',{name:'去打工',exact:true}).click();await expect(p.getByText('拉姆去餐厅打工了',{exact:true})).toBeVisible();await expect(p.locator('.scene-character')).toBeHidden();assert.equal(await p.locator('.ram-school[data-action=restaurant]').count(),0);await p.screenshot({path:path.join(out,`restaurant-${viewport.width}.png`)});
  await p.reload();await expect(p.locator('.pet-work-note')).toBeVisible();assert.equal(await p.locator('.pet-work-note').evaluate(e=>getComputedStyle(e).animationName),'none');await p.screenshot({path:path.join(out,`desktop-restaurant-${viewport.width}.png`)});await enterHome(p);await expect(p.getByText('拉姆去餐厅打工了',{exact:true})).toBeVisible();await p.getByRole('button',{name:'结束工作',exact:true}).click();await expect(p.locator('.scene-character')).toBeVisible();assert.equal((await saved(p)).activity,undefined);
  await roomTab(p,'游戏');await p.getByRole('button',{name:'去打工',exact:true}).click();await toDesktop(p);await p.locator('.pet-work-note').getByRole('button',{name:'结束工作',exact:true}).click();await expect(p.getByTestId('desktop-character')).toBeVisible();assert.equal((await saved(p)).activity,undefined);
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log(`PASS ${viewport.width}: compact right tabs, full-width status, scrolling navigation, warehouse ${viewport.width===360?'touch':'mouse'} drag, official board add/edit/reply/complete/delete/reload, restaurant absence and return`);await p.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
