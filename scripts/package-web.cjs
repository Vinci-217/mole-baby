#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {verifyOfflineAssets}=require('./verify-offline-assets.cjs');
const {inspectBookAssets}=require('./publish-book-assets.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist'),release=path.join(root,'release'),version=require('../package.json').version;
async function main(){
 const built=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,VITE_WEB_APP:'1',VITE_LOCAL_DEBUG:'0'}});
 if(built.error)throw built.error;if(built.status!==0)throw Error('Web production build failed');
 await fsp.mkdir(release,{recursive:true});
 const staging=await fsp.mkdtemp(path.join(release,'web-main-'));
 const mainDir=path.join(staging,'renderer');
 const bookAssets=process.env.MOLE_WEB_BOOK_ASSETS||path.join(staging,'books');
 const sharedIndex=process.env.MOLE_WEB_BOOK_ASSETS?['--book-index',path.join(bookAssets,'book-packs.json')]:[];
 try{
 const split=spawnSync(process.platform==='win32'?'python':'python3',[
  'scripts/split-resource-packs.py',output,bookAssets,'--light-renderer',mainDir,...sharedIndex,
 ],{cwd:root,stdio:'inherit'});
 if(split.error)throw split.error;
 if(split.status!==0)throw Error('Web book split failed');
 const resources=verifyOfflineAssets(mainDir);
 const books=await inspectBookAssets(bookAssets);
 const mirror=path.join(mainDir,'optional-books',books.tag);
 await fsp.mkdir(mirror,{recursive:true});
 for(const [name,file] of books.attachments)if(name.endsWith('.zip')){
  const target=path.join(mirror,name);
  try{await fsp.link(file.file,target)}catch{await fsp.copyFile(file.file,target)}
 }
 for(const file of ['manifest.webmanifest','sw.js','book-packs.json','icons/ramu-192.png','icons/ramu-512.png'])if(!fs.existsSync(path.join(mainDir,file)))throw Error('Missing PWA resource: '+file);
 const zip=path.join(release,`mole-baby-${version}-web-preview.zip`);
 // The same archiver used by the desktop builder. Only production files enter
 // the ZIP: never source, local assets research, credentials or player saves.
 await require('app-builder-lib/out/targets/archive').archive('zip',zip,mainDir,{compression:'normal',withoutDir:true});
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(zip))hash.update(chunk);
 const sha256=hash.digest('hex');await fsp.writeFile(zip+'.sha256',sha256+'  '+path.basename(zip)+'\n');
 const report={version,target:'web-preview',zip:path.basename(zip),zipBytes:(await fsp.stat(zip)).size,sha256,bookRelease:books.tag,...resources};
 const full=path.join(staging,'unfiltered');
 await fsp.rename(output,full);
 try{await fsp.rename(mainDir,output)}catch(error){await fsp.rename(full,output);throw error}
 await fsp.writeFile(path.join(release,'web-package-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await fsp.rm(staging,{recursive:true,force:true})}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
