const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const YAML=require('yaml');

function releaseDownloads(version){
 return [
  `mole-baby-${version}-Setup.exe`, `mole-baby-${version}-x64.zip`,
  ...['x64','ia32'].flatMap(arch=>[`mole-baby-${version}-legacy-${arch}-Setup.exe`,`mole-baby-${version}-legacy-${arch}.zip`]),
  ...['arm64','x64'].flatMap(arch=>[`mole-baby-${version}-mac-${arch}.zip`,`mole-baby-${version}-mac-${arch}.dmg`]),
 ];
}
function digest(file,algorithm,encoding='hex'){
 return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding);
}
function checkedSums(directory,expected){
 const lines=fs.readFileSync(path.join(directory,'SHA256SUMS.txt'),'utf8').split(/\r?\n/).filter(Boolean);
 const entries=new Map();
 for(const line of lines){
  const match=/^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
  assert.ok(match,`Invalid release checksum entry: ${line}`);
  const [,hash,name]=match;
  assert.ok(!entries.has(name),`Duplicate release checksum: ${name}`);
  assert.equal(digest(path.join(directory,name),'sha256'),hash,`${name} SHA256`);
  entries.set(name,hash);
 }
 for(const name of expected)assert.ok(entries.has(name),`Missing checked download: ${name}`);
 return entries;
}
function prepareUpdateMetadata(directory,version){
 assert.match(version,/^\d+\.\d+\.\d+$/,'Stable release version required');
 // A valid manifest is not enough: every downloadable ZIP/installer must have
 // a checked checksum, including the portable archives outside updater feeds.
 const sums=checkedSums(directory,releaseDownloads(version));
 const load=(name,expected)=>{
  const meta=YAML.parse(fs.readFileSync(path.join(directory,name),'utf8'),{maxAliasCount:0});
  assert.equal(meta.version,version,`${name} version`);
  assert.ok(Array.isArray(meta.files)&&meta.files.length===expected.length,`${name} files`);
  assert.deepEqual(meta.files.map(f=>f.url).sort(),[...expected].sort(),`${name} platform/architecture/channel`);
  for(const file of meta.files){
   assert.equal(path.basename(file.url),file.url);
   assert.ok(Number.isSafeInteger(file.size)&&file.size>0,`${file.url} valid size`);
   assert.equal(fs.statSync(path.join(directory,file.url)).size,file.size,`${file.url} size`);
   assert.equal(digest(path.join(directory,file.url),'sha512','base64'),file.sha512,`${file.url} SHA512`);
  }
  assert.ok(meta.files.some(f=>f.url===meta.path&&f.sha512===meta.sha512),`${name} compatibility entry`);
  return meta;
 };
 const windows=load('latest.yml',[`mole-baby-${version}-Setup.exe`]);
 const legacy=Object.fromEntries(['x64','ia32'].map(arch=>[
  arch,load(`legacy-${arch}.yml`,[`mole-baby-${version}-legacy-${arch}-Setup.exe`]),
 ]));
 const arm=load('latest-mac-arm64.yml',[`mole-baby-${version}-mac-arm64.zip`,`mole-baby-${version}-mac-arm64.dmg`]);
 const intel=load('latest-mac-x64.yml',[`mole-baby-${version}-mac-x64.zip`,`mole-baby-${version}-mac-x64.dmg`]);
 const mac={...intel,files:[...arm.files,...intel.files]};
 fs.writeFileSync(path.join(directory,'latest-mac.yml'),YAML.stringify(mac));
 for(const name of ['latest.yml','legacy-x64.yml','legacy-ia32.yml','latest-mac.yml']){
  sums.set(name,digest(path.join(directory,name),'sha256'));
 }
 fs.writeFileSync(path.join(directory,'SHA256SUMS.txt'),[...sums].map(([name,hash])=>`${hash}  ${name}`).join('\n')+'\n');
 console.log('PASS: ten checked downloads and isolated modern/legacy/Mac update channels match size and SHA512 digests');
 return{windows,legacy,mac};
}
if(require.main===module)prepareUpdateMetadata(path.resolve(__dirname,'../release'),require('../package.json').version);
module.exports={prepareUpdateMetadata,releaseDownloads};
