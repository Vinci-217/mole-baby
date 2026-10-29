// Copied into a separately named, isolated test app. Excluded from production.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {createUpdates}=require('../../electron/updates.cjs');
const {VersionedGenericProvider}=require('../../electron/update-source.cjs');
const {profile,feed,arch,channel}=require('./config.json');
const version=require('../../package.json').version;
app.setPath('userData',profile);let updates;
app.whenReady().then(()=>{
 fs.appendFileSync(path.join(profile,'launches.jsonl'),JSON.stringify({version,pid:process.pid})+'\n');
 const window=new BrowserWindow({width:320,height:180,show:true});
 window.loadURL('data:text/html,<p>Isolated incremental update test</p>');
 updates=createUpdates({version,platform:'win32',arch,configFile:path.join(profile,'updates.json'),cacheDirectory:path.join(profile,'downloads'),installed:true,
  engineFactory:()=>new(require('electron-updater').NsisUpdater)({provider:'custom',updateProvider:VersionedGenericProvider,url:feed+'/releases/latest/download/',releaseBaseUrl:feed+'/releases/download/',channel,useMultipleRangeRequest:false}),
  prepareInstall:async()=>{
   const pet=JSON.parse(fs.readFileSync(path.join(profile,'pet-save.json')));if(pet.coins!==1234)return false;
   fs.writeFileSync(path.join(profile,'checkpoint.json'),JSON.stringify({saved:true,version}));window.webContents.session.flushStorageData();return true;
  },
  onChange:state=>fs.writeFileSync(path.join(profile,'state.json'),JSON.stringify(state)),
  onAvailable:()=>setTimeout(()=>{fs.appendFileSync(path.join(profile,'consents.jsonl'),JSON.stringify({operation:'download',version})+'\n');void updates.download(true)},300),
  onReady:state=>{fs.writeFileSync(path.join(profile,'download-result.json'),JSON.stringify(state));setTimeout(()=>{fs.appendFileSync(path.join(profile,'consents.jsonl'),JSON.stringify({operation:'install',version})+'\n');void updates.install(true)},300)},openPath:async()=>'',
 });
 updates.start();
});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>updates?.dispose());
