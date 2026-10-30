#!/usr/bin/env node
'use strict';
// Generates reviewable artifacts only. This command never creates a tag or Release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const{buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const{environment}=require('./gradle.cjs');
const root=path.resolve(__dirname,'../..'),base='https://github.com/Vinci-217/mole-baby/releases/download/android-preview/';
const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1]};
function hash(file){const digest=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(1024*1024),fd=fs.openSync(file,'r');try{let size;while((size=fs.readSync(fd,buffer,0,buffer.length,null)))digest.update(buffer.subarray(0,size));return digest.digest('hex');}finally{fs.closeSync(fd);}}
function signer(apk){const env=environment(),sdk=env.ANDROID_HOME||env.ANDROID_SDK_ROOT;if(!sdk)throw Error('设置 ANDROID_HOME 后再生成更新清单。');const jar=path.join(sdk,'build-tools','36.0.0','lib','apksigner.jar'),binary=env.JAVA_HOME?path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';const result=cp.execFileSync(binary,['-jar',jar,'verify','--print-certs',apk],{encoding:'utf8',env});const fingerprints=[...result.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})/g)].map(m=>m[1].toLowerCase());if(fingerprints.length!==1)throw Error('需要单一且固定的 APK 签名。');return {fingerprint:fingerprints[0],debug:result.includes('CN=Android Debug')};}
function previousBases(previous,packageName,code,signerSha256){
 if(!previous)return [];
 if(previous.schema!==1||previous.channel!=='android-preview'||previous.packageName!==packageName||!Number.isInteger(previous.versionCode)||previous.versionCode>=code)throw Error('上一版本清单的渠道、包名或版本不匹配。');
 if(signerSha256&&previous.apk.signerSha256!==signerSha256)throw Error('APK 签名与上一版本不同，不能覆盖升级已安装的拉姆。');
 return [{versionCode:previous.versionCode,size:previous.apk.size,blockmap:previous.apk.blockmap},...(previous.bases??[])].filter(v=>v?.blockmap&&v.versionCode<code).slice(0,12);
}
async function publishedManifest(){
 const response=await fetch(base+'latest-android.json',{signal:AbortSignal.timeout(30000)});if(response.status===404)return null;if(!response.ok)throw Error('无法读取上一版安卓更新清单：HTTP '+response.status);
 const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>256*1024)throw Error('上一版更新清单超出大小限制');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function prepare(){
 const apk=path.resolve(arg('--apk')||path.join(root,'android/app/build/outputs/apk/release/app-release.apk')),out=path.resolve(arg('--out')||path.join(root,'mobile-release'));
 const metadata=JSON.parse(fs.readFileSync(path.join(path.dirname(apk),'output-metadata.json'),'utf8')),element=metadata.elements.find(e=>e.outputFile===path.basename(apk));if(!element)throw Error('APK 与 Gradle output-metadata.json 不匹配。');
 const development=process.argv.includes('--development'),signature=signer(apk);if(!development&&(metadata.applicationId.endsWith('.dev')||signature.debug))throw Error('开发签名包不能生成正式更新清单；本地演练请使用 --development。');
 fs.mkdirSync(out,{recursive:true});const code=element.versionCode,name=`mole-baby-android-${code}.apk`,target=path.join(out,name);fs.copyFileSync(apk,target);await buildBlockMap(target,'gzip',target+'.blockmap');
 const describe=file=>({url:base+path.basename(file),size:fs.statSync(file).size,sha256:hash(file)}),apkDescriptor={...describe(target),signerSha256:signature.fingerprint,blockmap:describe(target+'.blockmap')};
 const assets=path.join(root,'android/app/src/main/assets/web'),index=JSON.parse(fs.readFileSync(path.join(assets,'resource-index.json'),'utf8'));
 const resourcesName=`resources-${index.revision}.zip`,resources=path.join(out,resourcesName),indexFile=path.join(out,`resources-${index.revision}.json`);
 fs.copyFileSync(path.join(assets,'resources.zip'),resources);fs.copyFileSync(path.join(assets,'resources.zip.blockmap'),resources+'.blockmap');fs.copyFileSync(path.join(assets,'resource-index.json'),indexFile);
 const priorFile=arg('--previous'),previous=priorFile?JSON.parse(fs.readFileSync(priorFile,'utf8')):process.argv.includes('--fetch-previous')?await publishedManifest():null;
 const manifest={schema:1,channel:'android-preview',packageName:metadata.applicationId,versionCode:code,versionName:element.versionName,minSdk:26,apk:apkDescriptor,bases:previousBases(previous,metadata.applicationId,code,signature.fingerprint),resources:{...describe(resources),revision:index.revision,minAppCode:code,maxAppCode:code,index:describe(indexFile),blockmap:describe(resources+'.blockmap')}};
 const manifestName=development?'latest-android-development.json':'latest-android.json';fs.writeFileSync(path.join(out,manifestName),JSON.stringify(manifest,null,2)+'\n');
 const deliver=[name,name+'.blockmap',resourcesName,resourcesName+'.blockmap',path.basename(indexFile),manifestName];fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),deliver.map(f=>hash(path.join(out,f))+'  '+f).join('\n')+'\n');
 console.log(`${development?'开发演练':'固定签名预览'}更新产物已生成：${out}；未发布。APK ${Math.round(apkDescriptor.size/1024/1024)} MiB，保留 ${manifest.bases.length} 个历史差量基线。`);
}
if(require.main===module)prepare().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={previousBases};
