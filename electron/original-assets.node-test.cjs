const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {originalAssetPath,createOriginalAssetReader,registerOriginalAssets}=require('./original-assets.cjs');
test('the original animation protocol serves only the bundled read-only asset tree',()=>{
 const root=path.resolve('dist/assets/original/official');
 assert.equal(originalAssetPath('ram-original://assets/runtime.html?id=abc',root),path.join(root,'runtime.html'));
 assert.equal(originalAssetPath('ram-original://assets/ruffle/test.wasm',root),path.join(root,'ruffle/test.wasm'));
 for(const url of ['https://assets/runtime.html','ram-original://other/runtime.html','ram-original://assets/%2e%2e%2fuser.json','ram-original://assets/%2fetc%2fpasswd','ram-original://assets/test.exe','ram-original://assets/folder%5csecret.json'])assert.equal(originalAssetPath(url,root),null,url);
});
test('bundled reads coalesce in flight, reuse bytes and retry failed reads',async()=>{
 let calls=0,release;const cache=createOriginalAssetReader({readFile:async file=>{calls++;if(file==='broken')throw Error('unavailable');await new Promise(resolve=>release=resolve);return Buffer.from(file)}});
 const a=cache.read('same'),b=cache.read('same');await Promise.resolve();assert.equal(calls,1);release();assert.equal(await a,await b);await cache.read('same');assert.equal(calls,1);
 await assert.rejects(cache.read('broken'));await assert.rejects(cache.read('broken'));assert.equal(calls,3);
});
test('bundled byte cache has an LRU budget and never stores an oversized file',async()=>{
 let calls=0;const cache=createOriginalAssetReader({maxBytes:6,readFile:async file=>{calls++;return Buffer.from(file)}});
 await cache.read('aaa');await cache.read('bbb');await cache.read('aaa');await cache.read('ccc');assert.equal(cache.size,6);await cache.read('bbb');assert.equal(calls,4);
 await cache.read('oversize');await cache.read('oversize');assert.equal(calls,6);assert.equal(cache.size,6);
});
test('protocol retains error handling and only content-hashed engines get persistent browser caching',async()=>{
 const fs=require('node:fs'),os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ram-assets-'));
 try{fs.writeFileSync(path.join(dir,'runtime.js'),'code');fs.writeFileSync(path.join(dir,'1234567890abcdef1234.wasm'),'wasm');let receive;
  registerOriginalAssets({registerBufferProtocol:(scheme,handler)=>{assert.equal(scheme,'ram-original');receive=handler}},dir);
  const get=url=>new Promise(resolve=>receive({url},resolve));
  assert.equal((await get('ram-original://assets/runtime.js')).headers['Cache-Control'],'no-cache');
  assert.match((await get('ram-original://assets/1234567890abcdef1234.wasm')).headers['Cache-Control'],/immutable/);
  assert.equal((await get('ram-original://assets/no.swf')).error,-6);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
