const{test}=require('node:test'),assert=require('node:assert/strict');
const{VersionedGenericProvider,productionUpdateSource}=require('./update-source.cjs');
function provider(channel){return new VersionedGenericProvider(productionUpdateSource(channel),{isAddNoCacheQuery:false},{executor:{},platform:'win32'})}
test('pins installer and old/new blockmaps to their release, including skipped versions',()=>{
 const p=provider(),info={version:'1.3.0',files:[{url:'mole-baby-1.3.0-Setup.exe',sha512:'digest',size:50}]};
 const file=p.resolveFiles(info)[0].url;
 assert.equal(String(file),'https://github.com/Vinci-217/mole-baby/releases/download/v1.3.0/mole-baby-1.3.0-Setup.exe');
 assert.deepEqual(p.getBlockMapFiles(file,'1.0.0','1.3.0').map(String),[
  'https://github.com/Vinci-217/mole-baby/releases/download/v1.0.0/mole-baby-1.0.0-Setup.exe.blockmap',
  'https://github.com/Vinci-217/mole-baby/releases/download/v1.3.0/mole-baby-1.3.0-Setup.exe.blockmap',
 ]);
 assert.equal(p.isUseMultipleRangeRequest,false);
});
test('keeps legacy architecture metadata channels separate',()=>{
 for(const arch of['x64','ia32']){
  const p=provider(`legacy-${arch}`);assert.equal(p.channel,`legacy-${arch}`);
  const file=p.resolveFiles({version:'1.3.0',files:[{url:`mole-baby-1.3.0-legacy-${arch}-Setup.exe`,sha512:'digest'}]})[0].url;
  assert.match(String(p.getBlockMapFiles(file,'1.0.0','1.3.0')[0]),new RegExp(`v1.0.0/mole-baby-1.0.0-legacy-${arch}-Setup.exe.blockmap$`));
 }
});
test('rejects remote URLs, traversal and invalid versions in update metadata',()=>{
 for(const url of['https://other.example/installer.exe','../installer.exe','%2e%2e.exe','a/installer.exe','a\\installer.exe'])assert.throws(()=>provider().resolveFiles({version:'1.0.0',files:[{url,sha512:'x'}]}),/artifact/);
 for(const version of['../1.0.0','1.0.1-beta.1','garbage','v1.0.0'])assert.throws(()=>provider().resolveFiles({version,files:[{url:'installer.exe',sha512:'x'}]}),/version/);
 assert.equal(require('electron-updater/package.json').version,'6.8.11','Internal updater interfaces must remain pinned');
});
