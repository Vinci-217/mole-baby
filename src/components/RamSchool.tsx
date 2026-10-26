import {useEffect,useRef} from 'react'
import {createPetSoundClock} from '../pet-audio'
import type {SoundScore} from '../pet-sound-score'
import layouts from '../../public/assets/generated/school/runtime.json'
import './RamSchool.css'

export const SCHOOL_CLIPS:Record<string,{frames:number;fps:number;loop:boolean}>={
 'school-language':{frames:48,fps:24,loop:true},'school-english':{frames:48,fps:24,loop:true},'school-magic':{frames:48,fps:24,loop:true},
 restaurant:{frames:72,fps:24,loop:true},'skill-language':{frames:48,fps:24,loop:false},'skill-english':{frames:48,fps:24,loop:false},
 'skill-magic':{frames:72,fps:24,loop:false},'skill-wind':{frames:72,fps:24,loop:false},'skill-fire':{frames:72,fps:24,loop:false},'skill-ice':{frames:72,fps:24,loop:false},'skill-meteor':{frames:72,fps:24,loop:false},
}
export default function RamSchool({action,sound,startedAt,stage=1}:{action:string;sound:boolean;startedAt:number;stage?:number}){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const c=ref.current,ctx=c?.getContext('2d'),spec=SCHOOL_CLIPS[action],layout=layouts[action as keyof typeof layouts];if(!c||!ctx||!spec||!layout)return
  const [sw,sh]=layout.cell,[ox,oy]=layout.origin
  let stopped=false,request=0;const image=new Image(),reduced=matchMedia('(prefers-reduced-motion: reduce)')
  const score:SoundScore={cues:action==='restaurant'?[{at:650,kind:'cloth',strength:.2},{at:1850,kind:'sparkle',strength:.25}]:action.startsWith('school-')?[{at:800,kind:'page',strength:.25}]:[{at:500,kind:'magic',strength:.45},{at:1700,kind:'sparkle',strength:.3}]},audio=createPetSoundClock(score,sound)
  const paint=(now:number)=>{if(stopped||!c.isConnected)return;const t=Math.max(0,now-startedAt),frame=reduced.matches?Math.min(spec.frames-1,24):Math.min(spec.frames-1,Math.floor(t/1000*spec.fps)%(spec.loop?spec.frames:1e9));ctx.clearRect(0,0,256,256);ctx.drawImage(image,frame%8*sw,Math.floor(frame/8)*sh,sw,sh,ox,oy,sw,sh);c.dataset.loaded='true';c.dataset.frame=String(frame);audio.tick(t);if(!reduced.matches&&(spec.loop||t<spec.frames/spec.fps*1000))request=requestAnimationFrame(paint)}
  image.onload=()=>{if(!stopped)request=requestAnimationFrame(paint)};image.src=`./assets/generated/school/clips/${action}.png`
  return()=>{stopped=true;cancelAnimationFrame(request);audio.stop()}
 },[action,sound,startedAt])
 return <canvas ref={ref} width={256} height={256} className={`ram-school-cue ${stage===0?'school-seed':stage>=3?'school-flying':''}`} data-school-clip={action} aria-hidden="true"/>
}
