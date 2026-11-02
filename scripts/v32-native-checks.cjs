const {expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {enterHome,roomTab,toDesktop,openActions}=require('./smoke-helpers.cjs');
async function verifyV32Native(page,desktop){
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  await page.evaluate(async()=>{await window.desktop.setPetScale(1);await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);const key='ramu-house-save-v1',pet=JSON.parse(localStorage.getItem(key));Object.assign(pet,{growth:420,highestGrowth:420,growthLocked:true,evolution:undefined,activity:undefined,outing:undefined,sleeping:false,lastTick:Date.now()});localStorage.setItem(key,JSON.stringify(pet));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,sound:false,roomWander:false}));localStorage.setItem('ramu-room-media-v1',JSON.stringify({musicEnabled:false,backgroundPlayback:false}));});
  await page.reload();await page.getByTestId('desktop-character').waitFor();await enterHome(page);await roomTab(page,'设置');
  const opened=desktop.waitForEvent('window');await page.getByRole('button',{name:'大小变换',exact:true}).click();const editor=await opened;
  await expect(editor.getByRole('heading',{name:'拉姆大小变换',exact:true})).toBeVisible();await editor.locator('#percent').fill('175');const closed=editor.waitForEvent('close');await editor.getByRole('button',{name:'确认',exact:true}).click().catch(error=>{if(!editor.isClosed())throw error});await closed;
  await expect.poll(()=>page.evaluate(async()=>(await window.desktop.getState()).petScale)).toBe(1.75);
  await toDesktop(page);
  const results=[];
  for(const scale of [.5,1,1.25,1.75,2,3]){
   await page.evaluate(scale=>window.desktop.setPetScale(scale),scale);
   await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {bounds:w.getBounds(),zoom:Math.round(w.webContents.getZoomFactor()*10000)/10000}})).toMatchObject({bounds:{width:Math.round(160*scale),height:Math.round(240*scale)},zoom:scale});
   const body=page.getByTestId('desktop-character');await expect(body).toBeVisible();const rect=await body.boundingBox();assert.ok(Math.abs(rect.width/rect.height-100/108.34)<.002,'body keeps its original aspect ratio');
   await (await openActions(page)).getByRole('button',{name:'状态',exact:true}).click();await expect(page.getByRole('region',{name:'拉姆状态面板',exact:true})).toBeVisible();await expect(page.locator('.pocket-status progress')).toHaveCount(6);await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
   results.push({scale,cssBody:rect});
  }
  const fromTray=desktop.waitForEvent('window');await page.evaluate(()=>window.desktop.openSizeEditor());const smallEditor=await fromTray;
  await expect(smallEditor.locator('#percent')).toHaveValue('300');assert.ok(await smallEditor.evaluate(()=>innerWidth)>300,'the editor keeps its own 100% zoom');
  const trayClosed=smallEditor.waitForEvent('close');await smallEditor.close();await trayClosed;
  await page.evaluate(()=>window.desktop.setPetScale(1));await enterHome(page);
  await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0],b=w.getBounds();w.setBounds({...b,width:360,height:320})});
  await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([360,320]);await page.locator('.room-dock').getByRole('button',{name:'打开小屋留言板',exact:true}).click();await expect(page.getByRole('region',{name:'小屋留言板',exact:true})).toBeVisible();
  const header=await page.locator('.panel-header').boundingBox();assert.ok(header.y>=0&&header.y+header.height<=320);await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  const profile=await desktop.evaluate(({app})=>app.getPath('userData'));assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'window-state.json'))).petScale,1);
  const out=path.resolve(__dirname,'../artifacts/v32');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`native-${process.platform}-${process.arch}.json`),JSON.stringify({passed:true,scales:results,roomSize:[360,320],sizeDialog:true},null,2)+'\n');
  console.log('PASS v0.32 native: editable size dialog, six proportional zooms, real native bounds, interactive status panels, preference persistence and 360x320 room');
 }finally{
  await page.evaluate(async values=>{await window.desktop.setPetScale(1);localStorage.clear();for(const[key,value]of Object.entries(values))localStorage.setItem(key,value)},snapshot);
  await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0],b=w.getBounds();w.setBounds({...b,width:1180,height:820})});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
 }
}
module.exports={verifyV32Native};
