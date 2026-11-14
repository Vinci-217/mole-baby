import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import type {PetColor} from '../pet-color'
import {petColorOffsets} from '../pet-color'
import type {RamForm} from '../original-actions'
import {officialTimelineForm,OFFICIAL_FORM,OFFICIAL_DURATION,OFFICIAL_LOAD_TIMEOUT} from '../official-clips'
import type {OfficialClip} from '../official-clips'
import {validOutfitBody,type OutfitBodyBounds} from '../outfit-petting'
import {officialViewportScale} from '../original-viewport'
import {recordAnimationLoad} from '../animation-log'
import {outfitPreviewKey,rememberOutfitPreview} from '../outfit-preview-cache'
import {outfitPreviewSource,useOutfitPreview} from '../use-outfit-preview'
import {acquireOriginalPlayer,type OriginalPlayerLease} from '../original-player-cache'
import './OfficialRamClip.css'

/** A mounted outfit reuses one isolated engine; the player has no save bridge. */
export default function OfficialRamClip({clip,form,bodyForm=form,color,action='idle',finite=false,registerBody=true,sound=false,volume=.45,paused=false,reloadKey,fallback,onEnd,onReady,onLoading,onError,onBodyBounds}:{clip:OfficialClip;form:RamForm;bodyForm?:RamForm;color:PetColor;action?:string;finite?:boolean;registerBody?:boolean;sound?:boolean;volume?:number;paused?:boolean;reloadKey?:number|string;fallback:ReactNode;onEnd?:(completed?:boolean)=>void;onReady?:()=>void;onLoading?:()=>void;onError?:()=>void;onBodyBounds?:(body:OutfitBodyBounds)=>void}){
 const root=useRef<HTMLSpanElement>(null),host=useRef<HTMLSpanElement>(null),frame=useRef<HTMLIFrameElement|null>(null),lease=useRef<OriginalPlayerLease|null>(null),mask=useRef<HTMLCanvasElement>(null),end=useRef(onEnd);end.current=onEnd
 const readyCallback=useRef(onReady),loadingCallback=useRef(onLoading),errorCallback=useRef(onError);readyCallback.current=onReady;loadingCallback.current=onLoading;errorCallback.current=onError;
 const bodyCallback=useRef(onBodyBounds);bodyCallback.current=onBodyBounds;
 const viewportScale=officialViewportScale(clip)
 const sourceKey=`${clip.id}:${form}:${bodyForm}:${finite}:${registerBody}`
 const [retry,setRetry]=useState({key:'',count:0}),[restart,setRestart]=useState(0);
 const attempt=retry.key===sourceKey?retry.count:0,loadKey=`${sourceKey}:${attempt}`;
 const [loadState,setLoadState]=useState({key:'',state:'loading',reason:''}),[binding,setBinding]=useState<{token:string;reused:boolean}|null>(null)
 const token=binding?.token??''
 const state=loadState.key===loadKey?loadState.state:'loading'
 const latestState=useRef(state);latestState.current=state;
 useEffect(()=>{if(latestState.current==='failed')setRetry(previous=>({key:sourceKey,count:(previous.key===sourceKey?previous.count:0)+1}))},[reloadKey]);
 const sequence=useRef(0),requestLoad=useRef<()=>void>(()=>{})
 const direction=action.includes('left')?'left':action.includes('right')?'right':'down'
 const pose=useRef({form:officialTimelineForm(clip,form),direction,moving:action.includes('walk')||action.includes('running'),color:[...petColorOffsets(color)],sound,volume,paused})
 pose.current={form:officialTimelineForm(clip,form),direction,moving:action.includes('walk')||action.includes('running'),color:[...petColorOffsets(color)],sound,volume,paused}
 const cacheKey=`${clip.sha256}:${sourceKey}`
 const currentCache=useRef({key:cacheKey,pose:pose.current,ready:state==='ready'});currentCache.current={key:cacheKey,pose:pose.current,ready:state==='ready'}
 useLayoutEffect(()=>{
  if(!host.current)return;
  const acquired=acquireOriginalPlayer(host.current,currentCache.current.key,window.desktop?.isElectron?'ram-original://assets/':'./assets/original/official/');
  lease.current=acquired;frame.current=acquired.frame;acquired.frame.onload=()=>requestLoad.current();
  setBinding({token:acquired.token,reused:acquired.reused});
  return()=>{acquired.update(currentCache.current.key,currentCache.current.pose,currentCache.current.ready);acquired.release();if(lease.current===acquired){lease.current=null;frame.current=null}};
 },[attempt,restart]);
 useLayoutEffect(()=>{const node=frame.current;if(node){node.title=clip.name;Object.assign(node.style,{left:`${-(viewportScale-1)*50}%`,top:`${-(viewportScale-1)*50}%`,width:`${viewportScale*100}%`,height:`${viewportScale*100}%`})}},[binding,viewportScale,clip.name]);
 const previewSource=outfitPreviewSource(clip,form,bodyForm,finite,registerBody);
 const preview=useOutfitPreview(previewSource,pose.current.color,clip.kind==='outfit');
 useEffect(()=>{
  const node=root.current;if(!node||finite)return;
  const reload=()=>{recordAnimationLoad({event:'retry',clip:clip.id,name:clip.name,form,action,attempt});setRestart(n=>n+1);setRetry(previous=>({key:sourceKey,count:(previous.key===sourceKey?previous.count:0)+1}))};
  node.addEventListener('ram-original-retry',reload);return()=>node.removeEventListener('ram-original-retry',reload);
 },[sourceKey,finite,clip.id,clip.name,form,action,attempt]);
 const sendPose=()=>frame.current?.contentWindow?.postMessage({type:'ram-original-pose',token,sequence:sequence.current,value:pose.current},'*')
 useEffect(()=>{sendPose()},[color,direction,action,form,sound,volume,paused])
 useEffect(()=>{
  let announced=false;
  const request=requestAnimationFrame(()=>{const node=frame.current,pet=node?.closest('.desktop-character'),parent=pet?.closest('.compact-pet');if(!node||!parent)return;
   const art=node.getBoundingClientRect(),base=parent.getBoundingClientRect();announced=true;
   window.dispatchEvent(new CustomEvent('ram-native-drawing-bounds',{detail:{token,bounds:{x:art.x-base.x,y:art.y-base.y,width:art.width,height:art.height}}}));
  });
  return()=>{cancelAnimationFrame(request);if(announced)window.dispatchEvent(new CustomEvent('ram-native-drawing-bounds',{detail:{token,bounds:null}}))}
 },[token,viewportScale])
 useEffect(()=>{
  if(!binding||!lease.current)return;
  const current=lease.current.nextSequence();sequence.current=current
  loadingCallback.current?.();
  const began=performance.now(),diagnostic={clip:clip.id,name:clip.name,form,action,attempt};
  recordAnimationLoad({...diagnostic,event:'load'});
  let done=false,announced=false,booted=false,finish:ReturnType<typeof setTimeout>|undefined,retryTimer:ReturnType<typeof setTimeout>|undefined
  const phases=new Set<string>();
  setLoadState({key:loadKey,state:'loading',reason:''})
  if(mask.current){mask.current.getContext('2d')?.clearRect(0,0,100,108);delete mask.current.dataset.loaded;}
  const load=()=>frame.current?.contentWindow?.postMessage({type:'ram-original-load',token,sequence:current,value:{id:clip.id,form:officialTimelineForm(clip,form),loop:!finite,registerBody,referenceForm:OFFICIAL_FORM[bodyForm],viewportScale,pose:pose.current}},'*')
  requestLoad.current=load
  const fail=(reason:string)=>{if(done)return;done=true;clearTimeout(watchdog);recordAnimationLoad({...diagnostic,event:'error',reason,elapsedMs:Math.round(performance.now()-began)});setLoadState({key:loadKey,state:'failed',reason});if(!finite&&attempt===0){retryTimer=setTimeout(()=>setRetry({key:sourceKey,count:1}),500)}else{errorCallback.current?.();if(finite)end.current?.(false)}}
  const watchdog=setTimeout(()=>fail('加载超时，仍等待当前原片完成'),OFFICIAL_LOAD_TIMEOUT)
  const receive=(event:MessageEvent)=>{
   if(event.data?.token!==token)return
   if(frame.current){frame.current.dataset.lastMessage=JSON.stringify({type:event.data.type,sequence:event.data.sequence,id:event.data.id,expectedSequence:current,expectedId:clip.id,sourceMatches:event.source===frame.current.contentWindow,sourceNull:event.source===null,value:event.data.type==='ram-original-error'||event.data.type==='ram-original-diagnostic'?event.data.value:undefined})}
   if(event.source!==frame.current?.contentWindow)return
   if(event.data.type==='ram-original-boot'){if(!booted){booted=true;recordAnimationLoad({...diagnostic,event:'boot',elapsedMs:Math.round(performance.now()-began)})}load();return}
   if(event.data.sequence!==current||event.data.id!==clip.id)return
   if(event.data.type==='ram-original-preview'&&clip.kind==='outfit'&&Array.isArray(event.data.value?.color)&&event.data.value.color.length===3){
    rememberOutfitPreview(outfitPreviewKey(previewSource,event.data.value.color),event.data.value.image);
   }
   if(event.data.type==='ram-original-diagnostic'&&typeof event.data.value?.phase==='string'){
    const phase=event.data.value.phase.slice(0,80);if(!phases.has(phase)){phases.add(phase);recordAnimationLoad({...diagnostic,event:'progress',reason:phase,elapsedMs:Math.round(performance.now()-began)})}
   }
   if(event.data.type==='ram-original-ready'){
    frame.current?.contentWindow?.postMessage({type:'ram-original-ack',token,sequence:current},'*')
    // Slow downloads can finish after the watchdog. A matching, current
    // looping source is still valid; finite actions already ended stay ended.
    if(announced||done&&finite)return;announced=true;done=false
    clearTimeout(watchdog);clearTimeout(retryTimer);recordAnimationLoad({...diagnostic,event:'ready',elapsedMs:Math.round(performance.now()-began)});setLoadState({key:loadKey,state:'ready',reason:''});sendPose();readyCallback.current?.()
    if(finite)finish=setTimeout(()=>{if(!done){done=true;end.current?.(true)}},OFFICIAL_DURATION)
   }
   if(event.data.type==='ram-original-error')fail(String(event.data.value??'原片加载失败'))
   if(event.data.type==='ram-original-finished'&&finite&&!done){done=true;clearTimeout(finish);end.current?.(true)}
   if(event.data.type==='ram-original-state'&&frame.current){frame.current.dataset.frame=String(event.data.value.frame);frame.current.dataset.bones=JSON.stringify(event.data.value.bones);frame.current.dataset.registration=JSON.stringify(event.data.value.registration);if(validOutfitBody(event.data.value.body))bodyCallback.current?.(event.data.value.body)}
   if(event.data.type==='ram-original-mask'&&Array.isArray(event.data.value)&&event.data.value.length===10800){
    const ctx=mask.current?.getContext('2d');if(ctx){const image=ctx.createImageData(100,108);for(let i=0;i<10800;i++)image.data[i*4+3]=event.data.value[i];ctx.putImageData(image,0,0);mask.current!.dataset.loaded='true'}
   }
  }
  addEventListener('message',receive);load()
  return()=>{if(!announced&&!done)recordAnimationLoad({...diagnostic,event:'cancel',reason:'当前播放入口离开或切换，原片尚未加载完成',elapsedMs:Math.round(performance.now()-began)});done=true;requestLoad.current=()=>{};clearTimeout(watchdog);clearTimeout(finish);clearTimeout(retryTimer);removeEventListener('message',receive)}
 },[clip.id,form,finite,registerBody,token,loadKey])
 return <span ref={root} className={`official-ram-clip is-${state}`} data-official-id={clip.id} data-source={clip.path} data-color={color} data-loaded={state==='ready'} data-load-error={loadState.key===loadKey?loadState.reason:undefined}>
  {state!=='ready'&&(preview?<img className="official-cached-preview" src={preview} alt="" draggable={false} data-cached-original="true" style={{left:`${-(viewportScale-1)*50}%`,top:`${-(viewportScale-1)*50}%`,width:`${viewportScale*100}%`,height:`${viewportScale*100}%`}}/>:<span className="official-clip-fallback">{fallback}</span>)}
  {clip.kind==='outfit'&&state!=='ready'&&(!preview||state==='failed')&&<span className="official-outfit-status" aria-hidden="true">{state==='failed'?'装扮暂未载入':'装扮载入中…'}</span>}
  {/* A source gets an isolated AVM inside the SAME loaded Ruffle module.
      Only explicit/failed-runtime retries recreate the iframe and WASM. */}
  <span ref={host} className="official-player-host" style={{display:'contents'}} data-reused-player={binding?.reused||undefined}/>
  <canvas ref={mask} width={100} height={108} className="ram-classic-frame official-hit-mask" style={{display:state==='ready'?'block':'none'}} aria-hidden="true"/>
 </span>
}
