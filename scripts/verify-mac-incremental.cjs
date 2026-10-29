const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const {createUpdateServer}=require('./incremental-test-server.cjs');
const root=path.resolve(__dirname,'..');
function run(command,args,log,options={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,stdio:['ignore',log,log],...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Native Mac fixture exited ${code}: ${command}`)))})}
async function sha256(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex')}
(async()=>{
 assert.equal(process.platform,'darwin');const arch=process.argv[2]??process.arch;assert.equal(arch,process.arch);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mole-native-delta-')),files=new Map();let service,log;
 try{
  const config=path.join(root,'artifacts/mac-incremental-builder.cjs');fs.mkdirSync(path.dirname(config),{recursive:true});
  log=fs.openSync(path.join(root,`artifacts/mac-incremental-${arch}.log`),'a');
  fs.writeFileSync(config,`const{build}=require('../package.json');const{macBuildConfig}=require('../scripts/mac-signing-policy.cjs');const c=macBuildConfig(build);module.exports={...c,directories:{...c.directories,output:process.env.MOLE_FIXTURE_OUTPUT},extraMetadata:{...c.extraMetadata,version:process.env.MOLE_FIXTURE_VERSION}};`);
  const packages={};
  for(const version of['1.0.0','1.0.1']){
   const output=path.join(temp,version);
   await run(process.execPath,[path.join(root,'node_modules/electron-builder/cli.js'),'--config',config,'--mac','dmg',`--${arch}`,'--publish','never'],log,{env:{...process.env,MOLE_MAC_DISTRIBUTION:'local',MOLE_FIXTURE_OUTPUT:output,MOLE_FIXTURE_VERSION:version}});
   const name=`mole-baby-${version}-mac-${arch}.dmg`,file=path.join(output,name);assert.ok(fs.statSync(file).size>1000000);
   await buildBlockMap(file,'gzip',file+'.blockmap');packages[version]={name,file,digest:await sha256(file),mapDigest:await sha256(file+'.blockmap')};
   files.set(`/releases/download/v${version}/${name}`,file);files.set(`/releases/download/v${version}/${name}.blockmap`,file+'.blockmap');
   console.log(`PASS: built full product Mac ${arch} DMG ${version}, including original animation payload`);
  }
  const next=packages['1.0.1'];files.set('/releases/download/v1.0.1/SHA256SUMS.txt',Buffer.from(`${next.digest}  ${next.name}\n${next.mapDigest}  ${next.name}.blockmap\n`));
  service=await createUpdateServer(files);
  const probeConfig=path.join(temp,'probe.json'),reportFile=path.join(temp,'result.json');
  fs.writeFileSync(probeConfig,JSON.stringify({root,temp,origin:service.origin,arch,packages,reportFile}));
  await run(require('electron'),[path.join(root,'scripts/mac-incremental-probe.cjs'),probeConfig],log);
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8')),requests=service.requests.filter(r=>r.path.endsWith('.dmg'));
  assert.ok(requests.length>0);assert.ok(requests.every(r=>r.range&&r.status===206),'Must not fetch the complete DMG');
  const bytes=requests.reduce((sum,r)=>sum+r.bodyBytes,0),indexBytes=service.requests.filter(r=>r.path.endsWith('.blockmap')).reduce((sum,r)=>sum+r.bodyBytes,0);
  assert.equal(bytes,report.packageBytesTransferred);assert.ok(bytes<report.fullPackageBytes);
  Object.assign(report,{rangeRequests:requests.length,blockmapBytesTransferred:indexBytes,totalUpdateBytesTransferred:service.requests.reduce((sum,r)=>sum+r.bodyBytes,0),savedPercent:Number(((1-(bytes+indexBytes)/report.fullPackageBytes)*100).toFixed(2))});
  fs.writeFileSync(path.join(root,`artifacts/incremental-mac-${arch}.json`),JSON.stringify(report,null,2)+'\n');console.log('INCREMENTAL_REPORT '+JSON.stringify(report));
  console.log('PASS: native Mac DMG incremental reconstruction, exact SHA256, native codesign, disk image mount, bundled version and saved companion data; application replacement was not performed');
 }finally{if(service)await service.close();if(log)fs.closeSync(log);fs.rmSync(temp,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
