const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {originalAssetPath}=require('./original-assets.cjs');
test('the original animation protocol serves only the bundled read-only asset tree',()=>{
 const root=path.resolve('dist/assets/original/official');
 assert.equal(originalAssetPath('ram-original://assets/runtime.html?id=abc',root),path.join(root,'runtime.html'));
 assert.equal(originalAssetPath('ram-original://assets/ruffle/test.wasm',root),path.join(root,'ruffle/test.wasm'));
 for(const url of ['https://assets/runtime.html','ram-original://other/runtime.html','ram-original://assets/%2e%2e%2fuser.json','ram-original://assets/%2fetc%2fpasswd','ram-original://assets/test.exe','ram-original://assets/folder%5csecret.json'])assert.equal(originalAssetPath(url,root),null,url);
});
