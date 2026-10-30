const test=require('node:test'),assert=require('node:assert/strict');
const{previousBases}=require('./android/prepare-update.cjs');
const packageName='com.molebaby.ramu.preview',signature='a'.repeat(64);
const release=(versionCode,bases=[])=>({schema:1,channel:'android-preview',packageName,versionCode,apk:{size:1024,signerSha256:signature,blockmap:{url:'map-'+versionCode,sha256:'b'.repeat(64)}},bases});
test('first Android release needs no unavailable baseline',()=>assert.deepEqual(previousBases(null,packageName,1,signature),[]));
test('Android manifests retain skipped-version blockmaps, bounded to 12',()=>{const bases=Array.from({length:20},(_,i)=>({versionCode:20-i,size:100,blockmap:{url:'old-'+i}}));const result=previousBases(release(21,bases),packageName,30,signature);assert.equal(result[0].versionCode,21);assert.equal(result[1].versionCode,20);assert.equal(result.length,12);});
test('different packages, channels, downgrades and signing keys cannot be offered as upgrades',()=>{const previous=release(21);assert.throws(()=>previousBases(previous,'com.another',30,signature));assert.throws(()=>previousBases({...previous,channel:'latest'},packageName,30,signature));assert.throws(()=>previousBases(previous,packageName,20,signature));assert.throws(()=>previousBases(previous,packageName,30,'c'.repeat(64)));});
