const test=require('node:test'),assert=require('node:assert/strict');
const {verifyReleaseUploads}=require('./verify-release-uploads.cjs');
const hash='a'.repeat(64),asset={name:'resources-test.zip',size:20,digest:'sha256:'+hash},sums=hash+'  resources-test.zip\n';
test('every checksum has a corresponding release upload',()=>{
 assert.throws(()=>verifyReleaseUploads([],sums),/Missing release attachment/);
 assert.deepEqual(verifyReleaseUploads([asset],sums),{checked:1,attachments:1});
});
test('server upload digest matches checked package bytes',()=>{
 assert.throws(()=>verifyReleaseUploads([{...asset,digest:'sha256:'+'b'.repeat(64)}],sums),/Uploaded release bytes differ/);
});
test('Android manifest cannot be left only in another channel',()=>{
 assert.throws(()=>verifyReleaseUploads([asset],sums,['latest-android.json']),/Missing release metadata/);
});
test('malformed entries and duplicate names fail the gate',()=>{
 assert.throws(()=>verifyReleaseUploads([asset],hash+'  ../resources-test.zip'),/Invalid release checksum/);
 assert.throws(()=>verifyReleaseUploads([asset,asset],sums),/Duplicate release attachment/);
});
