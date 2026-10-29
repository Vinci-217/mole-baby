const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),asar=require('@electron/asar'),YAML=require('yaml');
const {createUpdateServer}=require('./incremental-test-server.cjs');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mole-real-update-')),profile=path.join(temporary,'profile'),install=path.join(temporary,'MoleBabyUpdateFixture'),fixture=path.join(root,'artifacts/update-fixture-app'),config=path.join(root,'artifacts/update-fixture-builder.cjs');
const args=process.argv.slice(2),legacy=args.includes('--legacy'),fullPayload=args.includes('--full-payload'),arch=args.includes('--ia32')?'ia32':'x64';
let service,log;
function run(command,args,options={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,stdio:['ignore',log,log],windowsHide:true,...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Fixture command exited ${code}: ${command}`)))})}
function powershell(script){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:60000,windowsHide:true})}
const quote=value=>"'"+value.replaceAll("'","''")+"'";
(async()=>{
 assert.equal(process.platform,'win32');fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(fixture,{recursive:true});log=fs.openSync(path.join(root,'artifacts/windows-update-fixture.log'),'a');
 const payload={name:'小更新',color:'blue',growth:180,coins:1234,memories:['我们一起读过书。']},save=path.join(profile,'pet-save.json');fs.writeFileSync(save,JSON.stringify(payload));
 const files=new Map();service=await createUpdateServer(files);
 fs.copyFileSync(path.join(root,'scripts/windows-update-fixture-main.cjs'),path.join(fixture,'main.cjs'));
 fs.writeFileSync(path.join(fixture,'config.json'),JSON.stringify({profile,feed:service.origin,arch,channel:legacy?`legacy-${arch}`:'latest'}));
 fs.writeFileSync(config,`const{build}=require('../package.json');module.exports={...build,appId:'com.molebaby.updatefixture',productName:'MoleBabyUpdateFixture',${legacy?"electronVersion:'22.3.27',":''}directories:{output:process.env.MOLE_FIXTURE_OUTPUT},files:[${fullPayload?'...build.files,':"'electron/**/*.cjs','!electron/**/*.node-test.cjs','package.json',"}'artifacts/update-fixture-app/**/*'],extraMetadata:{name:'mole-baby-update-fixture',main:'artifacts/update-fixture-app/main.cjs',version:process.env.MOLE_FIXTURE_VERSION},publish:[{provider:'generic',url:${JSON.stringify(service.origin+'/releases/latest/download/')},${legacy?`channel:'legacy-${arch}'`:''}}],win:{...build.win,artifactName:'fixture-'+process.env.MOLE_FIXTURE_VERSION+'-${arch}.'+'\${ext}'},nsis:{...build.nsis,createDesktopShortcut:false,createStartMenuShortcut:false,artifactName:'fixture-'+process.env.MOLE_FIXTURE_VERSION+'-Setup.exe'}};`);
 const builder=path.join(root,'node_modules/electron-builder/cli.js');let newSize;
 for(const version of ['1.0.0','1.0.1']){
  const output=path.join(temporary,version);await run(process.execPath,[builder,'--win','nsis',`--${arch}`,'--publish','never','--config',config],{env:{...process.env,MOLE_FIXTURE_OUTPUT:output,MOLE_FIXTURE_VERSION:version}});
  const unpacked=arch==='ia32'?'win-ia32-unpacked':'win-unpacked';
  assert.equal(JSON.parse(asar.extractFile(path.join(output,unpacked,'resources/app.asar'),'package.json')).version,version);
  const name=`fixture-${version}-Setup.exe`,exe=path.join(output,name);assert.ok(fs.statSync(exe).size>1_000_000);
  files.set(`/releases/download/v${version}/${name}`,exe);files.set(`/releases/download/v${version}/${name}.blockmap`,exe+'.blockmap');
  if(version==='1.0.1'){
   const meta=YAML.parse(fs.readFileSync(path.join(output,legacy?`legacy-${arch}.yml`:'latest.yml'),'utf8'));assert.equal(meta.version,version);newSize=fs.statSync(exe).size;
   files.set(`/releases/latest/download/${legacy?`legacy-${arch}`:'latest'}.yml`,Buffer.from(YAML.stringify(meta)));
  }
  console.log(`PASS: packaged real ${legacy?'legacy':'modern'} ${arch} NSIS updater fixture ${version}; full product assets=${fullPayload}`);
 }
 // The harness alone simulates positive download and installation answers.
 await run(path.join(temporary,'1.0.0/fixture-1.0.0-Setup.exe'),['/S','/currentuser',`/D=${install}`]);
 const initial=spawn(path.join(install,'MoleBabyUpdateFixture.exe'),[],{cwd:install,stdio:['ignore',log,log],windowsHide:true});initial.on('error',error=>console.error(error));
 const deadline=Date.now()+300000;let launches=[];
 while(Date.now()<deadline){try{launches=fs.readFileSync(path.join(profile,'launches.jsonl'),'utf8').trim().split('\n').map(JSON.parse)}catch{}if(launches.some(v=>v.version==='1.0.1'))break;await new Promise(r=>setTimeout(r,300))}
 assert.ok(launches.some(v=>v.version==='1.0.0'),'initial installed fixture must run');assert.ok(launches.some(v=>v.version==='1.0.1'),`new installed version did not relaunch: ${fs.existsSync(path.join(profile,'state.json'))?fs.readFileSync(path.join(profile,'state.json'),'utf8'):'no update state'}`);
 assert.deepEqual(fs.readFileSync(path.join(profile,'consents.jsonl'),'utf8').trim().split('\n').map(JSON.parse),[{operation:'download',version:'1.0.0'},{operation:'install',version:'1.0.0'}]);
 assert.deepEqual(JSON.parse(fs.readFileSync(save,'utf8')),payload);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'checkpoint.json'),'utf8')),{saved:true,version:'1.0.0'});
 assert.equal(JSON.parse(asar.extractFile(path.join(install,'resources/app.asar'),'package.json')).version,'1.0.1');
 const state=JSON.parse(fs.readFileSync(path.join(profile,'download-result.json'),'utf8'));assert.equal(state.downloadMode,'differential');assert.ok(state.reusedBytes>0);
 const downloads=service.requests.filter(r=>r.path.endsWith('.exe'));assert.ok(downloads.length>0);assert.ok(downloads.every(r=>r.range&&r.status===206),'Successful update must never request the entire installer');
 const bytes=downloads.reduce((sum,r)=>sum+r.bodyBytes,0),indices=service.requests.filter(r=>r.path.endsWith('.blockmap')).reduce((sum,r)=>sum+r.bodyBytes,0);
 assert.ok(bytes<newSize);assert.ok(service.requests.some(r=>r.path.includes('/v1.0.0/')&&r.path.endsWith('.blockmap')),'Must find the old index in its own release');
 const report={platform:'win32',arch,edition:legacy?'legacy':'modern',runtime:legacy?'22.3.27':require('../package.json').devDependencies.electron,fullProductPayload:fullPayload,fixtureVersions:['1.0.0','1.0.1'],fullPackageBytes:newSize,packageBytesTransferred:bytes,blockmapBytesTransferred:indices,totalUpdateBytesTransferred:service.requests.reduce((sum,r)=>sum+r.bodyBytes,0),savedPercent:Number(((1-(bytes+indices)/newSize)*100).toFixed(2)),rangeRequests:downloads.length,mode:state.downloadMode,installedVersion:'1.0.1',savePreserved:true,applicationRelaunched:true,limitation:'Two isolated installers contain the current product payload with a test main process and a version change; production release-to-release savings will vary'};
 fs.writeFileSync(path.join(root,`artifacts/incremental-windows-${legacy?'legacy-':''}${arch}.json`),JSON.stringify(report,null,2)+'\n');console.log('INCREMENTAL_REPORT '+JSON.stringify(report));
 console.log('PASS: real Windows differential download, separate download/install consent, NSIS installation and relaunch, SHA512 verification, save checkpoint and companion data preservation');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
 try{powershell(`Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith(${quote(install)},[StringComparison]::OrdinalIgnoreCase)} | Stop-Process -Force -ErrorAction SilentlyContinue`)}catch{}
 const uninstaller=path.join(install,'Uninstall MoleBabyUpdateFixture.exe');if(fs.existsSync(uninstaller))try{await run(uninstaller,['/S',`_?=${install}`])}catch{}
 if(service)await service.close();if(log)fs.closeSync(log);
 fs.rmSync(temporary,{recursive:true,force:true,maxRetries:4,retryDelay:300});
});
