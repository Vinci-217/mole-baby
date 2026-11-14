/** Small, local-only load history. No pet save, player name or server address. */
const KEY='ramu-animation-load-log-v1',LIMIT=80;
export interface AnimationLoadEvent {
 at:number;event:'load'|'ready'|'error'|'retry'|'appearance'|'boot'|'progress'|'cancel';clip:string;name:string;
 form:string;action:string;attempt:number;elapsedMs?:number;reason?:string;
}
export function animationLoadLog():AnimationLoadEvent[]{
 try{const rows=JSON.parse(sessionStorage.getItem(KEY)??'[]');return Array.isArray(rows)?rows.slice(-LIMIT):[]}catch{return []}
}
export function recordAnimationLoad(event:Omit<AnimationLoadEvent,'at'>){
 try{sessionStorage.setItem(KEY,JSON.stringify([...animationLoadLog(),{...event,reason:event.reason?.slice(0,500),at:Date.now()}].slice(-LIMIT)))}catch{/* Diagnostics must never prevent playback or saving. */}
}
export function exportAnimationLoadLog(){
 const players=typeof document==='undefined'?[]:[...document.querySelectorAll<HTMLElement>('.official-ram-clip')].map(node=>{
  const frame=node.querySelector('iframe');let lastMessage:unknown;
  try{lastMessage=JSON.parse(frame?.dataset.lastMessage??'null')}catch{}
  return {clip:node.dataset.officialId,loaded:node.dataset.loaded==='true',visible:node.getClientRects().length>0,state:node.className,error:node.dataset.loadError,action:node.closest<HTMLElement>('.ram-sprite')?.dataset.action,lastMessage};
 });
 const exportedAt=new Date().toISOString(),text=JSON.stringify({version:2,animationBuild:'2026-11-13-reused-runtime-and-local-save',exportedAt,browser:navigator.userAgent,players,events:animationLoadLog()},null,2);
 const filename=`拉姆动画日志-${exportedAt.slice(0,19).replaceAll(':','-')}.json`;
 if(window.mobile){void window.mobile.exportSave(text,filename).catch(()=>alert('日志导出失败，请重试。'));return;}
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
