const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),{createXapk}=require('./android/prepare-update.cjs');

test('XAPK contains a byte-identical base APK and install manifest',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mole-xapk-')),apk=path.join(root,'app.apk'),out=path.join(root,'out');fs.mkdirSync(out);const bytes=Buffer.from('signed apk fixture\0\x01\x02');fs.writeFileSync(apk,bytes);
 const result=createXapk(apk,out,{applicationId:'com.molebaby.ramu.preview',minSdk:26,targetSdk:36},{versionCode:1330100,versionName:'0.33.1'});
 assert.equal(path.basename(result.path),'mole-baby-android-1330100.xapk');
 const listing=cp.execFileSync('python3',['-c',"import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print('\\n'.join(z.namelist()));print(z.read('manifest.json').decode());assert z.read('base.apk')==open(sys.argv[2],'rb').read()",result.path,apk],{encoding:'utf8'});
 assert.match(listing,/^base\.apk\nmanifest\.json\n/);assert.match(listing,/"package_name":"com\.molebaby\.ramu\.preview"/);assert.match(listing,/"file":"base\.apk"/);
 fs.rmSync(root,{recursive:true,force:true});
});
