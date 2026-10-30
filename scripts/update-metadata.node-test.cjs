const{test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),YAML=require('yaml');
const{prepareUpdateMetadata,releaseDownloads,releaseBlockmaps}=require('./update-metadata.cjs');
const{gzipSync}=require('node:zlib');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-update-meta-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const version='1.2.3';
 for(const name of releaseDownloads(version))fs.writeFileSync(path.join(dir,name),Buffer.from(name));
 function write(meta,files){
  const entries=files.map(name=>{const data=fs.readFileSync(path.join(dir,name));return{url:name,sha512:crypto.createHash('sha512').update(data).digest('base64'),size:data.length}});
  fs.writeFileSync(path.join(dir,meta),YAML.stringify({version,files:entries,path:entries[0].url,sha512:entries[0].sha512,releaseDate:'2026-10-25T00:00:00Z'}));
 }
 write('latest.yml',[`mole-baby-${version}-Setup.exe`]);
 for(const arch of['x64','ia32'])write(`legacy-${arch}.yml`,[`mole-baby-${version}-legacy-${arch}-Setup.exe`]);
 for(const arch of['arm64','x64'])write(`latest-mac-${arch}.yml`,[`mole-baby-${version}-mac-${arch}.zip`,`mole-baby-${version}-mac-${arch}.dmg`]);
 for(const name of releaseBlockmaps(version)){const size=fs.statSync(path.join(dir,name.slice(0,-'.blockmap'.length))).size;fs.writeFileSync(path.join(dir,name),gzipSync(JSON.stringify({version:'2',files:[{name:'file',offset:0,sizes:[size],checksums:[Buffer.alloc(18).toString('base64')]}]})))}
 const sums=[...releaseDownloads(version),...releaseBlockmaps(version)].map(name=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')}  ${name}`);
 fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),sums.join('\n')+'\n');
 return{dir,version,write};
}
test('merges Mac architectures and keeps both legacy channels separate and idempotently checksummed',t=>{
 const{dir,version}=fixture(t),result=prepareUpdateMetadata(dir,version);
 assert.equal(result.mac.files.length,4);assert.equal(result.windows.files.length,1);
 assert.ok(result.legacy.x64.files[0].url.endsWith('-legacy-x64-Setup.exe'));
 assert.ok(result.legacy.ia32.files[0].url.endsWith('-legacy-ia32-Setup.exe'));
 const persisted=YAML.parse(fs.readFileSync(path.join(dir,'latest-mac.yml'),'utf8'));
 assert.ok(persisted.files.some(f=>f.url.endsWith('arm64.zip')));assert.ok(persisted.files.some(f=>f.url.endsWith('x64.zip')));
 const first=fs.readFileSync(path.join(dir,'SHA256SUMS.txt'),'utf8');prepareUpdateMetadata(dir,version);
 assert.equal(fs.readFileSync(path.join(dir,'SHA256SUMS.txt'),'utf8'),first);assert.equal(first.trim().split('\n').length,21);
});
test('rejects a stale release version or corrupted installer before publication',t=>{
 const{dir,version}=fixture(t);assert.throws(()=>prepareUpdateMetadata(dir,'1.2.4'),/Missing checked download|version/);
 fs.appendFileSync(path.join(dir,`mole-baby-${version}-Setup.exe`),'bad');assert.throws(()=>prepareUpdateMetadata(dir,version),/SHA256/);
});
test('a legacy feed cannot point at a modern installer or the other legacy architecture',t=>{
 const{dir,version,write}=fixture(t);
 write('legacy-x64.yml',[`mole-baby-${version}-Setup.exe`]);assert.throws(()=>prepareUpdateMetadata(dir,version),/channel/);
 write('legacy-x64.yml',[`mole-baby-${version}-legacy-ia32-Setup.exe`]);assert.throws(()=>prepareUpdateMetadata(dir,version),/channel/);
});
test('requires both legacy channels and all portable archive checksums',t=>{
 const{dir,version}=fixture(t),manifest=path.join(dir,'legacy-ia32.yml');fs.unlinkSync(manifest);
 assert.throws(()=>prepareUpdateMetadata(dir,version),/ENOENT/);
 const next=fixture(t),sums=path.join(next.dir,'SHA256SUMS.txt');
 fs.writeFileSync(sums,fs.readFileSync(sums,'utf8').split('\n').filter(line=>!line.endsWith('-legacy-ia32.zip')).join('\n'));
 assert.throws(()=>prepareUpdateMetadata(next.dir,next.version),/Missing checked download/);
});
test('rejects duplicate checksum names and stale manifest sizes or SHA512 values',t=>{
 const a=fixture(t),sums=path.join(a.dir,'SHA256SUMS.txt');fs.appendFileSync(sums,fs.readFileSync(sums,'utf8').split('\n')[0]+'\n');
 assert.throws(()=>prepareUpdateMetadata(a.dir,a.version),/Duplicate/);
 for(const field of['size','sha512']){
  const f=fixture(t),name=path.join(f.dir,'legacy-x64.yml'),meta=YAML.parse(fs.readFileSync(name,'utf8'));
  meta.files[0][field]=field==='size'?meta.files[0].size+1:'bad';fs.writeFileSync(name,YAML.stringify(meta));
  assert.throws(()=>prepareUpdateMetadata(f.dir,f.version),field==='size'?/size/:/SHA512/);
 }
});

