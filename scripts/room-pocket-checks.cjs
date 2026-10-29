const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{expect}=require('@playwright/test');
const{enterHome,roomTab,toDesktop,openActions,enterBackpack}=require('./smoke-helpers.cjs');
const{warpPointer}=require('./native-pointer.cjs');
async function verifyRoomPocket(page,desktop){
 const out=path.resolve(__dirname,'../artifacts/room-pocket');fs.mkdirSync(out,{recursive:true});
 const label=process.platform+'-'+process.arch;
 const bounds=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 await page.evaluate(()=>{const key='ramu-house-save-v1',p=JSON.parse(localStorage.getItem(key));p.inventory={biscuit:5,berry:2,'180001':4,'180007':2,'180010':1,juice:3,'180002':2,'180003':2,'180009':1,'180005':1};p.lastTick=Date.now();localStorage.setItem(key,JSON.stringify(p))});await page.reload();await page.getByTestId('desktop-character').waitFor();
 await enterHome(page);const original=await bounds();
 try{
  await expect(page.locator('.room-resize-edge')).toHaveCount(8);
  await desktop.evaluate(({BrowserWindow,screen})=>{const area=screen.getPrimaryDisplay().workArea;BrowserWindow.getAllWindows()[0].setBounds({x:area.x+10,y:area.y+10,width:900,height:680})});
  const b=await bounds();const pointer={x:b.x+b.width-5,y:b.y+b.height-5};
  await warpPointer(desktop,pointer);assert.equal(await page.evaluate(()=>window.desktop.startRoomResize('se')),true);
  await warpPointer(desktop,{x:pointer.x+40,y:pointer.y+20});
  await expect.poll(async()=>Math.abs((await bounds()).width-(b.width+40))).toBeLessThanOrEqual(1);await page.evaluate(()=>window.desktop.endRoomResize());
  const dragged=await bounds();assert.ok(Math.abs(dragged.height-(b.height+20))<=1);
  const grip=page.getByRole('button',{name:'调整小屋右下角大小',exact:true});await grip.focus();await grip.press('ArrowLeft');
  await expect.poll(async()=>Math.abs((await bounds()).width-(dragged.width-16))).toBeLessThanOrEqual(1);
  const custom=await bounds();await page.getByRole('button',{name:'全屏查看小屋',exact:true}).click();await expect(page.locator('.room-resize-edge')).toHaveCount(0);
  await page.getByRole('button',{name:'退出小屋全屏',exact:true}).click();await expect(page.locator('.room-resize-edge')).toHaveCount(8);assert.deepEqual(await bounds(),custom);
  await toDesktop(page);assert.equal((await bounds()).width,160);assert.equal(await page.evaluate(()=>window.desktop.adjustRoomSize(16,16)),false);
  await enterHome(page);assert.deepEqual(await bounds(),custom);
  const profile=await desktop.evaluate(({app})=>app.getPath('userData'));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'window-state.json'))).normalBounds,custom);
  await page.evaluate(()=>window.desktop.adjustRoomSize(-124,-60));
  await page.screenshot({path:path.join(out,label+'-small-room.png')});
  for(const name of ['回到桌面','全屏查看小屋','进入摩尔庄园'])await expect(page.getByRole('button',{name,exact:true})).toBeInViewport();
  await roomTab(page,'背包');await verifyTabs(page.getByRole('region',{name:'拉姆用品背包',exact:true}));
  await toDesktop(page);await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();
  const pocket=await enterBackpack(page);await verifyTabs(pocket);
  const tab=pocket.getByRole('tab',{name:'食物',exact:true});await tab.focus();await tab.press('End');await expect(pocket.getByRole('tab',{name:'药水',exact:true})).toHaveAttribute('aria-selected','true');await pocket.getByRole('tab',{name:'药水',exact:true}).press('Home');await expect(tab).toHaveAttribute('aria-selected','true');
  const panel=page.getByTestId('companion-panel');const fit=await panel.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.pocket-heading,.pocket-categories,.pocket-items,.pocket-pages')].every(n=>{const b=n.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom+.5&&b.left>=r.left&&b.right<=r.right+.5})});assert.equal(fit,true,'Compact categories, square slots and page controls must all fit');
  await page.screenshot({path:path.join(out,label+'-desktop-pocket.png'),omitBackground:true});await pocket.getByRole('button',{name:'关闭小窗',exact:true}).click();
  console.log('PASS: native DIP room drag/keyboard resize, fullscreen/desktop size restore, persisted bounds and four inline square-grid pocket categories');
 }finally{
  await page.evaluate(async()=>{await window.desktop.endRoomResize();await window.desktop.setRoomFullscreen(false)});await enterHome(page);await desktop.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows()[0].setBounds(b),original);await toDesktop(page);
  await page.evaluate(snapshot=>{localStorage.clear();for(const [key,value]of Object.entries(snapshot))localStorage.setItem(key,value)},snapshot);await page.reload();await page.getByTestId('desktop-character').waitFor();
 }
}
async function verifyTabs(pocket){
 const tabs=pocket.getByRole('tablist',{name:'物品分类',exact:true}).getByRole('tab');assert.deepEqual(await tabs.allTextContents(),['食物','饮品','清洁','药水']);await expect(pocket.locator('select')).toHaveCount(0);
 const rows=await tabs.evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().top));assert.ok(Math.max(...rows)-Math.min(...rows)<1,'All four categories share one row');
 for(const name of ['食物','饮品','清洁','药水']){
  const tab=pocket.getByRole('tab',{name,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');await expect(pocket.locator('.pocket-slot')).toHaveCount(16);
  const squares=await pocket.locator('.pocket-slot').evaluateAll(ns=>ns.every(n=>{const b=n.getBoundingClientRect();return Math.abs(b.width-b.height)<1}));assert.equal(squares,true);
  const expected={'食物':['biscuit','berry','180001','180007','180010'],'饮品':['juice','180002'],'清洁':['180003','180009'],'药水':['180005']}[name];assert.deepEqual((await pocket.locator('[data-item-id]').evaluateAll(ns=>ns.map(n=>n.dataset.itemId))).sort(),expected.sort());
 }
 await pocket.getByRole('tab',{name:'食物',exact:true}).click();
}
module.exports={verifyRoomPocket};
