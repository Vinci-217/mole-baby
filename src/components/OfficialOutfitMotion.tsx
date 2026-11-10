import {useEffect,useRef,type ReactNode} from 'react'
import type {Stage,Evolution} from '../game'
import {OFFICIAL_LOAD_TIMEOUT} from '../official-clips'
import {outfitPettingPose,OUTFIT_PETTING_DURATION,type OutfitBodyBounds} from '../outfit-petting'
import SocialCue from './SocialCue'
import {createPetSoundClock} from '../pet-audio'
import {socialSoundScore} from '../pet-sound-score'

type PlayerBinding={pose:string;onReady:()=>void;onError:()=>void;onBodyBounds:(body:OutfitBodyBounds)=>void};
/** Native costume art plus project-authored petting of that intact appearance.
  * Dragging carries the intact source using the shared elastic layer.
  * Football and other unsupported full actions never enter this adaptation. */
export default function OfficialOutfitMotion({sourceKey,action,actionId,startedAt,stage,evolution,tilt,sound=false,children,onEnd}:{sourceKey:string;action:string;actionId?:number|string;startedAt:number;stage:Stage;evolution?:Evolution;tilt:number;sound?:boolean;children:(binding:PlayerBinding)=>ReactNode;onEnd?:(completed?:boolean)=>void}){
 const root=useRef<HTMLSpanElement>(null),poseLayer=useRef<HTMLSpanElement>(null),end=useRef(onEnd);end.current=onEnd;
 const voice=useRef(sound);voice.current=sound;
 const source=useRef<{key:string;readyAt:number;body?:OutfitBodyBounds}>({key:sourceKey,readyAt:0});
 if(source.current.key!==sourceKey)source.current={key:sourceKey,readyAt:0};
 const failed=useRef<()=>void>(()=>{});
 useEffect(()=>{
  if(action!=='pet')return;
  let request=0,done=false,previous=0,body:OutfitBodyBounds|undefined;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const audio=createPetSoundClock(socialSoundScore('pet'),()=>voice.current);
  const finish=(completed:boolean)=>{if(done)return;done=true;cancelAnimationFrame(request);audio.stop();end.current?.(completed)};
  failed.current=()=>finish(false);
  const watchdog=setTimeout(()=>finish(false),OFFICIAL_LOAD_TIMEOUT+OUTFIT_PETTING_DURATION);
  const paint=(now:number)=>{
   if(done)return;
   const target=source.current.body,readyAt=source.current.readyAt,sprite=root.current?.closest<HTMLElement>('.ram-sprite');
   if(sprite&&target&&readyAt){
    const blend=1-Math.exp(-Math.min(50,Math.max(0,now-(previous||now)))/70);previous=now;
    if(!body)body={...target};else for(const key of ['x','y','width','height'] as const)body[key]+=(target[key]-body[key])*blend;
    const elapsed=Math.max(0,now-Math.max(startedAt,readyAt));
    if(!reduced.matches)audio.tick(elapsed);
    const p=outfitPettingPose(body,elapsed,stage,evolution,reduced.matches),motion=p.pose;
    const styles={opacity:String(motion.opacity),angle:`${motion.bodyAngle}deg`,lift:`${motion.bodyY}%`,x:`${motion.bodyX}%`,scaleX:String(motion.bodyScaleX),scaleY:String(motion.bodyScaleY),readTilt:'0deg',affection:String(motion.affection),heartY:`${motion.heartY}%`,hx:`${p.handX}%`,hy:`${p.handY}%`,handwidth:`${p.handWidth}%`};
    for(const [key,value] of Object.entries(styles))sprite.style.setProperty(`--social-${key}`,value);
    sprite.style.setProperty('--social-affection-x',`${p.heartX}%`);sprite.style.setProperty('--social-affection-y',`${p.heartY}%`);sprite.style.setProperty('--social-affection-size',`${p.heartSize}%`);
    if(poseLayer.current)poseLayer.current.style.transformOrigin=`${p.originX}% ${p.originY}%`;
    if(root.current)root.current.dataset.pettingBody=JSON.stringify(body);
    if(elapsed>=OUTFIT_PETTING_DURATION){finish(true);return;}
   }
   request=requestAnimationFrame(paint);
  };
  request=requestAnimationFrame(paint);
  return()=>{done=true;cancelAnimationFrame(request);clearTimeout(watchdog);audio.stop();failed.current=()=>{}};
 },[sourceKey,action,actionId,startedAt,stage,evolution]);
 return <><span ref={root} className="ram-artwork" data-petting-adaptation={action==='pet'?'project':undefined} data-drag-adaptation={action==='drag'?'project':undefined} style={{transform:`rotate(${tilt}deg)`}}><span className="ram-elastic-layer"><span ref={poseLayer} className="ram-pose-layer">{children({pose:action==='pet'||action==='drag'?'idle':action,onReady:()=>{source.current.readyAt=performance.now()},onError:()=>failed.current(),onBodyBounds:body=>{source.current.body=body}})}</span></span></span>{action==='pet'&&<SocialCue action="pet"/>}</>
}