test('publication waits for modern, legacy and Mac package verification and uploads isolated feeds',()=>{
 const workflow=YAML.parse(fs.readFileSync(path.join(__dirname,'../.github/workflows/windows-build.yml'),'utf8'));
 assert.deepEqual(workflow.jobs.release.needs,['build','legacy','mac','android']);
 assert.equal(workflow.jobs.android.uses,'./.github/workflows/android-preview.yml');
 assert.match(workflow.jobs.release.steps.find(s=>s.name==='Check artifact checksums').run,/SHA256SUMS-android/);
 assert.deepEqual(workflow.jobs.legacy.strategy.matrix.arch,['x64','ia32']);
 assert.match(workflow.jobs.release.if,/refs\/tags\/v/);
 const upload=workflow.jobs.legacy.steps.find(s=>s.name==='Upload checked legacy downloads');
 assert.match(upload.with.path,/legacy-\$\{\{ matrix.arch \}\}.yml/);
 const publish=workflow.jobs.release.steps.find(s=>s.name==='Create release or replace its build attachments').run;
 assert.match(publish,/release\/legacy-x64.yml release\/legacy-ia32.yml/);
 assert.match(publish,/release\/\*\.blockmap/);
 const check=workflow.jobs.release.steps.find(s=>s.name==='Check artifact checksums').run;
 assert.ok(check.indexOf('sha256sum --check SHA256SUMS.txt')<check.indexOf('prepare-update-blockmaps.cjs'));
 assert.ok(check.indexOf('prepare-update-blockmaps.cjs')<check.indexOf('update-metadata.cjs'));
 for(const job of ['build','legacy','mac']){
  for(const step of workflow.jobs[job].steps.filter(s=>s.name.includes('Test ')||s.name==='Build renderer'||s.name==='Build shared renderer')){
   assert.match(step.run,/set -o pipefail/);assert.match(step.run,/tee -a artifacts\//);
  }
 }
});

test('Git receipt records ten unique downloads and legacy diagnostics, including partial build failures',t=>{
 const vm=require('node:vm');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mole-receipt-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const downloads=path.join(root,'ramu-downloads'),logs=path.join(root,'ramu-smoke');fs.mkdirSync(downloads);fs.mkdirSync(logs);
 const version='1.2.3',names=releaseDownloads(version),groups=[['SHA256SUMS.txt',names.slice(0,2)],['SHA256SUMS-legacy-x64.txt',names.slice(2,4)],['SHA256SUMS-legacy-ia32.txt',names.slice(4,6)],['SHA256SUMS-mac-arm64.txt',names.slice(6,8)],['SHA256SUMS-mac-x64.txt',names.slice(8,10)]];
 for(const[name,files]of groups)fs.writeFileSync(path.join(downloads,name),files.map(file=>'a'.repeat(64)+'  '+file).join('\n')+'\n');
 for(const arch of['x64','ia32'])fs.writeFileSync(path.join(logs,`legacy-${arch}-smoke.log`),`PASS legacy ${arch}`);
 const workflow=YAML.parse(fs.readFileSync(path.join(__dirname,'../.github/workflows/windows-build.yml'),'utf8'));
 const script=workflow.jobs.report.steps.at(-1).run.match(/node <<'NODE'\n([\s\S]+?)\nNODE/)[1];
 const env={RUNNER_TEMP:root,BUILD_RESULT:'success',LEGACY_RESULT:'success',MAC_RESULT:'success',RELEASE_RESULT:'success',GITHUB_SHA:'checked-source',GITHUB_REF_NAME:'v1.2.3',GITHUB_SERVER_URL:'https://github.com',GITHUB_REPOSITORY:'Vinci-217/mole-baby',GITHUB_RUN_ID:'123'};
 const execute=()=>{vm.runInNewContext(script,{require:name=>name==='./package.json'?{version}:require(name),process:{env}});return JSON.parse(fs.readFileSync(path.join(root,'ramu-build-receipt.json'),'utf8'))};
 const receipt=execute();assert.equal(receipt.downloads.length,10);assert.equal(receipt.platforms.legacyWindows,'success');assert.equal(receipt.buildResult,'success');assert.equal(receipt.legacyVerificationLogs.ia32,'PASS legacy ia32');
 fs.unlinkSync(path.join(downloads,'SHA256SUMS-legacy-ia32.txt'));assert.throws(execute,/ten unique/);
 env.LEGACY_RESULT='failure';env.RELEASE_RESULT='skipped';const failure=execute();assert.equal(failure.buildResult,'failure');assert.equal(failure.releaseUrl,null);assert.equal(failure.platforms.legacyWindows,'failure');
});

test('publication rejects a missing or malformed index and generation checks the final installer bytes',async t=>{
 const{prepareUpdateBlockmaps}=require('./prepare-update-blockmaps.cjs');
 const f=fixture(t),index=releaseBlockmaps(f.version)[0];fs.unlinkSync(path.join(f.dir,index));
 assert.throws(()=>prepareUpdateMetadata(f.dir,f.version),/ENOENT/);
 await prepareUpdateBlockmaps(f.dir,f.version);prepareUpdateMetadata(f.dir,f.version);
 const before=fs.readFileSync(path.join(f.dir,'SHA256SUMS.txt'),'utf8');await prepareUpdateBlockmaps(f.dir,f.version);prepareUpdateMetadata(f.dir,f.version);
 assert.equal(fs.readFileSync(path.join(f.dir,'SHA256SUMS.txt'),'utf8'),before);
 fs.appendFileSync(path.join(f.dir,releaseDownloads(f.version)[0]),'tamper');
 await assert.rejects(prepareUpdateBlockmaps(f.dir,f.version),/unchecked installer/);
});
