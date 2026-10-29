const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),semver=require('semver');
const {REPOSITORY}=require('./update-source.cjs');
const {parseBlockMap,readBlockMapResponse,downloadDifferential,downloadFull}=require('./differential-download.cjs');
const ACTIVE=new Set(['checking','downloading','installing']);
function stableNewer(next,current){return Boolean(semver.valid(next)&&!semver.prerelease(next)&&semver.gt(next,current))}
function readEnabled(file){try{return JSON.parse(fs.readFileSync(file,'utf8')).enabled!==false}catch{return true}}
function checksumEntry(text,name){const line=text.split(/\r?\n/).find(line=>line.endsWith(`  ${name}`));if(!line||!new RegExp(`^[a-f0-9]{64}  `).test(line))throw Error('Update checksum missing');return line.slice(0,64)}
async function hashFile(file){const h=crypto.createHash('sha256');for await(const part of fs.createReadStream(file))h.update(part);return h.digest('hex')}
/** No renderer-supplied URLs, executable paths, versions or feed overrides. */
function createUpdates(options){
 const{version,platform,arch,configFile,cacheDirectory,fetch:fetcher,openPath,prepareInstall,onChange=()=>{},onAvailable=()=>{},onReady=()=>{}}=options;
 const supported=['win32','darwin'].includes(platform),disabled=Boolean(options.disabled)||!supported;
 const initiallyEnabled=readEnabled(configFile);
 const automaticInstall=platform==='win32'?Boolean(options.installed):platform==='darwin'&&options.macSigned===true;
 let state={downloadMode:null,transferredBytes:0,totalBytes:0,fullSize:0,reusedBytes:0,fallbackReason:null,status:disabled?'disabled':'idle',currentVersion:version,version:null,percent:0,enabled:initiallyEnabled,automaticInstall,checkedAt:null,message:disabled?'当前环境不运行软件更新。':initiallyEnabled?'启动后会检查更新，下载和安装均需你确认。':'启动时检查已关闭，仍可手动检查更新。'};
 let engine=null,downloadedFile=null,checkPromise=null,downloadPromise=null,startTimer=null,retryTimer=null,disposed=false,lastAutomaticCheck=0,manualInfo=null,approvedDownloadVersion=null;
 const shutdown=new AbortController();
 const engineCancellation=new(require('builder-util-runtime').CancellationToken)();
 const requests=new Set();
 const timers=options.timers??{set:setTimeout,clear:clearTimeout};
 const later=(fn,ms)=>{const t=timers.set(fn,ms);t?.unref?.();return t};
 const publish=patch=>{if(disposed)return;state={...state,...patch};onChange({...state})};
 const fail=(error)=>{if(disposed)return;publish({status:'error',message:/checksum/i.test(error?.message??'')?'更新文件校验失败，请重新下载。':'无法连接 GitHub 或下载更新，请检查网络后重试，也可从发布页手动下载。'});if(state.enabled&&!disabled){timers.clear(retryTimer);retryTimer=later(()=>void check(false),30*60000)}};
 const ensureActive=()=>shutdown.signal.throwIfAborted();
 const request=async(url,settings,timeout)=>{
  ensureActive();
  // Electron 22 uses Node 16, which has no AbortSignal.any. Keep the abort
  // listener and timeout alive until the response body has been consumed.
  const controller=new AbortController(),abort=()=>controller.abort();
  const timer=setTimeout(abort,timeout);timer.unref?.();
  const finish=()=>{clearTimeout(timer);shutdown.signal.removeEventListener('abort',abort);requests.delete(finish)};
  shutdown.signal.addEventListener('abort',abort,{once:true});requests.add(finish);
  try{const response=await fetcher(url,{cache:'no-store',...settings,signal:controller.signal});ensureActive();return {response,finish}}
  catch(error){finish();throw error}
 };
 const checking=()=>!disposed&&state.status==='checking';
 function ready(info){
  if(disposed)return;
  downloadedFile=info.downloadedFile??downloadedFile;
  publish({status:'ready',downloadMode:state.downloadMode??'cached',version:info.version,percent:100,message:automaticInstall?'新版已下载，请确认是否更新并重启拉姆。':'新版已下载，请确认是否打开安装包完成更新。'});onReady({...state});
 }
 function loadEngine(){
  if(engine)return engine;
  engine=options.engineFactory();
  engine.autoDownload=false;engine.autoInstallOnAppQuit=false;engine.allowPrerelease=false;engine.allowDowngrade=false;engine.disableDifferentialDownload=false;engine.disableWebInstaller=true;
  // Observe the existing downloader instead of replacing NSIS installation.
  // A true result means its own fallback will download the complete package.
  if(typeof engine.differentialDownloadInstaller==='function'){
   const differential=engine.differentialDownloadInstaller.bind(engine);
   engine.differentialDownloadInstaller=async(...args)=>{
    publish({downloadMode:'differential',fullSize:args[0].info.size??0,message:'正在下载更新的变化部分…'});
    const full=await differential(...args);
    if(full)publish({downloadMode:'full',transferredBytes:0,totalBytes:args[0].info.size??0,reusedBytes:0,fallbackReason:'incremental-unavailable',message:'增量暂不可用，正在下载完整更新包…'});
    return full;
   };
  }
  engine.on('checking-for-update',()=>{if(checking())publish({message:'正在检查 GitHub 最新正式版…'})});
  engine.on('update-not-available',()=>{if(checking())publish({status:'current',version:null,checkedAt:Date.now(),message:'已经是最新版本。'})});
  engine.on('update-available',info=>{
   if(!checking())return;
   if(!stableNewer(info.version,version)){publish({status:'current',checkedAt:Date.now(),message:'已经是最新版本。'});return}
   publish({status:'available',version:info.version,checkedAt:Date.now(),percent:0,message:'发现新版本，请确认是否下载更新。'});onAvailable({...state});
  });
  let progressAt=0;
  engine.on('download-progress',p=>{if(disposed||!approvedDownloadVersion||state.status!=='downloading'||!Number.isFinite(p.percent))return;if(Date.now()-progressAt<400&&p.percent<100)return;progressAt=Date.now();publish({status:'downloading',downloadMode:state.downloadMode==='differential'?'differential':'full',percent:Math.max(0,Math.min(99,Math.floor(p.percent))),transferredBytes:Number.isFinite(p.transferred)?p.transferred:state.transferredBytes,totalBytes:Number.isFinite(p.total)?p.total:state.totalBytes,reusedBytes:state.downloadMode==='differential'&&p.total?Math.max(0,state.fullSize-p.total):0,message:state.downloadMode==='differential'?'正在下载更新的变化部分…':state.fallbackReason?'增量暂不可用，正在下载完整更新包…':'正在后台下载完整更新包…'})});
  engine.on('update-downloaded',info=>{if(!disposed&&state.status==='downloading'&&info.version===state.version&&info.version===approvedDownloadVersion&&stableNewer(info.version,version))ready(info)});
  engine.on('error',fail);
  return engine;
 }
 async function downloadMac(){
  ensureActive();if(!manualInfo)return;
  const {name,url,digest,blockmapDigest}=manualInfo;
  await fsp.mkdir(cacheDirectory,{recursive:true,mode:0o700});
  const target=path.join(cacheDirectory,name),partial=target+'.part';
  const baseName=`mole-baby-${version}-mac-${arch}.dmg`,base=path.join(cacheDirectory,baseName);
  try{if(await hashFile(target)===digest){ensureActive();publish({downloadMode:'cached'});ready({version:state.version,downloadedFile:target});return}}catch{ensureActive()}
  let newMapBytes,newMap,progressAt=0;
  const progress=patch=>{if(Date.now()-progressAt<200&&patch.percent<99)return;progressAt=Date.now();publish(patch)};
  const index=async(indexUrl,expected)=>{
   const pending=await request(indexUrl,{},30000);
   try{
    const bytes=await readBlockMapResponse(pending.response);ensureActive();
    if(expected&&crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Update blockmap checksum mismatch');
    return{bytes,parsed:parseBlockMap(bytes)};
   }finally{pending.finish()}
  };
  try{
   if(blockmapDigest){try{const result=await index(url+'.blockmap',blockmapDigest);newMapBytes=result.bytes;newMap=result.parsed}catch{ensureActive()}}
   let result;
   if(newMap){
    try{
     ensureActive();await fsp.access(base);
     let oldMap;
     try{oldMap=parseBlockMap(await fsp.readFile(base+'.blockmap'))}
     catch{ensureActive();oldMap=(await index(`${REPOSITORY}/releases/download/v${version}/${baseName}.blockmap`)).parsed}
     publish({downloadMode:'differential',fullSize:newMap.size,message:'正在下载更新的变化部分…'});
     result=await downloadDifferential({oldFile:base,newFile:partial,oldMap,newMap,url,digest,request,signal:shutdown.signal,onProgress:progress});
    }catch(error){ensureActive();publish({downloadMode:'full',percent:0,transferredBytes:0,totalBytes:0,reusedBytes:0,fallbackReason:error.code==='ERR_UPDATE_RANGE'?'range-unsupported':'incremental-unavailable',message:'增量暂不可用，正在下载完整更新包…'})}
   }
   if(!result){
    ensureActive();publish({downloadMode:'full',message:'正在下载完整更新包…'});progressAt=0;
    result=await downloadFull({url,newFile:partial,digest,request,signal:shutdown.signal,onProgress:progress});
   }
   ensureActive();await fsp.rename(partial,target);ensureActive();
   // Cache only the map associated with the fully verified package. A failed
   // attempt cannot overwrite the old baseline or its map.
   if(newMapBytes){try{await fsp.writeFile(target+'.blockmap.tmp',newMapBytes,{mode:0o600});ensureActive();await fsp.rename(target+'.blockmap.tmp',target+'.blockmap')}catch{ensureActive()}}
   // Keep the installed baseline and next package, rather than every release.
   const keep=new Set([baseName,name]);
   for(const entry of await fsp.readdir(cacheDirectory)){
    if(new RegExp(`^mole-baby-\\d+\\.\\d+\\.\\d+-mac-${arch}\\.dmg(?:\\.blockmap)?$`).test(entry)&&!keep.has(entry.replace(/\.blockmap$/,'')))await fsp.unlink(path.join(cacheDirectory,entry)).catch(()=>{});
   }
   publish(result);ready({version:state.version,downloadedFile:target});
  }finally{await fsp.rm(partial,{force:true});await fsp.rm(target+'.blockmap.tmp',{force:true})}
 }
 async function checkMac(){
  let next;
  try{
   const head=await request(`${REPOSITORY}/releases/latest`,{method:'HEAD'},15000);const response=head.response;head.finish();if(!response.ok)throw Error('Releases unavailable');
   const url=new URL(response.url),match=/^\/Vinci-217\/mole-baby\/releases\/tag\/v(\d+\.\d+\.\d+)$/.exec(url.pathname);
   if(url.origin!=='https://github.com'||!match)throw Error('Invalid release URL');
   next=match[1];
  }catch{
   // Some networks/Electron versions cannot resolve HEAD redirects. Read the
   // published version file through GET; download URLs remain repository-fixed.
   ensureActive();const metadata=await request(`${REPOSITORY}/releases/latest/download/latest-mac.yml`,{},30000);let text;
   try{if(!metadata.response.ok)throw Error('Update metadata unavailable');text=await metadata.response.text()}finally{metadata.finish()}
   const match=text.length<=65536&&/^version:[ \t]*['"]?(\d+\.\d+\.\d+)['"]?[ \t]*$/m.exec(text);
   if(!match)throw Error('Invalid update metadata');next=match[1];
  }
  if(!stableNewer(next,version)){publish({status:'current',version:null,checkedAt:Date.now(),message:'已经是最新版本。'});return}
  const root=`${REPOSITORY}/releases/download/v${next}`,name=`mole-baby-${next}-mac-${arch}.dmg`;
  const sums=await request(`${root}/SHA256SUMS.txt`,{},30000);let content;
  try{if(!sums.response.ok)throw Error('Update checksum unavailable');content=await sums.response.text()}finally{sums.finish()}
  if(content.length>65536)throw Error('Invalid update manifest');
  ensureActive();
  let blockmapDigest;try{blockmapDigest=checksumEntry(content,name+'.blockmap')}catch{}
  manualInfo={name,url:`${root}/${name}`,digest:checksumEntry(content,name),blockmapDigest};
  publish({status:'available',version:next,checkedAt:Date.now(),percent:0,message:'发现新版本，请确认是否下载更新。'});onAvailable({...state});
 }
 function check(manual=true){
  if(disabled||disposed)return Promise.resolve(false);
  if(checkPromise)return checkPromise;
  if(ACTIVE.has(state.status)||state.status==='ready')return Promise.resolve(false);
  if(!manual&&(!state.enabled||Date.now()-lastAutomaticCheck<5*60000))return Promise.resolve(false);
  lastAutomaticCheck=Date.now();
  checkPromise=Promise.resolve().then(async()=>{try{if(disposed||!manual&&!state.enabled)return false;
   manualInfo=null;downloadedFile=null;approvedDownloadVersion=null;
   publish({status:'checking',version:null,percent:0,downloadMode:null,transferredBytes:0,totalBytes:0,fullSize:0,reusedBytes:0,fallbackReason:null,message:'正在检查 GitHub 最新正式版…'});
   if(platform==='darwin'&&!options.macSigned)await checkMac();else await loadEngine().checkForUpdates();
   return !disposed&&state.status!=='error';
  }catch(error){fail(error);return false}finally{checkPromise=null}});return checkPromise;
 }
 function download(confirmed=false){
  if(confirmed!==true||disabled||disposed)return Promise.resolve(false);if(downloadPromise)return downloadPromise;
  if(state.status!=='available')return Promise.resolve(false);
  approvedDownloadVersion=state.version;
  publish({status:'downloading',percent:0,message:'正在下载已确认的更新…'});
  downloadPromise=Promise.resolve().then(async()=>{try{ensureActive();if(platform==='darwin'&&!options.macSigned)await downloadMac();else{const files=await loadEngine().downloadUpdate(engineCancellation);if(!disposed)downloadedFile=files?.[0]??downloadedFile}return !disposed&&state.status==='ready'}catch(error){fail(error);return false}finally{downloadPromise=null}});return downloadPromise;
 }
 async function install(confirmed=false){
  if(confirmed!==true||disabled||disposed||state.status!=='ready')return false;
  if(!automaticInstall){if(!downloadedFile)return false;try{const error=await openPath(downloadedFile);if(error)throw Error(error);if(platform==='darwin')publish({message:'DMG 已打开：将「拉姆」拖到「应用程序」并选择替换，然后退出旧版并重新打开。打开 DMG 本身还没有完成更新。'});return !disposed}catch{publish({message:'安装包暂时无法打开，请稍后重试。'});return false}}
  publish({status:'installing',message:'正在保存拉姆，确认更新后会自动回来。'});
  try{if(!await prepareInstall())throw Error('Save was not acknowledged');ensureActive();loadEngine().quitAndInstall(true,true);return true}
  catch{publish({status:'ready',message:'存档尚未准备好，请稍后重试更新。'});return false}
 }
 function setEnabled(value){
  if(typeof value!=='boolean')throw new TypeError('Update preference must be a boolean');
  if(disposed)return {...state};
  fs.mkdirSync(path.dirname(configFile),{recursive:true});fs.writeFileSync(configFile+'.tmp',JSON.stringify({enabled:value}),{mode:0o600});fs.renameSync(configFile+'.tmp',configFile);
  publish({enabled:value});if(engine)engine.autoInstallOnAppQuit=false;
  if(value){if(!['available','ready'].includes(state.status))void check(true)}else{timers.clear(startTimer);timers.clear(retryTimer)}return {...state};
 }
 return {getState:()=>({...state}),check,download,install,setEnabled,start(){if(!disposed&&!disabled&&state.enabled&&startTimer===null)startTimer=later(()=>{startTimer=null;void check(false)},8000)},wake(){void check(false)},dispose(){if(disposed)return;disposed=true;shutdown.abort();engineCancellation.cancel();for(const finish of requests)finish();for(const timer of[startTimer,retryTimer])timers.clear(timer)},repository:REPOSITORY};
}
module.exports={createUpdates,stableNewer,checksumEntry,hashFile,REPOSITORY};
