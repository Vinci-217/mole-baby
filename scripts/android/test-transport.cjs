/** Exercise production delta code against interrupted streams and real HTTP,
 * without an emulator/SDK. Android UI/APK verification still uses Gradle. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),cache=path.resolve(root,'../.cache/android-transport');
const dependencies=[
 ['junit','junit/junit/4.13.2/junit-4.13.2.jar','8e495b634469d64fb8acfa3495a065cbacc8a0fff55ce1e31007be4c16dc57d3'],
 ['hamcrest','org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar','66fdef91e9739348df7a096aa384a5685f4e875584cce89386a7a47251c4d8e9'],
 ['json','org/json/json/20250517/json-20250517.jar','3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796'],
];
(async()=>{
 fs.mkdirSync(cache,{recursive:true});
 for(const [name,url,sha] of dependencies){const file=path.join(cache,name+'.jar');if(!fs.existsSync(file)){const response=await fetch('https://repo.maven.apache.org/maven2/'+url);if(!response.ok)throw Error('Test dependency unavailable: '+name);fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));}if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==sha)throw Error('Test dependency checksum mismatch: '+name);}
 const generated=path.join(cache,'generated/com/molebaby/ramu/BuildConfig.java'),classes=path.join(cache,'classes');fs.mkdirSync(path.dirname(generated),{recursive:true});fs.mkdirSync(classes,{recursive:true});
 fs.writeFileSync(generated,'package com.molebaby.ramu; final class BuildConfig { static final String VERSION_NAME="transport-test"; }\n');
 const source=path.join(root,'android/app/src/main/java/com/molebaby/ramu'),test=path.join(root,'android/app/src/test/java/com/molebaby/ramu');
 cp.execFileSync('javac',['--release','17','-cp',path.join(cache,'*'),'-d',classes,generated,...['DeltaPlan','UpdateTransport','SafeFiles','Json'].map(n=>path.join(source,n+'.java')),...['DeltaDownloadTest','HttpDeltaIntegrationTest'].map(n=>path.join(test,n+'.java'))],{stdio:'inherit'});
 cp.execFileSync('java',['-cp',path.join(cache,'*')+path.delimiter+classes,'org.junit.runner.JUnitCore','com.molebaby.ramu.DeltaDownloadTest','com.molebaby.ramu.HttpDeltaIntegrationTest'],{stdio:'inherit'});
})().catch(e=>{console.error(e);process.exitCode=1});
