const{expect}=require('@playwright/test'),assert=require('node:assert/strict'),{enterHome,roomTab,toDesktop}=require('./smoke-helpers.cjs'),{version}=require('../package.json');
async function verifyUpdateSurface(page,desktop){
 if(!desktop)return;
 const state=await page.evaluate(()=>window.desktop.updates.getState());assert.equal(state.currentVersion,version);assert.equal(state.status,'disabled');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
 const ack=await desktop.evaluate(({ipcMain,BrowserWindow})=>new Promise((resolve,reject)=>{const id='smoke-checkpoint-'+Date.now();const timeout=setTimeout(()=>{ipcMain.removeListener('updates:prepared',listener);reject(Error('No renderer update checkpoint'))},5000);function listener(_event,requestId,ok){if(requestId!==id)return;clearTimeout(timeout);ipcMain.removeListener('updates:prepared',listener);resolve(ok)}ipcMain.on('updates:prepared',listener);BrowserWindow.getAllWindows()[0].webContents.send('updates:prepare',id)}));assert.equal(ack,true);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));for(const field of['createdAt','name','color','coins','inventory'])assert.deepEqual(after[field],before[field]);
 await enterHome(page);await roomTab(page,'设置');const updates=page.getByRole('region',{name:'软件更新',exact:true});await expect(updates).toContainText(`v${version}`);await expect(updates.getByRole('button',{name:'检查更新',exact:true})).toBeDisabled();await expect(updates.getByLabel('启动时自动更新',{exact:true})).toBeChecked();
 await page.evaluate(()=>window.desktop.updates.setEnabled(false));await expect(updates.getByLabel('启动时自动更新',{exact:true})).not.toBeChecked();assert.equal((await page.evaluate(()=>window.desktop.updates.getState())).enabled,false);
 await page.evaluate(()=>window.desktop.updates.setEnabled(true));await expect(updates.getByLabel('启动时自动更新',{exact:true})).toBeChecked();await toDesktop(page);
 console.log('PASS: packaged updater settings/IPC, persisted toggle and renderer save checkpoint; disabled test contexts never contact live releases');
}
module.exports={verifyUpdateSurface};
