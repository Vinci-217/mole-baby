const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),YAML=require('yaml');
function prepareUpdateMetadata(directory,version){
 const load=(name,expected)=>{
  const meta=YAML.parse(fs.readFileSync(path.join(directory,name),'utf8'),{maxAliasCount:0});assert.equal(meta.version,version,`${name} version`);assert.ok(Array.isArray(meta.files)&&meta.files.length===expected.length,`${name} files`);
  assert.deepEqual(meta.files.map(f=>f.url).sort(),[...expected].sort(),`${name} platform/architecture`);
  for(const f of meta.files){assert.equal(path.basename(f.url),f.url);const file=fs.readFileSync(path.join(directory,f.url));assert.equal(file.length,f.size,`${f.url} size`);assert.equal(crypto.createHash('sha512').update(file).digest('base64'),f.sha512,`${f.url} SHA512`)}
  assert.ok(meta.files.some(f=>f.url===meta.path&&f.sha512===meta.sha512),`${name} legacy entry`);return meta;
 };
 const windows=load('latest.yml',[`mole-baby-${version}-Setup.exe`]);
 const arm=load('latest-mac-arm64.yml',[`mole-baby-${version}-mac-arm64.zip`,`mole-baby-${version}-mac-arm64.dmg`]);
 const intel=load('latest-mac-x64.yml',[`mole-baby-${version}-mac-x64.zip`,`mole-baby-${version}-mac-x64.dmg`]);
 const mac={...intel,files:[...arm.files,...intel.files]};
 fs.writeFileSync(path.join(directory,'latest-mac.yml'),YAML.stringify(mac));
 const sums=path.join(directory,'SHA256SUMS.txt');let content=fs.readFileSync(sums,'utf8').split('\n').filter(line=>line&&!/  latest(?:-mac)?\.yml$/.test(line));
 for(const name of ['latest.yml','latest-mac.yml'])content.push(`${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,name))).digest('hex')}  ${name}`);
 fs.writeFileSync(sums,content.join('\n')+'\n');
 console.log('PASS: Windows and merged two-architecture Mac update metadata match all installer sizes and SHA512 digests');
 return{windows,mac};
}
if(require.main===module)prepareUpdateMetadata(path.resolve(__dirname,'../release'),require('../package.json').version);
module.exports={prepareUpdateMetadata};
