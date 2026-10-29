const {app,net}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const {createUpdates,hashFile}=require(path.join(config.root,'electron/updates.cjs'));
const {mappedFetch}=require('./incremental-test-server.cjs');
let updates;
app.whenReady().then(async()=>{
 const {temp,origin,arch,packages,reportFile}=config,cache=path.join(temp,'downloads'),saveFile=path.join(temp,'pet.json');
 const pet={name:'小更新',coins:1234,color:'blue',memories:['我们一起读过书。']};
 const deadline=setTimeout(()=>{updates?.dispose();console.error('Native Mac incremental test timed out');app.exit(1)},5*60000);
 try{
  fs.mkdirSync(cache);fs.writeFileSync(saveFile,JSON.stringify(pet));
  const before=packages['1.0.0'],after=packages['1.0.1'];
  fs.copyFileSync(before.file,path.join(cache,before.name));fs.copyFileSync(before.file+'.blockmap',path.join(cache,before.name+'.blockmap'));
  let mountedVersion=null;
  updates=createUpdates({version:'1.0.0',platform:'darwin',arch,macSigned:false,configFile:path.join(temp,'updates.json'),cacheDirectory:cache,fetch:mappedFetch(origin,'1.0.1',(url,options)=>net.fetch(url,options)),openPath:async file=>{
   execFileSync('/usr/bin/hdiutil',['verify',file],{stdio:'pipe'});
   const mount=fs.mkdtempSync(path.join(os.tmpdir(),'mole-delta-mount-'));let attached=false;
   try{
    execFileSync('/usr/bin/hdiutil',['attach',file,'-readonly','-nobrowse','-mountpoint',mount],{stdio:'pipe'});attached=true;
    const bundle=path.join(mount,'拉姆.app');execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'pipe'});
    mountedVersion=execFileSync('/usr/libexec/PlistBuddy',['-c','Print:CFBundleShortVersionString',path.join(bundle,'Contents/Info.plist')],{encoding:'utf8'}).trim();assert.equal(mountedVersion,'1.0.1');
   }finally{if(attached)execFileSync('/usr/bin/hdiutil',['detach',mount],{stdio:'pipe'});fs.rmSync(mount,{recursive:true,force:true})}
   return'';
  }});
  assert.equal(await updates.check(),true);assert.equal(updates.getState().status,'available');
  assert.equal(await updates.download(false),false);assert.equal(await updates.install(true),false);
  assert.equal(await updates.download(true),true);const state=updates.getState();assert.equal(state.status,'ready');assert.equal(state.downloadMode,'differential');assert.ok(state.reusedBytes>0);
  const downloaded=path.join(cache,after.name);assert.equal(await hashFile(downloaded),after.digest);
  assert.equal(await hashFile(path.join(cache,before.name)),before.digest);
  assert.equal(await updates.install(true),true);assert.deepEqual(JSON.parse(fs.readFileSync(saveFile,'utf8')),pet);
  fs.writeFileSync(reportFile,JSON.stringify({platform:'darwin',arch,runtime:process.versions.electron,fullProductPayload:true,fixtureVersions:['1.0.0','1.0.1'],fullPackageBytes:fs.statSync(after.file).size,packageBytesTransferred:state.transferredBytes,reusedBytes:state.reusedBytes,mode:state.downloadMode,mountedVersion,sha256Verified:true,codeSignatureVerified:true,savePreserved:true,applicationReplaced:false,limitation:'Two full product DMGs with a version change, served from an isolated loopback source; actual release-to-release savings will vary'}));
 }catch(error){console.error(error);process.exitCode=1}finally{clearTimeout(deadline);updates?.dispose();app.exit(process.exitCode??0)}
});
