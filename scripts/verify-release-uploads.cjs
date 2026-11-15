const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
/** Check actual GitHub upload digests before making the release visible. */
function verifyReleaseUploads(assets,checksums,required=[]){
 const files=new Map();
 for(const asset of assets){assert(!files.has(asset.name),'Duplicate release attachment: '+asset.name);files.set(asset.name,asset)}
 let checked=0;
 for(const line of checksums.split(/\r?\n/).filter(Boolean)){
  const match=line.match(/^([a-f0-9]{64})  ([\w.-]+)$/);assert(match,'Invalid release checksum entry');
  const [,hash,name]=match,asset=files.get(name);assert(asset,'Missing release attachment: '+name);
  assert.equal(asset.digest,'sha256:'+hash,'Uploaded release bytes differ: '+name);assert(asset.size>0,'Empty release attachment: '+name);checked++;
 }
 assert(checked>0,'No release checksums were checked');
 for(const name of required)assert(files.has(name),'Missing release metadata: '+name);
 return {checked,attachments:files.size};
}
if(require.main===module){
 const release=path.resolve(__dirname,'../release'),data=JSON.parse(fs.readFileSync(process.argv[2]));
 const sums=['SHA256SUMS.txt','SHA256SUMS-android.txt'].map(name=>fs.readFileSync(path.join(release,name),'utf8')).join('\n');
 console.log('PASS uploaded release:',verifyReleaseUploads(data.assets,sums,['SHA256SUMS.txt','SHA256SUMS-android.txt','latest.yml','latest-mac.yml','legacy-x64.yml','legacy-ia32.yml','latest-android.json']));
}
module.exports={verifyReleaseUploads};
