/** Real startup timer, GitHub requests, consent flow, download and mounted DMG
 * in the packaged Mac's network stack. Never replaces the running app. */
async function verifyMacUpdateNetwork(desktop){
 if(process.platform!=='darwin')return;
 const result=await desktop.evaluate(async({app,net})=>{
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-mac-update-live-'));
  const{createUpdates}=require(path.join(app.getAppPath(),'electron/updates.cjs'));
  const{createUpdatePrompts}=require(path.join(app.getAppPath(),'electron/update-prompts.cjs'));
  let opened=false,consent=false,dialogCount=0,mountedVersion,signalAvailable,signalError;
  const available=new Promise((resolve,reject)=>{signalAvailable=resolve;signalError=reject});
  const updates=createUpdates({version:'0.0.0',platform:'darwin',arch:process.arch,macSigned:false,
   configFile:path.join(directory,'config.json'),cacheDirectory:path.join(directory,'downloads'),
   fetch:(url,options)=>net.fetch(url,options),
   onAvailable:()=>signalAvailable(),onChange:state=>{if(state.status==='error')signalError(Error(state.message))},
   openPath:async file=>{
    if(!fs.existsSync(file))throw Error('Missing verified DMG');
    const mount=path.join(directory,'mounted');fs.mkdirSync(mount);let attached=false;
    try{
     execFileSync('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,file],{timeout:60000,stdio:'pipe'});attached=true;
     const name=fs.readdirSync(mount).find(n=>n.endsWith('.app'));if(!name)throw Error('Downloaded DMG has no application');
     mountedVersion=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',path.join(mount,name,'Contents/Info.plist')],{encoding:'utf8'}).trim();
     if(mountedVersion!==updates.getState().version)throw Error('Mounted application version mismatch');
     opened=true;return'';
    }finally{if(attached)execFileSync('/usr/bin/hdiutil',['detach',mount],{timeout:30000,stdio:'pipe'})}
   },engineFactory:()=>{throw Error('Unsigned Mac must use verified DMG')},prepareInstall:async()=>false});
  const prompts=createUpdatePrompts({getUpdates:()=>updates,platform:'darwin',showMessageBox:async()=>{dialogCount++;return{response:consent?0:1}}});
  let timeout;
  try{
   updates.start();await Promise.race([available,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Mac startup check did not discover a release')),90000)})]);
   if(updates.getState().status!=='available')throw Error(updates.getState().message);
   const version=updates.getState().version;
   if(fs.existsSync(path.join(directory,'downloads')))throw Error('Downloaded without consent');
   if(await prompts.offerDownload()||fs.existsSync(path.join(directory,'downloads')))throw Error('Dismissing download prompt granted consent');
   consent=true;if(!await prompts.download()||updates.getState().status!=='ready')throw Error(updates.getState().message);
   if(!await prompts.install()||!opened||dialogCount!==3)throw Error('Confirmed DMG open did not complete');
   return {version,mountedVersion,arch:process.arch,verified:true};
  }finally{clearTimeout(timeout);prompts.dispose();updates.dispose();fs.rmSync(directory,{recursive:true,force:true})}
 });
 console.log(`PASS Mac live updater: real 8s startup check fetched v${result.version} ${result.arch}; decline/confirm prompts, DMG download + SHA256 and mounted app v${result.mountedVersion} verified; application replacement not performed`);
}
module.exports={verifyMacUpdateNetwork};
