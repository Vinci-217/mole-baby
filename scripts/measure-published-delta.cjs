// Measures archived, publicly released DMGs using locally generated indexes.
// It does not publish indexes, change a release or mount/replace an application.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const{buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const{createUpdates,hashFile,checksumEntry}=require('../electron/updates.cjs');
const{createUpdateServer,mappedFetch}=require('./incremental-test-server.cjs');
(async()=>{
 const[directory,from,to,arch='arm64']=process.argv.slice(2);assert.ok(directory&&/^\d+\.\d+\.\d+$/.test(from)&&/^\d+\.\d+\.\d+$/.test(to)&&['arm64','x64'].includes(arch));
 const dir=path.resolve(directory),temp=fs.mkdtempSync(path.join(os.tmpdir(),'mole-published-delta-'));let service,updates;
 try{
  const packages={};
  for(const version of[from,to]){
   const name=`mole-baby-${version}-mac-${arch}.dmg`,file=path.join(dir,name),sums=fs.readFileSync(path.join(dir,`v${version}-SHA256SUMS.txt`),'utf8');
   const digest=await hashFile(file);assert.equal(digest,checksumEntry(sums,name),'Must match the public release checksum before measuring');
   await buildBlockMap(file,'gzip',file+'.blockmap');packages[version]={name,file,digest};
   console.log(`Verified public v${version} ${arch} DMG, ${fs.statSync(file).size} bytes; generated local blockmap`);
  }
  const before=packages[from],after=packages[to],index=fs.readFileSync(after.file+'.blockmap'),indexDigest=crypto.createHash('sha256').update(index).digest('hex');
  const files=new Map([[`/releases/download/v${to}/${after.name}`,after.file],[`/releases/download/v${to}/${after.name}.blockmap`,index],[`/releases/download/v${to}/SHA256SUMS.txt`,Buffer.from(`${after.digest}  ${after.name}\n${indexDigest}  ${after.name}.blockmap\n`)]]);
  service=await createUpdateServer(files,{version:to});const cache=path.join(temp,'cache');fs.mkdirSync(cache);
  fs.copyFileSync(before.file,path.join(cache,before.name));fs.copyFileSync(before.file+'.blockmap',path.join(cache,before.name+'.blockmap'));
  updates=createUpdates({version:from,platform:'darwin',arch,macSigned:false,cacheDirectory:cache,configFile:path.join(temp,'updates.json'),fetch:mappedFetch(service.origin,to),openPath:async()=>''});
  assert.equal(await updates.check(),true);assert.equal(await updates.download(true),true);const state=updates.getState();assert.equal(state.downloadMode,'differential');
  assert.equal(await hashFile(path.join(cache,after.name)),after.digest);
  const requests=service.requests.filter(r=>r.path.endsWith('.dmg'));assert.ok(requests.every(r=>r.range&&r.status===206));
  const packageBytes=requests.reduce((sum,r)=>sum+r.bodyBytes,0),indexBytes=service.requests.filter(r=>r.path.endsWith('.blockmap')).reduce((sum,r)=>sum+r.bodyBytes,0),size=fs.statSync(after.file).size;
  assert.equal(packageBytes,state.transferredBytes);
  const report={kind:'archived-public-releases',versions:[from,to],platform:'darwin',arch,originalPublicSha256:Object.fromEntries(Object.entries(packages).map(([version,p])=>[version,p.digest])),fullPackageBytes:size,packageBytesTransferred:packageBytes,blockmapBytesTransferred:indexBytes,totalUpdateBytesTransferred:service.requests.reduce((sum,r)=>sum+r.bodyBytes,0),reusedBytes:state.reusedBytes,savedPercent:Number(((1-(packageBytes+indexBytes)/size)*100).toFixed(2)),rangeRequests:requests.length,mode:state.downloadMode,byteIdentical:true,limitation:'Unmodified public DMGs with verified published checksums; blockmaps generated locally and transfer measured over loopback. No public release change, native mount or application replacement was performed by this script'};
  fs.mkdirSync(path.join(__dirname,'../artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,`../artifacts/incremental-published-mac-${arch}.json`),JSON.stringify(report,null,2)+'\n');console.log('PUBLISHED_DELTA_REPORT '+JSON.stringify(report));
 }finally{updates?.dispose();if(service)await service.close();fs.rmSync(temp,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
