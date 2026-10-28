import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {MAGIC_BOX_TIMELINE,magicBoxFrame,magicBoxImage,transformationTimeline} from '../magic-box';
import './SharedMagicBox.css';

let loading:Promise<void>|undefined;
export function preloadMagicBox(){
 return loading??=Promise.all((['box','smoke'] as const).flatMap(kind=>Array.from({length:kind==='box'?4:16},(_,index)=>new Promise<void>((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error('魔术素材加载失败'));image.src=magicBoxImage(kind,index);
 })))).then(()=>undefined).catch(error=>{loading=undefined;throw error});
}
export default function SharedMagicBox({children,startedAt,onEnd,target,targetDuration,prepare,label='烟雾变魔术盒，再恢复原形'}:{children:ReactNode;startedAt:number;onEnd?:()=>void;target?:ReactNode|((startedAt:number)=>ReactNode);targetDuration?:number;prepare?:Promise<void>;label?:string}){
 const timeline=useMemo(()=>targetDuration?transformationTimeline(targetDuration):MAGIC_BOX_TIMELINE,[targetDuration]),duration=timeline.reduce((sum,entry)=>sum+entry.ms,0);
 const [ready,setReady]=useState(false),[frame,setFrame]=useState(0),[playbackStart,setPlaybackStart]=useState(startedAt),end=useRef(onEnd);end.current=onEnd;
 useEffect(()=>{
  let live=true,request=0,finished=false;
  const done=()=>{if(!finished&&live){finished=true;end.current?.()}};
  const requestedAt=performance.now();let began=startedAt;
  const paint=(now:number)=>{if(!live)return;const elapsed=Math.max(0,now-began);setFrame(magicBoxFrame(elapsed,timeline));if(elapsed>=duration){done();return}request=requestAnimationFrame(paint)};
  void Promise.all([preloadMagicBox(),prepare]).then(()=>{if(!live)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){done();return}began=startedAt+performance.now()-requestedAt;setPlaybackStart(began);setReady(true);request=requestAnimationFrame(paint)}).catch(done);
  return()=>{live=false;cancelAnimationFrame(request)};
 },[startedAt,timeline,duration,prepare]);
 const entry=timeline[Math.min(frame,timeline.length-1)];
 return <span className="magic-box-performance" role="img" aria-label={label} data-ready={ready} data-magic-start={playbackStart} data-magic-frame={frame} data-magic-subject={ready?entry.subject:'original'}>
  <span className="magic-box-original" aria-hidden={ready&&entry.subject==='box'} style={{opacity:ready&&entry.subject==='box'?0:1}}>{children}</span>
  {ready&&entry.subject==='box'&&(typeof target==='function'?target(playbackStart):target??<img className="magic-box-layer" alt="" draggable={false} src={magicBoxImage('box',entry.box)}/>)}
  {ready&&entry.smoke!==null&&<img className="magic-box-layer magic-box-smoke" alt="" draggable={false} src={magicBoxImage('smoke',entry.smoke)}/>}
 </span>;
}
