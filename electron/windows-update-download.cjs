const fs=require('node:fs/promises'),path=require('node:path');
const {parseBlockMap}=require('./differential-download.cjs');
const {planUpdate}=require('./update-plan.cjs');
const {GenericDifferentialDownloader}=require('electron-updater/out/differentialDownloader/GenericDifferentialDownloader');
/** Preserve NSIS' cache/verification/install pipeline. Only replace its transfer
 * plan, using the same pinned downloader (including final SHA512 validation). */
async function downloadWindowsDifference(engine,args,onPlan){
 const [fileInfo,options,installerPath,provider,oldName]=args,cache=engine.downloadedUpdateHelper;
 const oldFile=path.join(cache.cacheDir,oldName);
 let stat;try{stat=await fs.stat(oldFile)}catch{onPlan({mode:'full',reason:'baseline-missing'});return true}
 const urls=await provider.getBlockMapFiles(fileInfo.url,engine.app.version,options.updateInfoAndProvider.info.version);
 const read=async url=>parseBlockMap(await engine.httpExecutor.downloadToBuffer(url,{headers:options.requestHeaders,cancellationToken:options.cancellationToken}));
 const newMap=await read(urls[1]);if(newMap.size!==fileInfo.info.size)throw Error('New installer index size mismatch');
 let oldMap;try{oldMap=parseBlockMap(await fs.readFile(path.join(cache.cacheDir,'current.blockmap')))}catch{oldMap=await read(urls[0])}
 if(!stat.isFile()||stat.size!==oldMap.size)throw Error('Cached installer and index do not match');
 const plan=planUpdate(oldMap,newMap);onPlan(plan);
 // Even a deliberate full download needs the new map beside the new installer
 // so the next update can use it. The upstream cache promotes it after success.
 await fs.mkdir(cache.cacheDirForPendingUpdate,{recursive:true});
 await fs.writeFile(path.join(cache.cacheDirForPendingUpdate,'current.blockmap'),require('node:zlib').gzipSync(JSON.stringify(newMap.map)));
 if(plan.mode==='full')return true;
 class PlannedDownloader extends GenericDifferentialDownloader{download(){return this.downloadFile(plan.operations)}}
 await new PlannedDownloader(fileInfo.info,engine.httpExecutor,{newUrl:fileInfo.url,oldFile,newFile:installerPath,logger:engine.logger??{info(){},warn(){},error(){}},isUseMultipleRangeRequest:false,requestHeaders:options.requestHeaders,cancellationToken:options.cancellationToken,onProgress:p=>engine.emit('download-progress',p)}).download();
 return false;
}
module.exports={downloadWindowsDifference};
