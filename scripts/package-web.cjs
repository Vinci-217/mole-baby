#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {verifyOfflineAssets}=require('./verify-offline-assets.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist'),release=path.join(root,'release'),version=require('../package.json').version;
async function main(){
 const built=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32',env:{...process.env,VITE_WEB_APP:'1',VITE_LOCAL_DEBUG:'0'}});
 if(built.error)throw built.error;if(built.status!==0)throw Error('Web production build failed');
 const resources=verifyOfflineAssets(output);
 for(const file of ['manifest.webmanifest','sw.js','icons/ramu-192.png','icons/ramu-512.png'])if(!fs.existsSync(path.join(output,file)))throw Error('Missing PWA resource: '+file);
 await fsp.mkdir(release,{recursive:true});
 const zip=path.join(release,`mole-baby-${version}-web-preview.zip`);
 // The same archiver used by the desktop builder. Only production files enter
 // the ZIP: never source, local assets research, credentials or player saves.
 await require('app-builder-lib/out/targets/archive').archive('zip',zip,output,{compression:'normal',withoutDir:true});
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(zip))hash.update(chunk);
 const sha256=hash.digest('hex');await fsp.writeFile(zip+'.sha256',sha256+'  '+path.basename(zip)+'\n');
 const report={version,target:'web-preview',zip:path.basename(zip),zipBytes:(await fsp.stat(zip)).size,sha256,...resources};
 await fsp.writeFile(path.join(release,'web-package-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
