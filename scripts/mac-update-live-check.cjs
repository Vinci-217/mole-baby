/** Real GitHub metadata + DMG download in the packaged Mac's Electron network
 * stack. The 0.0.0 fixture opens no installer and never changes the running app. */
async function verifyMacUpdateNetwork(desktop){
 if(process.platform!=='darwin')return;
 const result=await desktop.evaluate(async({app,net})=>{
  const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-mac-update-live-'));
  const{createUpdates}=require(path.join(app.getAppPath(),'electron/updates.cjs'));
  let opened=false;
  const updates=createUpdates({version:'0.0.0',platform:'darwin',arch:process.arch,macSigned:false,
   configFile:path.join(directory,'config.json'),cacheDirectory:path.join(directory,'downloads'),
   fetch:(url,options)=>net.fetch(url,options),openPath:async file=>{if(!fs.existsSync(file))throw Error('Missing verified DMG');opened=true;return''},engineFactory:()=>{throw Error('Unsigned Mac must use verified DMG')},prepareInstall:async()=>false});
  try{
   if(!await updates.check(true)||updates.getState().status!=='available')throw Error(updates.getState().message);
   const version=updates.getState().version;
   if(fs.existsSync(path.join(directory,'downloads')))throw Error('Downloaded without consent');
   if(!await updates.download(true)||updates.getState().status!=='ready')throw Error(updates.getState().message);
   if(!await updates.install(true)||!opened)throw Error('Verified DMG was not passed to installer opener');
   return {version,arch:process.arch,verified:true};
  }finally{updates.dispose();fs.rmSync(directory,{recursive:true,force:true})}
 });
 console.log(`PASS Mac live updater: Electron fetched v${result.version} ${result.arch} through GitHub, consented DMG download + SHA256 verified; installer opener stubbed`);
}
module.exports={verifyMacUpdateNetwork};
