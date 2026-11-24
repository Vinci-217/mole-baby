import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {MAGIC_BOX_TIMELINE,magicBoxImage,magicBoxRect,transformationTimeline} from '../magic-box';
import type {RamForm} from '../original-actions';
import {loadAnimationImage} from '../animation-image';
import {isPlaybackVisible,onPlaybackVisibilityChange} from '../playback-visibility';
import './SharedMagicBox.css';

let loading:Promise<void>|undefined;
export function preloadMagicBox(){
 return loading??=Promise.all((['box','smoke'] as const).flatMap(kind=>
  Array.from({length:kind==='box'?4:16},(_,index)=>loadAnimationImage(magicBoxImage(kind,index))),
 )).then(()=>undefined).catch(error=>{loading=undefined;throw error});
}
export default function SharedMagicBox({children,startedAt,form='super',onEnd,target,targetDuration,targetCompletion,prepare,onSubject,onTargetPlaying,label='烟雾变魔术盒，再恢复原形'}:{children:ReactNode;startedAt:number;form?:RamForm;onEnd?:(completed?:boolean)=>void;target?:ReactNode|((startedAt:number)=>ReactNode);targetDuration?:number;targetCompletion?:boolean|null;prepare?:Promise<unknown>;onSubject?:(subject:string)=>void;onTargetPlaying?:(playing:boolean)=>void;label?:string}){
 const timeline=useMemo(()=>targetDuration?transformationTimeline(targetDuration):MAGIC_BOX_TIMELINE,[targetDuration]);
 const [ready,setReady]=useState(false),[frame,setFrame]=useState(0),[playbackStart,setPlaybackStart]=useState(startedAt),end=useRef(onEnd);end.current=onEnd;
 const targetResult=useRef(targetCompletion);targetResult.current=targetCompletion;
 useEffect(()=>{
  let live=true,request=0,finished=false,loaded=false,position=0,elapsed=0,last:number|undefined;
  const done=(completed=true)=>{if(!finished&&live){finished=true;end.current?.(completed)}};
  const paint=(now:number)=>{
   if(!live||!isPlaybackVisible())return;
   const entry=timeline[position];
   const waitsForTarget=entry.subject==='box'&&entry.smoke===null&&targetResult.current!==undefined;
   if(last!==undefined)elapsed+=Math.min(now-last,entry.ms);
   last=now;
   if(waitsForTarget ? targetResult.current!==null : elapsed>=entry.ms){
    if(position===timeline.length-1){done(targetResult.current!==false);return;}
    elapsed=waitsForTarget?0:elapsed-entry.ms;position++;setFrame(position);
   }
   request=requestAnimationFrame(paint);
  };
  const resume=()=>{cancelAnimationFrame(request);last=undefined;if(loaded&&!finished&&isPlaybackVisible())request=requestAnimationFrame(paint)};
  const stopWatching=onPlaybackVisibilityChange(resume);
  void Promise.all([preloadMagicBox(),prepare]).then(()=>{
   if(!live)return;
   loaded=true;setPlaybackStart(performance.now());setReady(true);resume();
  }).catch(()=>done(false));
  return()=>{live=false;cancelAnimationFrame(request);stopWatching()};
 },[startedAt,timeline,prepare]);
 const entry=timeline[Math.min(frame,timeline.length-1)];
 const subject=ready?entry.subject:'original';
 const box=magicBoxRect(form);
 // A live SWF must mount to report readiness. A timed frame target only
 // mounts once its prepared atlas and the shared smoke have both loaded.
 const subjectNode=typeof target==='function'?(ready?target(playbackStart):null):target;
 const targetPlaying=subject==='box'&&entry.smoke===null;
 useEffect(()=>{onSubject?.(subject)},[subject,onSubject]);
 useEffect(()=>{onTargetPlaying?.(targetPlaying)},[targetPlaying,onTargetPlaying]);
 return <span className="magic-box-performance" role="img" aria-label={label} data-ready={ready} data-magic-start={playbackStart} data-magic-frame={frame} data-magic-subject={ready?entry.subject:'original'}>
  <span className="magic-box-original" aria-hidden={ready&&entry.subject==='box'} style={{opacity:ready&&entry.subject==='box'?0:1}}>{children}</span>
  {target?<span className="magic-box-target" aria-hidden={subject!=='box'} style={{opacity:subject==='box'?1:0}}>{subjectNode}</span>:ready&&entry.subject==='box'&&<img className="magic-box-layer magic-box-subject" alt="" draggable={false} src={magicBoxImage('box',entry.box)} style={{left:`${box.x}%`,top:`${box.y/108*100}%`,width:`${box.width}%`,height:'auto'}}/>}
  {ready&&entry.smoke!==null&&<img className="magic-box-layer magic-box-smoke" alt="" draggable={false} src={magicBoxImage('smoke',entry.smoke)}/>}
 </span>;
}
