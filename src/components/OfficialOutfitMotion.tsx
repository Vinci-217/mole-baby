import {useEffect,useRef,type ReactNode} from 'react';
import type {Stage,Evolution} from '../game';
import {OFFICIAL_LOAD_TIMEOUT} from '../official-clips';
import type {OutfitBodyBounds} from '../outfit-petting';
import type {CostumeAction} from '../costume-action';
import {sampleCostumeMotion} from '../costume-motion';
import {createPetSoundClock} from '../pet-audio';
import {itemSoundScore,socialSoundScore} from '../pet-sound-score';
import {useOutfitDrag} from '../use-outfit-drag';
import {paintCareAction} from './CareAction';
import OutfitActionCue from './OutfitActionCue';

type PlayerBinding={pose:string;onReady:()=>void;onLoading:()=>void;onError:()=>void;onBodyBounds:(body:OutfitBodyBounds)=>void};
/** One mounted original costume engine, one cancellable gesture clock. All
 * missing actions are project adaptations of the complete source appearance. */
export default function OfficialOutfitMotion({sourceKey,spec,actionId,stage,evolution,referenceBody,tilt,sound=false,paused=false,children,onEnd}:{sourceKey:string;spec:CostumeAction;actionId?:number|string;stage:Stage;evolution?:Evolution;referenceBody:OutfitBodyBounds;tilt:number;sound?:boolean;paused?:boolean;children:(binding:PlayerBinding)=>ReactNode;onEnd?:(completed?:boolean)=>void}){
 const root=useRef<HTMLSpanElement>(null),poseLayer=useRef<HTMLSpanElement>(null),end=useRef(onEnd);end.current=onEnd;
 const dragPose=useOutfitDrag(root,spec.action==='drag');
 const voice=useRef(sound);voice.current=sound;
 const source=useRef<{key:string;ready:boolean;body?:OutfitBodyBounds}>({key:sourceKey,ready:false});
 if(source.current.key!==sourceKey)source.current={key:sourceKey,ready:false};
 const failed=useRef<()=>void>(()=>{}),playbackStart=useRef(performance.now()),playbackClock=useRef({elapsed:0});
 useEffect(()=>{
  if(paused)return;
  const sprite=root.current?.closest<HTMLElement>('.ram-sprite');if(!sprite)return;
  let request=0,done=false,previous=0,elapsed=0,body:OutfitBodyBounds|undefined,painted=false;
  playbackClock.current.elapsed=0;if(root.current)root.current.dataset.motionElapsed='0';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const audio=createPetSoundClock(spec.motion?itemSoundScore(spec.motion):socialSoundScore(spec.action),()=>voice.current);
  const finish=(completed:boolean)=>{if(done)return;done=true;cancelAnimationFrame(request);audio.stop();clearTimeout(watchdog);end.current?.(completed)};
  failed.current=()=>{if(spec.duration!==null)finish(false)};
  // Loading time never consumes the visible gesture. An unavailable engine
  // still releases finite actions instead of leaving interaction locked.
  const watchdog=setTimeout(()=>{if(!painted&&spec.duration!==null)finish(false)},OFFICIAL_LOAD_TIMEOUT);
  const paint=(now:number)=>{
   if(done||!root.current?.isConnected||document.hidden){previous=0;return;}
   if(source.current.ready){
    const target=source.current.body??referenceBody;
    const delta=previous?Math.max(0,now-previous):0;previous=now;
    if(!painted){painted=true;playbackStart.current=now;clearTimeout(watchdog);}
    elapsed+=delta;playbackClock.current.elapsed=elapsed;
    const blend=1-Math.exp(-Math.min(50,delta)/70);
    if(!body)body={...target};else for(const key of ['x','y','width','height'] as const)body[key]+=(target[key]-body[key])*blend;
    const p=sampleCostumeMotion(spec,body,elapsed,stage,evolution,reduced.matches);
    if(!reduced.matches)audio.tick(elapsed);
    const styles={opacity:p.opacity,angle:`${p.angle}deg`,lift:`${p.y}%`,x:`${p.x}%`,scaleX:p.scaleX,scaleY:p.scaleY,readTilt:'0deg',contact:p.contact,affection:p.affection,heartY:`${p.heartLift}%`,hx:`${p.handX}%`,hy:`${p.handY}%`,handwidth:`${p.handWidth}%`,bx:`${p.ballX}%`,by:`${p.ballY}%`,spin:`${p.ballAngle}deg`,bookx:`${p.bookX}%`,booky:`${p.bookY}%`,page:`${p.page}deg`,pageOpacity:p.pageOpacity,'affection-x':`${p.heartX}%`,'affection-y':`${p.heartY}%`,'affection-size':`${p.heartSize}%`};
    for(const [key,value] of Object.entries(styles))sprite.style.setProperty(`--social-${key}`,String(value));
    const extras={'ball-size':`${p.ballSize}%`,'book-size':`${p.bookSize}%`,'prop-x':`${p.propX}%`,'prop-y':`${p.propY}%`,'prop-size':`${p.propSize}%`,'prop-angle':`${p.propAngle}deg`,'toy-scale':p.toyScale,'spring-scale':p.springScale,ink:p.ink};
    for(const [key,value] of Object.entries(extras))sprite.style.setProperty(`--outfit-${key}`,String(value));
    for(const [key,value] of Object.entries({x:`${p.butterflyX}%`,y:`${p.butterflyY}%`,angle:`${p.butterflyAngle}deg`,wing:p.butterflyWing}))sprite.style.setProperty(`--butterfly-${key}`,String(value));
    for(const [key,value] of Object.entries({x:`${p.netX}%`,y:`${p.netY}%`,angle:`${p.netAngle}deg`,width:`${p.netWidth}%`}))sprite.style.setProperty(`--net-${key}`,value);
    sprite.querySelectorAll<HTMLElement>('.social-dizzy-stars>i').forEach((star,i)=>{const phase=elapsed/1250*Math.PI*2+i*Math.PI*2/3,depth=Math.sin(phase);star.style.left=`${body!.x+body!.width/2+Math.cos(phase)*body!.width*.58}%`;star.style.top=`${body!.y/108*100-5+depth*3}%`;star.style.opacity=String(.7+(depth+1)*.15);star.style.transform=`translate(-50%,-50%) scale(${.8+(depth+1)*.16})`;});
    if(poseLayer.current)poseLayer.current.style.transformOrigin=`${p.originX}% ${p.originY}%`;
    if(spec.motion)paintCareAction(sprite,spec.motion,elapsed,p.mouth,reduced.matches);
    root.current.dataset.motionElapsed=String(Math.round(elapsed));root.current.dataset.pettingBody=JSON.stringify(body);
    if(p.finished){finish(true);return;}
   }else previous=0;
   request=requestAnimationFrame(paint);
  };
  const resume=()=>{cancelAnimationFrame(request);previous=0;audio.stop();if(!document.hidden&&!done)request=requestAnimationFrame(paint)};
  request=requestAnimationFrame(paint);
  document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{done=true;cancelAnimationFrame(request);clearTimeout(watchdog);audio.stop();failed.current=()=>{};document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);for(const property of Array.from(sprite.style))if(['--social-','--outfit-','--care-','--tray-','--bottle-','--clean-','--net-','--butterfly-'].some(prefix=>property.startsWith(prefix)))sprite.style.removeProperty(property);};
 },[sourceKey,spec,actionId,stage,evolution,referenceBody,paused]);
 const nativePose=spec.action==='drag'?dragPose:spec.kind==='native'?spec.action:'idle';
 return <><span ref={root} className="ram-artwork" data-petting-adaptation={spec.action==='pet'?'project':undefined} data-drag-adaptation={spec.action==='drag'?'project':undefined} data-drag-pose={spec.action==='drag'?dragPose:undefined} data-costume-motion={spec.kind} style={{transform:`rotate(${tilt}deg)`}}><span className="ram-elastic-layer"><span ref={poseLayer} className="ram-pose-layer">{children({pose:nativePose,onReady:()=>{source.current.ready=true},onLoading:()=>{source.current.ready=false},onError:()=>{source.current.ready=false;failed.current()},onBodyBounds:body=>{source.current.body=body}})}</span></span></span><OutfitActionCue spec={spec} startedAt={playbackStart.current} stage={stage} sound={sound} clock={playbackClock}/></>;
}
