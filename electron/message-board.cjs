// The pet renderer owns the save. The board sends notes-only edits, never a
// second game loop or an old complete snapshot that could undo a colour change.
function createMessageBoard({ipcMain,BrowserWindow,getMain,isMain,preload,indexPath,getURL}){
 let window=null,snapshot=null,pending=null,sequence=0;
 const valid=value=>value&&Number.isSafeInteger(value.createdAt)&&typeof value.name==='string'&&Array.isArray(value.notes)&&JSON.stringify(value).length<50000;
 const isBoard=event=>window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame;
 const requireBoard=event=>{if(!isBoard(event))throw new Error('Untrusted message board request')};
 function update(value){
  if(value!==null&&!valid(value))throw new TypeError('Invalid message board snapshot');
  snapshot=value===null?null:{name:value.name,createdAt:value.createdAt,notes:value.notes};
  if(window&&!window.isDestroyed())window.webContents.send('board:snapshot',snapshot);
  return snapshot;
 }
 function open(value){
  update(value);if(!snapshot)return false;
  if(window&&!window.isDestroyed()){window.show();window.focus();return true}
  const main=getMain();if(!main||main.isDestroyed())return false;
  window=new BrowserWindow({width:980,height:740,minWidth:380,minHeight:360,title:'小屋留言板',autoHideMenuBar:true,alwaysOnTop:true,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false}});
  const board=window;board.setMenu(null);board.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  board.webContents.on('will-navigate',event=>event.preventDefault());
  board.on('closed',()=>{if(window===board)window=null;if(pending){clearTimeout(pending.timer);pending.reject(new Error('留言板已关闭'));pending=null}});
  const url=getURL();const loaded=url?board.loadURL(`${url}#message-board`):board.loadFile(indexPath,{hash:'message-board'});
  void loaded.then(()=>{if(!board.isDestroyed()){board.show();board.focus()}}).catch(error=>{console.warn('Unable to open message board:',error.message);if(!board.isDestroyed())board.close()});
  return true;
 }
 ipcMain.handle('board:get',event=>{requireBoard(event);return snapshot});
 ipcMain.handle('board:change',(event,change)=>{
  requireBoard(event);
  if(pending)throw new Error('正在保存，请稍候。');
  if(!change||!snapshot||change.petId!==snapshot.createdAt||change.baseNotes!==JSON.stringify(snapshot.notes)||!Array.isArray(change.notes)||change.notes.length>40||JSON.stringify(change.notes).length>45000)throw new Error('留言已有更新，请重试。');
  const main=getMain();if(!main||main.isDestroyed())throw new Error('拉姆暂时无法保存，请稍后重试。');
  return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{if(pending?.id===id)pending=null;reject(new Error('保存超时，请重试。'))},5000);pending={id,timer,resolve,reject};main.webContents.send('board:patch',{...change,id})});
 });
 ipcMain.on('board:reply',(event,id,result)=>{
  if(!isMain(event)||!pending||pending.id!==id)return;
  const task=pending;pending=null;clearTimeout(task.timer);
  if(result?.ok&&valid(result.snapshot)){update(result.snapshot);task.resolve(snapshot)}
  else{
   if(result?.reason==='stale'&&valid(result.snapshot))update(result.snapshot);
   task.reject(new Error(result?.reason==='stale'?'留言已有更新，请重试。':result?.reason==='storage'?'本地存储写入失败，请检查存储空间。':'留言未保存，请重试。'));
  }
 });
 ipcMain.handle('board:close',event=>{requireBoard(event);window.close()});
 return{open,update,isOpen:()=>Boolean(window&&!window.isDestroyed())};
}
module.exports={createMessageBoard};
