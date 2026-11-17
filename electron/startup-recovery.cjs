const fs=require('node:fs'),path=require('node:path');

/** Keep recovery outside the renderer: a failed preload/page cannot show its
 * own error UI. Diagnostics contain runtime/errors, never browser save data. */
function createStartupRecovery({directory,details={},showMessageBox,openPath,retry,quit,isQuitting=()=>false,timeout=60000,timers={set:setTimeout,clear:clearTimeout}}){
 const logfile=path.join(directory,'logs','startup.log');
 let window=null,ready=false,disposed=false,timer=null,attempt=0,problem=null,pending=null,detach=()=>{},logError=null;
 const active=()=>!disposed&&!isQuitting();
 function record(event,extra={}){
  try{
   fs.mkdirSync(path.dirname(logfile),{recursive:true});
   if(fs.existsSync(logfile)&&fs.statSync(logfile).size>256*1024){
    const previous=path.join(path.dirname(logfile),'startup.previous.log');
    fs.rmSync(previous,{force:true});fs.renameSync(logfile,previous);
   }
   fs.appendFileSync(logfile,JSON.stringify({at:new Date().toISOString(),...details,event,...extra})+'\n',{mode:0o600});
   logError=null;
  }catch(error){logError=error.code||error.message;}
 }
 const errorDetails=error=>({name:String(error?.name||'').slice(0,128),message:String(error?.message||'').slice(0,2000),stack:String(error?.stack||'').slice(0,4000)});
 function clear(){timers.clear(timer);timer=null;}
 function begin(){
  if(!active())return;
  clear();attempt++;ready=false;problem=null;record('loading',{attempt});
  timer=timers.set(()=>{timer=null;void fail('startup-timeout',{message:`The renderer did not acknowledge readiness within ${timeout} ms.`});},timeout);
  timer?.unref?.();
 }
 function show(){
  if(!active()||!problem)return Promise.resolve(false);
  if(pending)return pending;
  const token=attempt;
  pending=Promise.resolve().then(async()=>{
   if(!active()||ready||attempt!==token)return false;
   const answer=await showMessageBox({type:'error',title:'拉姆启动遇到问题',message:'拉姆界面未能正常打开',detail:'可以重新加载界面，或查看启动日志帮助排查。你的拉姆存档会保留。'+(logError?'\n启动日志暂时无法写入：'+logError:'\n启动日志：'+logfile),buttons:['重新加载','查看启动日志','稍后再试','退出拉姆'],defaultId:0,cancelId:2,noLink:true});
   if(!active())return false;
   if(answer.response===1){
    const error=logError||await openPath(logfile);
    if(error){record('open-log-failed',{message:String(error).slice(0,1000)});await showMessageBox({type:'warning',title:'启动日志',message:'暂时无法打开启动日志',detail:String(error),buttons:['知道了'],noLink:true});}
    return false;
   }
   // A slow renderer may recover while its native prompt is open. Its late
   // dismissal must never reload/quit a now healthy or newer window.
   if(ready||attempt!==token)return false;
   if(answer.response===0){
    const current=window;begin();
    try{await retry(current);return true}catch(error){problem={kind:'retry-failed'};record('retry-failed',errorDetails(error));return false}
   }
   if(answer.response===3){quit();return true}
   return false;
  }).catch(error=>{record('recovery-prompt-failed',errorDetails(error));return false}).finally(()=>{pending=null});
  return pending;
 }
 function fail(kind,error={}){
  if(!active())return Promise.resolve(false);
  clear();ready=false;
  record(kind,{attempt,...errorDetails(error),...(error.reason?{reason:String(error.reason).slice(0,128),exitCode:error.exitCode}:{})});
  if(problem)return Promise.resolve(false);
  problem={kind};return show();
 }
 function watch(next){
  detach();window=next;
  const handlers=[];
  const on=(emitter,event,handler)=>{emitter.on(event,handler);handlers.push(()=>emitter.removeListener(event,handler))};
  const contents=next.webContents;
  on(contents,'did-start-navigation',(_event,_url,isInPlace,isMainFrame)=>{if(isMainFrame&&!isInPlace)begin()});
  on(contents,'did-finish-load',()=>{if(active())record('page-loaded',{attempt})});
  on(contents,'did-fail-load',(_event,code,message,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)void fail('page-load-failed',{name:String(code),message})});
  on(contents,'preload-error',(_event,_filename,error)=>void fail('preload-error',error));
  on(contents,'render-process-gone',(_event,details)=>void fail('renderer-gone',details));
  on(next,'unresponsive',()=>{if(!ready)void fail('startup-unresponsive')});
  on(next,'closed',()=>{clear();attempt++;window=null;problem=null;detach()});
  detach=()=>{for(const remove of handlers)remove();detach=()=>{}};
  begin();
 }
 record('launch');
 return{watch,fail,show,record,markReady(){if(!active())return;clear();ready=true;problem=null;record('ready',{attempt});},dispose(){disposed=true;clear();attempt++;detach();},logfile};
}
module.exports={createStartupRecovery};
