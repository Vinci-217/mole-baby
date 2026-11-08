import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {Stage,Evolution} from '../game'
import SocialCue,{paintSocialCue} from './SocialCue'
import {getRamActionDuration} from './ram-animation'
import {isSocialAction} from '../social-motion'

/** Keep source clothing and body together. Missing contact actions reuse the
 * desktop's gesture/elastic rig; no garment overlays or source frames change. */
export default function OfficialOutfitMotion({stage,evolution,form,action,actionId,startedAt,dragging,tilt,onEnd,children}:{stage:Stage;evolution?:Evolution;form:string;action:string;actionId?:number|string;startedAt:number;dragging:boolean;tilt:number;onEnd?:()=>void;children:(pose:string)=>ReactNode}){
 const root=useRef<HTMLSpanElement>(null),end=useRef(onEnd);end.current=onEnd
 const [direction,setDirection]=useState('idle')
 useEffect(()=>{
  const sprite=root.current?.closest<HTMLElement>('.ram-sprite');if(!sprite)return
  if(!dragging){setDirection('idle');return}
  const update=()=>{const view=parseFloat(sprite.style.getPropertyValue('--drag-view'))||0;setDirection(Math.abs(view)<.18?'idle':view<0?'walk-left':'walk-right')}
  sprite.addEventListener('ram-drag-motion',update);update()
  return()=>sprite.removeEventListener('ram-drag-motion',update)
 },[dragging])
 useEffect(()=>{
  let raf=0,finished=false;const started=startedAt,media=matchMedia('(prefers-reduced-motion: reduce)'),duration=getRamActionDuration(action,form)
  const paint=(now:number)=>{
   if(root.current)paintSocialCue(root.current,stage,action,now-started,media.matches,evolution)
   if(duration!==null&&now-started>=duration){if(!finished){finished=true;end.current?.()}return}
   raf=requestAnimationFrame(paint)
  }
  if(isSocialAction(action)||duration!==null)raf=requestAnimationFrame(paint)
  return()=>cancelAnimationFrame(raf)
 },[stage,evolution,form,action,actionId,startedAt])
 return <><span ref={root} className="ram-artwork" style={{transform:`rotate(${tilt}deg)`}}><span className="ram-elastic-layer"><span className="ram-pose-layer">{children(dragging?direction:action)}</span></span></span><SocialCue key={`${action}:${actionId??0}`} action={action}/></>
}
