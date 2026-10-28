/** Native consent is shared by startup notifications, settings and tray actions.
 * Dismissing a prompt never grants consent; quitting never installs an update. */
function createUpdatePrompts({getUpdates,showMessageBox,onError=()=>{},platform=process.platform}){
 const offered=new Set(),pending=new Map();
 let disposed=false,queue=Promise.resolve();
 function prompt(kind,automatic=false){
  const updates=getUpdates(),state=updates?.getState(),status=kind==='download'?'available':'ready';
  if(disposed||!state||state.status!==status||!state.version)return Promise.resolve(false);
  const key=`${kind}:${state.version}`;
  if(pending.has(key))return pending.get(key);
  if(automatic&&offered.has(key))return Promise.resolve(false);
  offered.add(key);
  const installing=kind==='install',restart=installing&&state.automaticInstall;
  const task=queue.then(async()=>{
   try{
    const before=updates.getState();
    if(disposed||before.version!==state.version||before.status!==status)return false;
    const manualMac=installing&&!restart&&platform==='darwin';
    const answer=await showMessageBox({type:'question',title:installing?'新版已准备好':'发现新版本',message:installing?`拉姆 v${state.version} 已下载完成`:`发现拉姆新版本 v${state.version}`,detail:installing?(restart?'确认后会先保存拉姆，再更新并重启。选择稍后更新可继续使用当前版本，退出时也不会自动安装。':manualMac?'确认后打开已校验的 DMG。请将「拉姆」拖到「应用程序」并选择替换，再从托盘退出旧版并重新打开。只打开 DMG 不会完成更新，宠物存档会保留。':'确认后打开已校验的安装包。选择稍后更新可继续使用当前版本。'):'是否下载更新？选择稍后提醒可继续使用当前版本，不会在后台自行下载或安装。',buttons:[installing?(restart?'更新并重启':manualMac?'打开 DMG 安装':'打开安装包'):'下载更新',installing?'稍后更新':'稍后提醒'],defaultId:1,cancelId:1,noLink:true});
    if(disposed||answer.response!==0)return false;
    const current=updates.getState();if(current.version!==state.version||current.status!==status)return false;
    return await(installing?updates.install(true):updates.download(true));
   }catch(error){onError(error);return false}
   finally{pending.delete(key)}
  });
  queue=task.then(()=>{},()=>{});
  pending.set(key,task);return task;
 }
 return {offerDownload:()=>prompt('download',true),offerInstall:()=>prompt('install',true),download:()=>prompt('download'),install:()=>prompt('install'),dispose(){disposed=true}};
}
module.exports={createUpdatePrompts};
