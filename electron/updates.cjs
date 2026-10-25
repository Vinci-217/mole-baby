const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),semver=require('semver');
const REPOSITORY='https://github.com/Vinci-217/mole-baby';
const ACTIVE=new Set(['checking','downloading','installing']);
function stableNewer(next,current){return Boolean(semver.valid(next)&&!semver.prerelease(next)&&semver.gt(next,current))}
function readEnabled(file){try{return JSON.parse(fs.readFileSync(file,'utf8')).enabled!==false}catch{return true}}
function checksumEntry(text,name){const line=text.split(/\r?\n/).find(line=>line.endsWith(`  ${name}`));if(!line||!new RegExp(`^[a-f0-9]{64}  `).test(line))throw Error('Update checksum missing');return line.slice(0,64)}
async function hashFile(file){const h=crypto.createHash('sha256');for await(const part of fs.createReadStream(file))h.update(part);return h.digest('hex')}
/** No renderer-supplied URLs, executable paths, versions or feed overrides. */
function createUpdates(options){
 const{version,platform,arch,configFile,cacheDirectory,fetch:fetcher,openPath,prepareInstall,isBusy,onChange=()=>{},onReady=()=>{}}=options;
 const supported=['win32','darwin'].includes(platform),disabled=Boolean(options.disabled)||!supported;
 const initiallyEnabled=readEnabled(configFile);
 const automaticInstall=platform==='win32'?Boolean(options.installed):platform==='darwin'&&options.macSigned===true;
 let state={status:disabled?'disabled':'idle',currentVersion:version,version:null,percent:0,enabled:initiallyEnabled,automaticInstall,checkedAt:null,message:disabled?'当前环境不运行自动更新。':initiallyEnabled?'启动后会在后台检查更新。':'自动更新已关闭，可手动检查。'};
 let engine=null,downloadedFile=null,checkPromise=null,downloadPromise=null,startTimer=null,installTimer=null,retryTimer=null,disposed=false,lastAutomaticCheck=0,manualInfo=null;
 const timers=options.timers??{set:setTimeout,clear:clearTimeout};
 const later=(fn,ms)=>{const t=timers.set(fn,ms);t?.unref?.();return t};
 const publish=patch=>{if(disposed)return;state={...state,...patch};onChange({...state})};
 const fail=()=>{publish({status:'error',message:'暂时无法完成更新，请检查网络后重试。'});if(state.enabled&&!disabled){timers.clear(retryTimer);retryTimer=later(()=>void check(false),30*60000)}};
 function ready(info){
  downloadedFile=info.downloadedFile??downloadedFile;
  publish({status:'ready',version:info.version,percent:100,message:automaticInstall?(state.enabled?'新版已下载，桌宠空闲时会自动更新。':'新版已下载，可点击立即更新并重启。'):'新版已下载，打开安装包完成更新。'});onReady({...state});scheduleInstall();
 }
 function loadEngine(){
  if(engine)return engine;
  engine=options.engineFactory();
  engine.autoDownload=false;engine.autoInstallOnAppQuit=automaticInstall&&state.enabled;engine.allowPrerelease=false;engine.allowDowngrade=false;engine.disableDifferentialDownload=true;engine.disableWebInstaller=true;
  engine.on('checking-for-update',()=>publish({status:'checking',message:'正在检查 GitHub 最新正式版…'}));
  engine.on('update-not-available',()=>publish({status:'current',checkedAt:Date.now(),message:'已经是最新版本。'}));
  engine.on('update-available',info=>{
   if(!stableNewer(info.version,version)){publish({status:'current',checkedAt:Date.now(),message:'已经是最新版本。'});return}
   publish({status:'available',version:info.version,checkedAt:Date.now(),percent:0,message:'发现新版本。'});
  });
  let progressAt=0;
  engine.on('download-progress',p=>{if(Date.now()-progressAt<400&&p.percent<100)return;progressAt=Date.now();publish({status:'downloading',percent:Math.max(0,Math.min(100,Math.floor(p.percent))),message:'正在后台下载更新…'})});
  engine.on('update-downloaded',info=>{if(stableNewer(info.version,version))ready(info)});
  engine.on('error',fail);
  return engine;
 }
 function scheduleInstall(){
  timers.clear(installTimer);if(!state.enabled||!automaticInstall||state.status!=='ready'||disabled)return;
  installTimer=later(async()=>{if(!state.enabled||state.status!=='ready'||disposed)return;if(isBusy()){scheduleInstall();return}await install(false)},8000);
 }
 async function downloadMac(){
  if(!manualInfo)return;
  const {name,url,digest}=manualInfo;await fsp.mkdir(cacheDirectory,{recursive:true,mode:0o700});const target=path.join(cacheDirectory,name),partial=target+'.part';
  try{if(await hashFile(target)===digest){ready({version:state.version,downloadedFile:target});return}}catch{}
  await fsp.rm(partial,{force:true});let file;
  try{
   const response=await fetcher(url,{signal:AbortSignal.timeout(20*60000)});if(!response.ok||!response.body)throw Error('Download unavailable');
   const total=Number(response.headers.get('content-length'))||0;if(total>1024*1024*1024)throw Error('Update too large');
   file=await fsp.open(partial,'w',0o600);const hash=crypto.createHash('sha256');let received=0,lastProgress=0;
   for await(const chunk of response.body){const bytes=Buffer.from(chunk);received+=bytes.length;if(received>1024*1024*1024)throw Error('Update too large');hash.update(bytes);await file.write(bytes);if(Date.now()-lastProgress>400){lastProgress=Date.now();publish({status:'downloading',percent:total?Math.min(99,Math.floor(received/total*100)):0,message:'正在后台下载更新…'})}}
   await file.sync();await file.close();file=null;
   if(total&&received!==total||hash.digest('hex')!==digest)throw Error('Update checksum mismatch');
   await fsp.rename(partial,target);ready({version:state.version,downloadedFile:target});
  }finally{if(file)await file.close();await fsp.rm(partial,{force:true})}
 }
 async function checkMac(){
  const response=await fetcher(`${REPOSITORY}/releases/latest`,{method:'HEAD',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Releases unavailable');
  const url=new URL(response.url),match=/^\/Vinci-217\/mole-baby\/releases\/tag\/v(\d+\.\d+\.\d+)$/.exec(url.pathname);
  if(url.origin!=='https://github.com'||!match)throw Error('Invalid release URL');
  const next=match[1];if(!stableNewer(next,version)){publish({status:'current',checkedAt:Date.now(),message:'已经是最新版本。'});return}
  const root=`${REPOSITORY}/releases/download/v${next}`,name=`mole-baby-${next}-mac-${arch}.dmg`;
  const sums=await fetcher(`${root}/SHA256SUMS.txt`,{signal:AbortSignal.timeout(30000)});if(!sums.ok)throw Error('Update checksum unavailable');
  const content=await sums.text();if(content.length>65536)throw Error('Invalid update manifest');
  manualInfo={name,url:`${root}/${name}`,digest:checksumEntry(content,name)};
  publish({status:'available',version:next,checkedAt:Date.now(),percent:0,message:'发现新版本。'});
 }
 function check(manual=true){
  if(disabled||disposed)return Promise.resolve(false);
  if(checkPromise)return checkPromise;
  if(ACTIVE.has(state.status)||state.status==='ready')return Promise.resolve(false);
  if(!manual&&(!state.enabled||Date.now()-lastAutomaticCheck<5*60000))return Promise.resolve(false);
  lastAutomaticCheck=Date.now();
  checkPromise=Promise.resolve().then(async()=>{try{if(disposed||!manual&&!state.enabled)return false;
   publish({status:'checking',message:'正在检查 GitHub 最新正式版…'});
   if(platform==='darwin'&&!options.macSigned)await checkMac();else await loadEngine().checkForUpdates();
   if(state.status==='available'&&state.enabled)await download();return state.status!=='error';
  }catch{fail();return false}finally{checkPromise=null}});return checkPromise;
 }
 function download(){
  if(disabled||disposed)return Promise.resolve(false);if(downloadPromise)return downloadPromise;
  if(state.status!=='available')return Promise.resolve(false);
  publish({status:'downloading',percent:0,message:'正在后台下载更新…'});
  downloadPromise=Promise.resolve().then(async()=>{try{if(platform==='darwin'&&!options.macSigned)await downloadMac();else{const files=await loadEngine().downloadUpdate();downloadedFile=files?.[0]??downloadedFile}return state.status==='ready'}catch{fail();return false}finally{downloadPromise=null}});return downloadPromise;
 }
 async function install(force=true){
  if(disabled||disposed||state.status!=='ready')return false;
  if(!automaticInstall){if(!downloadedFile)return false;const error=await openPath(downloadedFile);if(error){publish({message:'安装包暂时无法打开，请稍后重试。'});return false}return true}
  if(!force&&(isBusy()||!state.enabled)){scheduleInstall();return false}
  publish({status:'installing',message:'正在保存拉姆，更新后会自动回来。'});timers.clear(installTimer);
  try{if(!await prepareInstall())throw Error('Save was not acknowledged');if(!force&&(isBusy()||!state.enabled)){publish({status:'ready',message:'新版已准备好，等忙完后再更新。'});scheduleInstall();return false}loadEngine().quitAndInstall(true,true);return true}
  catch{publish({status:'ready',message:'存档尚未准备好，请稍后重试更新。'});return false}
 }
 function setEnabled(value){
  if(typeof value!=='boolean')throw new TypeError('Update preference must be a boolean');
  fs.mkdirSync(path.dirname(configFile),{recursive:true});fs.writeFileSync(configFile+'.tmp',JSON.stringify({enabled:value}),{mode:0o600});fs.renameSync(configFile+'.tmp',configFile);
  publish({enabled:value,...(state.status==='ready'&&automaticInstall?{message:value?'新版已下载，桌宠空闲时会自动更新。':'新版已下载，可点击立即更新并重启。'}:{})});if(engine)engine.autoInstallOnAppQuit=automaticInstall&&value;
  if(value){if(state.status==='ready')scheduleInstall();else if(state.status==='available')void download();else void check(true)}else{timers.clear(startTimer);timers.clear(installTimer);timers.clear(retryTimer)}return {...state};
 }
 return {getState:()=>({...state}),check,download,install,setEnabled,start(){if(!disabled&&state.enabled)startTimer=later(()=>void check(false),8000)},wake(){void check(false)},dispose(){disposed=true;for(const timer of[startTimer,installTimer,retryTimer])timers.clear(timer)},repository:REPOSITORY};
}
module.exports={createUpdates,stableNewer,checksumEntry,hashFile,REPOSITORY};
