import {useEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import type {PetColor} from '../pet-color'
import {petColorOffsets} from '../pet-color'
import type {RamForm} from '../original-actions'
import {officialTimelineForm,OFFICIAL_FORM,OFFICIAL_DURATION,OFFICIAL_LOAD_TIMEOUT} from '../official-clips'
import type {OfficialClip} from '../official-clips'
import {validOutfitBody,type OutfitBodyBounds} from '../outfit-petting'
import './OfficialRamClip.css'

/** A mounted outfit reuses one isolated engine; the player has no save bridge. */
export default function OfficialRamClip({clip,form,bodyForm=form,color,action='idle',finite=false,registerBody=true,sound=false,volume=.45,paused=false,fallback,onEnd,onReady,onError,onBodyBounds}:{clip:OfficialClip;form:RamForm;bodyForm?:RamForm;color:PetColor;action?:string;finite?:boolean;registerBody?:boolean;sound?:boolean;volume?:number;paused?:boolean;fallback:ReactNode;onEnd?:(completed?:boolean)=>void;onReady?:()=>void;onError?:()=>void;onBodyBounds?:(body:OutfitBodyBounds)=>void}){
 const frame=useRef<HTMLIFrameElement>(null),mask=useRef<HTMLCanvasElement>(null),end=useRef(onEnd);end.current=onEnd
 const readyCallback=useRef(onReady),errorCallback=useRef(onError);readyCallback.current=onReady;errorCallback.current=onError;
 const bodyCallback=useRef(onBodyBounds);bodyCallback.current=onBodyBounds;
 const loadKey=`${clip.id}:${form}:${bodyForm}:${finite}:${registerBody}`
 const [loadState,setLoadState]=useState({key:'',state:'loading'}),[token]=useState(()=>Math.random().toString(36).slice(2))
 const state=loadState.key===loadKey?loadState.state:'loading'
 const sequence=useRef(0),requestLoad=useRef<()=>void>(()=>{})
 const direction=action.includes('left')?'left':action.includes('right')?'right':'down'
 const pose=useRef({form:officialTimelineForm(clip,form),direction,moving:action.includes('walk')||action.includes('running'),color:[...petColorOffsets(color)],sound,volume,paused})
 pose.current={form:officialTimelineForm(clip,form),direction,moving:action.includes('walk')||action.includes('running'),color:[...petColorOffsets(color)],sound,volume,paused}
 const [src]=useState(()=>(window.desktop?.isElectron?'ram-original://assets/':'./assets/original/official/')+`runtime.html?v=6&token=${token}`)
 const sendPose=()=>frame.current?.contentWindow?.postMessage({type:'ram-original-pose',token,sequence:sequence.current,value:pose.current},'*')
 useEffect(()=>{sendPose()},[color,direction,action,form,sound,volume,paused])
 useEffect(()=>{
  const current=++sequence.current
  let done=false,announced=false,finish:ReturnType<typeof setTimeout>|undefined
  setLoadState({key:loadKey,state:'loading'})
  const load=()=>frame.current?.contentWindow?.postMessage({type:'ram-original-load',token,sequence:current,value:{id:clip.id,form:officialTimelineForm(clip,form),loop:!finite,registerBody,referenceForm:OFFICIAL_FORM[bodyForm],pose:pose.current}},'*')
  requestLoad.current=load
  const fail=()=>{if(done)return;done=true;setLoadState({key:loadKey,state:'failed'});errorCallback.current?.();if(finite)end.current?.(false)}
  const watchdog=setTimeout(fail,OFFICIAL_LOAD_TIMEOUT)
  const receive=(event:MessageEvent)=>{
   if(event.data?.token!==token)return
   if(frame.current){frame.current.dataset.lastMessage=JSON.stringify({type:event.data.type,sequence:event.data.sequence,id:event.data.id,expectedSequence:current,expectedId:clip.id,sourceMatches:event.source===frame.current.contentWindow,sourceNull:event.source===null,value:event.data.type==='ram-original-error'||event.data.type==='ram-original-diagnostic'?event.data.value:undefined})}
   if(event.source!==frame.current?.contentWindow)return
   if(event.data.type==='ram-original-boot'){load();return}
   if(event.data.sequence!==current||event.data.id!==clip.id)return
   if(event.data.type==='ram-original-ready'){
    frame.current?.contentWindow?.postMessage({type:'ram-original-ack',token,sequence:current},'*')
    if(announced||done)return;announced=true
    clearTimeout(watchdog);setLoadState({key:loadKey,state:'ready'});sendPose();readyCallback.current?.()
    if(finite)finish=setTimeout(()=>{if(!done){done=true;end.current?.(true)}},OFFICIAL_DURATION)
   }
   if(event.data.type==='ram-original-error')fail()
   if(event.data.type==='ram-original-finished'&&finite&&!done){done=true;clearTimeout(finish);end.current?.(true)}
   if(event.data.type==='ram-original-state'&&frame.current){frame.current.dataset.frame=String(event.data.value.frame);frame.current.dataset.bones=JSON.stringify(event.data.value.bones);frame.current.dataset.registration=JSON.stringify(event.data.value.registration);if(validOutfitBody(event.data.value.body))bodyCallback.current?.(event.data.value.body)}
   if(event.data.type==='ram-original-mask'&&Array.isArray(event.data.value)&&event.data.value.length===10800){
    const ctx=mask.current?.getContext('2d');if(ctx){const image=ctx.createImageData(100,108);for(let i=0;i<10800;i++)image.data[i*4+3]=event.data.value[i];ctx.putImageData(image,0,0);mask.current!.dataset.loaded='true'}
   }
  }
  addEventListener('message',receive);load()
  return()=>{done=true;requestLoad.current=()=>{};clearTimeout(watchdog);clearTimeout(finish);removeEventListener('message',receive)}
 },[clip.id,form,finite,registerBody,token,loadKey])
 return <span className={`official-ram-clip is-${state}`} data-official-id={clip.id} data-source={clip.path} data-color={color} data-loaded={state==='ready'}>
  {state!=='ready'&&<span className="official-clip-fallback">{fallback}</span>}
  <iframe ref={frame} src={src} onLoad={()=>requestLoad.current()} title={clip.name} className="official-clip-player" aria-hidden="true" tabIndex={-1} allow="autoplay"/>
  {state==='ready'&&<canvas ref={mask} width={100} height={108} className="ram-classic-frame official-hit-mask" aria-hidden="true"/>}
 </span>
}
